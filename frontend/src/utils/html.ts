// Minimal, safe HTML → plain text helpers for WooCommerce product content.
// We do NOT render arbitrary HTML (avoids XSS + keeps native look). We strip
// tags and decode common entities, preserving paragraph / list breaks.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#039;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&pound;": "£",
  "&euro;": "€",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&ldquo;": '"',
  "&rdquo;": '"',
};

function decodeEntities(input: string): string {
  let out = input.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
  out = out.replace(/&[a-z0-9#]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
  return out;
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ");
  const text = withBreaks.replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
