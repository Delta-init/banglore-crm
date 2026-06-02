"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Human-readable name of the page/section where the error occurred */
  label?: string;
}

export function ErrorPage({ error, reset, label }: ErrorPageProps) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log to console so developers can see it during development
    console.error(`[${label ?? "Page"} Error]`, error);
  }, [error, label]);

  const message =
    error?.message && error.message !== "An unknown error occurred"
      ? error.message
      : "An unexpected error occurred. Please try again.";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        {/* Heading */}
        <h2 className="mb-1.5 text-xl font-bold text-foreground">
          Something went wrong
        </h2>

        {label && (
          <p className="mb-1 text-sm text-muted-foreground">
            Error in{" "}
            <span className="font-semibold text-foreground">{label}</span>
          </p>
        )}

        <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
          {message}
        </p>

        {/* Action buttons */}
        <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="w-full gap-2 sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="w-full gap-2 sm:w-auto"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        {/* Collapsible error details */}
        {(error?.stack || error?.digest) && (
          <div>
            <button
              onClick={() => setShowDetails((v) => !v)}
              className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  showDetails && "rotate-180",
                )}
              />
              {showDetails ? "Hide" : "Show"} error details
            </button>

            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden"
              >
                <pre className="max-h-44 overflow-auto rounded-xl border border-border/50 bg-muted/40 p-3 text-left font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {error.digest && (
                    <span className="text-yellow-500/80">
                      {"Digest: "}
                      {error.digest}
                      {"\n\n"}
                    </span>
                  )}
                  {error.stack ?? error.message}
                </pre>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
