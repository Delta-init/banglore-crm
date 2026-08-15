// Lightweight CSV export helpers — no dependencies, RFC-4180 quoting, Excel-safe
// UTF-8 BOM so accents / non-Latin names render correctly in Excel.

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  /** Optional value formatter; receives the row. */
  get?: (row: T) => unknown;
}

function escapeCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => escapeCell(c.get ? c.get(row) : (row as Record<string, unknown>)[c.key as string]))
        .join(","),
    )
    .join("\r\n");
  return header + "\r\n" + body;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
