"use client";
import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import Image from "next/image";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SiteMenu } from "@/components/marketing/SiteMenu";
import { WhatYouGet } from "@/components/marketing/WhatYouGet";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { Logo } from "@/components/ui/Logo";
import { IconCheck, IconArrowRight, IconFaceScan, IconClock, IconShield, IconSparkle } from "@/components/ui/icons";
import { BUNDLE_PRICE, DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";
import { FAQS } from "@/lib/v2/homeFaqs";
import { OPEN_COOKIE_PREFS_EVENT } from "@/components/ConsentBanner";

const NAV_LINKS = [
  { label: "Product", href: "#what-you-get" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Science", href: "#experts" },
  { label: "Pricing", href: "#pricing" },
];

const PROOF_POINTS = [
  { Icon: IconFaceScan, label: "20+ appearance metrics", color: "#2BB6A4" },
  { Icon: IconClock, label: "Under 2 minute analysis", color: "#E0B44A" },
  { Icon: IconShield, label: "Private by design", color: "#E0785F" },
  { Icon: IconSparkle, label: "Personalised recommendations", color: "#9C8FE0" },
];

const STEPS = [
  { n: "01", title: "Capture", body: "A short, guided photo sequence. No special equipment.", accent: "#1A9E8F" },
  { n: "02", title: "Analyse", body: "20+ metrics scored across skin, face, colour and hair.", accent: "#D9A62E" },
  { n: "03", title: "Understand", body: "Plain-language findings, not a raw data dump.", accent: "#C8503A" },
  { n: "04", title: "Improve", body: "A routine and recommendations built around your results.", accent: "#7C6CC4" },
];

const COMMAND_METRICS = [
  { label: "Skin Quality", value: "84", fill: 84 },
  { label: "Harmony", value: "87", fill: 87 },
  { label: "Angularity", value: "79", fill: 79 },
  { label: "Contrast", value: "High", fill: 78 },
  { label: "Undertone", value: "Warm", fill: 70 },
  { label: "Hair Compatibility", value: "78", fill: 78 },
];

const RECOMMENDATIONS = [
  "Skin routine: morning, evening, weekly",
  "Best colours for your season",
  "Hairstyles matched to your face shape",
  "Eyewear matched to your proportions",
  "One personalised report, yours to keep",
];

const TESTIMONIALS: { quote: string; name: string; rating: number }[] = [
  { quote: "I expected a basic face analysis, but Percept picked up details I had never really noticed before. The skin and colour recommendations felt surprisingly personal, and the report was actually easy to understand.", name: "Priyanka Vaish", rating: 5 },
  { quote: "What I liked most was that it didn't just give me scores. It explained what those scores meant and what I could actually do with them. The eyewear and face-shape suggestions were especially useful.", name: "Amit Singh", rating: 5 },
  { quote: "I've tried a few AI appearance tools before, but most of them feel gimmicky. Percept felt much more considered. The analysis was detailed, the interface was clean, and the recommendations made sense for my face.", name: "Abhinav Soni", rating: 4 },
  { quote: "The colour analysis was the part that surprised me most. Some shades I usually wear were clearly not doing me any favours, and the suggested palette made an immediate difference. It felt practical rather than generic.", name: "Saket Tiwari", rating: 5 },
];

const PRICING_FEATURES = [
  "Full skin, face & colour analysis",
  "Hairstyle recommendations, rendered on your photo",
  "Eyewear recommendations, previewed on you",
  "Personalised morning / evening / weekly routine",
];

function AnimatedPrice({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setDisplay(value); return; }
    const controls = animate(motionVal, value, {
      duration: 1, ease: [0.24, 0.43, 0.15, 0.97],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display}</>;
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--border-neutral)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "2rem", padding: "2.4rem 0", textAlign: "left", background: "none", border: "none", cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "1.8rem", fontWeight: 500, color: "var(--ink)" }}>{q}</span>
        <span aria-hidden style={{ flexShrink: 0, fontSize: "2rem", color: "var(--ink-secondary)", transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && <p style={{ margin: "0 0 2.4rem", fontSize: "1.5rem", lineHeight: 1.6, color: "var(--ink-secondary)", maxWidth: "68rem" }}>{a}</p>}
    </div>
  );
}

// One shared entrance animation for every section below the hero, so the
// page reads as one consistent motion language instead of each section
// having its own duration/easing/offset (or, for several sections, none
// at all — an inconsistency the previous pass left behind).
const REVEAL_TRANSITION = { duration: 0.55, ease: [0.24, 0.43, 0.15, 0.97] as const };
function Reveal({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={REVEAL_TRANSITION}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div aria-label={`${rating} out of 5 stars`} style={{ display: "flex", gap: "0.3rem", marginBottom: "1.2rem" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={i < rating ? "#D9A62E" : "none"} stroke="#D9A62E" strokeWidth="1.5" aria-hidden>
          <path strokeLinejoin="round" d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.3l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.5z" />
        </svg>
      ))}
    </div>
  );
}

export function HomeClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Threshold tracks the hero's own height so the header stays
    // transparent-over-image for as long as the full-bleed hero photo is on
    // screen, and only goes opaque once you've scrolled past it.
    const update = () => {
      const heroBottom = heroRef.current?.offsetHeight ?? 32;
      setHeaderScrolled(window.scrollY > Math.max(32, heroBottom - 72));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="pg-scope" style={{ minHeight: "100dvh", color: "var(--ink)" }}>
      <SiteMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <header className={`home-header${headerScrolled ? " is-scrolled" : ""}`} style={{ position: "fixed", top: "1.6rem", left: 0, right: 0, zIndex: 40, padding: "0 1.6rem" }}>
        <div className="home-header-inner" style={{
          maxWidth: "128rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.2rem 1.2rem 1.2rem 2.4rem", borderRadius: "9999px", border: "1px solid var(--border-neutral)",
          background: "rgba(248,248,246,0.82)", backdropFilter: "blur(10px)",
        }}>
          <a href="/" style={{ display: "block" }}>
            <Logo height="clamp(2.6rem, 7vw, 4.2rem)" />
          </a>
          <nav className="pg-nav-links">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
            <a href="/auth/login" className="pg-nav-signin">Sign in</a>
            <a href="/splash" className="pg-header-cta">
              <PrimaryButton size="xs" fullWidth={false}>Try Free</PrimaryButton>
            </a>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="pg-menu-btn"
              style={{ width: "4.4rem", height: "4.4rem", border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M4 8h16M4 16h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile gets a dedicated, image-led first impression. Keeping it
          separate avoids compromising the more spacious desktop hero. */}
      <section ref={heroRef} className="mobile-first-hero" aria-labelledby="mobile-hero-title">
        <Image
          src="/marketing/hero-desktop.png"
          alt="Editorial portrait showing natural skin texture"
          fill
          priority
          sizes="100vw"
          className="hero-desktop-image"
        />
        <Image
          src="/marketing/hero-portrait.png"
          alt="Editorial close-up portrait showing natural skin texture"
          fill
          priority
          sizes="100vw"
          className="mobile-hero-image"
        />
        <div className="mobile-hero-shade" />
        <div className="mobile-hero-copy">
          <p className="mobile-hero-kicker">AI skin, face and hair analysis</p>
          <h1 id="mobile-hero-title">Understand your features.<br />Improve what matters.</h1>
          <p className="mobile-hero-sub">A private AI-guided scan for clearer skin, face, hair and colour insights, personalized to you.</p>
          <div className="mobile-hero-actions">
            <a href="/splash">Start My Plan</a>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div className="hero-proof-points" aria-label="Key product benefits">
            <div><strong>20+ visual metrics</strong><span>Skin, face and hair insights</span></div>
            <div><strong>Personal to you</strong><span>Guidance shaped by your features</span></div>
            <div><strong>Track progress</strong><span>Compare results across scans</span></div>
          </div>
        </div>
      </section>

      {/* ── Proof strip: continuous marquee, not a wrapping row — avoids the
          awkward divider-orphan look a flex-wrap row gets on narrow screens
          once items drop to a second line. ── */}
      <section className="proof-strip" aria-label="Key product benefits">
        <div className="proof-track">
          {/* Four copies, not two: the marquee keyframe shifts by -50% (i.e. two
              copies), so each half must be wide enough to always cover the
              viewport — with only four slim items, two copies weren't, and a
              blank gap showed at the loop point. */}
          {[...PROOF_POINTS, ...PROOF_POINTS, ...PROOF_POINTS, ...PROOF_POINTS].map((p, i) => (
            <span key={i} className="proof-item" style={{ ["--proof-accent" as string]: p.color }}>
              <span className="proof-chip" aria-hidden><p.Icon size={1.4} strokeWidth={1.9} /></span>
              <span className="proof-label">{p.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── Reveal ── */}
      <section className="pg-section pg-container">
        <Reveal className="reveal-grid">
          <div>
            <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>How Percept reads a face</p>
            <h2 className="pg-h2" style={{ marginBottom: "1.6rem" }}>See what Percept sees.</h2>
            <p className="pg-body" style={{ marginBottom: "2.4rem" }}>Every scan is broken into named, scored zones. Not a vague impression, a specific read.</p>
            <div className="reveal-tags">
              <span>🧴 Skin</span>
              <span>🎨 Colour</span>
              <span>💇 Hair</span>
              <span>👓 Eyewear</span>
            </div>
            <div className="reveal-colour-bar" aria-hidden>
              {["#1A9E8F", "#C8503A", "#D9A62E", "#7C6CC4", "#2E7D5B"].map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div style={{ position: "relative", width: "100%", maxHeight: "52rem", aspectRatio: "1122/1402", borderRadius: "2rem", overflow: "hidden", margin: "0 auto" }}>
            <Image src="/marketing/reveal-face-scan.png" alt="AI face-scan overlay analysing skin, colour and proportions" fill sizes="(max-width: 900px) 100vw, 55vw" style={{ objectFit: "cover" }} />
          </div>
        </Reveal>
      </section>

      {/* ── Five systems ── */}
      <WhatYouGet />

      {/* ── Pricing: moved right after the value section (you just saw what
          you get, here's the price) rather than buried near the bottom.
          Two cards — report, and the bundle of report + consultation — the
          consultation's own detail lives inside the bundle card rather than
          repeating a third standalone tile for it. Dark inverted cards on
          the normal light page, not a full dark section, so it doesn't sit
          back-to-back with the dark command centre below it. Bundle total
          ($20) matches the real combo price computed in
          app/bundle/[sessionId]/page.tsx (report + consultation, no extra
          discount — same math, not a new number invented here). ── */}
      <section id="pricing" className="pg-section pg-container" style={{ paddingBlock: "clamp(5.6rem, 7vw, 7.2rem)" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <p className="pg-eyebrow" style={{ marginBottom: "1.2rem" }}>Pricing</p>
            <h2 className="pg-h2" style={{ fontSize: "clamp(2.8rem, 3vw, 3.8rem)" }}>The best value in personal analysis.</h2>
          </div>
          <div className="pricing-grid">
            {/* Report */}
            <div className="pricing-tile">
              <p className="pg-eyebrow" style={{ margin: "0 0 1.2rem", color: "rgba(255,255,255,0.5)" }}>AI report</p>
              <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "0.8rem" }}>
                <span style={{ fontSize: "2.2rem", fontWeight: 600, marginTop: "0.5rem", color: "#F2C85B" }}>$</span>
                <span style={{ fontSize: "5.6rem", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: "#F2C85B" }}>{BUNDLE_PRICE}</span>
              </div>
              <span className="price-note">One-time</span>
              <div className="pricing-rule" />
              <ul style={{ margin: "0 0 2.4rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
                {PRICING_FEATURES.map((f) => (
                  <li key={f} style={{ display: "flex", gap: "0.9rem", fontSize: "1.4rem", color: "rgba(255,255,255,0.85)" }}>
                    <span style={{ flexShrink: 0, marginTop: "0.2rem", display: "flex", color: "#F2C85B" }}><IconCheck size={1.3} strokeWidth={2.4} /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/splash"><PrimaryButton variant="onDark" fullWidth>Get my report · ${BUNDLE_PRICE}</PrimaryButton></a>
            </div>

            {/* Bundle — featured */}
            <div className="pricing-tile pricing-tile-featured">
              <div aria-hidden style={{ position: "absolute", top: "-30%", right: "-20%", width: "30rem", height: "30rem", borderRadius: "50%", background: "radial-gradient(circle, rgba(217,166,46,0.3) 0%, transparent 70%)", pointerEvents: "none" }} />
              <span style={{ position: "relative", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#082f2b", background: "#F2C85B", padding: "0.5rem 1.1rem", marginBottom: "1.2rem" }}>
                Best value
              </span>
              <p className="pg-eyebrow" style={{ position: "relative", margin: "0 0 1.2rem", color: "rgba(255,255,255,0.55)" }}>Report + Consultation</p>
              <div style={{ position: "relative", display: "flex", alignItems: "flex-start", marginBottom: "0.8rem" }}>
                <span style={{ fontSize: "2.2rem", fontWeight: 600, marginTop: "0.5rem", color: "#F2C85B" }}>$</span>
                <span style={{ fontSize: "5.6rem", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: "#F2C85B" }}><AnimatedPrice value={BUNDLE_PRICE + DOCTOR_CONSULTATION_PRICE} /></span>
              </div>
              <span className="price-note" style={{ position: "relative" }}>One-time · everything included</span>
              <div className="pricing-rule" style={{ position: "relative" }} />
              <ul style={{ position: "relative", margin: "0 0 2.4rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
                <li style={{ display: "flex", gap: "0.9rem", fontSize: "1.4rem", color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>
                  <span style={{ flexShrink: 0, marginTop: "0.2rem", display: "flex", color: "#F2C85B" }}><IconCheck size={1.3} strokeWidth={2.4} /></span>
                  Everything in the AI report
                </li>
                <li style={{ display: "flex", gap: "0.9rem", fontSize: "1.4rem", color: "rgba(255,255,255,0.92)", fontWeight: 600 }}>
                  <span style={{ flexShrink: 0, marginTop: "0.2rem", display: "flex", color: "#F2C85B" }}><IconCheck size={1.3} strokeWidth={2.4} /></span>
                  Everything in the consultation
                </li>
                <li style={{ display: "flex", gap: "0.9rem", fontSize: "1.4rem", color: "rgba(255,255,255,0.85)" }}>
                  <span style={{ flexShrink: 0, marginTop: "0.2rem", display: "flex", color: "#F2C85B" }}><IconCheck size={1.3} strokeWidth={2.4} /></span>
                  One checkout, no extra steps
                </li>
              </ul>
              <a href="/splash" style={{ position: "relative", display: "block" }}><PrimaryButton variant="onDark" fullWidth>Get the bundle · ${BUNDLE_PRICE + DOCTOR_CONSULTATION_PRICE}</PrimaryButton></a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Command centre ── */}
      <section id="command-centre" className="pg-section" style={{ background: "var(--ink)", color: "var(--bg-neutral)", borderTopColor: "rgba(255,255,255,0.1)" }}>
        <Reveal className="pg-container command-grid">
          <div>
            <p className="pg-eyebrow" style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1.6rem" }}>Command centre</p>
            <h2 className="pg-h2" style={{ color: "var(--bg-neutral)", marginBottom: "1.6rem" }}>Everything about your appearance. One place.</h2>
            <p className="pg-body" style={{ color: "rgba(255,255,255,0.62)", marginBottom: "3.2rem" }}>
              One score per system, tracked in one report.
            </p>
            <div className="command-metrics">
              {COMMAND_METRICS.map((m) => (
                <div key={m.label} className="command-metric-row">
                  <span className="command-metric-label">{m.label}</span>
                  <span className="command-metric-track">
                    <span className="command-metric-thumb" style={{ left: `${m.fill}%` }} />
                  </span>
                  <span className="command-metric-value">{m.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", width: "100%", aspectRatio: "1672/941", borderRadius: "2rem", overflow: "hidden" }}>
            <Image src="/marketing/what-you-get/grooming.png" alt="Percept grooming and hairstyle analysis dashboard" fill sizes="(max-width: 900px) 100vw, 55vw" style={{ objectFit: "cover" }} />
          </div>
        </Reveal>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="pg-section pg-container pg-section-inset" style={{ background: "var(--surface-neutral)" }}>
        <Reveal>
          <h2 className="pg-h2" style={{ marginBottom: "6rem", maxWidth: "60rem" }}>From selfie to insight in minutes.</h2>
          <div className="steps-grid">
            {STEPS.map((s) => (
              <div key={s.n} className="step-card" style={{ ["--step-accent" as string]: s.accent }}>
                <span className="step-number">{s.n}</span>
                <h3 className="pg-card-h step-title">{s.title}</h3>
                <p className="step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Recommendations ── */}
      <section id="recommendations" className="pg-section pg-container">
        <Reveal className="reveal-grid reveal-grid-reverse">
          <ProductPreview defaultTab="frame" image="/marketing/portraits/deep-brown.png" />
          <div>
            <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Recommendations</p>
            <h2 className="pg-h2" style={{ marginBottom: "1.6rem" }}>Know what suits you. And why.</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {RECOMMENDATIONS.map((r) => (
                <li key={r} style={{ display: "flex", gap: "1rem", fontSize: "1.6rem", color: "var(--ink)" }}>
                  <IconCheck size={1.5} strokeWidth={2.4} />
                  {r}
                </li>
              ))}
            </ul>
            <a href="/perceptgpt" style={{ display: "inline-flex", alignItems: "center", gap: "0.8rem", marginTop: "2.4rem", fontSize: "1.4rem", fontWeight: 600, color: "var(--ink)" }}>
              💬 Have a question about your report? Ask PerceptGPT →
            </a>
          </div>
        </Reveal>
      </section>

      {/* ── Progress ── */}
      <section id="progress" className="pg-section pg-container progress-section pg-section-inset" style={{ paddingBlock: "clamp(6rem, 8vw, 8.4rem)" }}>
        <Reveal className="progress-band">
          <div className="progress-copy">
            <p className="pg-eyebrow" style={{ marginBottom: "0.8rem", color: "rgba(255,255,255,0.5)" }}>Progress</p>
            <h2 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(2.4rem, 2.4vw, 3rem)", fontWeight: 400, letterSpacing: "-0.01em", color: "#F5F5F3", margin: 0 }}>
              See what changes over time.
            </h2>
            <p className="progress-sub">
              Re-scan every few weeks in the same light and angle. Guided capture holds both steady, so the trend line reflects real change — not the room.
            </p>
            <div className="progress-legend">
              <span><i className="progress-legend-dot progress-legend-first" />First scan · 68</span>
              <span><i className="progress-legend-dot progress-legend-last" />Latest scan · 84</span>
            </div>
          </div>

          {/* Self-contained sparkline — no chart library, matching the other
              hand-rolled marks on this page. `non-scaling-stroke` keeps the
              line crisp as the SVG scales to the card width. */}
          <figure className="progress-card">
            <figcaption className="progress-card-head">
              <span className="progress-card-title">Percept score</span>
              <span className="progress-delta">+16 pts</span>
            </figcaption>
            <svg className="progress-spark" viewBox="0 0 320 150" role="img" aria-label="Percept score rising from 68 to 84 across six scans">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1A9E8F" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#1A9E8F" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* horizontal gridlines */}
              <line x1="12" y1="24" x2="308" y2="24" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="12" y1="70" x2="308" y2="70" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <line x1="12" y1="116" x2="308" y2="116" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              {/* dashed baseline at the first score, so the climb above it is legible */}
              <line x1="12" y1="118.8" x2="308" y2="118.8" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 4" />
              <path d="M12,118.8 L71.2,101.4 L130.4,113 L189.6,74 L248.8,50.2 L308,27.6 L308,138 L12,138 Z" fill="url(#sparkFill)" />
              <path d="M12,118.8 L71.2,101.4 L130.4,113 L189.6,74 L248.8,50.2 L308,27.6" fill="none" stroke="#1A9E8F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <circle cx="12" cy="118.8" r="3.5" fill="#0B2420" stroke="#1A9E8F" strokeWidth="2" />
              <circle cx="308" cy="27.6" r="4.5" fill="#1A9E8F" />
            </svg>
            <div className="progress-card-foot">
              <span>6 scans · 9 weeks</span>
              <span className="progress-up">24% higher than first scan</span>
            </div>
          </figure>
        </Reveal>
      </section>

      {/* ── Expert / Science ── */}
      <section id="experts" className="expert-section pg-section" style={{ paddingBlock: "clamp(6rem, 8vw, 9rem)" }}>
        <div className="pg-container" style={{ maxWidth: "92rem" }}>
          <Reveal className="experts-grid">
            <div className="expert-photo">
              <Image src="/marketing/expert-dermatologist.png" alt="Dermatologist" fill sizes="(max-width: 700px) 100vw, 24rem" style={{ objectFit: "cover" }} />
            </div>
            <div>
              <p className="pg-eyebrow" style={{ color: "var(--accent-muted)", marginBottom: "1.2rem" }}>Expert review</p>
              <h2 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(2.6rem, 2.6vw, 3.4rem)", fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.15, color: "#F5F5F3", marginBottom: "1.4rem" }}>
                Every report is reviewed by a licensed dermatologist.
              </h2>
              <p style={{ fontSize: "1.5rem", color: "rgba(245,245,243,0.72)", lineHeight: 1.6, marginBottom: "1.8rem", maxWidth: "44rem" }}>
                A real dermatologist reviews your case and follows up directly, usually within 24 hours. Not a chatbot reply, a licensed professional.
              </p>
              <div className="expert-creds">
                <span>Board-certified</span>
                <span>Replies within 24h</span>
                <span>Human, not a bot</span>
              </div>
              <p className="expert-cite">
                First impressions form in under 100ms, Willis &amp; Todorov, <em>Psychological Science</em>, 2006.
              </p>
              <a href="/splash"><PrimaryButton size="md" variant="onDark" fullWidth={false}>Talk to a dermatologist · ${DOCTOR_CONSULTATION_PRICE}</PrimaryButton></a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Testimonials: auto-scrolling carousel, same marquee technique as
          the proof strip, so cards keep moving rather than sitting static. ── */}
      <section id="testimonials" className="pg-section" style={{ background: "var(--surface-neutral)" }}>
        <div className="pg-container">
          <Reveal>
            <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Testimonials</p>
            <h2 className="pg-h2" style={{ marginBottom: "4rem", maxWidth: "56rem" }}>What people notice first.</h2>
          </Reveal>
        </div>
        <div className="testi-track-wrap">
          <div className="testi-track">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div key={i} className="pg-card testi-card">
                <StarRating rating={t.rating} />
                <p style={{ fontSize: "1.5rem", fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.5, color: "var(--ink)", marginBottom: "1.6rem" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p style={{ fontSize: "1.3rem", fontWeight: 500, color: "var(--ink-secondary)", margin: 0 }}>{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="pg-section" style={{ background: "var(--surface-neutral)" }}>
        <div className="pg-container" style={{ maxWidth: "80rem" }}>
          <Reveal>
            <h2 className="pg-h2" style={{ marginBottom: "4rem" }}>Frequently asked questions</h2>
            <div>
              {FAQS.map((f) => <FaqRow key={f.q} q={f.q} a={f.a} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="pg-section pg-container" style={{ textAlign: "center" }}>
        <Reveal>
          <h2 className="pg-h2" style={{ marginBottom: "2rem" }}>See yourself more clearly.</h2>
          <p className="pg-body" style={{ margin: "0 auto 3.6rem" }}>Your first scores are free. Takes under two minutes.</p>
          <a href="/splash"><PrimaryButton size="lg" fullWidth={false}>Start My Plan</PrimaryButton></a>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border-neutral)", padding: "6rem 0" }}>
        <div className="pg-container footer-grid">
          <div>
            <Logo height="clamp(2.6rem, 7vw, 4.2rem)" />
            <p style={{ fontSize: "1.3rem", color: "var(--ink-secondary)", marginTop: "1.6rem", maxWidth: "32rem", lineHeight: 1.6 }}>
              AI skin, face and hair analysis. Cosmetic insight, not a medical diagnosis.
            </p>
          </div>
          <div>
            <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Product</p>
            <FooterLinks links={[
              { label: "What you get", href: "#what-you-get" },
              { label: "How it works", href: "#how-it-works" },
              { label: "Science", href: "#experts" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ]} />
          </div>
          <div>
            <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Legal</p>
            <FooterLinks links={[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
            ]} />
            <button
              onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT))}
              style={{ display: "block", marginTop: "1rem", fontSize: "1.4rem", color: "var(--ink-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Cookie Preferences
            </button>
          </div>
          <div>
            <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Support</p>
            <FooterLinks links={[
              { label: "support@percept.skin", href: "mailto:support@percept.skin" },
              { label: "Help & FAQ", href: "#faq" },
            ]} />
          </div>
        </div>
        <div className="pg-container" style={{ marginTop: "4.8rem", paddingTop: "2.4rem", borderTop: "1px solid var(--border-neutral)" }}>
          <p style={{ fontSize: "1.2rem", color: "var(--ink-secondary)" }}>© 2026 Percept. Cosmetic and wellness insight only, not a medical diagnosis.</p>
        </div>
      </footer>

      <style jsx>{`
        /* .home-header, .pg-nav-links/.pg-nav-signin/.pg-menu-btn,
           .mobile-first-hero and everything inside it (images, shade, copy,
           kicker, h1, sub, actions, proof-points) — base rules and their
           is-scrolled/responsive states — all live in app/globals.css
           instead of here. See the comment there. */
        .proof-strip {
          position: relative; z-index: 1;
          overflow: hidden;
          background: var(--bg-neutral);
          padding-block: 0.7rem;
          border-top: 1px solid var(--border-neutral);
          border-bottom: 1px solid var(--border-neutral);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%);
        }
        /* :global — styled-jsx scopes the animation-name token inside a plain
           rule, rewriting the marquee name to a hashed one that never matches
           the global keyframes in app/globals.css, so the animation silently
           never runs (in every browser, not just iOS). Wrapping in :global
           keeps the name intact. Same reason the grid rules above use it. */
        :global(.proof-track) {
          display: flex; width: max-content; min-width: max-content; gap: 0;
          animation: marquee 34s linear infinite;
          will-change: transform;
        }
        /* Slim, borderless items separated by a hairline rule. Icon sits in a
           faint tint of its accent and is stroked in that accent — colourful
           but low-contrast enough to sit quietly on the dark strip. */
        :global(.proof-item) {
          display: inline-flex; align-items: center; gap: 0.7rem;
          flex-shrink: 0;
          padding: 0.2rem 1.8rem;
          border-left: 1px solid var(--border-neutral);
          white-space: nowrap;
        }
        :global(.proof-label) {
          font-size: 1.12rem; font-weight: 650; letter-spacing: 0.05em;
          text-transform: uppercase; color: var(--ink);
        }
        :global(.proof-chip) {
          display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          width: 2rem; height: 2rem;
          color: var(--proof-accent);
          background: color-mix(in srgb, var(--proof-accent) 15%, transparent);
        }
        /* Marquee intentionally keeps moving even under prefers-reduced-motion:
           it is decorative continuous motion, and several iOS devices ship with
           Reduce Motion on by default, which left the strip frozen and clipped. */

        .reveal-tags { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.6rem; }
        .reveal-tags span {
          display: inline-flex; align-items: center; gap: 0.6rem;
          font-size: 1.3rem; font-weight: 500; color: var(--ink);
          padding: 0.7rem 1.4rem; border-radius: 999px; border: 1px solid var(--border-neutral);
          background: var(--surface-neutral);
        }
        .reveal-colour-bar { display: flex; gap: 0.5rem; }
        .reveal-colour-bar span { width: 3.2rem; height: 0.8rem; border-radius: 999px; }

        /* :global — all of these (reveal-grid, command-grid, steps-grid,
           experts-grid) are now applied directly to the
           Reveal wrapper's motion.div, which — same root cause noted above —
           never receives styled-jsx's scope class, so a scoped selector here
           would silently never match. */
        :global(.reveal-grid) { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 5.6rem; align-items: center; }
        :global(.reveal-grid-reverse) { grid-template-columns: 1.2fr 0.8fr; }
        :global(.reveal-grid-reverse) > div:first-child { order: 2; }
        :global(.reveal-grid-reverse) > div:last-child { order: 1; }

        :global(.command-grid) { display: grid; grid-template-columns: 0.85fr 1.15fr; gap: 5.6rem; align-items: center; }
        .command-metrics { display: flex; flex-direction: column; }
        .command-metric-row { display: grid; grid-template-columns: 13rem 1fr 5rem; align-items: center; gap: 1.6rem; padding: 1.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .command-metric-row:last-child { border-bottom: none; }
        .command-metric-label { font-size: 1.3rem; color: rgba(255,255,255,0.7); }
        .command-metric-value { font-size: 1.8rem; font-weight: 600; letter-spacing: -0.01em; text-align: right; }
        .command-metric-track {
          position: relative; height: 0.5rem; border-radius: 999px;
          background: linear-gradient(90deg, #E8604F 0%, #D9A62E 25%, #1A9E8F 50%, #D9A62E 75%, #E8604F 100%);
          opacity: 0.75;
        }
        .command-metric-thumb {
          position: absolute; top: 50%; width: 1.5rem; height: 0.9rem; border-radius: 999px;
          background: #fff; box-shadow: 0 0.2rem 0.6rem rgba(0,0,0,0.4);
          transform: translate(-50%, -50%);
        }

        :global(.steps-grid) { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.6rem; }
        /* Flat card per step: hairline border, a solid accent rule on top, and
           the step number rendered in that same accent. Lifts and outlines in
           the accent colour on hover. */
        .step-card {
          display: flex; flex-direction: column;
          padding: 2.6rem 2.2rem 2.4rem;
          background: var(--bg-neutral);
          border: 1px solid var(--border-neutral);
          border-top: 3px solid var(--step-accent);
          transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;
        }
        .step-card:hover {
          transform: translateY(-4px);
          border-color: var(--step-accent);
          background: color-mix(in srgb, var(--step-accent) 7%, var(--bg-neutral));
        }
        .step-number {
          font-size: clamp(2.8rem, 3vw, 3.6rem); font-weight: 700;
          letter-spacing: -0.02em; line-height: 1;
          color: var(--step-accent); font-variant-numeric: tabular-nums;
        }
        :global(.step-title) { margin: 1.4rem 0 0.6rem; font-size: 1.9rem; }
        :global(.step-body) { font-size: 1.35rem; color: var(--ink-secondary); line-height: 1.55; margin: 0; }

        :global(.progress-band) { display: grid; grid-template-columns: 1fr 1fr; gap: 4.8rem; align-items: center; }
        /* Dark green band, same family as the pricing tiles and expert section
           — the previous white-on-white version read as an empty gap. Copy
           left, a score-trend card right, both on the dark ground. */
        /* Equal light gutter above and below a banded section so it reads as a
           distinct block rather than merging with its neighbours. Shared by
           the steps ("From selfie to insight") and progress sections. */
        :global(.pg-section-inset) { margin-block: clamp(2.4rem, 4vw, 4rem); }

        .progress-section {
          color: #F5F5F3;
          background:
            radial-gradient(120% 80% at 88% 0%, rgba(26,158,143,0.16) 0%, transparent 55%),
            linear-gradient(180deg, #0B211E 0%, #091917 100%);
          border-top: 1px solid rgba(255,255,255,0.08);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .progress-copy { max-width: 40rem; }
        .progress-sub { margin: 1.4rem 0 0; font-size: 1.4rem; line-height: 1.6; color: rgba(255,255,255,0.62); }
        .progress-legend { display: flex; flex-wrap: wrap; gap: 1.6rem 2.4rem; margin-top: 2rem; }
        .progress-legend span { display: inline-flex; align-items: center; gap: 0.7rem; font-size: 1.2rem; color: rgba(255,255,255,0.75); }
        .progress-legend-dot { width: 0.9rem; height: 0.9rem; flex-shrink: 0; }
        .progress-legend-first { background: transparent; box-shadow: inset 0 0 0 2px #1A9E8F; }
        .progress-legend-last { background: #1A9E8F; }
        .progress-card {
          margin: 0;
          border: 1px solid rgba(255,255,255,0.1);
          border-top: 3px solid #1A9E8F;
          background: #0B2420;
          padding: 2rem 2.2rem 1.7rem;
        }
        .progress-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.4rem; }
        .progress-card-title { font-size: 1.05rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.55); }
        .progress-delta { font-size: 1.05rem; font-weight: 700; letter-spacing: 0.03em; color: #04120F; background: #1A9E8F; padding: 0.35rem 0.8rem; }
        .progress-spark { display: block; width: 100%; height: auto; }
        .progress-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 1.2rem; margin-top: 1.4rem; padding-top: 1.2rem; border-top: 1px solid rgba(255,255,255,0.08); font-size: 1.15rem; color: rgba(255,255,255,0.5); }
        .progress-up { color: #2BB6A4; font-weight: 650; text-align: right; }

        .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: stretch; max-width: 82rem; margin: 0 auto; }
        /* Flat, squared tiles that match the rest of the page. Emphasis on the
           featured plan comes from a gold edge + elevation, not a scale bump
           (which was overflowing its column and blurring on sub-pixel edges). */
        .pricing-tile {
          position: relative; display: flex; flex-direction: column;
          padding: 3.2rem; background: #0B2420;
          border: 1px solid rgba(255,255,255,0.1);
          border-top: 3px solid rgba(255,255,255,0.16);
        }
        .pricing-tile-featured {
          overflow: hidden;
          border-color: rgba(224,180,74,0.55);
          border-top: 3px solid #E0B44A;
          box-shadow: 0 2.4rem 6rem -2rem rgba(0,0,0,0.55);
          transform: none;
        }
        .pricing-rule { height: 1px; background: rgba(255,255,255,0.1); margin: 0 0 2rem; }
        .price-note {
          align-self: flex-start; margin: -0.6rem 0 1.8rem;
          font-size: 1.1rem; letter-spacing: 0.06em; text-transform: uppercase;
          color: rgba(255,255,255,0.45);
        }
        .expert-section {
          color: #F5F5F3;
          /* Near-black, with a faint teal wash top-right so it is not a dead
             flat black. */
          background:
            radial-gradient(130% 90% at 85% -5%, rgba(26,158,143,0.11) 0%, transparent 55%),
            #0B0B0B;
          border-top: 1px solid rgba(255,255,255,0.08);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        :global(.experts-grid) { display: flex; gap: 4rem; align-items: center; }
        .expert-photo {
          position: relative; width: 100%; max-width: 24rem; aspect-ratio: 4 / 5;
          border-radius: 1.6rem; overflow: hidden; flex-shrink: 0;
          border: 1px solid rgba(207,227,222,0.18);
          box-shadow: 0 2.4rem 6rem -2rem rgba(0,0,0,0.6);
        }
        .expert-creds { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 2rem; }
        .expert-creds span {
          font-size: 1.25rem; font-weight: 500; color: rgba(245,245,243,0.82);
          padding: 0.6rem 1.2rem; border-radius: 999px;
          border: 1px solid rgba(207,227,222,0.2); background: rgba(255,255,255,0.03);
        }
        .expert-cite {
          font-size: 1.2rem; color: rgba(245,245,243,0.42); line-height: 1.5;
          border-left: 2px solid rgba(217,166,46,0.6); padding-left: 1.2rem;
          margin-bottom: 2.4rem; max-width: 40rem;
        }
        .testi-track-wrap {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, #000 4%, #000 96%, transparent 100%);
        }
        :global(.testi-track) { display: flex; width: max-content; min-width: max-content; gap: 2.4rem; padding: 0 3.2rem; animation: marquee 42s linear infinite; will-change: transform; }
        :global(.testi-card) { width: 38rem; flex-shrink: 0; padding: 3.2rem; }
        /* Auto-scroll kept on under prefers-reduced-motion — see proof-track note. */
        .footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 4rem; }

        #what-you-get, #how-it-works, #experts, #pricing, #faq, #command-centre, #recommendations, #progress, #testimonials {
          scroll-margin-top: 9rem;
        }

        @media (max-width: 700px) {
          /* Hero/header-specific mobile overrides live in the matching
             @media block in app/globals.css instead of here. */
          :global(.reveal-grid), :global(.reveal-grid-reverse), :global(.command-grid) { grid-template-columns: 1fr !important; }
          :global(.reveal-grid-reverse) > div:first-child, :global(.reveal-grid-reverse) > div:last-child { order: initial; }
          :global(.steps-grid) { grid-template-columns: 1fr 1fr; gap: 1.2rem; }
          .step-card { padding: 2rem 1.6rem 1.8rem; }
          :global(.step-title) { font-size: 1.7rem; }
          :global(.experts-grid) { flex-direction: column; align-items: center; text-align: left; }
          :global(.experts-grid) > div:last-child { width: 100%; }
          .pricing-grid { grid-template-columns: 1fr; }
          .pricing-tile-featured { transform: none; order: -1; }
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 3.2rem; }
          :global(.progress-band) { grid-template-columns: 1fr; gap: 2.4rem; }
          .progress-card-foot { flex-direction: column; align-items: flex-start; gap: 0.4rem; }
          .progress-up { text-align: left; }
        }
      `}</style>
    </div>
  );
}

function FooterLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {links.map((l) => (
        <a key={l.href} href={l.href} style={{ fontSize: "1.4rem", color: "var(--ink-secondary)" }}>{l.label}</a>
      ))}
    </div>
  );
}
