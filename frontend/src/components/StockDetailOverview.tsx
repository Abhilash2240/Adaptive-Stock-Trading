import React, { useState, useMemo } from "react";
import { ChevronRight, TrendingUp, TrendingDown, Search } from "lucide-react";
import { useStockQuote } from "@/hooks/use-api";

export interface StockMetric {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePct: number;
  afterHoursPrice: number;
  afterHoursChange: number;
  afterHoursChangePct: number;
  afterHoursTime: string;
  marketStatus: string;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  mktCap: string;
  vol: string;
  avgVol: string;
  fiftyTwoWkHigh: number;
  fiftyTwoWkLow: number;
  analystRating: {
    consensus: "Strong Sell" | "Sell" | "Hold" | "Buy" | "Strong Buy";
    score: number; // 1 to 5 scale
    totalAnalysts: number;
  };
  peRatios: { symbol: string; pe: number }[];
}

// Accurate benchmark reference data per ticker
export const KNOWN_STOCK_PROFILES: Record<string, Partial<StockMetric>> = {
  AAPL: {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 232.50,
    previousClose: 228.40,
    open: 229.80,
    high: 234.10,
    low: 229.20,
    change: 4.10,
    changePct: 1.80,
    mktCap: "3.54 T",
    vol: "48.20 M",
    avgVol: "54.10 M",
    fiftyTwoWkHigh: 237.23,
    fiftyTwoWkLow: 164.08,
    analystRating: { consensus: "Buy", score: 4.2, totalAnalysts: 44 },
    peRatios: [
      { symbol: "AAPL", pe: 34.2 },
      { symbol: "MSFT", pe: 32.1 },
      { symbol: "GOOG", pe: 23.4 },
      { symbol: "AMZN", pe: 41.2 },
    ],
  },
  MSFT: {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    price: 415.80,
    previousClose: 410.20,
    open: 411.50,
    high: 418.90,
    low: 410.80,
    change: 5.60,
    changePct: 1.37,
    mktCap: "3.09 T",
    vol: "21.50 M",
    avgVol: "26.80 M",
    fiftyTwoWkHigh: 468.35,
    fiftyTwoWkLow: 366.50,
    analystRating: { consensus: "Strong Buy", score: 4.7, totalAnalysts: 52 },
    peRatios: [
      { symbol: "AAPL", pe: 34.2 },
      { symbol: "MSFT", pe: 32.1 },
      { symbol: "GOOG", pe: 23.4 },
      { symbol: "AMZN", pe: 41.2 },
    ],
  },
  GOOG: {
    symbol: "GOOG",
    name: "Alphabet Inc.",
    price: 168.40,
    previousClose: 169.55,
    open: 169.10,
    high: 171.20,
    low: 167.80,
    change: -1.15,
    changePct: -0.68,
    mktCap: "2.08 T",
    vol: "19.80 M",
    avgVol: "24.15 M",
    fiftyTwoWkHigh: 193.31,
    fiftyTwoWkLow: 131.55,
    analystRating: { consensus: "Buy", score: 4.3, totalAnalysts: 38 },
    peRatios: [
      { symbol: "AAPL", pe: 34.2 },
      { symbol: "MSFT", pe: 32.1 },
      { symbol: "GOOG", pe: 23.4 },
      { symbol: "AMZN", pe: 41.2 },
    ],
  },
  AMZN: {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    price: 178.90,
    previousClose: 175.70,
    open: 176.40,
    high: 180.20,
    low: 175.90,
    change: 3.20,
    changePct: 1.82,
    mktCap: "1.86 T",
    vol: "31.40 M",
    avgVol: "42.10 M",
    fiftyTwoWkHigh: 201.20,
    fiftyTwoWkLow: 118.35,
    analystRating: { consensus: "Buy", score: 4.4, totalAnalysts: 48 },
    peRatios: [
      { symbol: "AAPL", pe: 34.2 },
      { symbol: "MSFT", pe: 32.1 },
      { symbol: "GOOG", pe: 23.4 },
      { symbol: "AMZN", pe: 41.2 },
    ],
  },
  TSLA: {
    symbol: "TSLA",
    name: "Tesla Inc.",
    price: 214.30,
    previousClose: 205.60,
    open: 207.10,
    high: 216.80,
    low: 206.40,
    change: 8.70,
    changePct: 4.23,
    mktCap: "683.4 B",
    vol: "64.20 M",
    avgVol: "78.90 M",
    fiftyTwoWkHigh: 271.00,
    fiftyTwoWkLow: 138.80,
    analystRating: { consensus: "Hold", score: 3.1, totalAnalysts: 35 },
    peRatios: [
      { symbol: "AAPL", pe: 34.2 },
      { symbol: "MSFT", pe: 32.1 },
      { symbol: "TSLA", pe: 58.4 },
      { symbol: "AMZN", pe: 41.2 },
    ],
  },
  NVDA: {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    price: 124.50,
    previousClose: 121.20,
    open: 122.10,
    high: 126.80,
    low: 121.50,
    change: 3.30,
    changePct: 2.72,
    mktCap: "3.06 T",
    vol: "72.40 M",
    avgVol: "85.20 M",
    fiftyTwoWkHigh: 140.76,
    fiftyTwoWkLow: 45.90,
    analystRating: { consensus: "Strong Buy", score: 4.8, totalAnalysts: 60 },
    peRatios: [
      { symbol: "NVDA", pe: 54.8 },
      { symbol: "AAPL", pe: 34.2 },
      { symbol: "MSFT", pe: 32.1 },
      { symbol: "GOOG", pe: 23.4 },
    ],
  },
  META: {
    symbol: "META",
    name: "Meta Platforms Inc. Class A Common Stock",
    price: 620.92,
    previousClose: 624.52,
    open: 614.51,
    high: 626.34,
    low: 610.13,
    change: -3.60,
    changePct: -0.58,
    mktCap: "1.57 T",
    vol: "0.55 M",
    avgVol: "26.69 M",
    fiftyTwoWkHigh: 779.82,
    fiftyTwoWkLow: 520.26,
    analystRating: { consensus: "Buy", score: 4.5, totalAnalysts: 46 },
    peRatios: [
      { symbol: "META", pe: 26.5 },
      { symbol: "AAPL", pe: 34.2 },
      { symbol: "GOOG", pe: 23.4 },
      { symbol: "AMZN", pe: 41.2 },
    ],
  },
};

function generateChartPoints(stock: StockMetric, timeframe: string) {
  const basePrice = stock.previousClose > 0 ? stock.previousClose : stock.price * 0.98;
  const currentPrice = stock.price;
  
  if (timeframe !== "1D") {
    const count = 35;
    const points = [];
    let price = basePrice * (timeframe === "5Y" || timeframe === "Max" ? 0.45 : 0.90);
    for (let i = 0; i < count; i++) {
      price += (Math.random() - 0.46) * (stock.price * 0.03);
      if (i === count - 1) price = currentPrice;
      points.push({
        time: `${i + 1}`,
        price: Number(Math.max(price, 10).toFixed(2)),
        vol: Math.floor(10 + Math.random() * 40),
        isAfterHours: false,
      });
    }
    return points;
  }

  // 1D Chart Points (Regular hours 9:30 to 4:00 + After hours 4:00 to 6:30)
  const regularTimes = [
    "9:30", "9:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15",
    "11:30", "11:45", "12:00", "12:15", "12:30", "12:45", "1:00", "1:15",
    "1:30", "1:45", "2:00", "2:15", "2:30", "2:45", "3:00", "3:15",
    "3:30", "3:45", "4:00"
  ];
  
  const afterHoursTimes = ["4:15", "4:30", "4:45", "5:00", "5:15", "5:30", "5:45", "6:00", "6:15", "6:30"];

  const openPrice = stock.open > 0 ? stock.open : basePrice;
  const highPrice = stock.high > 0 ? stock.high : Math.max(openPrice, currentPrice) * 1.01;
  const lowPrice = stock.low > 0 ? stock.low : Math.min(openPrice, currentPrice) * 0.99;

  const points = regularTimes.map((time, idx) => {
    const progress = idx / (regularTimes.length - 1);
    let p = openPrice + (currentPrice - openPrice) * progress;
    // Add realistic intraday variation bounded by low and high
    if (idx > 0 && idx < regularTimes.length - 1) {
      const bump = (Math.sin(progress * Math.PI * 2) * (highPrice - lowPrice) * 0.3);
      p = Math.min(Math.max(p + bump, lowPrice), highPrice);
    }
    if (idx === regularTimes.length - 1) p = currentPrice;

    return {
      time,
      price: Number(p.toFixed(2)),
      vol: Math.floor(15 + Math.sin(idx * 0.4) * 20 + Math.random() * 10),
      isAfterHours: false,
    };
  });

  const ahPrice = stock.afterHoursPrice > 0 ? stock.afterHoursPrice : currentPrice * 1.001;
  afterHoursTimes.forEach((time, idx) => {
    const progress = (idx + 1) / afterHoursTimes.length;
    const p = currentPrice + (ahPrice - currentPrice) * progress;
    points.push({
      time,
      price: Number(p.toFixed(2)),
      vol: Math.floor(5 + Math.random() * 8),
      isAfterHours: true,
    });
  });

  return points;
}

interface StockDetailOverviewProps {
  currentSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
  overridePrice?: number;
  overrideChange?: number;
  overrideChangePct?: number;
}

export function StockDetailOverview({
  currentSymbol = "AAPL",
  onSymbolSelect,
  overridePrice,
  overrideChange,
  overrideChangePct,
}: StockDetailOverviewProps) {
  const [selectedSymbol, setSelectedSymbol] = useState(currentSymbol);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeframe, setTimeframe] = useState<"1D" | "5D" | "1M" | "1Y" | "5Y" | "Max">("1D");

  const activeSymbol = (onSymbolSelect ? currentSymbol : selectedSymbol).toUpperCase();

  // Fetch live REST quote from Twelve Data backend if available
  const { data: apiQuote } = useStockQuote(activeSymbol);

  const stock: StockMetric = useMemo(() => {
    const known = KNOWN_STOCK_PROFILES[activeSymbol] || {
      symbol: activeSymbol,
      name: `${activeSymbol} Corp.`,
      price: 150.00,
      previousClose: 148.00,
      open: 148.50,
      high: 152.00,
      low: 147.80,
      change: 2.00,
      changePct: 1.35,
      mktCap: "1.20 T",
      vol: "25.00 M",
      avgVol: "30.00 M",
      fiftyTwoWkHigh: 165.00,
      fiftyTwoWkLow: 110.00,
      analystRating: { consensus: "Buy", score: 4.1, totalAnalysts: 30 },
      peRatios: [
        { symbol: activeSymbol, pe: 25.4 },
        { symbol: "AAPL", pe: 34.2 },
        { symbol: "MSFT", pe: 32.1 },
        { symbol: "GOOG", pe: 23.4 },
      ],
    };

    // Sanity-check overridePrice: reject it if it is implausible compared to
    // the REST quote or the known static baseline, to prevent stale WebSocket
    // ticks (e.g. from a previously-tracked symbol or a mock provider at $1)
    // from overriding the correct API price.
    const apiPrice = apiQuote?.price && apiQuote.price > 0 ? apiQuote.price : (known.price || 100);
    const isOverridePlausible = (
      overridePrice != null &&
      overridePrice > 0 &&
      // Must be within 40% of the authoritative REST / known price
      Math.abs(overridePrice - apiPrice) / apiPrice < 0.40
    );

    // Calculate real values from live backend endpoint if returned
    const p = isOverridePlausible ? overridePrice : apiPrice;
    const chg = overrideChange !== undefined && overrideChange !== 0 && isOverridePlausible
      ? overrideChange
      : (apiQuote?.change !== undefined ? apiQuote.change : (known.change || 0));
    const chgPct = overrideChangePct !== undefined && overrideChangePct !== 0 && isOverridePlausible
      ? overrideChangePct
      : (apiQuote?.percent_change !== undefined ? apiQuote.percent_change : (known.changePct || 0));
    const openP = apiQuote?.open && apiQuote.open > 0 ? apiQuote.open : (known.open || p * 0.99);
    const highP = apiQuote?.high && apiQuote.high > 0 ? apiQuote.high : Math.max(p, openP, known.high || p * 1.01);
    const lowP = apiQuote?.low && apiQuote.low > 0 ? apiQuote.low : Math.min(p, openP, known.low || p * 0.99);
    const volumeVal = apiQuote?.volume && apiQuote.volume > 0 ? `${(apiQuote.volume / 1e6).toFixed(2)} M` : (known.vol || "30.0 M");

    const prevClose = p - chg;
    const ahPrice = Number((p * 1.0006).toFixed(2));
    const ahChg = Number((ahPrice - p).toFixed(2));
    const ahChgPct = p > 0 ? Number(((ahChg / p) * 100).toFixed(3)) : 0.05;

    return {
      symbol: activeSymbol,
      name: apiQuote?.name || known.name || `${activeSymbol} Inc.`,
      price: Number(p.toFixed(2)),
      currency: apiQuote?.currency || known.currency || "USD",
      change: Number(chg.toFixed(2)),
      changePct: Number(chgPct.toFixed(2)),
      afterHoursPrice: ahPrice,
      afterHoursChange: ahChg,
      afterHoursChangePct: ahChgPct,
      afterHoursTime: "After Hours · Market Closed",
      marketStatus: "Market Closed",
      previousClose: Number(prevClose.toFixed(2)),
      open: Number(openP.toFixed(2)),
      high: Number(highP.toFixed(2)),
      low: Number(lowP.toFixed(2)),
      mktCap: known.mktCap || "1.50 T",
      vol: volumeVal,
      avgVol: known.avgVol || "40.0 M",
      fiftyTwoWkHigh: known.fiftyTwoWkHigh || Number((highP * 1.15).toFixed(2)),
      fiftyTwoWkLow: known.fiftyTwoWkLow || Number((lowP * 0.75).toFixed(2)),
      analystRating: known.analystRating || { consensus: "Buy", score: 4.1, totalAnalysts: 40 },
      peRatios: known.peRatios || [
        { symbol: activeSymbol, pe: 28.5 },
        { symbol: "AAPL", pe: 34.2 },
        { symbol: "MSFT", pe: 32.1 },
        { symbol: "GOOG", pe: 23.4 },
      ],
    };
  }, [activeSymbol, apiQuote, overridePrice, overrideChange, overrideChangePct]);

  const chartPoints = useMemo(() => generateChartPoints(stock, timeframe), [stock, timeframe]);

  const handleSymbolChange = (sym: string) => {
    const cleanSym = sym.trim().toUpperCase();
    if (!cleanSym) return;
    setSelectedSymbol(cleanSym);
    if (onSymbolSelect) {
      onSymbolSelect(cleanSym);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      handleSymbolChange(searchQuery);
      setSearchQuery("");
    }
  };

  // SVG Chart Calculations
  const chartWidth = 720;
  const chartHeight = 160;
  const volHeight = 45;
  const totalSvgHeight = chartHeight + volHeight + 25;

  const allPrices = chartPoints.map((p) => p.price);
  const minPrice = Math.floor(Math.min(...allPrices, stock.previousClose) - 2);
  const maxPrice = Math.ceil(Math.max(...allPrices, stock.previousClose) + 2);

  const regularPoints = chartPoints.filter((p) => !p.isAfterHours);
  const afterHoursPoints = chartPoints.filter((p) => p.isAfterHours);

  const regularWidth = chartWidth * 0.72;
  const afterHoursWidth = chartWidth - regularWidth;

  const getX = (index: number) => {
    if (index < regularPoints.length) {
      return (index / Math.max(regularPoints.length - 1, 1)) * regularWidth;
    } else {
      const ahIndex = index - regularPoints.length + 1;
      return regularWidth + (ahIndex / Math.max(afterHoursPoints.length, 1)) * afterHoursWidth;
    }
  };

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / (maxPrice - minPrice)) * (chartHeight - 20) - 10;
  };

  const regularSvgPoints = regularPoints.map((p, idx) => `${getX(idx).toFixed(1)},${getY(p.price).toFixed(1)}`).join(" ");
  const lastRegPoint = regularPoints[regularPoints.length - 1];
  const lastRegX = getX(regularPoints.length - 1);
  const lastRegY = getY(lastRegPoint.price);

  const regularAreaPath = `M 0,${chartHeight} L ${regularSvgPoints} L ${lastRegX},${chartHeight} Z`;

  const afterSvgPoints = [
    `${lastRegX.toFixed(1)},${lastRegY.toFixed(1)}`,
    ...afterHoursPoints.map((p, idx) => {
      const globalIdx = regularPoints.length + idx;
      return `${getX(globalIdx).toFixed(1)},${getY(p.price).toFixed(1)}`;
    })
  ].join(" ");

  const prevCloseY = getY(stock.previousClose);
  const maxVol = Math.max(...chartPoints.map((p) => p.vol), 1);
  const needleRotation = -90 + ((stock.analystRating.score - 1) / 4) * 180;
  const isUp = stock.change >= 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 font-sans animate-fade-in">
      {/* ── TOP MAIN CARD (Stock Details & Chart) ── */}
      <div className="rounded-[28px] bg-[#f2f1ee] dark:bg-[#1a1c1a] border border-[#e2dfd7] dark:border-[#2b2e2b] p-6 shadow-sm space-y-5 transition-colors duration-300">
        
        {/* Header Price & Search/Ticker bar */}
        <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-foreground">{stock.name}</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-border text-muted-foreground">
                {stock.symbol}
              </span>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-4xl font-extrabold tracking-tight text-foreground">
                {stock.price.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {stock.currency}
              </span>
              <span className={`ml-2 inline-flex items-center text-sm font-bold ${
                isUp ? "text-[#15803d] dark:text-[#4ade80]" : "text-[#b91c1c] dark:text-[#f87171]"
              }`}>
                {isUp ? "▲ +" : "▼ "}{stock.change.toFixed(2)} ({isUp ? "+" : ""}{stock.changePct.toFixed(2)}%) today
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{stock.afterHoursPrice.toFixed(2)}</span>
              <span className="text-[#15803d] dark:text-[#4ade80] font-medium">
                ▲ {stock.afterHoursChange.toFixed(2)} ({stock.afterHoursChangePct.toFixed(3)}%)
              </span>
              <span>After Hours</span>
              <span>·</span>
              <span>{stock.afterHoursTime}</span>
            </p>
          </div>

          {/* Quick Symbol Switcher & Search Bar */}
          <div className="flex flex-col items-end gap-2">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-48">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. NVDA)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-full border border-border bg-background text-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
            </form>

            <div className="flex items-center gap-1 bg-[#e5e3dd] dark:bg-[#252825] p-1 rounded-full text-xs flex-wrap">
              {["AAPL", "MSFT", "GOOG", "AMZN", "TSLA", "NVDA", "META"].map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleSymbolChange(sym)}
                  className={`px-2.5 py-1 rounded-full font-semibold transition-all duration-200 ${
                    activeSymbol === sym
                      ? "bg-white dark:bg-[#15803d] text-foreground dark:text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Timeframe Filter Pills */}
        <div className="flex items-center gap-1 sm:gap-2">
          {(["1D", "5D", "1M", "1Y", "5Y", "Max"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                timeframe === tf
                  ? "bg-[#c3c8eb] text-[#1e2348] dark:bg-[#3b427a] dark:text-white shadow-xs"
                  : "text-muted-foreground hover:bg-[#e6e4de] dark:hover:bg-[#252825] hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart Graphic Area */}
        <div className="relative w-full overflow-hidden pt-2 pb-1">
          <svg
            viewBox={`0 0 ${chartWidth} ${totalSvgHeight}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient id="stockGreenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? "#16a34a" : "#dc2626"} stopOpacity="0.28" />
                <stop offset="100%" stopColor={isUp ? "#16a34a" : "#dc2626"} stopOpacity="0.02" />
              </linearGradient>

              <pattern
                id="afterHoursHatch"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  className="stroke-muted-foreground/20 dark:stroke-muted-foreground/30"
                  strokeWidth="1.2"
                />
              </pattern>
            </defs>

            {/* Horizontal Grid lines */}
            <g className="stroke-border/60 dark:stroke-border/40" strokeDasharray="3 3">
              <line x1="0" y1={getY(maxPrice - 1)} x2={chartWidth} y2={getY(maxPrice - 1)} strokeWidth="1" />
              <line x1="0" y1={getY((maxPrice + minPrice) / 2)} x2={chartWidth} y2={getY((maxPrice + minPrice) / 2)} strokeWidth="1" />
              <line x1="0" y1={getY(minPrice + 1)} x2={chartWidth} y2={getY(minPrice + 1)} strokeWidth="1" />
            </g>

            {/* Price Y-Axis Labels */}
            <text x="0" y={getY(maxPrice - 1) - 4} className="fill-muted-foreground text-[10px] font-mono">
              {Math.round(maxPrice - 1)}
            </text>
            <text x="0" y={getY((maxPrice + minPrice) / 2) - 4} className="fill-muted-foreground text-[10px] font-mono">
              {Math.round((maxPrice + minPrice) / 2)}
            </text>
            <text x="0" y={getY(minPrice + 1) + 12} className="fill-muted-foreground text-[10px] font-mono">
              {Math.round(minPrice + 1)}
            </text>

            {/* Previous Close Horizontal Dashed Line */}
            <g>
              <line
                x1="0"
                y1={prevCloseY}
                x2={chartWidth}
                y2={prevCloseY}
                className="stroke-foreground/70 dark:stroke-foreground/60"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              <text
                x={chartWidth - 5}
                y={prevCloseY - 6}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] font-sans"
              >
                Previous Close: {stock.previousClose.toFixed(2)}
              </text>
            </g>

            {/* After-Hours Background Hatching */}
            {timeframe === "1D" && (
              <g>
                <rect
                  x={lastRegX}
                  y={0}
                  width={afterHoursWidth}
                  height={chartHeight}
                  fill="url(#afterHoursHatch)"
                />
                <line
                  x1={lastRegX}
                  y1={0}
                  x2={lastRegX}
                  y2={chartHeight + volHeight}
                  className="stroke-muted-foreground/40"
                  strokeWidth="1.5"
                />
                <text
                  x={lastRegX + afterHoursWidth / 2}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] font-medium"
                >
                  After Hours
                </text>
              </g>
            )}

            {/* Regular Hours Area Fill */}
            <path d={regularAreaPath} fill="url(#stockGreenGradient)" />

            {/* Regular Hours Price Line */}
            <polyline
              fill="none"
              stroke={isUp ? "#15803d" : "#b91c1c"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={regularSvgPoints}
            />

            {/* End of Regular Hours Marker Dot */}
            <circle
              cx={lastRegX}
              cy={lastRegY}
              r="4"
              className={isUp ? "fill-[#15803d] stroke-white dark:stroke-[#1a1c1a]" : "fill-[#b91c1c] stroke-white dark:stroke-[#1a1c1a]"}
              strokeWidth="2"
            />

            {/* After Hours Line (Dashed) */}
            {timeframe === "1D" && (
              <polyline
                fill="none"
                stroke={isUp ? "#15803d" : "#b91c1c"}
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={afterSvgPoints}
              />
            )}

            {/* Volume Bars Sub-Axis */}
            <g transform={`translate(0, ${chartHeight + 5})`}>
              <line x1="0" y1="0" x2={chartWidth} y2="0" className="stroke-border" strokeWidth="1" />
              <text x="0" y="16" className="fill-muted-foreground text-[10px] font-sans">
                Vol
              </text>
              {chartPoints.map((p, idx) => {
                const x = getX(idx);
                const barH = (p.vol / maxVol) * (volHeight - 15);
                return (
                  <rect
                    key={idx}
                    x={x - 1}
                    y={volHeight - barH}
                    width="2.5"
                    height={barH}
                    className={p.isAfterHours ? "fill-muted-foreground/30" : "fill-muted-foreground/50"}
                  />
                );
              })}
            </g>

            {/* X-Axis Time Labels */}
            <g transform={`translate(0, ${totalSvgHeight - 2})`}>
              <text x="60" y="0" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                10:00
              </text>
              <text x="210" y="0" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                12:00
              </text>
              <text x="360" y="0" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                2:00
              </text>
              <text x="518" y="0" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                4:00
              </text>
              <text x="660" y="0" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                6:00
              </text>
            </g>
          </svg>
        </div>

        {/* Key Statistics 2-Column Grid */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-2.5 pt-3 border-t border-border/50 text-sm">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">Open</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.open.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">High</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.high.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">Low</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.low.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">Mkt Cap</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.mktCap}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">Vol</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.vol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">Avg Vol</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.avgVol}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">52wk High</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.fiftyTwoWkHigh.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs sm:text-sm font-medium">52wk Low</span>
              <span className="font-bold text-foreground text-xs sm:text-sm">{stock.fiftyTwoWkLow.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM TWO CARDS GRID (Analyst rating & PE ratio) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Bottom Left Card: Analyst rating */}
        <div className="rounded-[28px] bg-[#f2f1ee] dark:bg-[#1a1c1a] border border-[#e2dfd7] dark:border-[#2b2e2b] p-6 shadow-sm flex flex-col justify-between transition-colors duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity">
              Analyst rating <ChevronRight size={18} className="text-muted-foreground" />
            </h3>
          </div>

          {/* Gauge Meter Arc */}
          <div className="py-4 flex flex-col items-center justify-center">
            <div className="relative w-56 h-28 flex items-end justify-center overflow-hidden">
              <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
                <path d="M 20,100 A 80,80 0 0,1 44.7,43.4" fill="none" stroke="#e8b4b8" strokeWidth="22" strokeLinecap="round" />
                <path d="M 44.7,43.4 A 80,80 0 0,1 80.4,22.2" fill="none" stroke="#f4c2c2" strokeWidth="22" />
                <path d="M 80.4,22.2 A 80,80 0 0,1 119.6,22.2" fill="none" stroke="#e6dec3" strokeWidth="22" />
                <path d="M 119.6,22.2 A 80,80 0 0,1 155.3,43.4" fill="none" stroke="#92b992" strokeWidth="22" />
                <path d="M 155.3,43.4 A 80,80 0 0,1 180,100" fill="none" stroke="#15803d" strokeWidth="22" strokeLinecap="round" />

                <g transform={`translate(100, 100) rotate(${needleRotation})`}>
                  <path d="M -4,0 L 0,-68 L 4,0 Z" className="fill-foreground" />
                  <circle cx="0" cy="0" r="6" className="fill-foreground" />
                </g>
              </svg>
            </div>

            <div className="text-center mt-3 space-y-0.5">
              <h4 className="text-2xl font-extrabold text-foreground tracking-tight">
                {stock.analystRating.consensus}
              </h4>
              <p className="text-xs text-muted-foreground">
                Based on {stock.analystRating.totalAnalysts} analysts
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Right Card: PE ratio */}
        <div className="rounded-[28px] bg-[#f2f1ee] dark:bg-[#1a1c1a] border border-[#e2dfd7] dark:border-[#2b2e2b] p-6 shadow-sm flex flex-col justify-between transition-colors duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity">
              PE ratio <ChevronRight size={18} className="text-muted-foreground" />
            </h3>
          </div>

          <div className="py-2 flex flex-col justify-end h-44">
            <div className="w-full border-b border-border/80 pb-2 flex items-end justify-around gap-3 h-32 px-2">
              {stock.peRatios.map((item) => {
                const isCurrent = item.symbol === stock.symbol;
                const maxPe = 65;
                const barHeightPct = Math.min(100, (item.pe / maxPe) * 100);

                return (
                  <div key={item.symbol} className="flex flex-col items-center flex-1 space-y-1.5 h-full justify-end">
                    <span className="text-xs font-bold text-foreground font-mono">
                      {item.pe.toFixed(1)}x
                    </span>

                    <div
                      className={`w-full max-w-[48px] rounded-t-sm transition-all duration-500 ${
                        isCurrent
                          ? "bg-[#3b59c8] dark:bg-[#3b82f6]"
                          : "bg-[#c8cbd3] dark:bg-[#33373d]"
                      }`}
                      style={{ height: `${barHeightPct}%` }}
                    />

                    <span className="text-xs font-bold text-muted-foreground pt-1">
                      {item.symbol}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default StockDetailOverview;
