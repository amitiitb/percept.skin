"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { V2Layout } from "@/components/v2/V2Layout";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const CHECKLIST = [
  { title: "Face a window", detail: "Use soft, even light without harsh shadows." },
  { title: "Show your natural face", detail: "Remove glasses and avoid heavy makeup." },
  { title: "Keep your face clear", detail: "Pull hair back and switch off all filters." },
  { title: "Wipe the camera lens", detail: "A clean lens keeps every detail sharp." },
  { title: "Relax your expression", detail: "Look straight ahead unless the guide asks otherwise." },
];

export default function V2ScanPrepPage() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);

  function beginCapture() {
    sessionStorage.setItem("percept_photo_consent", "true");
    router.push("/capture/0");
  }

  return (
    <V2Layout headline="Get ready to scan" sub="A few minutes of setup makes a big difference in your results." progress={35} backHref="/dashboard">
      {/* Plain normal document flow — a fixed-position CTA bar was tried here
          and reverted: position:fixed is unreliable inside embedded webviews
          (in-app browsers etc treat it as document-relative, not viewport-
          relative, so the button rendered far below the fold instead of
          pinned). Trimming the checklist to 6 short items keeps total page
          height within a normal mobile viewport without needing any
          positioning trick. */}
      <div style={{ width: "100%", maxWidth: "64rem" }}>
        <p style={{ display: "inline-flex", alignItems: "center", gap: ".6rem", fontSize: "1.25rem", fontWeight: 850, color: "var(--primary)", background: "var(--wash)", border: "1px solid var(--line)", borderRadius: "999px", padding: ".65rem 1.1rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>
          <span aria-hidden style={{ color: "var(--rose)" }}>●</span> Takes about 2–4 minutes
        </p>
        <h1 style={{ fontSize: "clamp(3rem, 6vw, 4.2rem)", lineHeight: 1.06, letterSpacing: "-0.035em", fontWeight: 750, color: "var(--primary)", marginBottom: ".8rem" }}>
          Set up for your best scan
        </h1>
        <p style={{ fontSize: "1.55rem", fontWeight: 500, color: "var(--secondary)", lineHeight: 1.5, margin: "0 0 2.4rem", maxWidth: "54rem" }}>Five quick checks help us produce clearer, more reliable recommendations.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: ".8rem", marginBottom: "2rem" }}>
          {CHECKLIST.map((item) => (
            <div key={item.title} style={{ display: "flex", gap: "1.2rem", alignItems: "center", padding: "1.15rem 1.25rem", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.1rem" }}>
              <span style={{ flexShrink: 0, width: "2.5rem", height: "2.5rem", borderRadius: "50%", background: "#DDEDE4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: "1.45rem", fontWeight: 750, color: "var(--primary)", lineHeight: 1.25 }}>{item.title}</strong><small style={{ display: "block", marginTop: ".2rem", fontSize: "1.2rem", color: "var(--secondary)", lineHeight: 1.35 }}>{item.detail}</small></span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "1.2rem", fontWeight: 550, color: "var(--muted)", marginBottom: "2rem", lineHeight: 1.5 }}>
          The on-screen checks are helpful guides. They estimate lighting and framing but may not catch everything.
        </p>

        <button
          type="button"
          role="checkbox"
          aria-checked={consent}
          onClick={() => setConsent((value) => !value)}
          style={{ width: "100%", display: "flex", gap: "1.1rem", marginBottom: "2rem", padding: "1.4rem 1.5rem", border: `2px solid ${consent ? "rgba(23,76,64,.35)" : "var(--line)"}`, borderRadius: "1.2rem", background: consent ? "#EDF6F1" : "var(--surface)", textAlign: "left", cursor: "pointer", transition: "all 180ms ease" }}
        >
          <span aria-hidden style={{ flexShrink: 0, width: "2rem", height: "2rem", marginTop: "0.1rem", borderRadius: "0.4rem", border: `2px solid ${consent ? "var(--primary)" : "var(--line-strong)"}`, background: consent ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {consent && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <span style={{ fontSize: "1.28rem", color: "var(--primary)", lineHeight: 1.5 }}>
            <strong style={{ display: "block", fontSize: "1.35rem", marginBottom: ".25rem" }}>Your photos stay private</strong>
            I agree that Percept may securely store and process my photos to create and save this report. My photos will not be used to train AI models unless I separately opt in.
          </span>
        </button>

        <p style={{ margin: "-1.1rem .2rem 2rem 3.1rem", color: "var(--muted)", fontSize: "1.15rem", lineHeight: 1.45 }}>
          Learn how we protect and handle your information in our <Link href="/privacy" style={{ color: "var(--primary)", fontWeight: 750, textDecoration: "underline", textUnderlineOffset: ".18em" }}>Privacy Policy</Link>.
        </p>

        <PrimaryButton onClick={beginCapture} disabled={!consent}>Start my scan →</PrimaryButton>
      </div>
    </V2Layout>
  );
}
