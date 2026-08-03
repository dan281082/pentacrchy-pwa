// Typed API errors + customer-friendly messages. Detailed technical errors are
// never shown to customers; we map to plain-language copy per the brief.

export type ApiErrorKind =
  | "offline"
  | "timeout"
  | "blocked" // bot-protection / captcha challenge (e.g. SiteGround)
  | "not-found"
  | "server"
  | "parse"
  | "unknown";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "offline":
        return "You appear to be offline. Check your connection and try again.";
      case "timeout":
        return "That took too long. Check your connection and try again.";
      case "blocked":
        return "We couldn’t reach the store from here. Please try again shortly.";
      case "not-found":
        return "We couldn’t find what you were looking for.";
      case "server":
        return "We couldn’t load the shop right now. Please try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
