// Low-level HTTPS JSON client for the public WooCommerce Store API.
// - HTTPS only, with timeout + abort.
// - Detects SiteGround / bot-protection HTML challenges and surfaces a typed
//   "blocked" error instead of throwing an opaque JSON parse error.
// - Returns { data, headers } so callers can read pagination headers.

import { ApiError } from "./errors";

const DEFAULT_TIMEOUT = 15000;

interface JsonResponse<T> {
  data: T;
  totalPages: number;
  total: number;
}

export async function getJson<T>(
  url: string,
  { timeout = DEFAULT_TIMEOUT, signal }: { timeout?: number; signal?: AbortSignal } = {},
): Promise<JsonResponse<T>> {
  if (!url.startsWith("https://")) {
    throw new ApiError("unknown", "Refusing non-HTTPS request");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (signal) signal.addEventListener("abort", () => controller.abort());

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "ApepsSuppliesApp/1.0 (Android)",
      },
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new ApiError("timeout", "Request timed out");
    throw new ApiError("offline", "Network request failed");
  }
  clearTimeout(timer);

  const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10) || 1;
  const total = parseInt(res.headers.get("x-wp-total") || "0", 10) || 0;

  const raw = await res.text();

  // Bot-protection challenge pages return HTML (not JSON).
  const looksLikeHtml = /^\s*<(?:!doctype|html|head)/i.test(raw) || raw.includes("sgcaptcha");
  if (looksLikeHtml) {
    throw new ApiError("blocked", "Store returned a challenge page", res.status);
  }

  if (res.status === 404) throw new ApiError("not-found", "Not found", 404);
  if (res.status >= 500) throw new ApiError("server", `Server error ${res.status}`, res.status);
  if (res.status >= 400) throw new ApiError("server", `Request failed ${res.status}`, res.status);

  try {
    return { data: JSON.parse(raw) as T, totalPages, total };
  } catch {
    throw new ApiError("parse", "Could not parse response");
  }
}
