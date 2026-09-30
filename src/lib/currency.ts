/**
 * Approximate USD conversion rates used only to normalise buy-ins for filtering
 * and sorting. Swap for a live FX feed if precision starts to matter.
 */
const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.66,
  NZD: 0.6,
  CZK: 0.044,
  PLN: 0.25,
  CHF: 1.12,
  SEK: 0.095,
  NOK: 0.093,
  DKK: 0.145,
  JPY: 0.0068,
  KRW: 0.00073,
  INR: 0.012,
  PHP: 0.017,
  THB: 0.028,
  SGD: 0.74,
  HKD: 0.128,
  MOP: 0.124,
  CNY: 0.14,
  MXN: 0.055,
  BRL: 0.18,
  ARS: 0.001,
  ZAR: 0.054,
};

export function toUsd(amount: number | null, currency: string | null): number | null {
  if (amount == null) return null;
  const rate = USD_PER_UNIT[(currency ?? "USD").toUpperCase()];
  return rate == null ? null : Math.round(amount * rate * 100) / 100;
}

export function formatMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("en-US")} ${currency ?? ""}`.trim();
  }
}

export function formatCompactUsd(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
}
