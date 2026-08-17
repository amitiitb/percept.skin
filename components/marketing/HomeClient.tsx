"use client";
import { useState, useEffect, type ReactNode } from "react";
import Image from "next/image";
import { motion, useMotionValue, animate } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SiteMenu } from "@/components/marketing/SiteMenu";
import { WhatYouGet } from "@/components/marketing/WhatYouGet";
import { Logo } from "@/components/ui/Logo";
import { IconCheck, IconClose, IconSparkle, IconShield, IconClock } from "@/components/ui/icons";
import { MODULES, BUNDLE_PRICE, DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";
import { FAQS } from "@/lib/v2/homeFaqs";
import { OPEN_COOKIE_PREFS_EVENT } from "@/components/ConsentBanner";

const GOLD = "#D9A62E";
const CORAL = "#E8604F";
const ACCENTS = [GOLD, CORAL, "var(--rose)"];

const HEADLINE_WORDS = "See your skin, face, and hair more clearly".split(" ");

const TRUST_BADGES = [
  { Icon: IconShield, label: "Private & Secure" },
  { Icon: IconSparkle, label: "AI-Powered Analysis" },
  { Icon: IconClock, label: "Under 2 minutes" },
] as const;

// Curved section boundary instead of a hard straight edge where two
// contrasting section backgrounds meet. Three different curve shapes so
// consecutive dividers don't look like the same asset repeated.
const WAVE_PATHS = [
  "M0,32 C240,80 480,0 720,24 C960,48 1200,8 1440,40 L1440,80 L0,80 Z",
  "M0,50 C360,0 1080,90 1440,20 L1440,80 L0,80 Z",
  "M0,20 C480,90 960,0 1440,50 L1440,80 L0,80 Z",
];

function WaveDivider({ fill, variant = 0, flip = false }: { fill: string; variant?: number; flip?: boolean }) {
  return (
    <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: -1, lineHeight: 0, transform: flip ? "scaleX(-1)" : undefined, pointerEvents: "none" }}>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ width: "100%", height: "6rem", display: "block" }}>
        <path d={WAVE_PATHS[variant % WAVE_PATHS.length]} fill={fill} />
      </svg>
    </div>
  );
}

// Horizontal scroll-snap carousel with side-by-side cards instead of a tall
// stacked grid, cheap way to save vertical space on mobile without losing
// any content. Native scroll (not a JS slider) so it works everywhere.
function Carousel({ children }: { children: ReactNode }) {
  return (
    <div
      className="percept-carousel"
      style={{ display: "flex", gap: "1.6rem", overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: "0.8rem", WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}

function ResearchEvidence() {
  const [index, setIndex] = useState(0);
  const category = RESEARCH_CATEGORIES[index];

  return (
    <div className="research-editorial">
      <h2 className="research-statement">
        Better decisions begin with <span>{category.emphasis}</span>
      </h2>
      <div className="research-tabs" role="tablist" aria-label="Research topics">
        {RESEARCH_CATEGORIES.map((item, i) => (
          <button key={item.label} type="button" role="tab" aria-selected={i === index} onClick={() => setIndex(i)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="research-evidence-grid">
        {category.cards.map((card) => (
          <article key={card.title} className="research-evidence-card">
            <h3>{card.title}</h3>
            <p>{card.finding}</p>
            <div className="research-source">
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" strokeWidth="1.5"/><path d="M14 3v5h5M10 13h5M10 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span>{card.source}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// Illustrative anchor comparison (typical U.S. session pricing, not verified
// quotes), using the same pattern iMorph uses: separate specialist visits vs. one
// Percept payment. Disclaimed below the comparison, not presented as fact.
const OLD_WAY = [
  { label: "Skin consultation", price: 120 },
  { label: "Colour / draping session", price: 150 },
  { label: "Hairstylist consult", price: 75 },
  { label: "Personal stylist (frames)", price: 60 },
];
const OLD_WAY_TOTAL = OLD_WAY.reduce((s, i) => s + i.price, 0);

const RESEARCH_CATEGORIES = [
  {
    label: "First impressions",
    emphasis: "clearer self-knowledge.",
    cards: [
      { title: "100 milliseconds", finding: "People form impressions of a face in a fraction of a second.", source: "Willis and Todorov, Psychological Science, 2006" },
      { title: "Visible signals", finding: "Skin, expression and grooming all contribute to an initial read.", source: "Review of person perception research" },
      { title: "More consistency", finding: "A guided capture makes comparison across scans more useful.", source: "Percept guided scan methodology" },
    ],
  },
  {
    label: "Work",
    emphasis: "a more intentional presentation.",
    cards: [
      { title: "Presentation matters", finding: "Appearance can influence workplace impressions and outcomes.", source: "Hamermesh and Biddle, American Economic Review, 1994" },
      { title: "Competence cues", finding: "Facial impressions can shape perceived competence before conversation begins.", source: "Todorov et al., Trends in Cognitive Sciences, 2015" },
      { title: "Personal, not generic", finding: "Useful guidance should reflect your own features and priorities.", source: "Percept personalized analysis framework" },
    ],
  },
  {
    label: "Progress",
    emphasis: "changes you can actually track.",
    cards: [
      { title: "A useful baseline", finding: "Your first scan creates a consistent point for future comparison.", source: "Percept scan history" },
      { title: "Small changes", finding: "Repeated photos can make gradual differences easier to notice.", source: "Standardized visual comparison principle" },
      { title: "Focused routines", finding: "Tracking helps you keep what works and reconsider what does not.", source: "Percept progress workflow" },
    ],
  },
];

const WHY_ITEMS = [
  {
    title: "Guided capture",
    description: "Clear prompts help you photograph each angle consistently. No appointment or extra hardware required.",
  },
  {
    title: "Specific analysis",
    description: "Visible areas are reviewed separately across skin, face and hair instead of being reduced to one vague grade.",
  },
  {
    title: "Progress over time",
    description: "Completed scans stay in your history, making it easier to compare changes and refine your routine.",
  },
];

// Counts up to the real bundle price once the pricing section scrolls into
// view. This is the payoff moment of the pricing section, using the same reveal pattern as
// the report page's Percept Score ring. Jumps straight to the value for
// prefers-reduced-motion instead of animating.
function AnimatedPrice({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const motionVal = useMotionValue(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setDisplay(value); return; }
    const controls = animate(motionVal, value, {
      duration: 1.2, ease: [0.24, 0.43, 0.15, 0.97],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);

  return <>{display}</>;
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6rem",
          background: "none", border: "none", cursor: "pointer", padding: "2.4rem 0", textAlign: "left",
        }}
      >
        <span style={{ fontSize: "1.8rem", fontWeight: 500, color: "var(--primary)" }}>{q}</span>
        <span style={{ flexShrink: 0, width: "2.8rem", height: "2.8rem", borderRadius: "50%", border: "1px solid var(--line-strong)", display: "flex", alignItems: "center", justifyContent: "center", transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </span>
      </button>
      {open && (
        <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.6, paddingBottom: "2.4rem", maxWidth: "64rem" }}>{a}</p>
      )}
    </div>
  );
}

export function HomeClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 32);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  return (
    <div style={{ background: "var(--canvas)", minHeight: "100dvh" }}>
      <SiteMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <header className={`home-header${headerScrolled ? " is-scrolled" : ""}`} style={{ position: "fixed", top: "1.6rem", left: 0, right: 0, zIndex: 40, padding: "0 1.6rem" }}>
        <div className="home-header-inner" style={{
          maxWidth: "128rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.2rem 1.2rem 1.2rem 2.4rem", borderRadius: "9999px", border: "1px solid var(--line)",
          background: "var(--header-bg)", backdropFilter: "blur(10px)",
        }}>
          <a href="/" style={{ display: "block" }}>
            <Logo height="clamp(2.6rem, 7vw, 4.2rem)" />
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
            {/* Previously the only "Try Free" CTA lived in the hero, so it
                scrolled out of view immediately, so someone reading further down
                the page had no way to start without scrolling back up or
                opening the menu. Sticky, so it's reachable from anywhere on
                the page, on mobile and desktop alike. */}
            <a href="/splash" className="site-header-cta">
              <PrimaryButton size="sm" fullWidth={false}>Try Free</PrimaryButton>
            </a>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              style={{ width: "4.4rem", height: "4.4rem", border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M4 8h16M4 16h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile gets a dedicated, image-led first impression. Keeping it
          separate avoids compromising the more spacious desktop hero. */}
      <section className="mobile-first-hero" aria-labelledby="mobile-hero-title">
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
          className="mobile-hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15 }}
        >
          <p className="mobile-hero-kicker">AI skin, face and hair analysis</p>
          <h1 id="mobile-hero-title">Understand your features.<br />Improve what matters.</h1>
          <p className="mobile-hero-sub">A private AI-guided scan for clearer skin, face, hair and colour insights, personalized to you.</p>
          <div className="mobile-hero-actions">
            <a href="/splash">Start my plan</a>
            <a href="#what-you-get">How it works</a>
          </div>
          <div className="hero-proof-points" aria-label="Key product benefits">
            <div><strong>20+ visual metrics</strong><span>Skin, face and hair insights</span></div>
            <div><strong>Personal to you</strong><span>Guidance shaped by your features</span></div>
            <div><strong>Track progress</strong><span>Compare results across scans</span></div>
          </div>
        </motion.div>
      </section>

      {/* ── Hero ── */}
      <section className="desktop-home-hero" style={{ position: "relative", padding: "6.4rem 3.2rem 8rem" }}>
        <div className="percept-hero-grid" style={{ position: "relative", maxWidth: "120rem", margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "5.6rem", alignItems: "center" }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.6rem" }}>
              Personal beauty analysis
            </p>
            <h1 style={{ fontSize: "clamp(3.4rem, 5.5vw, 5.6rem)", fontWeight: 400, color: "var(--primary)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: "2.4rem" }}>
              {HEADLINE_WORDS.map((word, i) => {
                const isLast = i === HEADLINE_WORDS.length - 1;
                return (
                  <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}>
                    <motion.span
                      style={{ display: "inline-block", color: isLast ? "var(--rose)" : undefined }}
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
            <p style={{ fontSize: "1.8rem", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "48rem", marginBottom: "2.8rem" }}>
              A guided photo scan, read by AI. Clear, specific, and easy to track over time.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", flexWrap: "wrap", marginBottom: "3.2rem" }}>
              {TRUST_BADGES.map(({ Icon, label }, i) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "1.4rem" }}>
                  {i > 0 && <span aria-hidden style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: "var(--line-strong)", flexShrink: 0 }} />}
                  <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "1.4rem", fontWeight: 500, color: "var(--secondary)" }}>
                    <Icon size={1.5} strokeWidth={1.75} />
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
              <a href="/splash"><PrimaryButton size="sm" fullWidth={false}>Start my journey →</PrimaryButton></a>
              <a href="#why"><PrimaryButton size="sm" variant="outline" fullWidth={false}>Why Percept</PrimaryButton></a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ position: "relative" }}
          >
            {/* Natural aspect ratio (1024x1536, 2:3), not force-cropped into a
                4:5 box because cover was cutting off her hair and hands. */}
            <Image
              src="/images/skincare-portraits/portrait-deep-brown.png"
              alt="Close-up portrait showing clear, healthy skin"
              width={1024}
              height={1536}
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </motion.div>
        </div>
      </section>

      <WhatYouGet />

      {/* ── Why Percept ── */}
      <section id="why" style={{ padding: "8rem 3.2rem", background: "var(--surface)", position: "relative" }}>
        <div style={{ maxWidth: "112rem", margin: "0 auto" }}>
          <div className="why-section-heading" style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "4rem", alignItems: "end", marginBottom: "5.6rem" }}>
            <div>
              <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.16em", marginBottom: "1.2rem" }}>
                Why Percept
              </p>
              <h2 className="percept-why-heading" style={{ fontSize: "clamp(3.2rem, 4vw, 5rem)", fontWeight: 400, color: "var(--primary)", lineHeight: 1.02, letterSpacing: "-0.04em", margin: 0 }}>
                Specific insight,<br />not a guess
              </h2>
            </div>
            <p style={{ maxWidth: "48rem", justifySelf: "end", fontSize: "1.6rem", lineHeight: 1.6, color: "var(--secondary)", margin: 0 }}>
              A structured view of what is visible today, what may be worth focusing on, and how your results change over time.
            </p>
          </div>
          <div className="why-list">
            {WHY_ITEMS.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="why-list-item"
              >
                <span className="why-list-number">[{i + 1}]</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <WaveDivider fill="var(--primary)" variant={0} />
      </section>

      {/* ── Why it matters (research) ── */}
      <section className="research-section">
        <div style={{ maxWidth: "112rem", margin: "0 auto" }}>
          <p className="research-eyebrow">
            The research
          </p>
          <ResearchEvidence />
        </div>
      </section>

      {/* ── Experts ── */}
      <section id="experts" style={{ padding: "8rem 3.2rem", position: "relative" }}>
        <div style={{ maxWidth: "88rem", margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "4.8rem", alignItems: "center" }} className="percept-experts-grid">
          <div>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.6rem" }}>
              Experts
            </p>
            <h2 style={{ fontSize: "clamp(2.8rem, 5vw, 3.8rem)", fontWeight: 400, color: "var(--primary)", lineHeight: 1.15, marginBottom: "2rem" }}>
              AI gives you the read. A dermatologist gives you the plan.
            </h2>
            <p style={{ fontSize: "1.7rem", color: "var(--secondary)", lineHeight: 1.6, marginBottom: "2.8rem" }}>
              Your Percept report is a starting point. When you want a real medical opinion, a certified dermatologist reviews your case and follows up directly. No AI in the loop, a real person, usually within 24 hours.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem", marginBottom: "3.2rem" }}>
              {["Your report reviewed by a licensed dermatologist", "Written notes on your specific concerns", "Direct follow-up, usually within 24 hours"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
                  <span style={{ width: "2.4rem", height: "2.4rem", flexShrink: 0, borderRadius: "50%", background: "var(--rose)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{item}</span>
                </div>
              ))}
            </div>
            <a href="/splash"><PrimaryButton fullWidth={false}>Talk to a dermatologist · ${DOCTOR_CONSULTATION_PRICE}</PrimaryButton></a>
          </div>
          <div style={{ position: "relative", borderRadius: "1.6rem", overflow: "hidden", aspectRatio: "4/5" }}>
            <Image
              src="/images/expert_dermatologist.png"
              alt="Dermatologist examining skin with a dermatoscope"
              fill
              sizes="(max-width: 900px) 100vw, 40vw"
              style={{ objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(43,53,48,0.92) 100%)" }} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "3.2rem" }}>
              <p style={{ fontSize: "1.3rem", color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.8rem" }}>Doctor Consultation</p>
              <p style={{ fontSize: "1.5rem", lineHeight: 1.6, color: "rgba(255,255,255,0.92)" }}>
                Available as an add-on after any scan. Share your report, your dermatologist reviews it and reaches out with a real plan, not a chatbot reply.
              </p>
            </div>
          </div>
        </div>
        <WaveDivider fill="var(--primary)" variant={2} />
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="pricing-section">
        <div aria-hidden className="pricing-orb pricing-orb-one" />
        <div aria-hidden className="pricing-orb pricing-orb-two" />
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.24, 0.43, 0.15, 0.97] }}
          style={{ maxWidth: "96rem", margin: "0 auto", position: "relative" }}
        >
          <p className="pricing-kicker">
            One scan. The complete picture.
          </p>
          <h2 className="pricing-heading">
            Your full Percept report<br /><span>for less than one consultation.</span>
          </h2>
          <div className="pricing-price-lockup">
            <span className="pricing-urgency"><i aria-hidden /> Limited-time launch offer</span>
            <span className="pricing-was">Typical separate cost <s>${OLD_WAY_TOTAL}+</s></span>
            <div className="pricing-price"><sup>$</sup><strong className="pricing-price-blink"><AnimatedPrice value={BUNDLE_PRICE} /></strong><span>one time</span></div>
            <span className="pricing-saving">Save ${OLD_WAY_TOTAL - BUNDLE_PRICE}+</span>
          </div>
          <div className="pricing-benefits" aria-label="Plan benefits">
            <span><IconCheck size={1.4} strokeWidth={2.4} /> Every analysis module</span>
            <span><IconCheck size={1.4} strokeWidth={2.4} /> One payment</span>
            <span><IconCheck size={1.4} strokeWidth={2.4} /> No subscription</span>
          </div>

          <div className="percept-pricing-compare" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
            {/* Old way: light card floating on the dark section for maximum contrast */}
            <div className="pricing-old-card" style={{ background: "var(--surface)", borderRadius: "1.6rem", padding: "3.2rem" }}>
              <p style={{ display: "flex", alignItems: "center", gap: "0.8rem", fontSize: "1.3rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2.4rem" }}>
                <span aria-hidden style={{ color: CORAL, display: "flex" }}><IconClose size={1.4} strokeWidth={2.4} /></span> The old way
              </p>
              {OLD_WAY.map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "1.2rem 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontSize: "1.5rem", color: "var(--secondary)" }}>{item.label}</span>
                  <span style={{ fontSize: "1.5rem", color: CORAL, textDecoration: "line-through" }}>${item.price}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "1.6rem" }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</span>
                <span style={{ fontSize: "2rem", fontWeight: 700, color: CORAL }}>${OLD_WAY_TOTAL}+</span>
              </div>
            </div>

            {/* Percept bundle, inverted to solid gold so it's unmissable against
                the dark section and the muted "old way" card beside it */}
            <motion.div
              whileHover={{ y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="pricing-bundle-card"
            >
              {/* Shimmer sweep, using the same technique as the report-page bundle card,
                  used sparingly so it reads as premium polish, not a loading spinner */}
              <motion.div
                aria-hidden
                animate={{ x: ["-120%", "220%"] }}
                transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
                style={{ position: "absolute", top: 0, bottom: 0, width: "30%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", pointerEvents: "none" }}
              />
              <div style={{ position: "absolute", top: "1.6rem", right: "-3.2rem", transform: "rotate(45deg)", background: "var(--panel)", color: GOLD, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.08em", padding: "0.5rem 4rem", textTransform: "uppercase" }}>
                Limited time
              </div>
              <p style={{ position: "relative", display: "flex", alignItems: "center", gap: "0.8rem", fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2.4rem" }}>
                ⭐ Percept bundle
              </p>
              {MODULES.map((m) => (
                <div key={m.id} style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.2rem 0", borderBottom: "1px solid rgba(12, 92, 81,0.15)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500 }}>
                    <span aria-hidden style={{ display: "flex" }}><IconCheck size={1.5} strokeWidth={2.4} /></span> {m.label}
                  </span>
                </div>
              ))}
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: "1.6rem" }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "rgba(12, 92, 81,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</span>
                <span style={{ fontSize: "3.2rem", fontWeight: 800, color: "var(--primary)" }}>${BUNDLE_PRICE}</span>
              </div>
            </motion.div>
          </div>

          <div className="percept-cta-banner pricing-cta-banner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap", borderRadius: "1.6rem", padding: "2.4rem 3.2rem", marginBottom: "1.2rem", minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Ready when you are</p>
              <p style={{ fontSize: "2.4rem", fontWeight: 500, color: "#fff", lineHeight: 1.15 }}>Get the $10 launch price while it is available.</p>
            </div>
            <a href="/splash" style={{ minWidth: 0, flexShrink: 0 }}><PrimaryButton fullWidth={false} size="lg">Get your report · ${BUNDLE_PRICE} →</PrimaryButton></a>
          </div>

          {/* Complete Package upsell, with the same visual weight as the bundle card
              above (solid color, checklist, big price), not a footnote.
              Still two separate real purchases today (report bundle, then
              consultation add-on) -- no combined single-order checkout exists
              yet -- so this sells the combination honestly rather than
              implying one unified SKU that doesn't exist in the backend. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            style={{ background: CORAL, borderRadius: "1.6rem", padding: "3.2rem", marginBottom: "1.2rem", position: "relative", overflow: "hidden" }}
          >
            <div aria-hidden style={{ position: "absolute", top: "-40%", left: "-10%", width: "32rem", height: "32rem", borderRadius: "50%", background: "rgba(255,255,255,0.18)", filter: "blur(40px)" }} />
            <div className="percept-complete-package" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2.8rem", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", opacity: 0.85 }}>
                  Go all the way: complete package
                </p>
                <p style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", lineHeight: 1.25, marginBottom: "1.8rem", maxWidth: "40rem" }}>
                  Your AI report, plus a real dermatologist&apos;s plan
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {["Reviewed by a licensed dermatologist", "Written notes on your specific concerns", "Direct follow-up, usually within 24 hours"].map((line) => (
                    <div key={line} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span style={{ width: "2rem", height: "2rem", flexShrink: 0, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      <span style={{ fontSize: "1.5rem", color: "rgba(255,255,255,0.92)" }}>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <p style={{ fontSize: "1.3rem", color: "rgba(255,255,255,0.75)", marginBottom: "0.4rem" }}>Report ${BUNDLE_PRICE} + consultation</p>
                <p style={{ fontSize: "4rem", fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: "1.8rem" }}>+${DOCTOR_CONSULTATION_PRICE}</p>
                <a
                  href="/splash"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap",
                    height: "5.8rem", padding: "0 3.2rem", borderRadius: "9999px", background: "#fff",
                    color: CORAL, fontSize: "1.7rem", fontWeight: 700, textDecoration: "none",
                  }}
                >
                  Add consultation →
                </a>
              </div>
            </div>
          </motion.div>

          <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            *Old-way total is a typical U.S. cost estimate for separate sessions, not a quote. Individual modules also available from ${MODULES[0].price} each.
          </p>
        </motion.div>
        <WaveDivider fill="var(--canvas)" variant={0} flip />
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: "8rem 3.2rem", position: "relative" }}>
        <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.2rem", textAlign: "center" }}>
            FAQ
          </p>
          <h2 style={{ fontSize: "clamp(2.8rem, 5vw, 4rem)", fontWeight: 400, color: "var(--primary)", textAlign: "center", marginBottom: "5.6rem" }}>
            Frequently asked questions
          </h2>
          <div>
            {FAQS.map((f) => <FaqRow key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
        <WaveDivider fill="var(--primary)" variant={1} />
      </section>

      <footer style={{ background: "var(--panel)", padding: "6.4rem 3.2rem 2.4rem" }}>
        <div style={{ maxWidth: "128rem", margin: "0 auto" }}>
          <div className="percept-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "4rem", paddingBottom: "4rem", borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
            <div className="percept-footer-brand">
              <img src="/brand/percept-ai-logo.svg" alt="Percept AI" style={{ display: "block", height: "3.6rem", width: "auto", background: "#E8E7E5", borderRadius: "0.8rem", padding: "0.2rem 0.6rem" }} />
              <p style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginTop: "1.6rem", maxWidth: "32rem" }}>
                A guided photo scan, understood by AI. Skin, face, and hair insight in a few minutes, no lab visit.
              </p>
            </div>

            <div>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Product</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                <a href="#why" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Why Percept</a>
                <a href="#experts" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Experts</a>
                <a href="#pricing" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Pricing</a>
                <a href="#faq" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>FAQ</a>
                <a href="/splash" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Start your scan</a>
              </div>
            </div>

            <div className="percept-footer-legalsupport" style={{ display: "flex", gap: "4rem" }}>
              <div>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Legal</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <a href="/privacy" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Privacy Policy</a>
                  <a href="/terms" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Terms of Service</a>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT))}
                    style={{ fontSize: "1.4rem", color: "var(--on-dark)", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", font: "inherit" }}
                  >
                    Cookie Preferences
                  </button>
                </div>
              </div>

              <div>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Support</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <a href="mailto:support@percept.skin" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>support@percept.skin</a>
                  <a href="#faq" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Help & FAQ</a>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", paddingTop: "2.4rem" }}>
            <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.5)" }}>© 2026 Percept</p>
            <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", maxWidth: "48rem", textAlign: "right" }}>
              Cosmetic and wellness insights, not a substitute for professional medical advice.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        .desktop-home-hero { display: none !important; }
        .home-header-inner { transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, padding 0.25s ease; }
        .home-header-inner {
          position: relative;
          padding: 0.8rem 0.9rem 0.8rem 1.6rem !important;
        }
        .home-header-inner > a:first-child img { height: 3.2rem !important; }
        .home-header-inner > a:first-child {
          position: absolute;
          left: 1.6rem;
          top: 50%;
          transform: translateY(-50%);
          display: flex !important;
          align-items: center;
        }
        .home-header-inner > div { margin-left: auto; gap: 0.7rem !important; }
        @media (min-width: 701px) {
          .home-header-inner > a:first-child { top: calc(50% + 0.2rem); }
        }
        .home-header .site-header-cta button {
          height: 3.8rem !important;
          padding: 0 1.6rem !important;
          font-size: 1.25rem !important;
        }
        .home-header button[aria-label="Open menu"] {
          width: 3.8rem !important;
          height: 3.8rem !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        .home-header button[aria-label="Open menu"] svg { width: 1.6rem; height: 1.6rem; }
        .home-header:not(.is-scrolled) .home-header-inner {
          background: transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }
        .home-header:not(.is-scrolled) .home-header-inner > a:first-child img {
          filter: brightness(0) invert(1) drop-shadow(0 0.2rem 0.45rem rgba(0,0,0,0.42));
        }
        .home-header.is-scrolled .home-header-inner > a:first-child img { filter: none; }
        .home-header:not(.is-scrolled) button[aria-label="Open menu"] {
          color: #fff !important;
        }
        .home-header:not(.is-scrolled) button[aria-label="Open menu"] svg {
          filter: drop-shadow(0 0.2rem 0.35rem rgba(0,0,0,0.55));
          stroke-width: 3;
        }
        .home-header.is-scrolled button[aria-label="Open menu"] svg { filter: none; stroke-width: 2.6; }
        .home-header.is-scrolled button[aria-label="Open menu"] { color: var(--primary) !important; }
        .home-header.is-scrolled .home-header-inner { box-shadow: 0 0.8rem 2.4rem rgba(8,32,29,0.12); }
        .mobile-first-hero {
          position: relative;
          display: block;
          min-height: 100svh;
          overflow: hidden;
          background: #909ca4;
        }
        .hero-desktop-image {
          object-fit: cover;
          object-position: center;
        }
        .mobile-hero-image {
          display: none;
        }
        .mobile-hero-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(3,10,9,0.72) 0%, rgba(3,10,9,0.3) 46%, rgba(3,10,9,0.05) 72%), linear-gradient(180deg, transparent 48%, rgba(2,7,6,0.74) 100%);
        }
        .mobile-hero-copy {
          position: absolute;
          z-index: 2;
          left: clamp(5.2rem, 7.5vw, 15.4rem);
          top: 24%;
          bottom: auto;
          width: min(55rem, calc(100vw - 6.4rem));
          color: #fff;
        }
        .mobile-hero-kicker { margin-bottom: 1.2rem; font-size: 1.4rem; font-weight: 500; color: rgba(255,255,255,0.9); }
        .mobile-hero-copy h1 {
          max-width: 55rem;
          margin: 0 0 1.6rem;
          font-size: clamp(4rem, 4.2vw, 6rem);
          font-weight: 400;
          line-height: 0.98;
          letter-spacing: -0.05em;
        }
        .mobile-hero-sub { max-width: 50rem; margin-bottom: 2.8rem; font-size: 1.6rem; line-height: 1.5; color: rgba(255,255,255,0.78); }
        .mobile-hero-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; max-width: 40rem; }
        .mobile-hero-actions a {
          min-height: 5.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 1.8rem;
          border-radius: 999px;
          background: #fff;
          color: #123f39;
          font-size: 1.45rem;
          font-weight: 700;
          text-align: center;
        }
        .mobile-hero-actions a:last-child { background: rgba(255,255,255,0.18); color: #fff; backdrop-filter: blur(10px); }
        .hero-proof-points {
          position: absolute;
          top: 64svh;
          left: 0;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0;
          width: min(58rem, calc(100vw - 6.4rem));
          max-width: calc(100vw - 6.4rem);
          margin-top: 0;
        }
        .hero-proof-points > div { min-width: 0; padding: 0 1.6rem; border-left: 1px solid rgba(255,255,255,0.24); }
        .hero-proof-points > div:first-child { padding-left: 0; border-left: 0; }
        .hero-proof-points strong { display: block; font-size: 1.2rem; font-weight: 500; line-height: 1.2; color: #fff; white-space: nowrap; }
        .hero-proof-points span { display: block; margin-top: 0.5rem; font-size: 0.95rem; line-height: 1.25; color: rgba(255,255,255,0.62); white-space: nowrap; }
        .why-list { border-top: 1px solid var(--line); }
        .why-list-item { display: grid; grid-template-columns: 8rem minmax(0, 1fr); gap: 2rem; align-items: start; padding: 2.8rem 0; border-bottom: 1px solid var(--line); }
        .why-list-number { padding-top: 0.25rem; font-size: 1.2rem; color: var(--muted); letter-spacing: 0.04em; }
        .why-list-item h3 { margin: 0 0 0.8rem; color: var(--primary); font-size: 2rem; font-weight: 400; line-height: 1.25; letter-spacing: -0.02em; }
        .why-list-item p { max-width: 68rem; margin: 0; color: var(--secondary); font-size: 1.4rem; line-height: 1.6; }
        .research-section { padding: 9rem 3.2rem; background: #f7f9f8; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .research-eyebrow { margin: 0 0 2.4rem; color: var(--muted); font-size: 1.15rem; font-weight: 600; letter-spacing: 0.12em; text-align: center; text-transform: uppercase; }
        .research-statement { max-width: 82rem; margin: 0 auto 4rem; color: var(--primary); font-size: clamp(3.2rem, 5vw, 5.4rem); font-weight: 400; line-height: 1.08; letter-spacing: -0.045em; text-align: center; }
        .research-statement span { color: #91aaa6; }
        .research-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 72rem; margin: 0 auto 4.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid var(--line); }
        .research-tabs button { min-height: 4.4rem; padding: 0.8rem 1.4rem; border: 0; border-radius: 999px; background: transparent; color: var(--muted); font: inherit; font-size: 1.35rem; cursor: pointer; transition: background 180ms ease, color 180ms ease; }
        .research-tabs button[aria-selected="true"] { background: var(--primary); color: #fff; }
        .research-evidence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.6rem; }
        .research-evidence-card { display: flex; min-height: 19rem; flex-direction: column; padding: 2.4rem; border: 1px solid var(--line); border-radius: 1.6rem; background: #fff; }
        .research-evidence-card h3 { margin: 0 0 1.2rem; color: var(--primary); font-size: 2rem; font-weight: 400; line-height: 1.25; letter-spacing: -0.025em; }
        .research-evidence-card p { margin: 0; color: var(--secondary); font-size: 1.35rem; line-height: 1.55; }
        .research-source { display: flex; align-items: center; gap: 0.9rem; margin-top: auto; padding-top: 2.4rem; color: var(--muted); min-width: 0; }
        .research-source svg { flex: 0 0 auto; }
        .research-source span { overflow: hidden; font-size: 1.05rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
        .pricing-section { position: relative; overflow: hidden; padding: 9.6rem 3.2rem; background: #082f2b; }
        .pricing-section::before { content: ""; position: absolute; inset: 0; opacity: 0.2; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px); background-size: 6rem 6rem; mask-image: linear-gradient(to bottom, #000, transparent 62%); }
        .pricing-orb { position: absolute; border-radius: 50%; pointer-events: none; filter: blur(10px); }
        .pricing-orb-one { top: -30rem; left: 50%; width: 74rem; height: 74rem; transform: translateX(-50%); background: rgba(217,166,46,0.2); }
        .pricing-orb-two { top: 12rem; right: -24rem; width: 50rem; height: 50rem; background: rgba(26,158,143,0.18); }
        .pricing-kicker { width: fit-content; margin: 0 auto 2rem; padding: 0.7rem 1.4rem; border: 1px solid rgba(217,166,46,0.55); border-radius: 999px; color: #f2cb68; font-size: 1.15rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
        .pricing-heading { margin: 0 auto 2.8rem; color: #fff; font-size: clamp(3.4rem, 6vw, 5.8rem); font-weight: 400; line-height: 1.03; letter-spacing: -0.045em; text-align: center; }
        .pricing-heading span { color: rgba(255,255,255,0.55); }
        .pricing-price-lockup { display: flex; flex-direction: column; align-items: center; margin-bottom: 2.4rem; }
        .pricing-urgency { display: inline-flex; align-items: center; gap: 0.8rem; margin-bottom: 1.2rem; color: #fff; font-size: 1.3rem; font-weight: 600; }
        .pricing-urgency i { width: 0.8rem; height: 0.8rem; border-radius: 50%; background: #ff7868; box-shadow: 0 0 0 0.5rem rgba(255,120,104,0.13); animation: urgency-pulse 1.3s ease-in-out infinite; }
        .pricing-was { margin-bottom: 0.6rem; color: rgba(255,255,255,0.58); font-size: 1.3rem; }
        .pricing-was s { color: #ff8d7f; text-decoration-thickness: 2px; }
        .pricing-price { display: flex; align-items: flex-end; color: #f2c85b; line-height: 0.86; }
        .pricing-price sup { align-self: flex-start; margin-top: 1.1rem; font-size: clamp(2.6rem, 5vw, 4.4rem); font-weight: 500; }
        .pricing-price strong { font-size: clamp(8rem, 16vw, 14rem); font-weight: 600; letter-spacing: -0.075em; }
        .pricing-price-blink { animation: price-blink 1.45s ease-in-out infinite; }
        .pricing-price > span { margin: 0 0 1.1rem 1.2rem; color: rgba(255,255,255,0.58); font-size: 1.25rem; white-space: nowrap; }
        .pricing-saving { margin-top: 1.4rem; padding: 0.75rem 1.5rem; border-radius: 999px; background: #f2c85b; color: #082f2b; font-size: 1.25rem; font-weight: 700; }
        .pricing-benefits { display: flex; justify-content: center; gap: 1rem 2.8rem; flex-wrap: wrap; margin-bottom: 5.6rem; color: rgba(255,255,255,0.78); }
        .pricing-benefits span { display: flex; align-items: center; gap: 0.7rem; font-size: 1.3rem; }
        .pricing-benefits svg { color: #f2c85b; }
        .pricing-old-card { border: 1px solid rgba(255,255,255,0.08); opacity: 0.86; }
        .pricing-bundle-card { position: relative; overflow: hidden; padding: 3.2rem; border: 1px solid rgba(255,255,255,0.55); border-radius: 1.6rem; background: #f2c85b; box-shadow: 0 2.4rem 6rem -1.4rem rgba(217,166,46,0.62); }
        .pricing-cta-banner { border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); backdrop-filter: blur(16px); }
        @keyframes price-blink {
          0%, 100% { opacity: 1; text-shadow: 0 0 0 rgba(242,200,91,0); }
          50% { opacity: 0.58; text-shadow: 0 0 3.2rem rgba(242,200,91,0.72); }
        }
        @keyframes urgency-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.72); opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pricing-price-blink, .pricing-urgency i { animation: none; }
        }
        #why, #experts, #pricing, #faq { scroll-margin-top: 8rem; }
        .percept-carousel { scrollbar-width: none; -ms-overflow-style: none; }
        .percept-carousel::-webkit-scrollbar { display: none; }
        @media (max-width: 900px) {
          .percept-hero-grid { grid-template-columns: 1fr !important; }
          .percept-experts-grid { grid-template-columns: 1fr !important; }
          .why-section-heading { grid-template-columns: 1fr !important; align-items: start !important; }
          .why-section-heading > p { justify-self: start !important; }
          .research-evidence-grid { grid-template-columns: 1fr; }
          .percept-footer-grid { grid-template-columns: 1fr 1fr !important; row-gap: 3.2rem !important; }
          .percept-footer-brand { grid-column: 1 / -1 !important; }
        }
        @media (max-width: 700px) {
          .home-header {
            position: fixed !important;
            inset: 1.6rem 0 auto 0 !important;
            margin: 0 !important;
          }
          /* Full first screen, no cap: the source portrait is a 0.8 aspect
             photographed with a lot of blank studio backdrop above the
             subject's hair, and the previous 88rem cap could land shorter
             than the real viewport on a tall phone, leaving the next
             section peeking in at the bottom before any scroll. */
          .mobile-first-hero { min-height: 100svh; }
          .mobile-hero-image {
            display: block;
            object-fit: cover;
            /* Was 18%, which left ~27% of the frame as flat grey backdrop
               above her hairline (measured against a real device
               screenshot) before any subject was visible at all. 34%
               brings the crop down to where her hair starts right at the
               top of the frame instead. */
            object-position: center 34%;
          }
          .hero-desktop-image { display: none; }
          .mobile-hero-shade {
            position: absolute;
            inset: 0;
            /* The old gradient started darkening at 36%, which is right
               where the face sits once the crop above was tightened —
               it was washing out the exact area meant to read clearly.
               Now stays fully transparent through the face (to 55%) and
               only darkens over the lower third behind the copy. */
            background: linear-gradient(180deg, transparent 0%, transparent 55%, rgba(3,10,9,0.55) 78%, rgba(2,7,6,0.96) 100%);
          }
          .mobile-hero-copy {
            position: absolute;
            z-index: 2;
            left: 2rem;
            right: 2rem;
            top: auto;
            bottom: 2rem;
            color: #fff;
          }
          .mobile-hero-kicker {
            margin-bottom: 0.8rem;
            font-size: 1.25rem;
            font-weight: 500;
            color: rgba(255,255,255,0.9);
          }
          .mobile-hero-copy h1 {
            max-width: 34rem;
            margin: 0 0 1rem;
            font-size: clamp(2.7rem, 7.8vw, 3.5rem);
            font-weight: 400;
            line-height: 1.02;
            letter-spacing: -0.045em;
          }
          .mobile-hero-sub {
            max-width: 36rem;
            margin-bottom: 2.4rem;
            font-size: 1.35rem;
            line-height: 1.45;
            color: rgba(255,255,255,0.78);
          }
          .mobile-hero-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
          .mobile-hero-actions a {
            min-height: 4.8rem;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 1.4rem;
            border-radius: 999px;
            background: #fff;
            color: #123f39;
            font-size: 1.4rem;
            font-weight: 700;
            text-align: center;
          }
          .mobile-hero-actions a:last-child { background: rgba(255,255,255,0.18); color: #fff; backdrop-filter: blur(10px); }
          .hero-proof-points { display: none; }
          #why { padding-top: 5.6rem !important; padding-bottom: 5.6rem !important; }
          .percept-why-heading { margin-bottom: 3.2rem !important; }
          .why-section-heading { gap: 0 !important; margin-bottom: 3.2rem !important; }
          .why-list-item { grid-template-columns: 5.6rem minmax(0, 1fr); gap: 1.2rem; padding: 2.4rem 0; }
          .why-list-item h3 { font-size: 1.8rem; }
          .why-list-item p { font-size: 1.35rem; }
          .research-section { padding: 6.4rem 2rem; }
          .research-statement { margin-bottom: 3.2rem; font-size: clamp(3.2rem, 10vw, 4.2rem); }
          .research-tabs { gap: 0.5rem; margin-bottom: 3.2rem; }
          .research-tabs button { padding-inline: 0.8rem; font-size: 1.2rem; }
          .research-evidence-grid { gap: 1.2rem; }
          .research-evidence-card { min-height: 16rem; padding: 2rem; }
          .pricing-section { padding: 7.2rem 2rem; }
          .pricing-heading br { display: none; }
          .pricing-price strong { font-size: clamp(8rem, 30vw, 11rem); }
          .pricing-benefits { align-items: flex-start; flex-direction: column; width: fit-content; margin: 0 auto 4rem; }
          .pricing-old-card { order: 2; }
          .pricing-bundle-card { order: 1; }
        }
        @media (max-width: 520px) {
          .percept-footer-legalsupport { flex-direction: column !important; gap: 2.4rem !important; }
        }
        @media (max-width: 700px) {
          .percept-pricing-compare { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .percept-research-tags { gap: 0.6rem !important; }
        }
        @media (max-width: 600px) {
          .percept-cta-banner { flex-direction: column !important; align-items: stretch !important; }
          .percept-cta-banner > a { width: 100% !important; flex-shrink: 1 !important; }
          .percept-cta-banner button { width: 100% !important; white-space: normal !important; }
          .percept-complete-package { flex-direction: column !important; align-items: stretch !important; }
          .percept-complete-package > div:last-child { text-align: left !important; }
          .percept-complete-package a { width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
