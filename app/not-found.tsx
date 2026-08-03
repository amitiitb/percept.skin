import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--canvas)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "3.2rem 2.4rem",
      textAlign: "center",
    }}>
      <div style={{ marginBottom: "4.8rem" }}>
        <Logo height="3rem" />
      </div>

      <p style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.6rem" }}>
        404 | Page not found
      </p>
      <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4rem)", fontWeight: 600, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.025em", marginBottom: "1.6rem" }}>
        This page doesn&apos;t exist.
      </h1>
      <p style={{ fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "42rem", marginBottom: "4rem" }}>
        The link may be outdated, or the page may have moved.
      </p>

      <div style={{ display: "flex", gap: "1.6rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/start" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: "5.2rem", padding: "0 3.2rem", borderRadius: "9999px",
          background: "var(--btn-fill)", color: "var(--btn-fill-ink)",
          fontSize: "1.5rem", fontWeight: 500, textDecoration: "none",
        }}>
          Go to homepage
        </Link>
        <Link href="/dashboard" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: "5.2rem", padding: "0 3.2rem", borderRadius: "9999px",
          border: "1px solid var(--line-strong)", color: "var(--primary)",
          fontSize: "1.5rem", fontWeight: 500, textDecoration: "none",
        }}>
          My dashboard
        </Link>
      </div>
    </div>
  );
}
