"use client";
import { useRouter } from "next/navigation";
import { V2Layout } from "@/components/v2/V2Layout";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const CHECKLIST = [
  "Even, natural lighting",
  "Remove glasses & heavy makeup",
  "Hair off your face, no filters",
  "Clean camera lens",
  "Neutral expression unless told otherwise",
];

export default function V2ScanPrepPage() {
  const router = useRouter();

  return (
    <V2Layout headline="Get ready to scan" sub="A few minutes of setup makes a big difference in your results." progress={35} backHref="/v2/dashboard">
      {/* Plain normal document flow — a fixed-position CTA bar was tried here
          and reverted: position:fixed is unreliable inside embedded webviews
          (in-app browsers etc treat it as document-relative, not viewport-
          relative, so the button rendered far below the fold instead of
          pinned). Trimming the checklist to 6 short items keeps total page
          height within a normal mobile viewport without needing any
          positioning trick. */}
      <div style={{ width: "100%", maxWidth: "64rem" }}>
        <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "1rem" }}>
          3-5 minutes
        </p>
        <h1 style={{ fontSize: "clamp(2.6rem, 5vw, 3.6rem)", fontWeight: 400, color: "var(--primary)", marginBottom: "2.4rem" }}>
          Before we start
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", marginBottom: "2.4rem" }}>
          {CHECKLIST.map((item) => (
            <div key={item} style={{ display: "flex", gap: "1.2rem", alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: "2.2rem", height: "2.2rem", borderRadius: "50%", border: "1px solid var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "0.1rem" }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.4 }}>{item}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginBottom: "2.4rem", lineHeight: 1.5 }}>
          These checks estimate lighting and framing, not exact, but a good guide.
        </p>

        <PrimaryButton onClick={() => router.push("/v2/capture/0")}>I&apos;m ready →</PrimaryButton>
      </div>
    </V2Layout>
  );
}
