import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CurrencyOption {
  code:   string;
  symbol: string;
  locale: string;
  label:  string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$",     locale: "en-US", label: "US Dollar (USD)"          },
  { code: "INR", symbol: "₹",     locale: "en-IN", label: "Indian Rupee (INR)"       },
  { code: "EUR", symbol: "€",     locale: "de-DE", label: "Euro (EUR)"               },
  { code: "GBP", symbol: "£",     locale: "en-GB", label: "British Pound (GBP)"      },
  { code: "AED", symbol: "AED ",  locale: "en-AE", label: "UAE Dirham (AED)"         },
  { code: "SAR", symbol: "SAR ",  locale: "en-SA", label: "Saudi Riyal (SAR)"        },
  { code: "CAD", symbol: "CA$",   locale: "en-CA", label: "Canadian Dollar (CAD)"    },
  { code: "AUD", symbol: "A$",    locale: "en-AU", label: "Australian Dollar (AUD)"  },
  { code: "SGD", symbol: "S$",    locale: "en-SG", label: "Singapore Dollar (SGD)"   },
  { code: "JPY", symbol: "¥",     locale: "ja-JP", label: "Japanese Yen (JPY)"       },
  { code: "MYR", symbol: "RM ",   locale: "ms-MY", label: "Malaysian Ringgit (MYR)"  },
];

interface CurrencyState {
  currencyCode: string;
  setCurrency:  (code: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currencyCode: "USD",
      setCurrency: (code) => set({ currencyCode: code }),
    }),
    { name: "crm_currency" },
  ),
);

export function getActiveCurrency(): CurrencyOption {
  const code = useCurrencyStore.getState().currencyCode;
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
