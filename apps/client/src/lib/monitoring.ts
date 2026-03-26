import * as Sentry from "@sentry/react";

let sentryReady = false;

function parseRate(value: string | undefined, fallback: number): number {
	const parsed = Number.parseFloat(value ?? "");
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function initMonitoring(): void {
	const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
	if (!dsn) {
		return;
	}

	Sentry.init({
		dsn,
		environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
		tracesSampleRate: parseRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1),
		replaysSessionSampleRate: parseRate(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE, 0.05),
	});

	sentryReady = true;
}

export function captureMonitoringException(error: unknown, context?: Record<string, unknown>): void {
	if (!sentryReady) {
		return;
	}

	Sentry.captureException(error, {
		extra: context,
	});
}
