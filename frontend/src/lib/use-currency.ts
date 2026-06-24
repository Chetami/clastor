import { useAuthStore } from "@/store/auth-store";

/**
 * The authenticated user's charging currency (ISO 4217 code), defaulting to
 * AUD when no user is loaded or they haven't set one. Use this to format any
 * money that belongs to the tutor (dashboard totals, student rates, new
 * invoices). For an existing invoice, prefer that invoice's own `currency`.
 */
export function useUserCurrency(): string {
  return useAuthStore((s) => s.user?.currency ?? "AUD");
}

/**
 * The localized symbol for a currency code (e.g. "$" for AUD, "$" for GBP,
 * "€" for EUR). Falls back to the code itself when Intl can't resolve it.
 * Used for input adornments where a full formatted string doesn't fit.
 */
export function getCurrencySymbol(currency: string = "AUD"): string {
  try {
    const parts = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
    }).formatToParts(0);
    const symbol = parts.find((p) => p.type === "currency")?.value;
    return symbol || currency;
  } catch {
    return currency;
  }
}

