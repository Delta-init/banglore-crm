import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a date string for display in AED (Gulf Standard Time, UTC+4) */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dubai",
  });
}

/** Return today's date as YYYY-MM-DD in AED timezone */
export function todayAED(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Dubai" });
}

/** Format a full datetime for display in AED (GST) */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-AE", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }) + " GST";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
