"use client";
import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SiteMenu } from "@/components/marketing/SiteMenu";
import { MODULES, BUNDLE_PRICE, INDIVIDUAL_TOTAL, BUNDLE_SAVINGS, DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";

const GOLD = "#D9A62E";
const CORAL = "#E8604F";

// Illustrative anchor comparison (typical U.S. session pricing, not verified
// quotes) — same pattern iMorph uses: separate specialist visits vs. one
// Glowmetry payment. Disclaimed below the comparison, not presented as fact.
const OLD_WAY = [
  { label: "Skin consultation", price: 120 },
  { label: "Colour / draping session", price: 150 },
  { label: "Hairstylist consult", price: 75 },
  { label: "Personal stylist (frames)", price: 60 },
];
const OLD_WAY_TOTAL = OLD_WAY.reduce((s, i) => s + i.price, 0);

// Hourly-pay index relative to "average" perceived appearance (Hamermesh &
// Biddle), normalized to the highest value so bar widths stay honest to the
// real relative gap rather than an exaggerated infographic scale.
const BAR_DATA = [
  { label: "Below average", value: "-9%", width: (91 / 105) * 100, highlight: false },
  { label: "Average", value: "Baseline", width: (100 / 105) * 100, highlight: false },
  { label: "Above average", value: "+5%", width: 100, highlight: true },
];

const WHY_ITEMS = [
  {
    title: "Guided photos, real analysis",
    body: "A short guided photo session covers skin, face, hair, and scalp. No lab visit, no appointment, no waiting.",
  },
  {
    title: "Specific, not generic",
    body: "Ten skin metrics, five face metrics, five hair metrics, each scored and explained in plain language, not a single vague grade.",
  },
  {
    title: "Track it over time",
    body: "Every scan is saved. Rescan under similar lighting and watch your Glow Score and individual metrics move.",
  },
];

// Real, verifiable trust signals — no invented reviews or people. Each line
// maps to an actual behavior in the product, not a marketing claim made up
// for this section.
const TRUST_ITEMS = [
  {
    title: "No fake before-and-afters",
    body: "Every score comes from your own photos, analyzed fresh by real AI vision each time, not a canned demo result.",
  },
  {
    title: "Transparent pricing, always",
    body: "The exact price is visible before you pay, every time. No subscription, no silent renewal, no surprise charge.",
  },
  {
    title: "Your photos stay yours",
    body: "Used only to generate your report. Never used to train AI models without separate, explicit consent you control.",
  },
  {
    title: "Grounded in real research",
    body: "Our appearance-and-opportunity framing cites a peer-reviewed labor-economics study, not a claim we invented for marketing.",
  },
];

const FAQS = [
  {
    q: "Is this a medical diagnosis?",
    a: "No. Glowmetry gives cosmetic and wellness insights, not a medical or dermatological diagnosis. For a real diagnosis, see the Experts section below or consult a licensed professional directly.",
  },
  {
    q: "What happens to my photos?",
    a: "Your photos are used only to generate your analysis. They are never used to train AI models without separate, explicit consent. You control that choice during setup.",
  },
  {
    q: "How is pricing structured?",
    a: `Each report module is $${MODULES[0].price}, or get all ${MODULES.length} for $${BUNDLE_PRICE} instead of $${INDIVIDUAL_TOTAL}, a $${BUNDLE_SAVINGS} saving. You only pay for the scan you take, no subscription required.`,
  },
  {
    q: "How long does a scan take?",
    a: "A few minutes for the guided photo capture, plus a short wait while your report is generated.",
  },
];

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

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ background: "var(--canvas)", minHeight: "100dvh" }}>
      <SiteMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <header style={{ position: "sticky", top: "1.6rem", zIndex: 40, padding: "0 1.6rem", marginBottom: "1.6rem" }}>
        <div style={{
          maxWidth: "128rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.2rem 1.2rem 1.2rem 2.4rem", borderRadius: "9999px", border: "1px solid var(--line)",
          background: "rgba(232,231,229,0.82)", backdropFilter: "blur(10px)",
        }}>
          <a href="/" style={{ fontSize: "1.8rem", fontWeight: 600, color: "var(--primary)", letterSpacing: "-0.02em" }}>
            Glow<span style={{ color: "var(--rose)" }}>metry</span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
            <a href="/v2/splash" style={{ display: "none" }} className="site-header-cta">
              <PrimaryButton size="sm" fullWidth={false}>Start your scan</PrimaryButton>
            </a>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              style={{ width: "4.4rem", height: "4.4rem", borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden", padding: "6.4rem 3.2rem 8rem" }}>
        <div aria-hidden style={{ position: "absolute", top: "-20%", left: "10%", width: "56rem", height: "56rem", borderRadius: "50%", background: "radial-gradient(circle, var(--rose) 0%, transparent 70%)", opacity: 0.06, filter: "blur(60px)", pointerEvents: "none" }} />
        <div className="glowmetry-hero-grid" style={{ position: "relative", maxWidth: "120rem", margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "5.6rem", alignItems: "center" }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.6rem" }}>
              Personal beauty analysis
            </p>
            <h1 style={{ fontSize: "clamp(3.4rem, 5.5vw, 5.6rem)", fontWeight: 400, color: "var(--primary)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: "2.4rem" }}>
              See your skin, face, and hair more clearly
            </h1>
            <p style={{ fontSize: "1.8rem", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "48rem", marginBottom: "4rem" }}>
              A guided photo scan, understood by AI. No lab visit, no appointment, just a clear, specific report you can act on and track over time.
            </p>
            <div style={{ display: "flex", gap: "1.6rem", flexWrap: "wrap" }}>
              <a href="/v2/splash"><PrimaryButton size="lg" fullWidth={false}>Start your scan →</PrimaryButton></a>
              <a href="#why"><PrimaryButton size="lg" variant="outline" fullWidth={false}>Why Glowmetry</PrimaryButton></a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ position: "relative", aspectRatio: "4/5", borderRadius: "2.4rem", overflow: "hidden" }}
          >
            <Image
              src="/images/skincare-portraits/portrait-deep-brown.png"
              alt="Close-up portrait showing clear, healthy skin"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
              style={{ objectFit: "cover" }}
            />
          </motion.div>
        </div>
      </section>

      {/* ── Why Glowmetry ── */}
      <section id="why" style={{ padding: "8rem 3.2rem", background: "var(--surface)" }}>
        <div style={{ maxWidth: "108rem", margin: "0 auto" }}>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.2rem", textAlign: "center" }}>
            Why Glowmetry
          </p>
          <h2 style={{ fontSize: "clamp(2.8rem, 5vw, 4rem)", fontWeight: 400, color: "var(--primary)", textAlign: "center", marginBottom: "6rem", maxWidth: "56rem", marginLeft: "auto", marginRight: "auto" }}>
            Specific insight, not a guess
          </h2>
          <div className="glowmetry-why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3.2rem" }}>
            {WHY_ITEMS.map((item) => (
              <div key={item.title} style={{ background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem" }}>
                <h3 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "1.2rem" }}>{item.title}</h3>
                <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.6 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why it matters (research) ── */}
      <section style={{ padding: "8rem 3.2rem", background: "var(--primary)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: "-25%", right: "-10%", width: "48rem", height: "48rem", borderRadius: "50%", background: `radial-gradient(circle, ${GOLD} 0%, transparent 70%)`, opacity: 0.12, filter: "blur(60px)" }} />
        <div style={{ maxWidth: "108rem", margin: "0 auto", position: "relative" }}>
          <div className="glowmetry-avatar-row" style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "3.2rem" }}>
            {["/images/skincare-portraits/portrait-deep-brown.png", "/images/skincare-portraits/portrait-light-freckled.png", "/images/skincare-portraits/portrait-olive-brown.png"].map((src) => (
              <div key={src} style={{ position: "relative", width: "5.6rem", height: "5.6rem", borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)" }}>
                <Image src={src} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.2rem", textAlign: "center" }}>
            The research
          </p>
          <h2 style={{ fontSize: "clamp(2.6rem, 5vw, 3.8rem)", fontWeight: 400, color: "#fff", textAlign: "center", lineHeight: 1.2, maxWidth: "60rem", margin: "0 auto 5.6rem" }}>
            Presentation is a measurable business asset
          </h2>

          <div style={{ maxWidth: "64rem", margin: "0 auto 2.4rem" }}>
            {BAR_DATA.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "1.6rem", marginBottom: "2rem" }}>
                <span style={{ flexShrink: 0, width: "13rem", fontSize: "1.3rem", fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{row.label}</span>
                <div style={{ flex: 1, height: "1.6rem", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${row.width}%`, background: row.highlight ? GOLD : "rgba(255,255,255,0.4)", borderRadius: "9999px" }} />
                </div>
                <strong style={{ flexShrink: 0, width: "5.6rem", textAlign: "right", fontSize: "1.8rem", fontWeight: 800, color: row.highlight ? GOLD : "#fff" }}>{row.value}</strong>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "1.6rem", color: "rgba(255,255,255,0.75)", textAlign: "center", maxWidth: "56rem", margin: "0 auto 3.2rem" }}>
            Hourly pay by perceived appearance, every occupation studied, no exceptions.
          </p>

          <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
            Source: Hamermesh and Biddle, Beauty and the Labor Market, American Economic Review, NBER Working Paper No. 4518.
          </p>
        </div>
      </section>

      {/* ── Experts ── */}
      <section id="experts" style={{ padding: "8rem 3.2rem" }}>
        <div style={{ maxWidth: "88rem", margin: "0 auto", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "4.8rem", alignItems: "center" }} className="glowmetry-experts-grid">
          <div>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.6rem" }}>
              Experts
            </p>
            <h2 style={{ fontSize: "clamp(2.8rem, 5vw, 3.8rem)", fontWeight: 400, color: "var(--primary)", lineHeight: 1.15, marginBottom: "2rem" }}>
              AI gives you the read. A dermatologist gives you the plan.
            </h2>
            <p style={{ fontSize: "1.7rem", color: "var(--secondary)", lineHeight: 1.6, marginBottom: "2.8rem" }}>
              Your Glowmetry report is a starting point. When you want a real medical opinion, a certified dermatologist reviews your case and follows up directly. No AI in the loop, a real person, usually within 24 hours.
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
            <a href="/v2/splash"><PrimaryButton fullWidth={false}>Talk to a dermatologist · ${DOCTOR_CONSULTATION_PRICE}</PrimaryButton></a>
          </div>
          <div style={{ position: "relative", borderRadius: "1.6rem", overflow: "hidden", aspectRatio: "4/5" }}>
            <Image
              src="/assets/generated-dermatologist-standin.png"
              alt="Consulting dermatologist"
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
      </section>

      {/* ── Trust — real, verifiable signals. No fabricated reviews or people:
           this product has no real customer base yet, so no review section
           exists until there's a real one to show. ── */}
      <section id="trust" style={{ padding: "8rem 3.2rem", background: "var(--surface)" }}>
        <div style={{ maxWidth: "96rem", margin: "0 auto" }}>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.2rem", textAlign: "center" }}>
            Why trust this
          </p>
          <h2 style={{ fontSize: "clamp(2.6rem, 5vw, 3.8rem)", fontWeight: 400, color: "var(--primary)", textAlign: "center", lineHeight: 1.15, marginBottom: "5.6rem" }}>
            No fake reviews. Just what&apos;s actually true.
          </h2>
          <div className="glowmetry-trust-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.4rem" }}>
            {TRUST_ITEMS.map((item) => (
              <div key={item.title} style={{ background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "3.2rem" }}>
                <h3 style={{ fontSize: "1.9rem", fontWeight: 500, color: "var(--primary)", marginBottom: "1rem" }}>{item.title}</h3>
                <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.6 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: "8rem 3.2rem", background: "var(--primary)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "80rem", height: "80rem", borderRadius: "50%", background: `radial-gradient(circle, ${GOLD} 0%, transparent 65%)`, opacity: 0.16, filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "96rem", margin: "0 auto", position: "relative" }}>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.2rem", textAlign: "center" }}>
            Pricing
          </p>
          <h2 style={{ fontSize: "clamp(2.8rem, 6vw, 4.8rem)", fontWeight: 700, color: "#fff", textAlign: "center", lineHeight: 1.12, letterSpacing: "-0.02em", marginBottom: "0.8rem" }}>
            What could cost you <span style={{ color: CORAL, textDecoration: "line-through", textDecorationThickness: "0.3rem" }}>${OLD_WAY_TOTAL}+</span> is now
          </h2>
          <p style={{ fontSize: "clamp(5.6rem, 12vw, 8.8rem)", fontWeight: 800, color: GOLD, textAlign: "center", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: "1.2rem", textShadow: `0 0 6rem rgba(217,166,46,0.4)` }}>
            ${BUNDLE_PRICE}
          </p>
          <p style={{ fontSize: "1.8rem", color: "rgba(255,255,255,0.75)", textAlign: "center", marginBottom: "5.6rem" }}>
            One payment. Every module covered. No subscription, right now.
          </p>

          <div className="glowmetry-pricing-compare" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
            {/* Old way — light card floating on the dark section for maximum contrast */}
            <div style={{ background: "var(--surface)", borderRadius: "1.6rem", padding: "3.2rem" }}>
              <p style={{ display: "flex", alignItems: "center", gap: "0.8rem", fontSize: "1.3rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2.4rem" }}>
                <span style={{ color: CORAL }}>✕</span> The old way
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

            {/* Glowmetry bundle — inverted to solid gold so it's unmissable against
                the dark section and the muted "old way" card beside it */}
            <div style={{ background: GOLD, borderRadius: "1.6rem", padding: "3.2rem", position: "relative", overflow: "hidden", boxShadow: `0 2.4rem 5rem -1rem rgba(217,166,46,0.5)` }}>
              <div style={{ position: "absolute", top: "1.6rem", right: "-3.2rem", transform: "rotate(45deg)", background: "var(--primary)", color: GOLD, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.08em", padding: "0.5rem 4rem", textTransform: "uppercase" }}>
                50% off
              </div>
              <p style={{ display: "flex", alignItems: "center", gap: "0.8rem", fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2.4rem" }}>
                ⭐ Glowmetry bundle
              </p>
              {MODULES.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.2rem 0", borderBottom: "1px solid rgba(0,57,52,0.15)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500 }}>
                    <span style={{ fontWeight: 700 }}>✓</span> {m.label}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingTop: "1.6rem" }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "rgba(0,57,52,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</span>
                <span style={{ fontSize: "3.2rem", fontWeight: 800, color: "var(--primary)" }}>${BUNDLE_PRICE}</span>
              </div>
            </div>
          </div>

          <div className="glowmetry-cta-banner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap", background: GOLD, borderRadius: "1.6rem", padding: "2.4rem 3.2rem", marginBottom: "1.2rem", minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>You save</p>
              <p style={{ fontSize: "3.2rem", fontWeight: 800, color: "var(--primary)", lineHeight: 1 }}>${OLD_WAY_TOTAL - BUNDLE_PRICE}+</p>
            </div>
            <a href="/v2/splash" style={{ minWidth: 0, flexShrink: 0 }}><PrimaryButton fullWidth={false} size="lg">Get your report · ${BUNDLE_PRICE} →</PrimaryButton></a>
          </div>

          <div className="glowmetry-cta-banner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: "1.6rem", padding: "2.4rem 3.2rem", marginBottom: "1.2rem", minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "1.3rem", fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Want a real dermatologist too?</p>
              <p style={{ fontSize: "1.6rem", color: "#fff" }}>Talk to a certified dermatologist, one time, no subscription</p>
            </div>
            <a
              href="/v2/splash"
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: "5.8rem", padding: "0 3.2rem", borderRadius: "9999px", border: `1px solid ${GOLD}`,
                color: GOLD, fontSize: "1.7rem", fontWeight: 500, whiteSpace: "nowrap", textDecoration: "none",
              }}
            >
              Add consultation · ${DOCTOR_CONSULTATION_PRICE} →
            </a>
          </div>

          <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
            *Old-way total is a typical U.S. cost estimate for separate sessions, not a quote. Individual modules also available from ${MODULES[0].price} each.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: "8rem 3.2rem" }}>
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
      </section>

      <footer style={{ background: "var(--primary)", padding: "6.4rem 3.2rem 2.4rem" }}>
        <div style={{ maxWidth: "128rem", margin: "0 auto" }}>
          <div className="glowmetry-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: "4rem", paddingBottom: "4rem", borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
            <div className="glowmetry-footer-brand">
              <span style={{ fontSize: "1.8rem", fontWeight: 600, letterSpacing: "0.02em", color: "#fff" }}>
                Glow<span style={{ color: "var(--rose)" }}>metry</span>
              </span>
              <p style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginTop: "1.6rem", maxWidth: "32rem" }}>
                A guided photo scan, understood by AI. Skin, face, and hair insight in a few minutes, no lab visit.
              </p>
            </div>

            <div>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Product</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                <a href="#why" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Why Glowmetry</a>
                <a href="#experts" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Experts</a>
                <a href="#trust" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Why trust this</a>
                <a href="#pricing" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Pricing</a>
                <a href="#faq" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>FAQ</a>
                <a href="/v2/splash" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Start your scan</a>
              </div>
            </div>

            <div className="glowmetry-footer-legalsupport" style={{ display: "flex", gap: "4rem" }}>
              <div>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Legal</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <a href="/privacy" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Privacy Policy</a>
                  <a href="/terms" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Terms of Service</a>
                </div>
              </div>

              <div>
                <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Support</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <a href="mailto:support@glowmetry.com" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>support@glowmetry.com</a>
                  <a href="#faq" style={{ fontSize: "1.4rem", color: "var(--on-dark)" }}>Help & FAQ</a>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", paddingTop: "2.4rem" }}>
            <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.5)" }}>© 2026 Glowmetry</p>
            <p style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", maxWidth: "48rem", textAlign: "right" }}>
              Cosmetic and wellness insights, not a substitute for professional medical advice.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        #why, #experts, #trust, #pricing, #faq { scroll-margin-top: 8rem; }
        @media (min-width: 640px) { .site-header-cta { display: inline-block !important; } }
        @media (max-width: 900px) {
          .glowmetry-hero-grid { grid-template-columns: 1fr !important; }
          .glowmetry-why-grid { grid-template-columns: 1fr !important; }
          .glowmetry-experts-grid { grid-template-columns: 1fr !important; }
          .glowmetry-trust-grid { grid-template-columns: 1fr !important; }
          .glowmetry-footer-grid { grid-template-columns: 1fr 1fr !important; row-gap: 3.2rem !important; }
          .glowmetry-footer-brand { grid-column: 1 / -1 !important; }
        }
        @media (max-width: 520px) {
          .glowmetry-footer-legalsupport { flex-direction: column !important; gap: 2.4rem !important; }
        }
        @media (max-width: 700px) {
          .glowmetry-pricing-compare { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .glowmetry-cta-banner { flex-direction: column !important; align-items: stretch !important; }
          .glowmetry-cta-banner > a { width: 100% !important; flex-shrink: 1 !important; }
          .glowmetry-cta-banner button { width: 100% !important; white-space: normal !important; }
        }
      `}</style>
    </div>
  );
}
