"use client";
import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import Image from "next/image";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SiteMenu } from "@/components/marketing/SiteMenu";
import { WhatYouGet } from "@/components/marketing/WhatYouGet";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { Logo } from "@/components/ui/Logo";
import { IconCheck, IconArrowRight, IconShield, IconSparkle, IconClock } from "@/components/ui/icons";
import { BUNDLE_PRICE, DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";
import { FAQS } from "@/lib/v2/homeFaqs";
import { OPEN_COOKIE_PREFS_EVENT } from "@/components/ConsentBanner";

const HEADLINE_WORDS = "See your skin, face, and hair more clearly".split(" ");

const TRUST_BADGES = [
  { Icon: IconShield, label: "Private & Secure" },
  { Icon: IconSparkle, label: "AI-Powered Analysis" },
  { Icon: IconClock, label: "Under 2 minutes" },
] as const;

const NAV_LINKS = [
  { label: "Product", href: "#what-you-get" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Science", href: "#experts" },
  { label: "Pricing", href: "#pricing" },
];

const PROOF_POINTS = [
  { icon: "📊", label: "20+ appearance metrics", color: "#1A9E8F" },
  { icon: "⏱️", label: "Under 2 minute analysis", color: "#D9A62E" },
  { icon: "🔒", label: "Private by design", color: "#C8503A" },
  { icon: "✨", label: "Personalised recommendations", color: "#7C6CC4" },
];

const STEPS = [
  { n: "01", title: "Capture", body: "A short, guided photo sequence. No special equipment." },
  { n: "02", title: "Analyse", body: "20+ metrics scored across skin, face, colour and hair." },
  { n: "03", title: "Understand", body: "Plain-language findings, not a raw data dump." },
  { n: "04", title: "Improve", body: "A routine and recommendations built around your results." },
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

const TESTIMONIALS: { quote: string; name: string }[] = [
  { quote: "I expected a basic face analysis, but Percept picked up details I had never really noticed before. The skin and colour recommendations felt surprisingly personal, and the report was actually easy to understand.", name: "Priyanka Vaish" },
  { quote: "What I liked most was that it didn't just give me scores. It explained what those scores meant and what I could actually do with them. The eyewear and face-shape suggestions were especially useful.", name: "Amit Singh" },
  { quote: "I've tried a few AI appearance tools before, but most of them feel gimmicky. Percept felt much more considered. The analysis was detailed, the interface was clean, and the recommendations made sense for my face.", name: "Abhinav Soni" },
  { quote: "The colour analysis was the part that surprised me most. Some shades I usually wear were clearly not doing me any favours, and the suggested palette made an immediate difference. It felt practical rather than generic.", name: "Saket Tiwari" },
];

const PRICING_FEATURES = [
  "Full skin, face & colour analysis",
  "Hairstyle recommendations, rendered on your photo",
  "Eyewear recommendations, previewed on you",
  "Personalised morning / evening / weekly routine",
  "One-time payment, no subscription",
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
              <PrimaryButton size="sm" fullWidth={false}>Try Free</PrimaryButton>
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
          src="/assets/percept-hero-desktop-v3.png"
          alt="Editorial portrait showing natural skin texture"
          fill
          priority
          sizes="100vw"
          className="hero-desktop-image"
        />
        <Image
          src="/assets/percept-hero-portrait-v2.png"
          alt="Editorial close-up portrait showing natural skin texture"
          fill
          priority
          sizes="100vw"
          className="mobile-hero-image"
        />
        <div className="mobile-hero-shade" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.24, 0.43, 0.15, 0.97], delay: 0.15 }}
        >
          {/* styled-jsx doesn't inject its scope class onto motion.* components
              in this Next 16/Turbopack setup, only literal DOM tags — so the
              scoped class lives on this plain nested div, not the motion.div
              above, or every rule keyed off .mobile-hero-copy silently never
              matches (positioning collapses, h1 shrinks to inherited 1rem). */}
          <div className="mobile-hero-copy">
            <p className="mobile-hero-kicker">AI skin, face and hair analysis</p>
            <h1 id="mobile-hero-title">Understand your features.<br />Improve what matters.</h1>
            <p className="mobile-hero-sub">A private AI-guided scan for clearer skin, face, hair and colour insights, personalized to you.</p>
            <div className="mobile-hero-actions">
              <a href="/splash">Start my plan</a>
              <a href="#how-it-works">How it works</a>
            </div>
            <div className="hero-proof-points" aria-label="Key product benefits">
              <div><strong>20+ visual metrics</strong><span>Skin, face and hair insights</span></div>
              <div><strong>Personal to you</strong><span>Guidance shaped by your features</span></div>
              <div><strong>Track progress</strong><span>Compare results across scans</span></div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Hero ── */}
      <section className="desktop-home-hero" style={{ position: "relative", padding: "6.4rem 3.2rem 8rem" }}>
        <div className="percept-hero-grid" style={{ position: "relative", maxWidth: "120rem", margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "5.6rem", alignItems: "center" }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.6rem" }}>
              Personal beauty analysis
            </p>
            <h1 style={{ fontSize: "clamp(3.4rem, 5.5vw, 5.6rem)", fontWeight: 600, color: "var(--ink)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: "2.4rem" }}>
              {HEADLINE_WORDS.map((word, i) => {
                const isLast = i === HEADLINE_WORDS.length - 1;
                return (
                  <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
                    <motion.span
                      style={{ display: "inline-block", color: isLast ? "var(--ink-secondary)" : undefined }}
                      initial={{ y: "110%" }}
                      animate={{ y: "0%" }}
                      transition={{ duration: 0.6, delay: 0.15 + i * 0.07, ease: [0.24, 0.43, 0.15, 0.97] }}
                    >
                      {word}&nbsp;
                    </motion.span>
                  </span>
                );
              })}
            </h1>
            <p className="pg-body" style={{ marginBottom: "2.8rem" }}>
              A guided photo scan, read by AI. Clear, specific, and easy to track over time.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", flexWrap: "wrap", marginBottom: "3.2rem" }}>
              {TRUST_BADGES.map(({ Icon, label }, i) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "1.4rem" }}>
                  {i > 0 && <span aria-hidden style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: "var(--border-neutral)", flexShrink: 0 }} />}
                  <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "1.4rem", fontWeight: 500, color: "var(--ink-secondary)" }}>
                    <Icon size={1.5} strokeWidth={1.75} />
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
              <a href="/splash"><PrimaryButton size="sm" fullWidth={false}>Start my journey →</PrimaryButton></a>
              <a href="#how-it-works"><PrimaryButton size="sm" variant="outline" fullWidth={false}>How it works</PrimaryButton></a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ position: "relative" }}
          >
            <Image
              src="/images/skincare-portraits/portrait-deep-brown.png"
              alt="Close-up portrait showing clear, healthy skin"
              width={1024}
              height={1536}
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              style={{ width: "100%", height: "auto", display: "block", borderRadius: "2rem" }}
            />
          </motion.div>
        </div>
      </section>

      {/* ── Proof strip: continuous marquee, not a wrapping row — avoids the
          awkward divider-orphan look a flex-wrap row gets on narrow screens
          once items drop to a second line. ── */}
      <section className="proof-strip" aria-label="Key product benefits">
        <div className="proof-track">
          {[...PROOF_POINTS, ...PROOF_POINTS].map((p, i) => (
            <span key={i}>
              <span className="proof-chip" aria-hidden style={{ background: p.color }}>{p.icon}</span>
              {p.label}
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
            <Image src="/images/reveal-face-scan.png" alt="AI face-scan overlay analysing skin, colour and proportions" fill sizes="(max-width: 900px) 100vw, 55vw" style={{ objectFit: "cover" }} />
          </div>
        </Reveal>
      </section>

      {/* ── Five systems ── */}
      <WhatYouGet />

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
            <Image src="/images/wyg-grooming-v4.png" alt="Percept grooming and hairstyle analysis dashboard" fill sizes="(max-width: 900px) 100vw, 55vw" style={{ objectFit: "cover" }} />
          </div>
        </Reveal>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="pg-section pg-container" style={{ background: "var(--surface-neutral)" }}>
        <Reveal>
          <h2 className="pg-h2" style={{ marginBottom: "6rem", maxWidth: "60rem" }}>From selfie to insight in minutes.</h2>
          <div className="steps-grid">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="step-number">{s.n}</span>
                <h3 className="pg-card-h" style={{ margin: "1.6rem 0 0.8rem", fontSize: "2rem" }}>{s.title}</h3>
                <p style={{ fontSize: "1.4rem", color: "var(--ink-secondary)", lineHeight: 1.5, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Recommendations ── */}
      <section id="recommendations" className="pg-section pg-container">
        <Reveal className="reveal-grid reveal-grid-reverse">
          <ProductPreview defaultTab="frame" image="/images/skincare-portraits/portrait-deep-brown.png" />
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
          </div>
        </Reveal>
      </section>

      {/* ── Progress ── */}
      <section id="progress" className="pg-section pg-container" style={{ textAlign: "center", background: "var(--surface-neutral)" }}>
        <Reveal>
          <h2 className="pg-h2" style={{ marginBottom: "1.6rem" }}>See what changes over time.</h2>
          <p className="pg-body" style={{ margin: "0 auto 5.6rem" }}>Every scan stays in your history, so progress is a comparison, not a guess.</p>
          <div className="progress-compare">
            <div className="pg-card progress-card">
              <span className="pg-eyebrow">First scan</span>
              <span className="progress-score">68</span>
            </div>
            <IconArrowRight size={2.4} strokeWidth={1.6} className="progress-arrow" />
            <div className="pg-card progress-card" style={{ borderColor: "var(--ink)" }}>
              <span className="pg-eyebrow">Latest scan</span>
              <span className="progress-score">84</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Expert / Science ── */}
      <section id="experts" className="pg-section">
        <div className="pg-container" style={{ maxWidth: "88rem" }}>
          <Reveal>
            <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Expert review</p>
            <div className="experts-grid">
              <div style={{ position: "relative", width: "9.6rem", height: "9.6rem", borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                <Image src="/images/expert_dermatologist.png" alt="Dermatologist" fill sizes="96px" style={{ objectFit: "cover" }} />
              </div>
              <div>
                <h2 className="pg-card-h" style={{ marginBottom: "0.6rem" }}>Reviewed by a licensed dermatologist</h2>
                <p style={{ fontSize: "1.5rem", color: "var(--ink-secondary)", lineHeight: 1.6, marginBottom: "1.2rem" }}>
                  Your Percept report is a starting point. A real dermatologist reviews your case and follows up directly, usually within 24 hours.
                </p>
                <p style={{ fontSize: "1.3rem", color: "var(--ink-secondary)", marginBottom: "1.6rem" }}>
                  First impressions form in under 100ms, Willis &amp; Todorov, <em>Psychological Science</em>, 2006.
                </p>
                <a href="/splash" style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--ink)" }}>
                  Talk to a dermatologist · ${DOCTOR_CONSULTATION_PRICE} →
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="pg-section pg-container" style={{ background: "var(--surface-neutral)" }}>
        <Reveal>
          <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Testimonials</p>
          <h2 className="pg-h2" style={{ marginBottom: "4rem", maxWidth: "56rem" }}>What people notice first.</h2>
          <div className="testimonial-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i}>
                <p style={{ fontSize: "clamp(1.8rem, 2vw, 2.2rem)", fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.4, color: "var(--ink)", marginBottom: "1.6rem" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p style={{ fontSize: "1.4rem", color: "var(--ink-secondary)", fontWeight: 600 }}>{t.name}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="pg-section pg-container" style={{ display: "flex", justifyContent: "center" }}>
        <Reveal className="pg-card" style={{ maxWidth: "56rem", width: "100%", padding: "4.8rem" }}>
          <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>Full Percept report</p>
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "3.2rem" }}>
            <span style={{ fontSize: "3.2rem", fontWeight: 600, marginTop: "0.6rem" }}>$</span>
            <span style={{ fontSize: "8rem", fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1 }}><AnimatedPrice value={BUNDLE_PRICE} /></span>
            <span style={{ fontSize: "1.5rem", color: "var(--ink-secondary)", marginTop: "1.2rem", marginLeft: "0.8rem" }}>one time</span>
          </div>
          <ul style={{ margin: "0 0 3.6rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            {PRICING_FEATURES.map((f) => (
              <li key={f} style={{ display: "flex", gap: "1rem", fontSize: "1.5rem" }}>
                <span style={{ flexShrink: 0, marginTop: "0.2rem", display: "flex" }}><IconCheck size={1.4} strokeWidth={2.4} /></span>
                {f}
              </li>
            ))}
          </ul>
          <a href="/splash"><PrimaryButton size="lg">Get my report · ${BUNDLE_PRICE}</PrimaryButton></a>
          <p style={{ textAlign: "center", fontSize: "1.3rem", color: "var(--ink-secondary)", marginTop: "1.6rem" }}>
            Want a dermatologist&apos;s opinion too? <a href="/splash" style={{ color: "var(--ink)", fontWeight: 600 }}>Add a consultation · ${DOCTOR_CONSULTATION_PRICE}</a>
          </p>
        </Reveal>
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
          <a href="/splash"><PrimaryButton size="lg" fullWidth={false}>Start my plan</PrimaryButton></a>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border-neutral)", padding: "6rem 0" }}>
        <div className="pg-container footer-grid">
          <div>
            <Logo height="2.4rem" />
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
        .home-header { transition: none; }
        .home-header:not(.is-scrolled) .home-header-inner {
          background: transparent !important; border-color: transparent !important; box-shadow: none !important; backdrop-filter: none !important;
        }
        .home-header:not(.is-scrolled) .home-header-inner > a:first-child :global(img) {
          filter: brightness(0) invert(1) drop-shadow(0 0.2rem 0.45rem rgba(0,0,0,0.42));
        }
        .home-header.is-scrolled .home-header-inner { box-shadow: 0 0.8rem 2.4rem rgba(0,0,0,0.08); }
        .home-header:not(.is-scrolled) .pg-nav-links a,
        .home-header:not(.is-scrolled) .pg-nav-signin { color: rgba(255,255,255,0.9); }
        .home-header:not(.is-scrolled) .pg-menu-btn { color: #fff; }
        .home-header.is-scrolled .pg-menu-btn { color: var(--ink); }
        .pg-nav-links { display: flex; align-items: center; gap: 3.2rem; }
        .pg-nav-links a { font-size: 1.45rem; font-weight: 500; color: var(--ink-secondary); }
        .pg-nav-links a:hover { color: var(--ink); }
        .pg-nav-signin { font-size: 1.45rem; font-weight: 500; color: var(--ink-secondary); }
        .pg-menu-btn { display: none; align-items: center; justify-content: center; }

        .desktop-home-hero { display: none !important; }
        .mobile-first-hero {
          position: relative;
          display: block;
          min-height: 100vh;
          min-height: 100dvh;
          overflow: hidden;
          background: #909ca4;
        }
        /* :global — next/image's <Image> is a component, not a literal tag,
           so styled-jsx doesn't inject its scope class onto it here either
           (same root cause as the .mobile-hero-copy fix above). Without
           :global these rules silently never match and object-fit falls
           back to the browser default "fill", stretching the photo. */
        :global(.hero-desktop-image) { object-fit: cover; object-position: center; }
        :global(.mobile-hero-image) { display: none; }
        .mobile-hero-shade {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, rgba(3,10,9,0.72) 0%, rgba(3,10,9,0.3) 46%, rgba(3,10,9,0.05) 72%), linear-gradient(180deg, transparent 48%, rgba(2,7,6,0.74) 100%);
        }
        .mobile-hero-copy {
          position: absolute; z-index: 2;
          left: clamp(5.2rem, 7.5vw, 15.4rem); top: 24%; bottom: auto;
          width: min(55rem, calc(100vw - 6.4rem));
          color: #fff;
        }
        .mobile-hero-kicker { margin-bottom: 1.2rem; font-size: 1.4rem; font-weight: 500; color: rgba(255,255,255,0.9); }
        .mobile-hero-copy h1 {
          max-width: 55rem; margin: 0 0 1.6rem;
          font-size: clamp(4rem, 4.2vw, 6rem); font-weight: 600; line-height: 0.98; letter-spacing: -0.05em;
        }
        .mobile-hero-sub { max-width: 50rem; margin-bottom: 2.8rem; font-size: 1.6rem; line-height: 1.5; color: rgba(255,255,255,0.78); }
        .mobile-hero-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; max-width: 40rem; }
        .mobile-hero-actions a {
          min-height: 5.2rem; display: flex; align-items: center; justify-content: center;
          padding: 0 1.8rem; border-radius: 999px; background: #fff; color: #123f39;
          font-size: 1.45rem; font-weight: 700; text-align: center;
        }
        .mobile-hero-actions a:last-child { background: rgba(255,255,255,0.18); color: #fff; backdrop-filter: blur(10px); }
        .hero-proof-points {
          position: absolute; top: 64svh; left: 0;
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0;
          width: min(58rem, calc(100vw - 6.4rem)); max-width: calc(100vw - 6.4rem); margin-top: 0;
        }
        .hero-proof-points > div { min-width: 0; padding: 0 1.6rem; border-left: 1px solid rgba(255,255,255,0.24); }
        .hero-proof-points > div:first-child { padding-left: 0; border-left: 0; }
        .hero-proof-points strong { display: block; font-size: 1.2rem; font-weight: 500; line-height: 1.2; color: #fff; white-space: nowrap; }
        .hero-proof-points span { display: block; margin-top: 0.5rem; font-size: 0.95rem; line-height: 1.25; color: rgba(255,255,255,0.62); white-space: nowrap; }

        .proof-strip {
          position: relative; z-index: 1;
          overflow: hidden;
          background: var(--surface-neutral);
          padding-block: 2rem;
          /* Hard shadow, not just a border — the hero above ends in a
             near-black gradient, so a same-tone dark strip would blend
             straight into it with no visible seam (looked like the marquee
             text was floating, residual, over the photo). A light strip
             with real elevation makes the boundary unmistakable regardless
             of how dark the image above happens to be. */
          box-shadow: 0 -1px 0 var(--border-neutral), 0 4px 16px rgba(0,0,0,0.06);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0%, #000 6%, #000 94%, transparent 100%);
        }
        .proof-track {
          display: flex; width: max-content; gap: 4.8rem;
          animation: marquee 24s linear infinite;
        }
        .proof-track span {
          display: inline-flex; align-items: center; gap: 1.1rem;
          font-size: 1.5rem; font-weight: 600; color: var(--ink);
          white-space: nowrap;
        }
        .proof-chip {
          display: inline-flex; align-items: center; justify-content: center;
          width: 3rem; height: 3rem; border-radius: 50%; font-size: 1.4rem;
          box-shadow: 0 0 0 4px rgba(255,255,255,0.06);
        }
        @media (prefers-reduced-motion: reduce) {
          .proof-track { animation: none; }
        }

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
           experts-grid, testimonial-grid) are now applied directly to the
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

        :global(.steps-grid) { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4rem; }
        .step-number { font-size: clamp(3.6rem, 4vw, 5.2rem); font-weight: 600; letter-spacing: -0.03em; color: var(--border-neutral); }

        .progress-compare { display: flex; align-items: center; justify-content: center; gap: 3.2rem; }
        .progress-card { padding: 3.2rem 4rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .progress-score { font-size: 4.8rem; font-weight: 600; letter-spacing: -0.03em; }
        .progress-arrow { color: var(--ink-secondary); flex-shrink: 0; }

        :global(.experts-grid) { display: flex; gap: 3.2rem; align-items: flex-start; }
        :global(.testimonial-grid) { display: grid; grid-template-columns: 1fr 1fr; gap: 5.6rem; }
        .footer-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 4rem; }

        #what-you-get, #how-it-works, #experts, #pricing, #faq, #command-centre, #recommendations, #progress, #testimonials {
          scroll-margin-top: 9rem;
        }

        @media (max-width: 1099px) {
          .pg-nav-links { display: none; }
        }
        @media (max-width: 900px) {
          .percept-hero-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          .pg-nav-signin { display: none; }
          .pg-menu-btn { display: flex; }
          /* Full first screen, no cap: the source portrait has a lot of blank
             studio backdrop above the subject's hair, and a shorter cap could
             land the next section peeking in at the bottom before any scroll. */
          .mobile-first-hero { min-height: 100vh; min-height: 100dvh; }
          :global(.mobile-hero-image) {
            display: block;
            object-fit: cover;
            /* 34%: brings the crop down to where her hair starts right at the
               top of the frame, instead of ~27% of flat grey backdrop first. */
            object-position: center 34%;
          }
          :global(.hero-desktop-image) { display: none; }
          .mobile-hero-shade {
            position: absolute; inset: 0;
            background: linear-gradient(180deg, transparent 0%, transparent 55%, rgba(3,10,9,0.55) 78%, rgba(2,7,6,0.96) 100%);
          }
          .mobile-hero-copy { position: absolute; z-index: 2; left: 2rem; right: 2rem; top: auto; bottom: 2rem; color: #fff; }
          .mobile-hero-kicker { margin-bottom: 0.8rem; font-size: 1.25rem; font-weight: 500; color: rgba(255,255,255,0.9); }
          .mobile-hero-copy h1 { max-width: 34rem; margin: 0 0 1rem; font-size: clamp(2.7rem, 7.8vw, 3.5rem); font-weight: 600; line-height: 1.02; letter-spacing: -0.045em; }
          .mobile-hero-sub { max-width: 36rem; margin-bottom: 2.4rem; font-size: 1.35rem; line-height: 1.45; color: rgba(255,255,255,0.78); }
          .mobile-hero-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
          .mobile-hero-actions a { min-height: 4.8rem; display: flex; align-items: center; justify-content: center; padding: 0 1.4rem; border-radius: 999px; background: #fff; color: #123f39; font-size: 1.4rem; font-weight: 700; text-align: center; }
          .mobile-hero-actions a:last-child { background: rgba(255,255,255,0.18); color: #fff; backdrop-filter: blur(10px); }
          .hero-proof-points { display: none; }
          :global(.reveal-grid), :global(.reveal-grid-reverse), :global(.command-grid) { grid-template-columns: 1fr !important; }
          :global(.reveal-grid-reverse) > div:first-child, :global(.reveal-grid-reverse) > div:last-child { order: initial; }
          :global(.steps-grid) { grid-template-columns: 1fr 1fr; gap: 3.2rem; }
          :global(.experts-grid) { flex-direction: column; }
          :global(.testimonial-grid) { grid-template-columns: 1fr; gap: 3.2rem; }
          .footer-grid { grid-template-columns: 1fr 1fr; gap: 3.2rem; }
          .progress-compare { gap: 1.6rem; }
          .progress-card { padding: 2.4rem 2rem; }
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
