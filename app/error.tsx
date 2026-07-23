"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--canvas, #FAFAF8)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "3.2rem 2.4rem",
      textAlign: "center",
    }}>
      <span style={{ fontSize: "2.2rem", fontWeight: 600, color: "var(--primary, #111B1E)", letterSpacing: "-0.02em", marginBottom: "4.8rem" }}>
        Glow<span style={{ color: "var(--rose, #D9546A)" }}>metry</span>
      </span>

      <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4rem)", fontWeight: 600, color: "var(--primary, #111B1E)", lineHeight: 1.1, letterSpacing: "-0.025em", marginBottom: "1.6rem" }}>
        Something went wrong.
      </h1>
      <p style={{ fontSize: "1.6rem", color: "var(--secondary, #5A6B72)", lineHeight: 1.6, maxWidth: "42rem", marginBottom: "4rem" }}>
        An unexpected error occurred. Your progress is saved on this device, try again and you&apos;ll pick up where you left off.
      </p>

      <div style={{ display: "flex", gap: "1.6rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            height: "5.2rem", padding: "0 3.2rem", borderRadius: "9999px",
            background: "var(--primary, #111B1E)", color: "#fff", border: "none",
            fontSize: "1.5rem", fontWeight: 500, cursor: "pointer",
          }}
        >
          Try again
        </button>
        <a
          href="/start"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            height: "5.2rem", padding: "0 3.2rem", borderRadius: "9999px",
            border: "1px solid var(--line-strong, #C8C4BB)", color: "var(--primary, #111B1E)",
            fontSize: "1.5rem", fontWeight: 500, textDecoration: "none",
          }}
        >
          Go to homepage
        </a>
      </div>
    </div>
  );
}
