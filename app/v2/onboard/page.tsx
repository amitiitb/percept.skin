"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const SCREENS = [
  {
    eyebrow: "Personal beauty analysis",
    title: "Guided photographs, understood by AI",
    body: "Glowmetry analyzes your skin, face, hair, and scalp using a short guided photo session. No lab visit, no waiting.",
  },
  {
    eyebrow: "Detailed personal insights",
    title: "See what's really going on",
    body: "Skin texture, fine lines, pores, pigmentation, facial balance, hair density, scalp visibility, estimated skin age, and personalised recommendations.",
  },
  {
    eyebrow: "Track improvement",
    title: "Watch it change over time",
    body: "Save every report and compare future scans under similar lighting to see visible changes over weeks and months.",
  },
] as const;

function SampleReportPreview() {
  // Design review Decision #15 — static/illustrative sample, no backend call, no fake account.
  // Padding/sizes trimmed (2026-07-27) so this step's CTA doesn't sit below the
  // fold on short viewports — same bug class as the earlier step-1 fix, found
  // while verifying the header/footer changes above didn't regress this step.
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2rem", filter: "saturate(0.9)" }}>
      <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.8rem" }}>Sample report</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem", marginBottom: "0.6rem" }}>
        <strong style={{ fontSize: "4.4rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1 }}>78</strong>
        <span style={{ fontSize: "1.6rem", color: "var(--secondary)" }}>Glow Score · Good</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1.2rem" }}>
        {["Skin texture", "Hydration", "Hair density", "Scalp visibility"].map((m) => (
          <div key={m} style={{ background: "var(--wash)", borderRadius: "0.8rem", padding: "1rem" }}>
            <p style={{ fontSize: "1.2rem", color: "var(--secondary)", margin: "0 0 0.4rem" }}>{m}</p>
            <strong style={{ fontSize: "2rem", color: "var(--primary)", fontWeight: 500 }}>{60 + (m.length % 30)}</strong>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "1.3rem", color: "var(--muted)", marginTop: "1rem" }}>This is what your own report will look like, illustrative only.</p>
    </div>
  );
}

export default function V2OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0-2 = explainer screens, 3 = sample report preview
  const total = 4;

  const next = () => (step < total - 1 ? setStep(step + 1) : router.push("/auth/signup?next=/v2/profile-setup"));
  const skip = () => router.push("/auth/signup?next=/v2/profile-setup");

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", padding: "1.6rem 2.4rem 0", maxWidth: "72rem", margin: "0 auto", width: "100%" }}>
        {/* Always rendered at fixed size (visibility toggled, not unmounted) so
            the progress dots never shift horizontally when Back appears/disappears. */}
        <button
          onClick={() => setStep(step - 1)}
          aria-label="Go back"
          disabled={step === 0}
          style={{
            width: "3.6rem", height: "3.6rem", flexShrink: 0, borderRadius: "50%", border: "1px solid var(--line)",
            background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            visibility: step === 0 ? "hidden" : "visible", pointerEvents: step === 0 ? "none" : "auto",
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--secondary)" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{ width: "3.2rem", height: "0.4rem", borderRadius: "9999px", background: i <= step ? "var(--primary)" : "var(--line)" }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {step < total - 1 && (
          <button onClick={skip} style={{ background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", flexShrink: 0 }}>
            Skip
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "1.6rem 2.4rem", maxWidth: "72rem", margin: "0 auto", width: "100%" }}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.28 }}>
            {step < 3 ? (
              <>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: step === 0 ? "0.8rem" : "1.6rem" }}>
                  {SCREENS[step].eyebrow}
                </p>
                <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.4rem)", fontWeight: 400, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: step === 0 ? "1rem" : "2rem" }}>
                  {SCREENS[step].title}
                </h1>
                <p style={{ fontSize: "1.8rem", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "52rem", marginBottom: step === 0 ? "1.2rem" : 0 }}>
                  {SCREENS[step].body}
                </p>
                {step === 0 && (
                  <div style={{
                    position: "relative", height: "min(26vh, 21rem)", borderRadius: "2rem", overflow: "hidden",
                    margin: "0 auto", background: "linear-gradient(155deg, var(--sage) 0%, var(--surface) 100%)",
                  }}>
                    <Image
                      src="/assets/selfie-capture-guide.png"
                      alt="Guided photo capture with an on-screen framing guide"
                      fill
                      priority
                      sizes="(max-width: 700px) 90vw, 40rem"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1rem" }}>
                  See it before you sign up
                </p>
                <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", fontWeight: 400, color: "var(--primary)", lineHeight: 1.1, marginBottom: "1.4rem" }}>
                  Here&apos;s what you&apos;ll get
                </h1>
                <SampleReportPreview />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ padding: "1.2rem 2.4rem 2rem", maxWidth: "72rem", margin: "0 auto", width: "100%" }}>
        <p style={{ fontSize: "1.2rem", color: "var(--muted)", lineHeight: 1.5, marginBottom: "1.2rem", textAlign: "center" }}>
          Glowmetry offers cosmetic and wellness insights and is not a substitute for professional medical advice.
        </p>
        {/* CTA always gets full width — a long label like "Get Started →" was
            wrapping to two lines when squeezed into a 50/50 split with Back. */}
        <PrimaryButton onClick={next}>{step < total - 1 ? "Continue →" : "Get Started →"}</PrimaryButton>
      </div>
    </div>
  );
}
