"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, ChevronDown, ChevronUp,
  ArrowLeft, CheckCircle2, XCircle, Loader2, AlertCircle,
  History, Info, User, Check, ChevronsUpDown, Globe, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useUploadLegacyLeads } from "@/hooks/useLeads";
import { useUsers } from "@/hooks/useUsers";
import { useAuthStore } from "@/lib/store/authStore";

// ─── Template Download ─────────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = [
    "SI", "Date", "Lead Name", "Phone Number", "Lead Source", "Lead status",
    "Lead Received Time", "First Contact Time", "Initial Lead Response",
    "Primary Concern", "Exact Concern (Lead Words)", "Demo Scheduled",
    "Demo Attended?", "Follow-up Strategy Type", "Last Follow-up Date",
    "Comments (If any)", "", "CAMPAIGNS",
  ];
  const sample = [
    "1", "2026-01-04", "John Doe", "971501234567", "Abhin", "Following -up",
    "11.30 AM", "12.00 PM", "Let me think",
    "Risk", "beginner, will check later", "", "", "", "23-04-2026",
    "Some comments here", "1050 AED", "",
  ];
  const blob = new Blob([[headers, sample].map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "old_leads_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── Source Options ────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  { value: "__auto__",             label: "Auto-detect from sheet",  hint: "reads the Lead Source column" },
  { value: "meta - abhin leads",   label: "Meta — Abhin Leads",      hint: "" },
  { value: "meta - shuhaib leads", label: "Meta — Shuhaib Leads",    hint: "" },
  { value: "google",               label: "Google Ads",              hint: "" },
  { value: "meta",                 label: "Meta (generic)",          hint: "" },
  { value: "whatsapp",             label: "WhatsApp",                hint: "" },
  { value: "other",                label: "Other",                   hint: "" },
];

// ─── Searchable Combobox ───────────────────────────────────────────────────────

interface ComboboxOption {
  value: string;
  label: string;
  sub?: string;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText?: string;
  disabled?: boolean;
  renderSelected?: (opt: ComboboxOption) => React.ReactNode;
}

function SearchableCombobox({
  options, value, onChange, placeholder, searchPlaceholder,
  emptyText = "No results found.", disabled, renderSelected,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 font-normal text-sm",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selected
              ? renderSelected
                ? renderSelected(selected)
                : selected.label
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label + (opt.sub ? " " + opt.sub : "")}
                  onSelect={() => { onChange(opt.value); setOpen(false); }}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{opt.label}</span>
                    {opt.sub && <span className="text-[11px] text-muted-foreground truncate">{opt.sub}</span>}
                  </div>
                  <Check className={cn("h-4 w-4 shrink-0 text-primary", value === opt.value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Result Summary ────────────────────────────────────────────────────────────

interface LegacyResult {
  summary: { total: number; created: number; duplicate: number; invalid: number };
  results: Array<{ index: number; status: string; leadId?: string; phone?: string; reason?: string }>;
}

function ResultSummary({ result }: { result: LegacyResult }) {
  const [invalidOpen, setInvalidOpen] = useState(false);
  const [dupOpen, setDupOpen]         = useState(false);
  const { summary, results } = result;
  const invalidRows = results.filter((r) => r.status === "invalid");
  const dupRows     = results.filter((r) => r.status === "duplicate");

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-400" />
        <h3 className="font-semibold">Import Complete</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total",     value: summary.total,     color: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
          { label: "Created",   value: summary.created,   color: "bg-green-500/10 border-green-500/20 text-green-400" },
          { label: "Duplicate", value: summary.duplicate, color: summary.duplicate > 0 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-muted/30 border-border text-muted-foreground" },
          { label: "Invalid",   value: summary.invalid,   color: summary.invalid > 0 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-muted/30 border-border text-muted-foreground" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.07 }}>
            <div className={`rounded-lg border p-4 ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Duplicates */}
      {summary.duplicate > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
          <button className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-amber-400" onClick={() => setDupOpen(!dupOpen)}>
            <div className="flex items-center gap-2"><XCircle className="h-4 w-4" />{summary.duplicate} duplicate{summary.duplicate !== 1 ? "s" : ""} skipped</div>
            {dupOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence>
            {dupOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="border-t border-amber-500/20 px-4 py-3 max-h-48 overflow-y-auto space-y-0.5">
                  {dupRows.map((r, i) => <p key={i} className="text-xs text-muted-foreground">Row {r.index + 1}: {r.phone} — already exists</p>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Invalid */}
      {summary.invalid > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden">
          <button className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-red-400" onClick={() => setInvalidOpen(!invalidOpen)}>
            <div className="flex items-center gap-2"><XCircle className="h-4 w-4" />{summary.invalid} invalid row{summary.invalid !== 1 ? "s" : ""} — click to review</div>
            {invalidOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <AnimatePresence>
            {invalidOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="border-t border-red-500/20 px-4 py-3 max-h-48 overflow-y-auto space-y-0.5">
                  {invalidRows.map((r, i) => <p key={i} className="text-xs text-red-400/80">Row {r.index + 1}: {r.phone || "—"} — {r.reason}</p>)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function UploadLegacyLeadsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const [dragOver, setDragOver]         = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceOverride, setSourceOverride] = useState("__auto__");
  const [assignedTo, setAssignedTo]     = useState("");
  const [uploadResult, setUploadResult] = useState<LegacyResult | null>(null);

  const { mutate: uploadLegacy, isPending } = useUploadLegacyLeads();
  const { data: usersData, isLoading: usersLoading } = useUsers({ status: "active", limit: "200" });
  const users = usersData?.data ?? [];

  // ── Role detection (mirrors upload/page.tsx) ──────────────────────────────
  const isSuperAdmin = user?.role?.isSystemRole === true && user?.role?.roleName === "Super Admin";
  const canSeeAllUsers =
    isSuperAdmin ||
    user?.role?.roleName === "Team Leader" ||
    user?.role?.roleName === "Reporter";
  const isBDE = !!user && !canSeeAllUsers;

  // BDE: auto-lock to themselves once we have the user
  useEffect(() => {
    if (isBDE && user?._id && !assignedTo) {
      setAssignedTo(user._id);
    }
  }, [isBDE, user?._id]);

  // Build options for the counselor combobox
  const counselorOptions: ComboboxOption[] = [
    { value: "", label: "No assignment — import as-is", sub: "leads keep their original status" },
    ...users.map((u) => ({ value: u._id, label: u.name, sub: u.email ?? "" })),
  ];

  // Build options for source combobox
  const sourceOptions: ComboboxOption[] = SOURCE_OPTIONS.map((s) => ({
    value: s.value,
    label: s.label,
    sub: s.hint,
  }));

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFile(files[0]);
    setUploadResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    uploadLegacy(
      {
        file: selectedFile,
        assignedTo: assignedTo || undefined,
        sourceOverride: sourceOverride === "__auto__" ? undefined : sourceOverride,
      },
      {
        onSuccess: (result) => {
          setUploadResult(result);
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
      },
    );
  };

  const selectedCounselor = users.find((u) => u._id === assignedTo);
  const selectedSource    = SOURCE_OPTIONS.find((s) => s.value === sourceOverride);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/leads")} className="h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Import Old Leads</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">Upload historical leads from the standard report sheet format</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-4">

        {/* Column info */}
        <Card className="border-primary/20 bg-primary/3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Expected Sheet Format
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {[
                ["Date",                      "→ Lead creation date (backdated) ✱"],
                ["Lead Name",                 "→ Contact name ✱ required"],
                ["Phone Number",              "→ Phone number ✱ required"],
                ["Lead Source",               "→ Abhin / Shoaib / Google…"],
                ["Lead status",               "→ Following-up / Closed / Lost…"],
                ["Lead Received Time",        "→ Stored in lead (e.g. 11.30 AM)"],
                ["Initial Lead Response",     "→ Let me think / Very Interested"],
                ["Primary Concern",           "→ Risk / Price / Time / Trust"],
                ["Exact Concern (Lead Words)", "→ Stored in lead"],
                ["Demo Scheduled / Attended", "→ Stored in lead"],
                ["Last Follow-up Date",       "→ Stored in lead"],
                ["Comments (If any)",         "→ Stored in lead"],
                ["CAMPAIGNS",                 "→ Campaign name"],
              ].map(([col, desc]) => (
                <div key={col} className="flex gap-1 py-0.5">
                  <span className="font-mono text-foreground/80 shrink-0">{col}</span>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-3 gap-2 h-8">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download Template
            </Button>
          </CardContent>
        </Card>

        {/* Counselor + Source — side by side on md+ */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* Counselor selection */}
          <Card className={cn("border-border/50", isBDE && "border-primary/25")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {isBDE ? <Lock className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                Assign to Counselor
                {isBDE ? (
                  <span className="text-xs font-normal text-primary/70 flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />auto
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isBDE ? (
                /* BDE — locked to themselves */
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold text-sm">
                    {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </motion.div>
              ) : (
                /* Admin / Reporter / Team Leader — free to choose */
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    All leads will be assigned to the selected counselor.
                    Terminal statuses (Closed, Lost, Repeated…) are never overridden.
                  </p>

                  {usersLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />Loading counselors…
                    </div>
                  ) : (
                    <SearchableCombobox
                      options={counselorOptions}
                      value={assignedTo}
                      onChange={setAssignedTo}
                      placeholder="Search and select a counselor…"
                      searchPlaceholder="Search by name or email…"
                      emptyText="No counselor found."
                      renderSelected={(opt) => (
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          {opt.label}
                        </span>
                      )}
                    />
                  )}

                  <AnimatePresence>
                    {assignedTo && selectedCounselor && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-1.5 rounded-lg bg-primary/8 border border-primary/20 px-3 py-2"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <p className="text-xs text-primary">
                          Active leads → <strong>{selectedCounselor.name}</strong>
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </CardContent>
          </Card>

          {/* Source override */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Source Override
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Force all leads to use a specific source instead of reading the "Lead Source" column.
              </p>

              <SearchableCombobox
                options={sourceOptions}
                value={sourceOverride}
                onChange={setSourceOverride}
                placeholder="Select source…"
                searchPlaceholder="Search source…"
                emptyText="No source found."
                renderSelected={(opt) => (
                  <span className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
                    {opt.label}
                  </span>
                )}
              />

              <AnimatePresence>
                {sourceOverride && sourceOverride !== "__auto__" && selectedSource && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-1.5 rounded-lg bg-primary/8 border border-primary/20 px-3 py-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs text-primary">
                      All rows → <strong>{selectedSource.label}</strong>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

        </div>

        {/* Upload form */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload Sheet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileChange(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-12 px-6 text-center
                  ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : selectedFile ? "border-green-500/50 bg-green-500/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
                <AnimatePresence mode="wait">
                  {selectedFile ? (
                    <motion.div key="selected" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                        <FileSpreadsheet className="h-6 w-6 text-green-400" />
                      </div>
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">Click to change file</p>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                        <Upload className={`h-6 w-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{dragOver ? "Drop file here" : "Drag & drop or click to browse"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-3">
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button type="submit" disabled={isPending || !selectedFile} className="gap-2">
                    {isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Importing…</>
                      : <><Upload className="h-4 w-4" />Import Leads</>}
                  </Button>
                </motion.div>
                {selectedFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; setUploadResult(null); }}>
                    Clear
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <AnimatePresence>
          {uploadResult && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
              <Card className="border-green-500/20">
                <CardContent className="pt-6">
                  <ResultSummary result={uploadResult} />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import notes */}
        <Card className="border-border/30 bg-muted/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground text-sm">Import Notes</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Lead Name</strong> and <strong>Phone Number</strong> are required per row.</li>
                  <li>The <strong>Date</strong> column sets the lead&apos;s creation date (backdated).</li>
                  <li>Duplicate phone numbers are skipped silently.</li>
                  <li><strong>Closed, Lost, Not Connected, Repeated</strong> leads are never marked as "assigned" even if a counselor is selected.</li>
                  <li>All data fields (concern, comments, demo, follow-up) are stored directly on the lead.</li>
                  <li>Use <strong>Source Override</strong> to force a single source for all rows.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}
