"use client";
import { useRouter } from "next/navigation";
import { V2Layout } from "@/components/v2/V2Layout";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const CHECKLIST = [
  "Use natural or evenly distributed light",
  "Remove glasses",
  "Remove heavy makeup where possible",
  "Keep hair away from your face",
  "Do not use beauty filters",
  "Clean your camera lens",
  "Keep a neutral expression unless instructed otherwise",
  "Use your rear camera for scalp shots, where practical",
];

export default function V2ScanPrepPage() {
  const router = useRouter();

  return (
    <V2Layout headline="Get ready to scan" sub="A few minutes of setup makes a big difference in your results." progress={35} backHref="/v2/dashboard">
      <div style={{ maxWidth: "64rem" }}>
        <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "1.2rem" }}>
          About 3-5 minutes
        </p>
        <h1 style={{ fontSize: "clamp(2.6rem, 5vw, 3.6rem)", fontWeight: 400, color: "var(--primary)", marginBottom: "3.2rem" }}>
          Before we start
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.6rem", marginBottom: "4rem" }}>
          {CHECKLIST.map((item) => (
            <div key={item} style={{ display: "flex", gap: "1.2rem", alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: "2.4rem", height: "2.4rem", borderRadius: "50%", border: "1px solid var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "0.1rem" }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span style={{ fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginBottom: "2.4rem", lineHeight: 1.5 }}>
          Client-side checks estimate lighting and framing but aren&apos;t perfectly accurate — do your best with the tips above.
        </p>

        <PrimaryButton onClick={() => router.push("/v2/capture/0")}>I&apos;m ready →</PrimaryButton>
      </div>
    </V2Layout>
  );
}
