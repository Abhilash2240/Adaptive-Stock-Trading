export function formatPrice(value: number | null | undefined, prefix = "$", fallback = "—"): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${prefix}${value.toFixed(2)}`;
}

export function formatRelativeTime(value: Date | string | null | undefined, fallback = "—"): string {
  if (!value) {
    return fallback;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 1000) {
    return "just now";
  }
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}
