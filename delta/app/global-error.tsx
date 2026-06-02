"use client";

/**
 * global-error.tsx — catches crashes in the root layout itself.
 * Must render its own <html> + <body> since it replaces the root layout.
 * Cannot use Tailwind, shadcn, or any component that relies on the root layout.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#09090b",
          color: "#fafafa",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "420px",
            width: "100%",
          }}
        >
          {/* Warning icon */}
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: "20px",
              fontWeight: "700",
              margin: "0 0 8px",
              color: "#fafafa",
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: "14px",
              color: "#a1a1aa",
              margin: "0 0 24px",
              lineHeight: "1.6",
            }}
          >
            {error?.message && error.message !== "An unknown error occurred"
              ? error.message
              : "A critical error occurred. Please refresh the page."}
          </p>

          {error?.digest && (
            <p
              style={{
                fontSize: "11px",
                color: "#71717a",
                fontFamily: "monospace",
                margin: "0 0 20px",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#6366f1",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseOver={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")
              }
              onMouseOut={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
              }
            >
              Try Again
            </button>

            <button
              onClick={() => (window.location.href = "/dashboard")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "transparent",
                color: "#a1a1aa",
                border: "1px solid #27272a",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#fafafa";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "#3f3f46";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#a1a1aa";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "#27272a";
              }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
