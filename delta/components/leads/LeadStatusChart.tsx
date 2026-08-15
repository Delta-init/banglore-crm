"use client";

import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAD_STATUSES, STATUS_META } from "@/lib/statusConfig";
import type { LeadStatus } from "@/lib/statusConfig";
import type { LeadStats } from "@/types/lead";

interface LeadStatusChartProps {
  stats?: LeadStats;
  loading?: boolean;
  /** Shown in the header, e.g. "in selected range" when a date filter is on */
  subtitle?: string;
}

/**
 * Donut of lead status distribution, fed by LeadStats. Because the stats already
 * honor the active date/source filters, this chart updates with them for free.
 */
export function LeadStatusChart({ stats, loading, subtitle }: LeadStatusChartProps) {
  const data = LEAD_STATUSES
    .map((s) => ({ status: s, name: STATUS_META[s].label, value: (stats?.[s] as number | undefined) ?? 0, color: STATUS_META[s].chartColor }))
    .filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="border-border/50 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieIcon className="h-4 w-4 text-muted-foreground" />
          Status Breakdown
          {subtitle && <span className="text-xs font-normal text-muted-foreground">· {subtitle}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[220px] items-center justify-center">
            <div className="h-32 w-32 animate-pulse rounded-full bg-muted" />
          </div>
        ) : total === 0 ? (
          <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
            <PieIcon className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No leads to chart</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-[200px] w-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive
                  >
                    {data.map((d) => (
                      <Cell key={d.status} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value, name) => {
                      const n = Number(value) || 0;
                      return [`${n} (${Math.round((n / total) * 100)}%)`, String(name)];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{total}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 sm:flex-1">
              {data
                .sort((a, b) => b.value - a.value)
                .map((d, i) => (
                  <motion.div
                    key={d.status}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-semibold text-foreground">{d.value}</span>
                  </motion.div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
