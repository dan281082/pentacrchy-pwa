// Price + text formatting helpers.
// Prices are formatted from WooCommerce's integer minor units + currency meta.
// We NEVER do arithmetic on prices for display beyond currency formatting.

import type { PriceInfo } from "@/src/types/catalogue";

// Convert integer minor-unit string ("1250") into a display string ("£12.50")
// using the currency metadata WooCommerce returned.
export function formatMinor(amountMinor: string | null | undefined, p: PriceInfo): string {
  if (amountMinor == null || amountMinor === "") return "";
  const minor = p.currencyMinorUnit ?? 2;
  const asInt = parseInt(amountMinor, 10);
  if (Number.isNaN(asInt)) return "";
  const value = asInt / Math.pow(10, minor);
  const fixed = value.toFixed(minor);
  const [whole, frac] = fixed.split(".");
  const thousands = (p.currencyThousandSeparator || ",");
  const decimal = (p.currencyDecimalSeparator || ".");
  const withThousands = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const body = frac ? `${withThousands}${decimal}${frac}` : withThousands;
  return `${p.currencyPrefix || ""}${body}${p.currencySuffix || ""}`;
}

// Display price for a product/line — uses the final `price` (sale-aware) from WC.
export function displayPrice(p: PriceInfo): string {
  if (p.priceRange) {
    const min = formatMinor(p.priceRange.minAmount, p);
    const max = formatMinor(p.priceRange.maxAmount, p);
    return min === max ? min : `${min} – ${max}`;
  }
  return formatMinor(p.price, p);
}

export const regularPriceStr = (p: PriceInfo): string => formatMinor(p.regularPrice, p);

export const hasStrikethrough = (p: PriceInfo): boolean =>
  !!p.salePrice && !!p.regularPrice && p.salePrice !== p.regularPrice && !p.priceRange;

// Convert major units (e.g. 25.00) into minor-unit int for comparisons.
export const toMinor = (major: number, minorUnit = 2): number =>
  Math.round(major * Math.pow(10, minorUnit));
