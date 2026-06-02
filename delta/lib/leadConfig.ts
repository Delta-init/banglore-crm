export interface LeadFieldOption {
  value:  string;
  label:  string;
  color:  string;
  bg:     string;
  border: string;
}

export const INITIAL_RESPONSE_CONFIG: LeadFieldOption[] = [
  { value: "very_interested", label: "Very Interested", color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20"  },
  { value: "not_interested",  label: "Not Interested",  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  { value: "let_me_think",    label: "Let Me Think",    color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
];

export const PRIMARY_CONCERN_CONFIG: LeadFieldOption[] = [
  { value: "risk",          label: "Risk",          color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  { value: "price",         label: "Price",         color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
  { value: "time",          label: "Time",          color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
  { value: "trust",         label: "Trust",         color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { value: "exact_concern", label: "Exact Concern", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
];

export const FOLLOWUP_STRATEGY_CONFIG: LeadFieldOption[] = [
  { value: "risk_based",  label: "Risk Based",  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
  { value: "price_based", label: "Price Based", color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
  { value: "time_based",  label: "Time Based",  color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
  { value: "trust_based", label: "Trust Based", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
];
