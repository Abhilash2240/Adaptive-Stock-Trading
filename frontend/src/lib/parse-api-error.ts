/**
 * Safely extracts a human-readable error message
 * from a backend API response body.
 *
 * Handles:
 *   { detail: "string" }              - FastAPI string error
 *   { detail: [{ msg: "..." }] }      - FastAPI validation array
 *   { message: "string" }             - generic JSON error
 *   plain string body                  - rare but possible
 *   null / unparseable                 - fallback message
 */
export function parseApiError(
  errBody: unknown,
  fallback = "An unexpected error occurred"
): string {
  if (!errBody || typeof errBody !== "object") {
    return typeof errBody === "string" && errBody.length > 0
      ? errBody
      : fallback;
  }

  const body = errBody as Record<string, unknown>;

  if (body.detail !== undefined) {
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((e) =>
          typeof e === "object" && e !== null && "msg" in e
            ? String((e as Record<string, unknown>).msg)
            : JSON.stringify(e)
        )
        .join(", ");
    }
    return JSON.stringify(body.detail);
  }

  if (typeof body.message === "string") return body.message;

  return fallback;
}

/**
 * Normalizes any thrown value into a plain string.
 * Use in catch blocks: setError(normalizeError(err))
 */
export function normalizeError(
  err: unknown,
  fallback = "An unexpected error occurred"
): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err.length > 0) return err;
  return fallback;
}
