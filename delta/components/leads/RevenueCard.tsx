"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleDollarSign, TrendingUp, CreditCard, Users2,
  Calendar, ChevronDown, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useUserRevenue, type RevenuePeriod } from "@/hooks/useLeads";
import { fmtFull } from "@/lib/currency";

const PERIOD_OPTIONS: { value: RevenuePeriod; label: string }[] = [
  { value: "today",  label: "Today" },
  { value: "week",   label: "This Week" },
  { value: "month",  label: "This Month" },
  { value: "year",   label: "This Year" },
  { value: "all",    label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

interface RevenueCardProps {
  userId: string;
}

export function RevenueCard({ userId }: RevenueCardProps) {
  const [period, setPeriod]     = useState<RevenuePeriod>("month");
  const [customFrom, setFrom]   = useState("");
  const [customTo, setTo]       = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const activeFrom = period === "custom" ? customFrom : undefined;
  const activeTo   = period === "custom" ? customTo   : undefined;
  const enabled    = period !== "custom" || (!!customFrom && !!customTo);

  const { data, isLoading } = useUserRevenue(
    userId,
    enabled ? period : "all",
    activeFrom,
    activeTo,
  );

  const selectedLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "This Month";

  function handlePeriodSelect(p: RevenuePeriod) {
    setPeriod(p);
    setShowCustom(p === "custom");
  }

  return (
    <Card className="border-green-500/20 bg-green-500/3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-green-400" />
            Revenue
          </CardTitle>

          {/* Period picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-green-500/20 hover:border-green-500/40">
                <Calendar className="h-3.5 w-3.5 text-green-400" />
                {selectedLabel}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {PERIOD_OPTIONS.filter((o) => o.value !== "custom").map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  className={`text-xs ${period === opt.value ? "text-primary font-medium" : ""}`}
                  onClick={() => handlePeriodSelect(opt.value)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={`text-xs ${period === "custom" ? "text-primary font-medium" : ""}`}
                onClick={() => handlePeriodSelect("custom")}
              >
                Custom Range…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Custom date inputs */}
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 pt-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 text-xs [color-scheme:dark]"
                />
                <span className="text-xs text-muted-foreground shrink-0">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 text-xs [color-scheme:dark]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <motion.div
            key={`${period}-${customFrom}-${customTo}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-3 gap-3"
          >
            {/* Total Revenue */}
            <div className="col-span-3 flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/8 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/15">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-400 tabular-nums">
                  {fmtFull(data?.totalRevenue ?? 0)}
                </p>
              </div>
            </div>

            {/* Payment count */}
            <div className="flex flex-col gap-1 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-blue-400" />
                <p className="text-[11px] text-muted-foreground">Payments</p>
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">{data?.paymentCount ?? 0}</p>
            </div>

            {/* Leads with payments */}
            <div className="col-span-2 flex flex-col gap-1 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Users2 className="h-3.5 w-3.5 text-violet-400" />
                <p className="text-[11px] text-muted-foreground">Leads with payments</p>
              </div>
              <p className="text-lg font-bold text-foreground tabular-nums">{data?.leadCount ?? 0}</p>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
