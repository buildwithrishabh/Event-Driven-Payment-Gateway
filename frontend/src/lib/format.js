/**
 * Formatting helpers. The backend stores all money as INTEGER MINOR UNITS
 * (e.g. 2500 paise = ₹25.00), so always divide before displaying.
 */

// Currencies that have no minor units (amount is already the whole unit).
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

const CURRENCY_SYMBOLS = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  JPY: "¥",
};

/** Convert integer minor units to a display number. */
export function fromMinorUnits(amount, currency = "INR") {
  if (typeof amount !== "number" || Number.isNaN(amount)) return 0;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toUpperCase())
    ? amount
    : amount / 100;
}

/** Convert a display number back to integer minor units (safe rounding). */
export function toMinorUnits(amount, currency = "INR") {
  const value = Number(amount);
  if (Number.isNaN(value)) return NaN;
  return ZERO_DECIMAL_CURRENCIES.has(String(currency).toUpperCase())
    ? Math.round(value)
    : Math.round(value * 100);
}

/** Format integer minor units as a currency string, e.g. 2500 -> "₹25.00". */
export function formatMoney(amount, currency = "INR", { compact = false } = {}) {
  const value = fromMinorUnits(amount, currency);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
      maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
      notation: compact ? "compact" : "standard",
    }).format(value);
  } catch {
    const symbol = CURRENCY_SYMBOLS[currency] || "";
    return `${symbol}${value.toFixed(2)}`;
  }
}

/** Format a Mongo ObjectId for compact display, e.g. 65ab…9f21. */
export function shortId(id) {
  if (!id) return "—";
  const str = String(id);
  return str.length > 12 ? `${str.slice(0, 6)}…${str.slice(-6)}` : str;
}

/** Format an ISO date string as e.g. "15 Oct 2026, 14:03". */
export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Format an ISO date string as e.g. "15 Oct 2026". */
export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Human-friendly relative time, e.g. "3 min ago". */
export function timeAgo(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const table = [
    [60, "s", 1],
    [3600, "min", 60],
    [86400, "hr", 3600],
    [604800, "day", 86400],
    [2629800, "wk", 604800],
    [31557600, "mo", 2629800],
  ];
  if (seconds < 45) return "just now";
  for (const [limit, unit, div] of table) {
    if (seconds < limit) {
      return `${Math.round(seconds / div)} ${unit} ago`;
    }
  }
  return `${Math.round(seconds / 31557600)} yr ago`;
}

/** Turns "customerEmail" / "PAYMENT_CREATED" into "Customer email" / "Payment created". */
export function humanize(value) {
  if (!value) return "";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Truncate long secrets/keys for safe display. */
export function maskSecret(value, { visible = 8 } = {}) {
  if (!value) return "—";
  const str = String(value);
  if (str.length <= visible + 4) return str;
  return `${str.slice(0, visible)}${"•".repeat(12)}${str.slice(-4)}`;
}

/** Crypto-random idempotency key so double-clicks never double-charge. */
export function generateIdempotencyKey(prefix = "idem") {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${random}`;
}

/** Copy text to the clipboard, resolving to a boolean. */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
