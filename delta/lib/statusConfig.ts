export const LEAD_STATUSES = [
  "new", "assigned", "pending_response", "followup",
  "closed", "lost", "not_connected", "mia", "repeated", "callback", "cnc",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface StatusMeta {
  label:     string;
  color:     string;   // badge bg+text+border
  dot:       string;   // dot color
  bar:       string;   // progress bar bg
  text:      string;   // text-only color
  chartColor: string;  // hex for recharts
  // kanban column
  header:   string;
  border:   string;
  dropZone: string;
  badge:    string;
}

export const STATUS_META: Record<LeadStatus, StatusMeta> = {
  new: {
    label: "New",
    color:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
    dot:        "bg-blue-400",
    bar:        "bg-blue-500",
    text:       "text-blue-400",
    chartColor: "#3b82f6",
    header:     "bg-blue-500/15 text-blue-400",
    border:     "border-blue-500/25",
    dropZone:   "border-blue-500/50 bg-blue-500/5",
    badge:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  assigned: {
    label: "Assigned",
    color:      "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    dot:        "bg-yellow-400",
    bar:        "bg-yellow-500",
    text:       "text-yellow-400",
    chartColor: "#eab308",
    header:     "bg-yellow-500/15 text-yellow-400",
    border:     "border-yellow-500/25",
    dropZone:   "border-yellow-500/50 bg-yellow-500/5",
    badge:      "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  pending_response: {
    label: "Pending Response",
    color:      "bg-violet-500/15 text-violet-400 border-violet-500/30",
    dot:        "bg-violet-400",
    bar:        "bg-violet-500",
    text:       "text-violet-400",
    chartColor: "#8b5cf6",
    header:     "bg-violet-500/15 text-violet-400",
    border:     "border-violet-500/25",
    dropZone:   "border-violet-500/50 bg-violet-500/5",
    badge:      "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  followup: {
    label: "Follow Up",
    color:      "bg-orange-500/15 text-orange-400 border-orange-500/30",
    dot:        "bg-orange-400",
    bar:        "bg-orange-500",
    text:       "text-orange-400",
    chartColor: "#f97316",
    header:     "bg-orange-500/15 text-orange-400",
    border:     "border-orange-500/25",
    dropZone:   "border-orange-500/50 bg-orange-500/5",
    badge:      "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  closed: {
    label: "Closed",
    color:      "bg-green-500/15 text-green-400 border-green-500/30",
    dot:        "bg-green-400",
    bar:        "bg-green-500",
    text:       "text-green-400",
    chartColor: "#22c55e",
    header:     "bg-green-500/15 text-green-400",
    border:     "border-green-500/25",
    dropZone:   "border-green-500/50 bg-green-500/5",
    badge:      "bg-green-500/15 text-green-400 border-green-500/30",
  },
  lost: {
    label: "Lost",
    color:      "bg-red-500/15 text-red-400 border-red-500/30",
    dot:        "bg-red-400",
    bar:        "bg-red-500",
    text:       "text-red-400",
    chartColor: "#ef4444",
    header:     "bg-red-500/15 text-red-400",
    border:     "border-red-500/25",
    dropZone:   "border-red-500/50 bg-red-500/5",
    badge:      "bg-red-500/15 text-red-400 border-red-500/30",
  },
  not_connected: {
    label: "Not Connected",
    color:      "bg-slate-500/15 text-slate-400 border-slate-500/30",
    dot:        "bg-slate-400",
    bar:        "bg-slate-500",
    text:       "text-slate-400",
    chartColor: "#64748b",
    header:     "bg-slate-500/15 text-slate-400",
    border:     "border-slate-500/25",
    dropZone:   "border-slate-500/50 bg-slate-500/5",
    badge:      "bg-slate-500/15 text-slate-400 border-slate-500/30",
  },
  mia: {
    label: "MIA",
    color:      "bg-rose-500/15 text-rose-400 border-rose-500/30",
    dot:        "bg-rose-400",
    bar:        "bg-rose-500",
    text:       "text-rose-400",
    chartColor: "#f43f5e",
    header:     "bg-rose-500/15 text-rose-400",
    border:     "border-rose-500/25",
    dropZone:   "border-rose-500/50 bg-rose-500/5",
    badge:      "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
  repeated: {
    label: "Repeated",
    color:      "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    dot:        "bg-cyan-400",
    bar:        "bg-cyan-500",
    text:       "text-cyan-400",
    chartColor: "#06b6d4",
    header:     "bg-cyan-500/15 text-cyan-400",
    border:     "border-cyan-500/25",
    dropZone:   "border-cyan-500/50 bg-cyan-500/5",
    badge:      "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  callback: {
    label: "Call Back",
    color:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
    dot:        "bg-sky-400",
    bar:        "bg-sky-500",
    text:       "text-sky-400",
    chartColor: "#0ea5e9",
    header:     "bg-sky-500/15 text-sky-400",
    border:     "border-sky-500/25",
    dropZone:   "border-sky-500/50 bg-sky-500/5",
    badge:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
  },
  cnc: {
    label: "CNC",
    color:      "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot:        "bg-amber-400",
    bar:        "bg-amber-500",
    text:       "text-amber-400",
    chartColor: "#f59e0b",
    header:     "bg-amber-500/15 text-amber-400",
    border:     "border-amber-500/25",
    dropZone:   "border-amber-500/50 bg-amber-500/5",
    badge:      "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
};
