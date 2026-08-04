"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { METRIC_GUIDE } from "@/lib/v2/metricGuide";
import { CAPTURE_STEPS } from "@/lib/v2/captureSteps";

/**
 * The first screen a new account sees.
 *
 * Two rules shape it. First, it has to answer "what do I actually get?" before
 * asking for six photos, so each of the four report modules gets a live sample.
 * Second, each sample gets its own layout rather than the same grid of squares:
 * an annotated face diagram, a colour fan, a list, and a single try-on figure.
 * A palette and a set of haircuts are different kinds of thing and should not
 * look identical. The page rhythm alternates too, dark card into bordered card
 * into open cloud into timeline, so it does not read as five stacked boxes.
 *
 * Sample values are illustrative and labelled as such. Structural data comes
 * from the same constants the real product uses (METRIC_GUIDE, CAPTURE_STEPS),
 * so the preview cannot drift from what the report delivers.
 */

const GOLD = "#D9A62E";
const CORAL = "#E8604F";
const GOOD = "#2E7D5B";

const ALL_METRICS = Object.keys(METRIC_GUIDE);

type PreviewId = "skin" | "colour" | "hairstyle" | "frame";

const PREVIEWS: Array<{ id: PreviewId; chip: string; title: string; blurb: string; image: string }> = [
  { id: "skin", chip: "Skin & face", title: "Read region by region", blurb: "Separate scores for skin, harmony, and angularity, each tied to where on your face it was measured.", image: "/images/wyg-skin.png" },
  { id: "colour", chip: "Colour", title: "The shades that suit your skin", blurb: "Your season, the colours to wear, and the ones that drain you.", image: "/images/wyg-colour.png" },
  { id: "hairstyle", chip: "Hairstyles", title: "A cut for each occasion", blurb: "Generated on your own photo, so you see it before the salon.", image: "/images/wyg-hair.png" },
  { id: "frame", chip: "Frames", title: "Eyewear matched to your face", blurb: "Five shapes fitted to your proportions, plus a live try-on.", image: "/images/wyg-frames.png" },
];

function bandColour(score: number): string {
  if (score >= 80) return GOOD;
  if (score >= 60) return "var(--rose)";
  if (score >= 40) return GOLD;
  return CORAL;
}

/* ── 1. Skin: an annotated diagram, not a list of tiles ──────────────────── */

// Pins keyed to the list beside them, rather than tinted zones. Filled regions
// were tried first and overlapped into an unreadable smear on a face this size;
// a numbered marker survives being small, which a soft ellipse does not.
const FACE_REGIONS: Array<{ name: string; score: number; x: number; y: number }> = [
  { name: "Forehead proportion", score: 74, x: 50, y: 26 },
  { name: "Under-eye appearance", score: 58, x: 34, y: 52 },
  { name: "Pore visibility", score: 51, x: 66, y: 64 },
  { name: "Jawline definition", score: 68, x: 50, y: 90 },
];

function FaceDiagram() {
  return (
    <div style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "0 0 auto", width: "11.5rem" }}>
        <svg viewBox="0 0 100 118" width="100%" aria-hidden style={{ display: "block", overflow: "visible" }}>
          <ellipse cx="50" cy="57" rx="32" ry="43" fill="var(--wash)" stroke="var(--line)" strokeWidth="1.2" />
          <circle cx="38" cy="48" r="2.2" fill="var(--secondary)" opacity="0.45" />
          <circle cx="62" cy="48" r="2.2" fill="var(--secondary)" opacity="0.45" />
          <path d="M33 41q5 -3 10 0M57 41q5 -3 10 0" fill="none" stroke="var(--secondary)" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
          <path d="M48 58q2 5 4 5" fill="none" stroke="var(--secondary)" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
          <path d="M42 76q8 5 16 0" fill="none" stroke="var(--secondary)" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
          {FACE_REGIONS.map((r, i) => (
            <motion.g
              key={r.name}
              initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.1 }}
              style={{ transformOrigin: `${r.x}px ${r.y}px` }}
            >
              <circle cx={r.x} cy={r.y} r="7" fill={bandColour(r.score)} stroke="var(--surface)" strokeWidth="2" />
              <text x={r.x} y={r.y + 2.9} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">{i + 1}</text>
            </motion.g>
          ))}
        </svg>
      </div>

      <ol style={{ flex: "1 1 15rem", minWidth: 0, margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {FACE_REGIONS.map((r, i) => (
          <motion.li
            key={r.name}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.09 }}
            style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}
          >
            <span style={{
              flex: "0 0 auto", width: "1.8rem", height: "1.8rem", borderRadius: "50%", background: bandColour(r.score),
              color: "#fff", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            }}>{i + 1}</span>
            <span style={{ fontSize: "1.25rem", color: "var(--primary)", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: bandColour(r.score), fontVariantNumeric: "tabular-nums" }}>{r.score}</span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/* ── 2. Colour: an overlapping fan, the way a palette is actually shown ──── */

const SAMPLE_PALETTE = ["#8B4513", "#C8503A", "#B8860B", "#556B2F", "#D2691E", "#6B4423", "#CC5500"];
const SAMPLE_AVOID = ["#AED6F1", "#D7BDE2", "#AAB7B8"];

function ColourFan() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.8rem", marginBottom: "1.6rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>Deep Autumn</span>
        <span style={{ fontSize: "1.15rem", color: "var(--muted)" }}>warm · high contrast · gold</span>
      </div>

      {/* Circles overlap into a fan rather than sitting in a grid: it reads as
          one palette, and it scales down without leaving ragged rows. */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1.4rem", paddingLeft: "0.4rem" }}>
        {SAMPLE_PALETTE.map((c, i) => (
          <motion.span
            key={c}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22, delay: i * 0.05 }}
            style={{
              width: "4.2rem", height: "4.2rem", borderRadius: "50%", background: c,
              marginLeft: i === 0 ? 0 : "-1.2rem", border: "2px solid var(--surface)",
              boxShadow: "0 0.2rem 0.6rem rgba(0,0,0,0.12)", zIndex: SAMPLE_PALETTE.length - i, flexShrink: 0,
            }}
          />
        ))}
      </div>

      <div style={{ height: "0.6rem", borderRadius: "9999px", marginBottom: "1.6rem", background: `linear-gradient(90deg, ${SAMPLE_PALETTE.join(",")})` }} />

      <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
        <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em" }}>SKIP</span>
        {SAMPLE_AVOID.map((c) => (
          <span key={c} style={{ position: "relative", width: "2.2rem", height: "2.2rem", borderRadius: "50%", background: c, opacity: 0.5, flexShrink: 0 }}>
            <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)" }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 3. Hairstyles: a list you read, with the occasion leading ───────────── */

// Each row gets its own crown shape. Identical silhouettes at three opacities
// read as one placeholder repeated, not as three different cuts.
const HAIR_ROWS: Array<{ occasion: string; note: string; hair: string }> = [
  { occasion: "Office", note: "Neat, structured, low effort in the morning",
    hair: "M10 17c0-6 4.5-10 10-10s10 4 10 10c0-3-1.5-5-4-5-4 0-4 2-9 2-3 0-5 1-7 3z" },
  { occasion: "Wedding", note: "Formal, holds through a long day",
    hair: "M10 18c0-9 4.5-14 10-14s10 5 10 14c0-5-2-8-5-8-2 0-3 1-5 1s-3-1-5-1c-3 0-5 3-5 8z" },
  { occasion: "Evening out", note: "Sharper, more texture through the top",
    hair: "M10 17l2-5 2 4 2-5 2 4 2-5 2 4 2-4 2 4 2-3c1 3 1 5 1 7 0-3-2-5-5-5-4 0-5 2-9 2-2 0-4 1-5 3z" },
];

function HairstyleList() {
  return (
    <div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {HAIR_ROWS.map((h, i) => (
          <motion.li
            key={h.occasion}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            style={{
              display: "flex", alignItems: "center", gap: "1.2rem", padding: "1rem 0",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
            }}
          >
            <span style={{ flex: "0 0 auto", width: "3.8rem", height: "3.8rem", borderRadius: "50%", background: "var(--wash)", border: "1px solid var(--line)", overflow: "hidden", display: "block" }}>
              <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
                <circle cx="20" cy="18" r="8.5" fill="var(--line)" />
                <path d="M6 40c0-8 6.3-13 14-13s14 5 14 13z" fill="var(--line)" />
                <path d={h.hair} fill="var(--primary)" opacity="0.62" />
              </svg>
            </span>
            <span style={{ flex: "1 1 auto", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "1.4rem", fontWeight: 600, color: "var(--primary)" }}>{h.occasion}</span>
              <span style={{ display: "block", fontSize: "1.2rem", color: "var(--secondary)", lineHeight: 1.4 }}>{h.note}</span>
            </span>
          </motion.li>
        ))}
      </ul>
      <p style={{ fontSize: "1.2rem", color: "var(--muted)", margin: "1rem 0 0" }}>and 2 more, including a low-upkeep short cut</p>
    </div>
  );
}

/* ── 4. Frames: one figure, a selector, and the frame actually changes ───── */

const FRAMES: Array<{ name: string; render: (c: string) => React.ReactNode }> = [
  { name: "Rectangular", render: (c) => (<><rect x="14" y="42" width="26" height="16" rx="3" fill="none" stroke={c} strokeWidth="2.4" /><rect x="60" y="42" width="26" height="16" rx="3" fill="none" stroke={c} strokeWidth="2.4" /><path d="M40 50h20" stroke={c} strokeWidth="2.4" /></>) },
  { name: "Round", render: (c) => (<><circle cx="27" cy="50" r="12" fill="none" stroke={c} strokeWidth="2.2" /><circle cx="73" cy="50" r="12" fill="none" stroke={c} strokeWidth="2.2" /><path d="M39 50h22" stroke={c} strokeWidth="2.2" /></>) },
  { name: "Bold square", render: (c) => (<><rect x="13" y="41" width="28" height="18" rx="2" fill="none" stroke={c} strokeWidth="3.4" /><rect x="59" y="41" width="28" height="18" rx="2" fill="none" stroke={c} strokeWidth="3.4" /><path d="M41 49h18" stroke={c} strokeWidth="3.4" /></>) },
  { name: "Aviator", render: (c) => (<><path d="M14 43h26c0 10-5 16-13 16s-13-6-13-16z" fill="none" stroke={c} strokeWidth="2.2" /><path d="M60 43h26c0 10-5 16-13 16s-13-6-13-16z" fill="none" stroke={c} strokeWidth="2.2" /><path d="M40 45h20" stroke={c} strokeWidth="2.2" /></>) },
  { name: "Rimless", render: (c) => (<><rect x="15" y="43" width="25" height="14" rx="7" fill="none" stroke={c} strokeWidth="1.1" opacity="0.65" /><rect x="60" y="43" width="25" height="14" rx="7" fill="none" stroke={c} strokeWidth="1.1" opacity="0.65" /><path d="M40 50h20" stroke={c} strokeWidth="1.6" /></>) },
];

function FrameTryOn({ reduceMotion }: { reduceMotion: boolean | null }) {
  const [i, setI] = useState(0);
  const held = useRef(false);

  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => { if (!held.current) setI((v) => (v + 1) % FRAMES.length); }, 1600);
    return () => clearInterval(t);
  }, [reduceMotion]);

  return (
    <div style={{ display: "flex", gap: "1.8rem", alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: "0 0 auto", width: "11rem" }}>
        <svg viewBox="0 0 100 115" width="100%" aria-hidden style={{ display: "block" }}>
          <ellipse cx="50" cy="56" rx="33" ry="44" fill="var(--wash)" stroke="var(--line)" strokeWidth="1.2" />
          <path d="M38 74q12 7 24 0" fill="none" stroke="var(--secondary)" strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
          <path d="M48 58q2 4 4 4" fill="none" stroke="var(--secondary)" strokeWidth="1.4" strokeLinecap="round" opacity="0.35" />
          {/* Arms, so the frame reads as worn rather than floating */}
          <path d="M14 46 8 44M86 46l6-2" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          <AnimatePresence mode="wait">
            <motion.g
              key={i}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.22 }}
            >
              {FRAMES[i].render("var(--primary)")}
            </motion.g>
          </AnimatePresence>
        </svg>
      </div>

      <div style={{ flex: "1 1 13rem", minWidth: 0 }}>
        <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", margin: "0 0 0.9rem" }}>TRY A SHAPE</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {FRAMES.map((f, idx) => {
            const on = idx === i;
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => { held.current = true; setI(idx); }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.8rem", padding: "0.5rem 0.9rem",
                  borderRadius: "9999px", cursor: "pointer", textAlign: "left", width: "100%",
                  border: `1px solid ${on ? "var(--primary)" : "transparent"}`,
                  background: on ? "var(--wash)" : "transparent",
                  fontSize: "1.2rem", fontWeight: on ? 700 : 500, color: on ? "var(--primary)" : "var(--secondary)",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <svg viewBox="8 36 84 28" width="30" height="14" aria-hidden style={{ flexShrink: 0 }}>
                  {f.render(on ? "var(--primary)" : "var(--muted)")}
                </svg>
                {f.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Screen ──────────────────────────────────────────────────────────────── */

export function DashboardEmptyState({ onStart }: { onStart: () => void }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<PreviewId>("skin");
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  // Cycles through the four modules until the first tap, so the screen shows
  // rather than tells that there is more than one. Stops for good once the user
  // takes over, and never starts under reduced motion.
  useEffect(() => {
    if (reduceMotion || !autoRotate) return;
    const t = setInterval(() => {
      setActive((cur) => PREVIEWS[(PREVIEWS.findIndex((p) => p.id === cur) + 1) % PREVIEWS.length].id);
    }, 4200);
    return () => clearInterval(t);
  }, [reduceMotion, autoRotate]);

  function pick(id: PreviewId) {
    setAutoRotate(false);
    setActive(id);
  }

  const current = PREVIEWS.find((p) => p.id === active)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3.2rem" }}>

      {/* ── Start: dark, one action, expectations stated up front ── */}
      <div style={{ background: "var(--panel)", borderRadius: "2rem", padding: "3.2rem 2.8rem", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: "-40%", right: "-20%", width: "28rem", height: "28rem", borderRadius: "50%", background: "radial-gradient(circle, var(--rose) 0%, transparent 70%)", opacity: 0.18, filter: "blur(40px)" }} />
        <div style={{ position: "relative" }}>
          <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--rose)", letterSpacing: "0.14em", margin: "0 0 1rem" }}>NO ANALYSES YET</p>
          <h2 style={{ fontSize: "clamp(2.2rem, 6vw, 2.8rem)", fontWeight: 400, color: "#fff", lineHeight: 1.25, margin: "0 0 1.8rem", textWrap: "balance" }}>
            Your first Percept Score is a few minutes away
          </h2>
          <PrimaryButton fullWidth variant="onDark" onClick={onStart}>Start your first scan →</PrimaryButton>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem 1.6rem", marginTop: "1.6rem" }}>
            {[`${CAPTURE_STEPS.length} photos`, "2 to 4 minutes", "Private to you"].map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "1.2rem", color: "rgba(255,255,255,0.72)" }}>
                <span aria-hidden style={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", background: "var(--rose)" }} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sample of each module, each with its own layout ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "2rem", padding: "2.4rem 2.4rem 2.8rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "1.6rem", flexWrap: "wrap" }}>
          <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.12em", margin: 0 }}>WHAT YOU GET</p>
          <span style={{ fontSize: "1.1rem", color: "var(--secondary)", background: "var(--wash)", borderRadius: "9999px", padding: "0.3rem 0.9rem" }}>Example, not your data</span>
        </div>

        <div role="tablist" aria-label="Report modules" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.8rem" }}>
          {PREVIEWS.map((p) => {
            const on = p.id === active;
            return (
              <button
                key={p.id} role="tab" aria-selected={on} onClick={() => pick(p.id)}
                style={{
                  flex: "0 0 auto", padding: "0.8rem 1.4rem", borderRadius: "9999px", cursor: "pointer",
                  fontSize: "1.25rem", fontWeight: 600, whiteSpace: "nowrap",
                  border: `1px solid ${on ? "var(--primary)" : "var(--line)"}`,
                  background: on ? "var(--btn-fill)" : "var(--surface)",
                  color: on ? "var(--btn-fill-ink)" : "var(--secondary)", transition: "background 0.18s, color 0.18s, border-color 0.18s",
                }}
              >
                {p.chip}
              </button>
            );
          })}
        </div>

        {/* Fixed floor so swapping layouts never makes the page jump. */}
        <div style={{ minHeight: "21rem" }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {/* A real photo leading each preview — the diagrams/lists below are
                  illustrative UI, not photography, and standing alone they read
                  as placeholder art next to the photo-led cards elsewhere on the
                  site (components/marketing/WhatYouGet.tsx). Same 4 image assets,
                  reused here for a consistent, finished look. */}
              <div style={{ position: "relative", width: "100%", aspectRatio: "21/9", borderRadius: "1.4rem", overflow: "hidden", marginBottom: "2rem" }}>
                <Image src={current.image} alt={current.title} fill sizes="(max-width: 700px) 100vw, 60rem" style={{ objectFit: "cover" }} />
              </div>
              <p style={{ fontSize: "1.7rem", fontWeight: 600, color: "var(--primary)", margin: "0 0 0.4rem" }}>{current.title}</p>
              <p style={{ fontSize: "1.35rem", color: "var(--secondary)", lineHeight: 1.5, margin: "0 0 1.8rem" }}>{current.blurb}</p>
              {active === "skin" && <FaceDiagram />}
              {active === "colour" && <ColourFan />}
              {active === "hairstyle" && <HairstyleList />}
              {active === "frame" && <FrameTryOn reduceMotion={reduceMotion} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── The metrics, named. Open on the page, no box: a change of texture
             after two cards, and the count means nothing until you read them. ── */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.9rem", marginBottom: "1.4rem" }}>
          <span style={{ fontSize: "3.6rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1 }}>{ALL_METRICS.length}</span>
          <p style={{ fontSize: "1.5rem", color: "var(--secondary)", margin: 0 }}>things we score, one at a time</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {(showAllMetrics ? ALL_METRICS : ALL_METRICS.slice(0, 8)).map((m) => (
            <span key={m} style={{ fontSize: "1.2rem", color: "var(--secondary)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "9999px", padding: "0.45rem 1rem" }}>{m}</span>
          ))}
          {!showAllMetrics && (
            <button type="button" onClick={() => setShowAllMetrics(true)}
              style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--rose)", background: "none", border: "none", cursor: "pointer", padding: "0.45rem 0.6rem" }}>
              show all {ALL_METRICS.length}
            </button>
          )}
        </div>
      </div>

      {/* ── How it works: a timeline with a spine, not three boxes ── */}
      <div>
        <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.12em", margin: "0 0 2rem" }}>HOW IT WORKS</p>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", position: "relative" }}>
          <span aria-hidden style={{ position: "absolute", left: "1.1rem", top: "1.2rem", bottom: "1.2rem", width: "1px", background: "var(--line)" }} />
          {[
            { t: "Take the photos", d: `${CAPTURE_STEPS.length} guided shots. The app frames each one and tells you exactly what to do.` },
            { t: "We analyse", d: "Every photo is read together, then scored metric by metric with an explanation." },
            { t: "Read your report", d: "Scores, routine, colours, hairstyles and frames, all generated for you." },
          ].map((s, i) => (
            <li key={s.t} style={{ position: "relative", display: "flex", gap: "1.4rem", paddingBottom: i === 2 ? 0 : "2.2rem" }}>
              <span style={{
                flex: "0 0 auto", width: "2.2rem", height: "2.2rem", borderRadius: "50%", zIndex: 1,
                background: "var(--panel)", color: "#fff", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "1.1rem", fontWeight: 700,
              }}>{i + 1}</span>
              <div style={{ minWidth: 0, paddingTop: "0.2rem" }}>
                <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--primary)", margin: "0 0 0.3rem" }}>{s.t}</p>
                <p style={{ fontSize: "1.3rem", color: "var(--secondary)", lineHeight: 1.5, margin: 0 }}>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "2rem", paddingLeft: "3.6rem" }}>
          {CAPTURE_STEPS.map((s) => (
            <span key={s.photoType} style={{ fontSize: "1.15rem", color: "var(--secondary)", background: "var(--wash)", borderRadius: "9999px", padding: "0.4rem 0.9rem" }}>{s.label}</span>
          ))}
        </div>
      </div>

      {/* ── One evidence line, quiet ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1.2rem", borderTop: "1px solid var(--line)", paddingTop: "2rem" }}>
        <span style={{ fontSize: "1.8rem", fontWeight: 700, color: GOLD, lineHeight: 1.2, flexShrink: 0 }}>+5%</span>
        <p style={{ fontSize: "1.3rem", color: "var(--secondary)", lineHeight: 1.5, margin: 0 }}>
          Peer-reviewed research finds people rated above average in appearance earn measurably more, across every occupation studied.
        </p>
      </div>
    </div>
  );
}
