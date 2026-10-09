import { getActiveCurrency } from "./store/currencyStore";

/** Compact: $1.2M / $123K / $500 */
export function fmtCompact(n: number): string {
  const { symbol } = getActiveCurrency();
  if (n >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${symbol}${(n / 1_000).toFixed(1)}K`;
  return `${symbol}${n}`;
}

/** Full: $1,234,567 */
export function fmtFull(n: number): string {
  const { symbol, locale } = getActiveCurrency();
  return `${symbol}${n.toLocaleString(locale)}`;
}

/** Intl.NumberFormat full currency string: $1,234 */
export function fmtCurrency(n: number): string {
  const { code, locale } = getActiveCurrency();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Just the symbol for the active currency */
export function getCurrencySymbol(): string {
  return getActiveCurrency().symbol;
}

/**
 * Always INR: ₹1,23,456.
 *
 * For the close, the enrolments and anything else that goes to finance —
 * Banglore's finance organisation keeps its books in INR, so these amounts are
 * rupees whatever display currency the user picked for the rest of the app.
 */
export function fmtINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * A bonus, always in US dollars: the course bonus is an MT5 bonus, given and
 * sent to finance in USD in every sales CRM (2026-10-09) — whatever currency
 * the screen shows the fees in. "$1,234.50"
 */
export function fmtUSD(n: number): string {
  return `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
