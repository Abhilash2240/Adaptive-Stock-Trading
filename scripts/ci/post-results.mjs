import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

function formatPercentage(value) {
	if (typeof value !== "number") {
		return "n/a";
	}
	return `${Math.round(value * 100)}%`;
}

function collectLighthouse() {
	const dir = "reports/lighthouse";
	if (!existsSync(dir)) {
		return null;
	}

	const reportFile = readdirSync(dir).find((file) => file.endsWith(".report.json"));
	if (!reportFile) {
		return null;
	}

	const raw = JSON.parse(readFileSync(join(dir, reportFile), "utf8"));
	const categories = raw.categories ?? raw.lighthouseResult?.categories;
	if (!categories) {
		return null;
	}

	return {
		performance: formatPercentage(categories.performance?.score),
		accessibility: formatPercentage(categories.accessibility?.score),
		bestPractices: formatPercentage(categories["best-practices"]?.score ?? categories.best_practices?.score),
		seo: formatPercentage(categories.seo?.score),
	};
}

function collectK6() {
	const file = "reports/k6-summary.json";
	if (!existsSync(file)) {
		return null;
	}

	const raw = JSON.parse(readFileSync(file, "utf8"));
	const metrics = raw.metrics ?? {};

	const httpFailed = metrics.http_req_failed?.rate ?? null;
	const httpLatency = metrics.http_req_duration?.percentiles?.["95"] ?? null;
	const liveLatency = metrics.live_health_latency?.percentiles?.["95"] ?? null;

	return {
		httpFailureRate: httpFailed !== null ? `${(httpFailed * 100).toFixed(2)}%` : "n/a",
		httpLatencyP95: httpLatency !== null ? `${httpLatency.toFixed(0)} ms` : "n/a",
		liveLatencyP95: liveLatency !== null ? `${liveLatency.toFixed(0)} ms` : "n/a",
	};
}

function emitSummary(lighthouse, k6) {
	const lines = ["## Observability Snapshot\n"];

	if (lighthouse) {
		lines.push("### Lighthouse", "| Metric | Score |", "| --- | --- |");
		lines.push(`| Performance | ${lighthouse.performance} |`);
		lines.push(`| Accessibility | ${lighthouse.accessibility} |`);
		lines.push(`| Best Practices | ${lighthouse.bestPractices} |`);
		lines.push(`| SEO | ${lighthouse.seo} |`, "");
	} else {
		lines.push("- Lighthouse report unavailable.", "");
	}

	if (k6) {
		lines.push("### k6 Smoke Test", "| Metric | Value |", "| --- | --- |");
		lines.push(`| HTTP failure rate | ${k6.httpFailureRate} |`);
		lines.push(`| HTTP latency p95 | ${k6.httpLatencyP95} |`);
		lines.push(`| Live health p95 | ${k6.liveLatencyP95} |`, "");
	} else {
		lines.push("- k6 summary unavailable.");
	}

	const summary = lines.join("\n");
	const summaryFile = process.env.GITHUB_STEP_SUMMARY;
	if (summaryFile) {
		appendFileSync(summaryFile, `${summary}\n`);
	}

	return summary;
}

async function emitSlack(summary) {
	const webhook = process.env.SLACK_MONITORING_WEBHOOK;
	if (!webhook) {
		return;
	}

	try {
		await fetch(webhook, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: `CI observability summary for ${process.env.GITHUB_REF ?? "unknown"}\n\n${summary}` }),
		});
	} catch (error) {
		console.error("Failed to post Slack notification", error);
	}
}

async function main() {
	try {
		const lighthouse = collectLighthouse();
		const k6 = collectK6();
		const summary = emitSummary(lighthouse, k6);
		await emitSlack(summary);
	} catch (error) {
		console.error("Failed to produce observability summary", error);
	}
}

await main();
