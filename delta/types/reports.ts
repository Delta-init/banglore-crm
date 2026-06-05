export type LeadStatus =
  | "new"
  | "assigned"
  | "pending_response"
  | "followup"
  | "closed"
  | "lost"
  | "not_connected"
  | "mia"
  | "repeated"
  | "callback"
  | "cnc";

// ── Overview ──────────────────────────────────────────────────────────────────

export interface ReportSummary {
  total:          number;
  closed:         number;
  conversionRate: number;
  activeTeams:    number;
  totalTeams:     number;
  activeUsers:    number;
}

export interface StatusDistributionItem {
  status: LeadStatus;
  count:  number;
  pct:    number;
}

export interface SourceDistributionItem {
  source: string;
  count:  number;
}

export interface OverviewReport {
  summary:            ReportSummary;
  statusDistribution: StatusDistributionItem[];
  sourceDistribution: SourceDistributionItem[];
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export type TimelinePeriod = "daily" | "weekly" | "monthly";

export interface TimelinePoint {
  label:            string;
  total:            number;
  new:              number;
  assigned:         number;
  pending_response: number;
  followup:         number;
  closed:           number;
  lost:             number;
  not_connected:    number;
  mia:              number;
  repeated:         number;
  callback:         number;
  cnc:              number;
}

// ── User Rankings ─────────────────────────────────────────────────────────────

export interface UserRankItem {
  rank:             number;
  userId:           string;
  name:             string;
  email:            string;
  designation?:     string;
  total:            number;
  revenue:          number;
  pendingAmount:    number;
  new:              number;
  assigned:         number;
  pending_response: number;
  followup:         number;
  closed:           number;
  lost:             number;
  not_connected:    number;
  mia:              number;
  repeated:         number;
  callback:         number;
  cnc:              number;
  conversionRate:   number;
}

// ── Team Rankings ─────────────────────────────────────────────────────────────

export interface TeamRankItem {
  rank:             number;
  teamId:           string;
  name:             string;
  description?:     string;
  memberCount:      number;
  total:            number;
  totalPayments:    number;
  new:              number;
  assigned:         number;
  pending_response: number;
  followup:         number;
  closed:           number;
  lost:             number;
  not_connected:    number;
  mia:              number;
  repeated:         number;
  callback:         number;
  cnc:              number;
  thisMonth:        number;
  conversionRate:   number;
}

// ── Team Split ────────────────────────────────────────────────────────────────

export type SplitPeriod = "daily" | "weekly" | "monthly" | "yearly";

/** One time-bucket row in the chart — dynamic keys for each team name */
export type TeamSplitPoint = {
  label: string;
  total: number;
  [teamName: string]: number | string;
};

export interface TeamSplitSummaryItem {
  rank:             number;
  teamName:         string;
  total:            number;
  new:              number;
  assigned:         number;
  pending_response: number;
  followup:         number;
  closed:           number;
  lost:             number;
  not_connected:    number;
  mia:              number;
  repeated:         number;
  callback:         number;
  cnc:              number;
  conversionRate:   number;
}

export interface TeamSplitReport {
  teams:    string[];                  // unique team names (for chart series)
  timeline: TeamSplitPoint[];          // per-bucket rows
  summary:  TeamSplitSummaryItem[];    // team totals for the table
}

// ── Revenue ───────────────────────────────────────────────────────────────────

export type RevenuePeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface RevenueTeamBrief {
  rank:         number;
  teamId:       string;
  name:         string;
  revenue:      number;
  paymentCount: number;
}

export interface RevenueAgentItem {
  rank:          number;
  userId:        string;
  name:          string;
  email:         string;
  designation?:  string;
  revenue:       number;
  paymentCount:  number;
}

export interface RevenueOverview {
  totalRevenue:       number;
  totalPending:       number;
  overpaidCount:      number;
  overpaidTotal:      number;
  payingLeadCount:    number;
  paymentCount:       number;
  avgRevenuePerLead:  number;
  topTeam:            { name: string; revenue: number } | null;
  topAgent:           { name: string; revenue: number; designation?: string } | null;
  teamBreakdown:      RevenueTeamBrief[];
  agentBreakdown:     RevenueAgentItem[];
}

export type RevenueTimelinePoint = {
  label: string;
  total: number;
  [teamName: string]: number | string;
};

export interface RevenueTimelineReport {
  teams:    string[];
  timeline: RevenueTimelinePoint[];
}

export interface RevenueMemberItem {
  userId:        string;
  name:          string;
  designation?:  string;
  revenue:       number;
  pendingAmount: number;
  paymentCount:  number;
  leadCount:     number;
  pct:           number;
}

export interface RevenueTeamDetail {
  rank:          number;
  teamId:        string;
  name:          string;
  revenue:       number;
  pendingAmount: number;
  paymentCount:  number;
  leadCount:     number;
  members:       RevenueMemberItem[];
}

// ── Team-scoped revenue ───────────────────────────────────────────────────────

export interface TeamRevenueMember {
  rank:          number;
  userId:        string;
  name:          string;
  designation?:  string;
  revenue:       number;
  pendingAmount: number;
  paymentCount:  number;
  leadCount:     number;
  pct:           number;
}

export interface TeamRevenueOverview {
  totalRevenue:       number;
  totalPending:       number;
  payingLeadCount:    number;
  paymentCount:       number;
  avgRevenuePerLead:  number;
  topMember:          { name: string; revenue: number; designation?: string } | null;
  memberBreakdown:    TeamRevenueMember[];
}

export type TeamRevenueTimelinePoint = {
  label: string;
  total: number;
  [memberName: string]: number | string;
};

export interface TeamRevenueTimelineReport {
  members:  string[];
  timeline: TeamRevenueTimelinePoint[];
}

// ── Source Analytics ──────────────────────────────────────────────────────────

export interface SourceAnalyticsItem {
  source:         string;
  total:          number;
  closed:         number;
  lost:           number;
  revenue:        number;
  conversionRate: number;
  lostRate:       number;
}

export interface CampaignBreakdownItem {
  campaignId:     string;
  total:          number;
  closed:         number;
  lost:           number;
  revenue:        number;
  conversionRate: number;
  lostRate:       number;
}

// ── Filter state ──────────────────────────────────────────────────────────────

export interface ReportFilters {
  dateFrom: string;
  dateTo:   string;
  period:   TimelinePeriod;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank:             number;
  userId:           string;
  name:             string;
  email:            string;
  extension:        string | null;
  closings:         number;
  closingAmount:    number;
  callDurationMins: number;
  callDurationSecs: number;
  callDurationHit:  boolean;          // true when ≥ 100 mins
  totalLeads:       number;           // all-time assigned leads
  leadCounts:       Record<string, number>; // status → count
}

export interface LeaderboardData {
  month:     string;           // "YYYY-MM"
  updatedAt: string;           // ISO timestamp
  entries:   LeaderboardEntry[];
}
