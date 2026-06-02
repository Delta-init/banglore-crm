import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type {
  OverviewReport,
  TimelinePoint,
  UserRankItem,
  TeamRankItem,
  TimelinePeriod,
  TeamSplitReport,
  SplitPeriod,
  RevenuePeriod,
  RevenueOverview,
  RevenueTimelineReport,
  RevenueTeamDetail,
  SourceAnalyticsItem,
  CampaignBreakdownItem,
  LeaderboardData,
} from "@/types/reports";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// ── Overview ─────────────────────────────────────────────────────────────────

export function useReportOverview(dateFrom: string, dateTo: string) {
  return useQuery<OverviewReport>({
    queryKey: ["reports", "overview", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<OverviewReport>>(
        `/reports/overview?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Timeline ─────────────────────────────────────────────────────────────────

export function useReportTimeline(
  period: TimelinePeriod,
  dateFrom: string,
  dateTo: string,
) {
  return useQuery<TimelinePoint[]>({
    queryKey: ["reports", "timeline", period, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<TimelinePoint[]>>(
        `/reports/timeline?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── User Rankings ─────────────────────────────────────────────────────────────

export function useReportUserRankings(dateFrom: string, dateTo: string) {
  return useQuery<UserRankItem[]>({
    queryKey: ["reports", "users", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<UserRankItem[]>>(
        `/reports/users?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Team Rankings ─────────────────────────────────────────────────────────────

export function useReportTeamRankings(dateFrom: string, dateTo: string) {
  return useQuery<TeamRankItem[]>({
    queryKey: ["reports", "teams", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<TeamRankItem[]>>(
        `/reports/teams?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Team Split ────────────────────────────────────────────────────────────────

export function useReportTeamSplit(
  period: SplitPeriod,
  dateFrom: string,
  dateTo: string,
) {
  return useQuery<TeamSplitReport>({
    queryKey: ["reports", "team-split", period, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<TeamSplitReport>>(
        `/reports/team-split?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Revenue Overview ──────────────────────────────────────────────────────────

export function useRevenueOverview(dateFrom: string, dateTo: string) {
  return useQuery<RevenueOverview>({
    queryKey: ["reports", "revenue", "overview", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<RevenueOverview>>(
        `/reports/revenue/overview?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Revenue Timeline ──────────────────────────────────────────────────────────

export function useRevenueTimeline(
  period: RevenuePeriod,
  dateFrom: string,
  dateTo: string,
) {
  return useQuery<RevenueTimelineReport>({
    queryKey: ["reports", "revenue", "timeline", period, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<RevenueTimelineReport>>(
        `/reports/revenue/timeline?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Source Analytics ──────────────────────────────────────────────────────────

export function useSourceAnalytics(dateFrom: string, dateTo: string, teamId?: string) {
  return useQuery<SourceAnalyticsItem[]>({
    queryKey: ["reports", "sources", dateFrom, dateTo, teamId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      if (teamId)   params.set("team",     teamId);
      const { data } = await api.get<ApiResponse<SourceAnalyticsItem[]>>(
        `/reports/sources?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export function useLeaderboard(month: string, refetchInterval = 30_000) {
  return useQuery<LeaderboardData>({
    queryKey: ["reports", "leaderboard", month],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<LeaderboardData>>(
        `/reports/leaderboard?month=${encodeURIComponent(month)}`,
      );
      return data.data;
    },
    staleTime: 25_000,          // consider fresh for 25 s
    refetchInterval,             // auto-refetch every N ms
    refetchIntervalInBackground: false,
  });
}

export function useCampaignBreakdown(source: string, dateFrom: string, dateTo: string) {
  return useQuery<CampaignBreakdownItem[]>({
    queryKey: ["reports", "sources", source, "campaigns", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<CampaignBreakdownItem[]>>(
        `/reports/sources/${encodeURIComponent(source)}/campaigns?${params}`,
      );
      return data.data;
    },
    enabled: !!source,
    staleTime: 60_000,
  });
}

// ── Revenue Teams (with member breakdown) ─────────────────────────────────────

export function useRevenueTeams(dateFrom: string, dateTo: string) {
  return useQuery<RevenueTeamDetail[]>({
    queryKey: ["reports", "revenue", "teams", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo)   params.set("dateTo",   dateTo);
      const { data } = await api.get<ApiResponse<RevenueTeamDetail[]>>(
        `/reports/revenue/teams?${params}`,
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}
