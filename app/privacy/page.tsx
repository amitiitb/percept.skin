import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Percept collects, uses, and protects your photos and personal data.",
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy", title: "Privacy Policy | Percept" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--canvas)",
        padding: "9.6rem 2.4rem 6.4rem",
      }}
    >
      <div style={{ maxWidth: "112rem", margin: "0 auto" }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            fontSize: "1.4rem",
            color: "var(--secondary)",
            textDecoration: "none",
            marginBottom: "4rem",
          }}
        >
          ← Back
        </a>

        <h1
          style={{
            fontSize: "3.6rem",
            fontWeight: 300,
            color: "var(--primary)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 0 2.4rem",
          }}
        >
          Privacy Policy
        </h1>

        <p
          style={{
            fontSize: "1.7rem",
            color: "var(--secondary)",
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          Our privacy policy is being updated. Please check back soon.
        </p>
      </div>
    </div>
  );
}
