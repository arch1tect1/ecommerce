"use client";

import { useEffect } from "react";

/**
 * Global error boundary — only triggers when the root layout itself throws,
 * so it has to render its own <html>/<body>. Keep it minimal and dependency-free.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="az">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9fafb",
          color: "#111827",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 32,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            Application failed to load
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
            A critical error prevented the app from rendering. Please reload
            the page.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                color: "#9ca3af",
                marginBottom: 24,
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#2563eb",
              color: "white",
              border: 0,
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
