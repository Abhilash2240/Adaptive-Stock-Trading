import http from "k6/http";
import { Trend, Rate } from "k6/metrics";
import { check, sleep } from "k6";

const liveLatency = new Trend("live_health_latency", true);
const liveErrorRate = new Rate("live_health_errors");

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<750"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const baseUrl = __ENV.K6_TARGET || "http://localhost:8080";
  const response = http.get(`${baseUrl}/health/live`, {
    timeout: "10s",
  });

  check(response, {
    "status is 200": (r) => r.status === 200,
    "responds within budget": (r) => r.timings.duration < 750,
  });

  liveLatency.add(response.timings.duration);
  if (response.status !== 200) {
    liveErrorRate.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    "reports/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
