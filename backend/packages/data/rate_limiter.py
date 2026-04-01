"""
Rate limiter with token bucket and price prediction fallback.

Provides smart API rate limiting with automatic fallback to predicted prices
when rate limits are hit or API responses are slow.
"""

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class PriceData:
    """Holds historical price data for prediction."""
    symbol: str
    price: float
    timestamp: float
    is_predicted: bool = False
    confidence: float = 1.0


@dataclass
class RateLimitState:
    """Token bucket rate limiter state."""
    tokens: float = 8.0  # TwelveData free tier: 8 credits/min
    max_tokens: float = 8.0
    last_refill: float = field(default_factory=time.time)
    refill_rate: float = 8.0 / 60.0  # tokens per second
    
    def try_consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens. Returns True if successful."""
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
    
    def time_until_available(self, tokens: int = 1) -> float:
        """Return seconds until tokens will be available."""
        if self.tokens >= tokens:
            return 0.0
        needed = tokens - self.tokens
        return needed / self.refill_rate


class PricePredictor:
    """Simple linear regression price predictor for fallback."""
    
    def __init__(self, history_size: int = 20):
        self.history_size = history_size
        self._history: dict[str, deque[PriceData]] = {}
    
    def add_price(self, symbol: str, price: float, timestamp: float) -> None:
        """Add a real price observation."""
        if symbol not in self._history:
            self._history[symbol] = deque(maxlen=self.history_size)
        
        self._history[symbol].append(PriceData(
            symbol=symbol,
            price=price,
            timestamp=timestamp,
            is_predicted=False,
            confidence=1.0,
        ))
    
    def predict(self, symbol: str) -> Optional[PriceData]:
        """
        Predict the next price using linear regression.
        
        Returns None if insufficient history.
        """
        if symbol not in self._history or len(self._history[symbol]) < 3:
            return None
        
        history = list(self._history[symbol])
        n = len(history)
        
        # Extract timestamps and prices
        timestamps = np.array([p.timestamp for p in history])
        prices = np.array([p.price for p in history])
        
        # Normalize timestamps to avoid numerical issues
        t_min = timestamps[0]
        t_norm = timestamps - t_min
        
        # Linear regression: price = a * t + b
        try:
            # Use numpy for simple linear regression
            t_mean = np.mean(t_norm)
            p_mean = np.mean(prices)
            
            numerator = np.sum((t_norm - t_mean) * (prices - p_mean))
            denominator = np.sum((t_norm - t_mean) ** 2)
            
            if denominator == 0:
                # Flat price, return last known
                return PriceData(
                    symbol=symbol,
                    price=float(prices[-1]),
                    timestamp=time.time(),
                    is_predicted=True,
                    confidence=0.5,
                )
            
            slope = numerator / denominator
            intercept = p_mean - slope * t_mean
            
            # Predict for current time
            now = time.time()
            t_pred = now - t_min
            predicted_price = slope * t_pred + intercept
            
            # Calculate confidence based on R² and data recency
            predictions = slope * t_norm + intercept
            ss_res = np.sum((prices - predictions) ** 2)
            ss_tot = np.sum((prices - p_mean) ** 2)
            
            r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
            
            # Decay confidence based on time since last real data
            last_real_time = max(p.timestamp for p in history if not p.is_predicted)
            time_decay = max(0.5, 1.0 - (now - last_real_time) / 60.0)  # Decay over 1 min
            
            confidence = max(0.3, min(0.95, r_squared * time_decay))
            
            # Clamp predicted price to reasonable range
            price_std = np.std(prices)
            predicted_price = np.clip(
                predicted_price,
                p_mean - 3 * price_std,
                p_mean + 3 * price_std
            )
            
            return PriceData(
                symbol=symbol,
                price=float(max(0.01, predicted_price)),
                timestamp=now,
                is_predicted=True,
                confidence=float(confidence),
            )
            
        except Exception as e:
            logger.warning(f"Prediction failed for {symbol}: {e}")
            # Fallback to last known price
            return PriceData(
                symbol=symbol,
                price=float(history[-1].price),
                timestamp=time.time(),
                is_predicted=True,
                confidence=0.4,
            )
    
    def get_last_price(self, symbol: str) -> Optional[PriceData]:
        """Get the last known real price."""
        if symbol not in self._history or not self._history[symbol]:
            return None
        return self._history[symbol][-1]


class SmartRateLimiter:
    """
    Smart rate limiter with automatic fallback to predictions.
    
    Tracks API calls per minute and falls back to predicted prices
    when rate limits are hit or responses are delayed.
    """
    
    def __init__(
        self,
        max_requests_per_minute: int = 8,
        timeout_threshold: float = 2.0,
    ):
        self.rate_limit = RateLimitState(
            tokens=float(max_requests_per_minute),
            max_tokens=float(max_requests_per_minute),
        )
        self.timeout_threshold = timeout_threshold
        self.predictor = PricePredictor()
        self._lock = asyncio.Lock()
        self._in_cooldown = False
        self._cooldown_until: float = 0.0
    
    async def should_use_prediction(self, symbols_count: int = 1) -> bool:
        """Check if we should use prediction instead of API call."""
        async with self._lock:
            now = time.time()
            
            # Check cooldown from previous rate limit hit
            if self._in_cooldown and now < self._cooldown_until:
                return True
            elif self._in_cooldown:
                self._in_cooldown = False
            
            # Check token bucket
            return not self.rate_limit.try_consume(symbols_count)
    
    async def record_success(self, symbol: str, price: float) -> None:
        """Record a successful API response."""
        self.predictor.add_price(symbol, price, time.time())
    
    async def record_rate_limit_hit(self, retry_after: float = 60.0) -> None:
        """Record that we hit a rate limit."""
        async with self._lock:
            self._in_cooldown = True
            self._cooldown_until = time.time() + retry_after
            logger.warning(f"Rate limit hit, cooling down for {retry_after}s")
    
    async def record_timeout(self) -> None:
        """Record a slow/timeout response."""
        async with self._lock:
            # Brief cooldown on timeouts
            self._in_cooldown = True
            self._cooldown_until = time.time() + 5.0
    
    def get_prediction(self, symbol: str) -> Optional[dict]:
        """
        Get predicted price for a symbol.
        
        Returns dict with price, is_predicted flag, and confidence.
        """
        prediction = self.predictor.predict(symbol)
        if prediction is None:
            # Fall back to last known price
            last = self.predictor.get_last_price(symbol)
            if last:
                return {
                    "price": last.price,
                    "is_predicted": True,
                    "confidence": 0.5,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            return None
        
        return {
            "price": prediction.price,
            "is_predicted": True,
            "confidence": round(prediction.confidence, 2),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    def get_status(self) -> dict:
        """Get current rate limiter status."""
        return {
            "tokens_available": round(self.rate_limit.tokens, 2),
            "max_tokens": self.rate_limit.max_tokens,
            "in_cooldown": self._in_cooldown,
            "cooldown_remaining": max(0, self._cooldown_until - time.time()),
        }


# Global instance
_rate_limiter: Optional[SmartRateLimiter] = None


def get_rate_limiter() -> SmartRateLimiter:
    """Get or create the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = SmartRateLimiter()
    return _rate_limiter
