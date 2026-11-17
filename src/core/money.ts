// All money is stored as integers in the currency's smallest unit (cents,
// kobo, pesewas...). Commission rates are basis points: 4000 = 40%.

export function currencyDecimals(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoney(minor: number, currency: string, opts: { sign?: boolean } = {}): string {
  const decimals = currencyDecimals(currency);
  const major = minor / 10 ** decimals;
  let text: string;
  try {
    text = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Number.isInteger(major) ? 0 : decimals,
      maximumFractionDigits: decimals,
    }).format(Math.abs(major));
  } catch {
    text = `${currency} ${Math.abs(major).toFixed(decimals)}`;
  }
  const negative = minor < 0;
  if (negative) return `−${text}`;
  return opts.sign && minor > 0 ? `+${text}` : text;
}

/** Parse what a person typed ("1,500", "1500.5") into minor units. Returns null when invalid. */
export function parseMoney(input: string, currency: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d*(\.\d*)?$/.test(cleaned)) return null;
  const decimals = currencyDecimals(currency);
  const value = Math.round(Number(cleaned) * 10 ** decimals);
  return Number.isFinite(value) ? value : null;
}

/** Minor units to a plain editable string, e.g. 150050 -> "1500.5". */
export function toInputValue(minor: number | null | undefined, currency: string): string {
  if (minor == null) return "";
  const decimals = currencyDecimals(currency);
  return String(minor / 10 ** decimals);
}

/** Staff share of an amount, rounded to the nearest minor unit. */
export function share(amount: number, bp: number): number {
  return Math.round((amount * bp) / 10000);
}

export function bpToPercent(bp: number): string {
  const pct = bp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

export function percentToBp(input: string): number | null {
  const n = Number(input.replace("%", "").trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}
