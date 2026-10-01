export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "PKR"
  | "AED"
  | "SAR"
  | "INR"
  | "CAD"
  | "AUD";

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  /** minor units — 2 for most, 0 for JPY, 3 for KWD */
  decimals: number;
  symbolPosition?: "before";
};

export const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimals: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", decimals: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimals: 2 },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", decimals: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimals: 2 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2 },
];

const FALLBACK: Currency = { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 };

export function getCurrency(codeOrSymbol: string | null | undefined, customSymbol?: string | null): Currency {
  if (!codeOrSymbol) return { ...FALLBACK, symbol: customSymbol || FALLBACK.symbol };
  const found = CURRENCIES.find(
    (c) => c.code.toLowerCase() === codeOrSymbol.toLowerCase(),
  );
  const base = found ?? { ...FALLBACK, code: codeOrSymbol.toUpperCase() };
  return customSymbol ? { ...base, symbol: customSymbol } : base;
}

/** Some codes are only understood as "XXX" by Stripe/PayPal zero-decimal logic. */
export function currencyDecimals(code: string): number {
  return getCurrency(code).decimals;
}
