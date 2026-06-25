"use client";

// Providing our own global error boundary makes Next use this module instead of
// the built-in `global-error`, which avoids a Turbopack dev bug where the builtin
// is missing from the React Client Manifest ("Could not find the module
// .../builtin/global-error.js#default in the React Client Manifest").
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#f8fafc",
          color: "#0f172a"
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
            An unexpected error occurred. Try again, and check the server logs if it
            persists.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#0891b2",
              color: "white",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
