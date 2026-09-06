"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScoreReveal } from "@/components/v2/ScoreReveal";
import ColourAnalysisPanel from "@/components/v2/ColourAnalysisPanel";
import HairstylePanel, { HairCarePointers } from "@/components/v2/HairstylePanel";
import GroomingPanel from "@/components/v2/GroomingPanel";
import GlassesVirtualTryOn from "@/components/v2/GlassesVirtualTryOn";
import FrameAIPanel from "@/components/v2/FrameAIPanel";
import { FrameGrid } from "@/components/v2/FrameGrid";
import { MAX_GENERATIONS } from "@/lib/v2/generationBudget";
import { guideFor } from "@/lib/v2/metricGuide";
import { trackEvent } from "@/lib/analytics";
import { logV2 } from "@/lib/v2/log";
import { HARMONY_METRIC_NAMES, ANGULARITY_METRIC_NAMES } from "@/lib/v2/faceMetricGroups";
import { IconFaceScan, IconLock, IconCheck, IconSparkle, IconSun, IconMoon, IconStrands, IconArrowRight, IconInfo } from "@/components/ui/icons";
import { ScanFace, Scissors, Palette, Glasses, Smile, Sparkles as LucideSparkles, Droplets, ShieldCheck, Heart, type LucideIcon } from "lucide-react";
import type { AnalysisMetric, MetricCategory, ColourAnalysis, RecommendationSet } from "@/lib/v2/types";
import type { ModuleId } from "@/lib/v2/reportModules";

interface SessionRow {
  id: string;
  status: string;
  overall_score: number | null;
  skin_age: number | null;
  image_quality_score: number | null;
  created_at: string;
  positive_observations: string[] | null;
  recommendations: RecommendationSet | null;
  limitations: string[] | null;
  // Nullable: pre-migration environments lack this column, same as the
  // best-effort content fetch below — a failed analysis just falls back to
  // the plain "still processing" copy rather than a specific reason.
  stage: string | null;
  fail_reason: string | null;
}

function verdictFor(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Moderate";
  return "Needs attention";
}

// Score bands drive the colour of both the bar and the status chip, so a
// glance down the column reads as a status list rather than 20 identical bars.
function bandFor(score: number | null): { label: string; color: string; tint: string } {
  if (score === null) return { label: "Not assessed", color: "#65716D", tint: "#ECEFEE" };
  if (score >= 80) return { label: "Excellent", color: "#17633F", tint: "#E2F1E8" };
  if (score >= 60) return { label: "Good", color: "#217A55", tint: "#E7F3EC" };
  if (score >= 40) return { label: "Watch", color: "#9A6512", tint: "#FAF0D7" };
  return { label: "Needs attention", color: "#A93636", tint: "#F8E5E3" };
}

function ScoreBar({ score, color }: { score: number | null; color?: string }) {
  const pct = Math.max(2, Math.min(100, score ?? 0));
  return (
    <div style={{ flex: 1, height: "0.5rem", borderRadius: "9999px", background: "var(--line)", overflow: "hidden", minWidth: "4rem" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: "9999px", background: color ?? "var(--rose)" }} />
    </div>
  );
}

// Collapsed by default: name, status, bar, score. That row alone is the
// scannable layer. Everything else, the model's finding for this specific
// scan plus the standing reference material, opens on click, so depth is
// available without the page reading as a wall of paragraphs.
function MetricRow({ m }: { m: AnalysisMetric }) {
  const [open, setOpen] = useState(false);
  const band = bandFor(m.score);
  const guide = guideFor(m.metricName);

  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="v2-metric-row"
        style={{
          display: "flex", alignItems: "center", gap: "1.4rem", width: "100%", padding: "1.5rem 0",
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <span style={{ fontSize: "1.65rem", color: "var(--primary)", fontWeight: 650, flex: "1 1 auto", minWidth: 0 }}>{m.metricName}</span>
        <span style={{
          fontSize: "1.18rem", fontWeight: 800, color: band.color, background: band.tint, borderRadius: "9999px",
          padding: "0.4rem 1rem", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.02em",
        }}>
          {band.label}
        </span>
        <div className="v2-metric-bar" style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "0 0 12rem" }}>
          <ScoreBar score={m.score} color={band.color} />
          <span style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 700, width: "2.8rem", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{m.score ?? "-"}</span>
        </div>
        <span aria-hidden style={{ fontSize: "1.2rem", color: "var(--muted)", flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="v2-metric-detail" style={{ paddingBottom: "2.4rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div className="v2-metric-finding" style={{ display: "flex", flexDirection: "column", gap: "1.4rem", borderLeft: `2px solid ${band.color}`, paddingLeft: "1.8rem" }}>
                <div>
                  {/* An icon per subsection so "what we saw" and "what to do" read
                      apart at a glance — both used to be identical grey eyebrow
                      text, so telling them apart meant actually reading the label. */}
                  <p style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem", fontSize: "1.1rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>
                    <IconFaceScan size={1.25} strokeWidth={2} />In your scan
                  </p>
                  <p style={{ fontSize: "1.6rem", color: "var(--primary)", lineHeight: 1.65, margin: 0 }}>{m.explanation}</p>
                </div>
                {m.recommendation && (
                  <div>
                    <p style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem", fontSize: "1.1rem", fontWeight: 700, color: band.color, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>
                      <IconArrowRight size={1.25} strokeWidth={2.4} />Suggested next step
                    </p>
                    <p style={{ fontSize: "1.6rem", color: "var(--primary)", lineHeight: 1.65, margin: 0 }}>{m.recommendation}</p>
                  </div>
                )}
                {m.confidence && (
                  <p style={{ fontSize: "1.2rem", color: "var(--muted)", margin: 0 }}>Confidence: {m.confidence}</p>
                )}
              </div>

              {guide && (
                <div className="v2-metric-guide" style={{ background: "var(--canvas)", borderRadius: "1.2rem", padding: "2.2rem 2.4rem" }}>
                  <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 1.2rem" }}>
                    Understanding {m.metricName.toLowerCase()}
                  </p>
                  <p style={{ fontSize: "1.45rem", color: "var(--primary)", lineHeight: 1.65, margin: "0 0 0.8rem" }}>{guide.what}</p>
                  <p style={{ fontSize: "1.45rem", color: "var(--secondary)", lineHeight: 1.65, margin: "0 0 1.8rem" }}>{guide.matters}</p>
                  <div className="v2-guide-cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.8rem 3.2rem" }}>
                    <GuideList title="What drives it" items={guide.drivers} color="var(--secondary)" />
                    <GuideList title="What helps" items={guide.helps} color="var(--rose)" tick />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// `tick` marks the actionable column. A drawn check and a dot sit on the same
// baseline at the same weight; the ✓ character and the • character do not, and
// the two columns never lined up because of it.
function GuideList({ title, items, color, tick }: { title: string; items: string[]; color: string; tick?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 0.9rem" }}>{title}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", gap: "0.8rem", fontSize: "1.35rem", color: "var(--secondary)", lineHeight: 1.55 }}>
            <span aria-hidden style={{ color, flexShrink: 0, display: "flex", alignItems: "center", height: "2.1rem" }}>
              {tick ? <IconCheck size={1.4} strokeWidth={2.6} /> : <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: "currentColor" }} />}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const REPORT_GLOSSARY: Record<string, { meaning: string; why: string }> = {
  Skin: { meaning: "Visible qualities such as texture, tone, hydration, pores and pigmentation.", why: "It helps identify what looks healthy now and what may benefit from a consistent routine." },
  Harmony: { meaning: "How naturally the visible proportions of your facial features balance together.", why: "It describes overall balance, not whether one individual feature is good or bad." },
  Angularity: { meaning: "How defined or softly curved your jawline, cheekbones and chin appear.", why: "It can help guide hairstyles, facial hair, makeup and frame shapes that complement your structure." },
  "Hair & Scalp": { meaning: "Visible hair density, hairline pattern, part width and scalp presentation.", why: "It provides a baseline for grooming choices and future scan comparisons." },
};

function InfoTip({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const copy = REPORT_GLOSSARY[term];
  if (!copy) return null;
  return (
    <span className="v2-info-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="v2-info-button" aria-label={`What does ${term} mean?`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>i</button>
      <AnimatePresence>{open && <motion.span className="v2-info-popover" role="tooltip" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
        <button type="button" className="v2-info-close" aria-label="Close explanation" onClick={() => setOpen(false)}>×</button><strong>What is {term}?</strong><span>{copy.meaning}</span><small>Why it matters</small><span>{copy.why}</span>
      </motion.span>}</AnimatePresence>
    </span>
  );
}

// Pre-purchase teaser row — real metric name (what was measured), score/bar
// blurred behind a lock (real proportions still faintly visible, exact value
// not readable), no explanation. The data itself already exists for every
// scan regardless of purchase (analyse runs before checkout) — this is a
// rendering-only gate, nothing new computed or stored.
function LockedMetricRow({ m }: { m: AnalysisMetric }) {
  return (
    // Same geometry as MetricRow: name on the left, a fixed 12rem score column
    // on the right, lock last. A locked row that stretched its blurred bar
    // across the full width pulled more attention than the readable rows above
    // it, which inverts what the free preview is meant to do.
    <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", padding: "1.5rem 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: "1.5rem", color: "var(--secondary)", fontWeight: 500, flex: "1 1 auto", minWidth: 0 }}>{m.metricName}</span>
      <div
        aria-hidden
        className="v2-metric-bar"
        style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "0 0 12rem", filter: "blur(5px)", opacity: 0.55, userSelect: "none" }}
      >
        <ScoreBar score={m.score} />
        <span style={{ fontSize: "1.5rem", color: "var(--secondary)", fontWeight: 700, width: "2.8rem", textAlign: "right", flexShrink: 0 }}>{m.score ?? "-"}</span>
      </div>
      <span style={{ display: "flex", color: "var(--muted)", flexShrink: 0 }}><IconLock size={1.5} title="Locked" /></span>
    </div>
  );
}

// One accent per section, keyed by title (not index) so it stays fixed
// regardless of which sections a given purchase actually renders.
const SECTION_ACCENT: Record<string, string> = {
  Skin: "#3E7B68",
  Face: "#8B7355",
  Harmony: "#71857C",
  Angularity: "#8B7355",
  "Hair & Scalp": "#6D7768",
};

// How many skin metrics a free scan reads in full — real score, real band, the
// model's finding, and the suggested next step, exactly as a buyer sees them.
// Not a watermarked sample: the free tier has to be worth using on its own, or
// the paid report is being sold on a promise rather than on evidence.
//
// Three, and specifically the three lowest-scoring, because those are the ones
// worth acting on. Handing over the best scores for free would make the free
// tier flattering and useless.
const FREE_METRIC_COUNT = 3;

// Rows are one line each now (detail opens per row), so this is about
// prioritising rather than hiding bulk: the four that most need attention
// sit above the fold, the rest are one tap away.
// Three, not four. Each row is a full line on mobile, and with three
// sections the report opened with a dozen rows before any other content.
const COLLAPSED_COUNT = 3;

// Status filter shared by every metric section on a tab. "all" is the default;
// picking anything else is itself a narrowing act, so a filtered section shows
// every match rather than re-collapsing behind a "show more".
type BandKey = "all" | "focus" | "moderate" | "good";

// Each filter carries the colour of the band it selects, so the control itself
// teaches the colour language used by every score row underneath it.
const BAND_FILTERS: Array<{ key: BandKey; label: string; short: string; colour: string; match: (s: number | null) => boolean }> = [
  { key: "all", label: "All metrics", short: "All", colour: "var(--primary)", match: () => true },
  { key: "focus", label: "Needs attention", short: "Attention", colour: "#A93636", match: (s) => s !== null && s < 40 },
  { key: "moderate", label: "Neutral or watch", short: "Watch", colour: "#9A6512", match: (s) => s !== null && s >= 40 && s < 60 },
  { key: "good", label: "Strong results", short: "Strong", colour: "#217A55", match: (s) => s !== null && s >= 60 },
];

function matchesBand(key: BandKey, score: number | null): boolean {
  return (BAND_FILTERS.find((b) => b.key === key) ?? BAND_FILTERS[0]).match(score);
}

function MetricFilterBar({ value, onChange, metrics }: {
  value: BandKey; onChange: (v: BandKey) => void; metrics: AnalysisMetric[];
}) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <p className="v2-filter-label" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.12em", margin: "0 0 1rem" }}>SHOW ME</p>
      <div className="v2-filter-row" style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
        {BAND_FILTERS.filter((f) => metrics.some((m) => f.match(m.score))).map((f) => {
          const count = metrics.filter((m) => f.match(m.score)).length;
          const active = value === f.key;
          return (
            <motion.button
              key={f.key}
              type="button"
              onClick={() => onChange(f.key)}
              whileTap={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.8rem",
                padding: "1rem 1.6rem", borderRadius: "1.4rem",
                cursor: "pointer", fontSize: "1.45rem", fontWeight: 700,
                border: `2px solid ${active ? f.colour : "var(--line)"}`,
                background: active ? f.colour : "var(--surface)",
                color: active ? "#fff" : "var(--primary)",
                boxShadow: active ? `0 0.6rem 1.6rem -0.6rem ${f.colour}` : "none",
                transition: "background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s",
              }}
            >
              <span aria-hidden className="v2-filter-dot" style={{
                width: "0.9rem", height: "0.9rem", borderRadius: "50%", flexShrink: 0,
                background: active ? "rgba(255,255,255,0.9)" : f.colour,
              }} />
              <span className="v2-filter-full">{f.label}</span>
              <span className="v2-filter-short" style={{ display: "none" }}>{f.short}</span>
              <span style={{
                fontSize: "1.2rem", fontWeight: 800, borderRadius: "9999px", padding: "0.2rem 0.7rem",
                background: active ? "rgba(255,255,255,0.22)" : "var(--wash)",
                color: active ? "#fff" : f.colour, fontVariantNumeric: "tabular-nums",
              }}>{count}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// `total` is the number of sections rendering within the same tab (e.g. Skin
// tab: Skin, Harmony, Angularity → total 3). The numbered badge only appears
// when there's an actual sequence to number — "Part 1 of 1" tells a reader
// nothing a lone section header doesn't already say.
function Section({ index, total = 1, id, title, intro, metrics, locked, filter = "all" }: {
  index: number; total?: number; id: string; title: string; intro?: string; metrics: AnalysisMetric[]; locked?: boolean; filter?: BandKey;
}) {
  const [expanded, setExpanded] = useState(false);
  if (metrics.length === 0) return null;
  const accent = SECTION_ACCENT[title] ?? "var(--rose)";

  // Lowest scores first: the actionable end of the list is what belongs at
  // the top of a section, not whatever order the model happened to return.
  const ordered = locked
    ? metrics
    : [...metrics].filter((m) => matchesBand(filter, m.score)).sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
  if (ordered.length === 0) return null;
  // Average is always over the whole section, never the filtered view — a
  // section average that moved when you clicked "Focus areas" would be a lie.
  const scored = metrics.filter((m) => m.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, m) => s + (m.score ?? 0), 0) / scored.length) : null;
  const band = bandFor(avg);
  const focusCount = metrics.filter((m) => m.score !== null && m.score < 40).length;
  const moderateCount = metrics.filter((m) => m.score !== null && m.score >= 40 && m.score < 60).length;
  const strongCount = metrics.filter((m) => m.score !== null && m.score >= 60).length;
  const hiddenCount = locked || filter !== "all" ? 0 : Math.max(0, ordered.length - COLLAPSED_COUNT);
  const visible = hiddenCount > 0 ? ordered.slice(0, COLLAPSED_COUNT) : ordered;

  return (
    <section id={id} className="v2-report-section" style={{
      marginBottom: "1.6rem", background: "var(--surface)", borderRadius: "1.6rem",
      border: "1px solid var(--line)", overflow: "hidden", scrollMarginTop: "2.4rem",
    }}>
      {/* Eyebrow and average share one line, then the title, then the intro.
          The average used to be a three-line stack floated to the right, which
          wrapped below the title on a phone and left the header six lines tall
          before a single score appeared. */}
      <header className="v2-section-header" style={{ borderTop: `0.4rem solid ${accent}`, padding: "2rem 2.4rem 1.6rem", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.2rem", marginBottom: "0.7rem" }}>
          <p style={{ display: "inline-flex", alignItems: "center", gap: "0.9rem", fontSize: "1.1rem", fontWeight: 700, color: accent, letterSpacing: "0.12em", margin: 0 }}>
            {total > 1 && (
              <span aria-hidden style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                width: "1.9rem", height: "1.9rem", borderRadius: "50%", background: accent, color: "#fff",
                fontSize: "1.05rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
              }}>{index}</span>
            )}
            {total > 1 ? `PART ${index} OF ${total} · ` : ""}{scored.length} MEASUREMENT{scored.length === 1 ? "" : "S"}
          </p>
          {avg !== null && !locked && (
            <span style={{
              display: "inline-flex", alignItems: "baseline", gap: "0.5rem", flexShrink: 0,
              background: band.tint, borderRadius: "9999px", padding: "0.4rem 1.1rem",
            }}>
              <strong style={{ fontSize: "1.7rem", fontWeight: 800, color: band.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{avg}</strong>
              <span style={{ fontSize: "1.1rem", fontWeight: 600, color: band.color, opacity: 0.85 }}>section score</span>
            </span>
          )}
        </div>
        <div className="v2-title-with-info"><h2 style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2><InfoTip term={title} /></div>
        {intro && <p style={{ fontSize: "1.4rem", color: "var(--secondary)", margin: "0.5rem 0 0", maxWidth: "52rem" }}>{intro}</p>}
        <div className="v2-section-summary" aria-label={`${title} score summary`}>
          <span><i style={{ background: "#A93636" }} />{focusCount} need attention</span>
          <span><i style={{ background: "#9A6512" }} />{moderateCount} watch</span>
          <span><i style={{ background: "#217A55" }} />{strongCount} strong</span>
        </div>
      </header>

      <div className="v2-section-body" style={{ padding: "0 2.4rem 1.8rem" }}>
        {visible.map((m) => locked ? <LockedMetricRow key={m.metricName} m={m} /> : <MetricRow key={m.metricName} m={m} />)}
        <AnimatePresence initial={false}>
          {hiddenCount > 0 && expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: "hidden" }}
            >
              {ordered.slice(COLLAPSED_COUNT).map((m) => <MetricRow key={m.metricName} m={m} />)}
            </motion.div>
          )}
        </AnimatePresence>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1.8rem", background: "none",
              border: "none", padding: 0, cursor: "pointer", fontSize: "1.4rem", fontWeight: 600, color: accent,
            }}
          >
            {expanded ? "Show fewer metrics" : `Show ${hiddenCount} more metric${hiddenCount > 1 ? "s" : ""}`}
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
          </button>
        )}
      </div>
    </section>
  );
}

/* ── Free preview ─────────────────────────────────────────────────────────
   Every score below already exists for every scan: analysis runs before
   checkout, so nothing here is computed or billed for a free user. These are
   rendering gates over data the account already owns. */

// A section where the first few rows read in full and the rest are name-only.
// Deliberately not the `locked` variant of Section, which blurs everything:
// the point of the free tier is that part of it is genuinely readable.
function FreeSkinSection({ title, intro, free, locked, accent, onUnlock }: {
  title: string; intro?: string; free: AnalysisMetric[]; locked: AnalysisMetric[]; accent: string; onUnlock: () => void;
}) {
  if (free.length === 0 && locked.length === 0) return null;
  const scored = [...free, ...locked].filter((m) => m.score !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, m) => s + (m.score ?? 0), 0) / scored.length) : null;
  const band = bandFor(avg);

  return (
    <section style={{
      marginBottom: "1.6rem", background: "var(--surface)", borderRadius: "1.6rem",
      border: "1px solid var(--line)", overflow: "hidden",
    }}>
      <header style={{ borderTop: `0.4rem solid ${accent}`, padding: "2rem 2.4rem 1.6rem", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.2rem", marginBottom: "0.7rem" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: accent, letterSpacing: "0.12em", margin: 0 }}>
            {free.length > 0 ? `${free.length} OF ${free.length + locked.length} FREE` : "LOCKED"}
          </p>
          {avg !== null && free.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: "0.5rem", background: band.tint, borderRadius: "9999px", padding: "0.4rem 1.1rem" }}>
              <strong style={{ fontSize: "1.7rem", fontWeight: 800, color: band.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{avg}</strong>
              <span style={{ fontSize: "1.1rem", fontWeight: 600, color: band.color, opacity: 0.85 }}>avg of {scored.length}</span>
            </span>
          )}
        </div>
        <div className="v2-title-with-info"><h2 style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2><InfoTip term={title} /></div>
        {intro && <p style={{ fontSize: "1.4rem", color: "var(--secondary)", margin: "0.5rem 0 0", maxWidth: "52rem" }}>{intro}</p>}
      </header>

      <div style={{ padding: "0 2.4rem 1.8rem" }}>
        {free.map((m) => <MetricRow key={m.metricName} m={m} />)}
        {locked.map((m) => <LockedMetricRow key={m.metricName} m={m} />)}
        {locked.length > 0 && (
          <button
            type="button"
            onClick={onUnlock}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1.8rem", background: "none",
              border: "none", padding: 0, cursor: "pointer", fontSize: "1.4rem", fontWeight: 700, color: accent,
            }}
          >
            Unlock {locked.length} more {locked.length > 1 ? "scores" : "score"} →
          </button>
        )}
      </div>
    </section>
  );
}

// The panel behind a locked tab. Says what is in there and what it costs, in
// the tab's own accent, rather than bouncing straight to the paywall on click.
function LockedTabPanel({ title, blurb, points, accent, onUnlock }: {
  title: string; blurb: string; points: string[]; accent: string; onUnlock: () => void;
}) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderTop: `0.4rem solid ${accent}`,
      borderRadius: "1.6rem", padding: "3.2rem", textAlign: "center",
    }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "0.6rem", fontSize: "1.15rem", fontWeight: 800,
        letterSpacing: "0.08em", textTransform: "uppercase", color: accent,
        background: "var(--wash)", borderRadius: "9999px", padding: "0.5rem 1.4rem", marginBottom: "1.6rem",
      }}>
        <IconLock size={1.3} strokeWidth={2} />
        Locked
      </span>
      <h2 style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", margin: "0 0 1rem" }}>{title}</h2>
      <p style={{ fontSize: "1.55rem", color: "var(--secondary)", lineHeight: 1.6, maxWidth: "44rem", margin: "0 auto 2.4rem" }}>{blurb}</p>
      <ul style={{
        margin: "0 auto 2.8rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column",
        gap: "1rem", maxWidth: "36rem", textAlign: "left",
      }}>
        {points.map((p) => (
          <li key={p} style={{ display: "flex", gap: "1rem", fontSize: "1.45rem", color: "var(--primary)", lineHeight: 1.5 }}>
            <span aria-hidden style={{ color: accent, display: "flex", marginTop: "0.2rem" }}><IconCheck size={1.5} strokeWidth={2.4} /></span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <PrimaryButton fullWidth={false} onClick={onUnlock}>Unlock full report →</PrimaryButton>
    </div>
  );
}

const LOCKED_TAB_COPY: Record<"hairstyle" | "colour" | "frame", { title: string; blurb: string; points: string[] }> = {
  hairstyle: {
    title: "Hairstyle Suggestions",
    blurb: "Cuts matched to your face shape and hairline, generated on the photos you just took.",
    points: ["A style for each occasion, rendered on your own face", "Hair and scalp health scored separately", "Two regenerations if the first set misses"],
  },
  colour: {
    title: "Colour Analysis",
    blurb: "Your season worked out from your skin, hair and eyes, with the palette to wear and the shades that wash you out.",
    points: ["Your seasonal palette, named and explained", "The colours to avoid, with the reason", "Draping previews on your own photo"],
  },
  frame: {
    title: "AI Frame Recommendations",
    blurb: "Frame shapes chosen for your face geometry, then previewed on your photo. The live try-on below stays free either way.",
    points: ["Shapes fitted to your proportions", "Cross-checked against your colour season", "Rendered on your own photo, not a model"],
  },
};

// Same order/labels as lib/v2/captureSteps.ts (kept as a separate small map
// here rather than importing that module, which also pulls in capture-flow
// types not needed on this page).
const PHOTO_ORDER = ["face_front", "face_left", "face_right", "face_detail", "hairline_front", "scalp_crown", "hair_parting"];
const PHOTO_LABELS: Record<string, string> = {
  face_front: "Front face", face_left: "Left angle", face_right: "Right angle", face_detail: "Close-up",
  hairline_front: "Hairline", scalp_crown: "Crown", hair_parting: "Parting",
};

const SECTION_INTRO: Record<string, string> = {
  Skin: "A practical view of texture, tone, hydration, pores and visible skin quality.",
  Harmony: "How the proportions of your visible features relate and balance as a whole.",
  Angularity: "How clearly your jawline, cheekbones and chin define the structure of your face.",
  "Hair & Scalp": "Visible density, hairline pattern, parting and scalp presentation across your captured angles.",
};

// One tab per purchased module. Turning the report into four short documents
// instead of one long one is the whole point: previously everything a user
// bought rendered as a single scroll, so a bundle buyer met skin metrics,
// routine, colour analysis, frames, and hairstyles back to back.
type TabId = "skin" | "hairstyle" | "colour" | "frame";

// Each module carries its own accent, used on the tab icon and the section
// rules, so a glance at the bar tells you where in the report you are.
const TAB_LABELS: Record<TabId, { label: string; short: string; Icon: LucideIcon; accent: string }> = {
  skin:      { label: "Skin Analysis",          short: "Skin",       Icon: ScanFace, accent: "#168C7E" },
  hairstyle: { label: "Hairstyle Suggestions",  short: "Hair",       Icon: Scissors, accent: "#B77B16" },
  colour:    { label: "Colour Analysis",        short: "Colour",     Icon: Palette,  accent: "#C45745" },
  frame:     { label: "Frame Try-On",           short: "Frames",     Icon: Glasses,  accent: "#397C61" },
};

// A hairline underline on thin text was far too quiet for the primary
// navigation of a paid report. This is a raised segmented rail: the active
// segment is a filled pill that physically slides between tabs, which makes the
// switch feel like a control rather than a link changing colour.
// `locked` is only passed by the free preview, where all four tabs are shown
// on purpose: a tab you cannot open still tells you what the scan produced,
// which a hidden tab does not. They stay clickable so the panel behind them
// can make its own case.
// `variant="hero"` renders a second, bigger, non-sticky copy of the same
// control near the top of the page — same tabs, same onChange, same active
// state, so the two instances can never disagree about which category is
// selected. The real navigation was previously sticky-positioned inside the
// tab content itself, which only reads as sticky once you've already
// scrolled past the hero, priority cards, category cards and photo strip
// that come before it — meaning the actual category picker was invisible
// until four other sections had gone by. This puts the same control where a
// reader hits it first.
function TabBar({ tabs, active, onChange, locked, variant = "sticky" }: {
  tabs: TabId[]; active: TabId; onChange: (t: TabId) => void; locked?: Set<TabId>; variant?: "sticky" | "hero";
}) {
  if (tabs.length < 2) return null;
  const hero = variant === "hero";
  return (
    <div
      id={hero ? undefined : "v2-tabs"}
      className={`v2-tabbar${hero ? " v2-tabbar-hero" : ""}`}
      style={hero ? { marginBottom: 0 } : {
        position: "sticky", top: 0, zIndex: 20, marginBottom: "2.4rem",
        padding: "1rem 0 1.2rem", background: "var(--canvas)",
      }}
    >
      <div
        role="tablist"
        aria-label="Report sections"
        className={`v2-tabrail${hero ? " v2-tabrail-hero" : ""}`}
        style={hero ? {
          // A single scrolling row of four full-label, hero-scale tabs
          // doesn't actually fit most viewports — it overflowed its own
          // card and got visually clipped by the rounded corner instead of
          // scrolling cleanly. A wrapping grid (4-across when there's room,
          // 2x2 or 1-per-row when there isn't) never needs to scroll, so it
          // can't clip.
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "0.3rem",
          background: "var(--surface)", borderRadius: "1.6rem", padding: "0.7rem",
          border: "1px solid var(--line)", width: "100%",
          boxShadow: "0 1.2rem 3rem -2.4rem rgba(12,92,81,.35)",
        } : {
          display: "flex", gap: "0.4rem", overflowX: "auto", scrollbarWidth: "none",
          background: "var(--wash)", borderRadius: "9999px", padding: "0.5rem",
          border: "1px solid var(--line)",
          // Tabs share the rail's full width equally (flex:1 on each button
          // below) rather than the rail shrinking to fit them, so there's
          // never a stretch of empty pill-shaped background on wide screens.
          width: "100%",
        }}
      >
        {tabs.map((t, i) => {
          const on = t === active;
          const meta = TAB_LABELS[t];
          return (
            <motion.button
              key={t}
              className={`v2-tab-option v2-tab-${t}${on ? " is-active" : ""}`}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t)}
              whileTap={{ scale: 0.985 }}
              style={{
                position: "relative",
                // Hero tabs are grid items — sizing comes from the grid track
                // (auto-fit minmax), not from flex-grow, so they can wrap to a
                // second row instead of forcing one overflowing line.
                ...(hero ? { width: "100%" } : { flex: "1 1 0", minWidth: 0 }),
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                gap: "0.8rem", padding: hero ? "1.35rem 1.5rem" : "1.2rem 1.6rem", borderRadius: hero ? "1.2rem" : "1.2rem",
                // An inactive tab used to be background:none against the rail's
                // own --wash fill — no edge, no shadow, nothing marking it as a
                // pressable button. Three of four tabs read as plain text, which
                // is the actual reason the bar was easy to skim past. Each tab
                // now carries its own card even at rest; only the active one
                // additionally gets the sliding gradient pill below.
                border: "1px solid transparent",
                background: "transparent",
                cursor: "pointer", whiteSpace: "nowrap",
                fontSize: hero ? "1.45rem" : "1.4rem", fontWeight: 700,
                color: on ? "var(--primary)" : "var(--secondary)",
                boxShadow: "none",
                transition: "color .3s ease, opacity .3s ease",
              }}
            >
              {on && (
                <motion.span
                  layoutId={hero ? "v2-tab-pill-hero" : "v2-tab-pill"}
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0, borderRadius: hero ? "1.4rem" : "1.2rem",
                    background: `color-mix(in srgb, ${meta.accent} 9%, var(--surface))`,
                    boxShadow: `inset 0 -3px 0 ${meta.accent}`,
                  }}
                  transition={{ type: "spring", stiffness: 260, damping: 28, mass: .7 }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: "0.8rem" }}>
                {/* Numbered so the bar reads as a sequence — "1 of 4 parts" —
                    not four unrelated buttons a reader might stop partway
                    through, thinking they've seen the whole report. */}
                {!hero && <span aria-hidden className="v2-tab-number" style={{
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  width: hero ? "2.3rem" : "2.1rem", height: hero ? "2.3rem" : "2.1rem", borderRadius: "50%",
                  fontSize: hero ? "1.3rem" : "1.2rem", fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  background: on ? "rgba(255,255,255,0.22)" : `color-mix(in srgb, ${meta.accent} 16%, transparent)`,
                  color: on ? "#fff" : meta.accent,
                }}>{i + 1}</span>}
                <span aria-hidden className="v2-tab-icon" style={{
                  display: "grid", placeItems: "center", flexShrink: 0,
                  width: hero ? "3.4rem" : "3rem", height: hero ? "3.4rem" : "3rem", borderRadius: "50%",
                  color: meta.accent,
                  background: `color-mix(in srgb, ${meta.accent} ${on ? 16 : 9}%, transparent)`,
                  transition: "color .3s ease, background .3s ease, transform .3s ease",
                  transform: on ? "scale(1.04)" : "scale(1)",
                }}><meta.Icon size={hero ? 19 : 17} strokeWidth={1.8} /></span>
                <span className="v2-tab-full">{meta.label}</span>
                <span className="v2-tab-short" style={{ display: "none" }}>{meta.short}</span>
                {locked?.has(t) && (
                  <span style={{ display: "flex", opacity: on ? 0.9 : 0.55 }}><IconLock size={1.3} strokeWidth={2} title="Locked" /></span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const ROUTINE_META: Array<{ key: keyof RecommendationSet; label: string; note: string; Icon: (p: { size?: number }) => React.ReactElement; gate: "skin" | "hair" }> = [
  { key: "morning", label: "Morning", note: "Your daily foundation before sun and environmental exposure", Icon: IconSun, gate: "skin" },
  { key: "evening", label: "Evening", note: "A consistent reset to support recovery overnight", Icon: IconMoon, gate: "skin" },
  { key: "weekly", label: "Weekly", note: "Occasional steps that complement your daily routine", Icon: IconSparkle, gate: "skin" },
  { key: "hairScalp", label: "Hair & Scalp", note: "A repeatable routine based on your visible hair and scalp findings", Icon: IconStrands, gate: "hair" },
];

const HAIR_ROUTINE_ICONS: LucideIcon[] = [LucideSparkles, Droplets, ShieldCheck, Heart, Smile];

// Tabbed instead of one card per block side by side — with only 2-3 blocks a
// grid left one lonely half-width card (skin's 3 blocks on a 2-col grid) or
// wasted width (hair's single block). A tab per block plus one centered
// content panel reads as one routine with sections, not a scattered card wall.
function RoutinePanel({ gate, recommendations }: { gate: "skin" | "hair"; recommendations: RecommendationSet | null }) {
  const blocks = recommendations ? ROUTINE_META.filter((r) => r.gate === gate).filter((r) => recommendations[r.key]?.length) : [];
  const [active, setActive] = useState(0);
  if (blocks.length === 0) return null;
  const current = blocks[Math.min(active, blocks.length - 1)];

  return (
    <div className={gate === "hair" ? "v2-hair-routine" : undefined} style={{ marginBottom: "3.2rem" }}>
      {gate === "hair" && <div className="v2-hair-routine-mark" aria-hidden><Smile size={25} strokeWidth={1.8} /></div>}
      <h2 style={{ fontSize: "2.2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.6rem", textAlign: "center" }}>
        {gate === "skin" ? "Your Personalized Routine" : "Your Hair & Scalp Routine"}
      </h2>
      <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2.4rem", maxWidth: "60rem", textAlign: "center", marginLeft: "auto", marginRight: "auto" }}>
        {gate === "skin" ? "Based on what we saw in your photos and the concerns you shared." : "Simple steps for healthier-looking hair and scalp."}
      </p>

      {blocks.length > 1 && (
        <div
          className="v2-routine-tabs"
          role="tablist"
          aria-label={`${gate === "skin" ? "Routine" : "Hair routine"} sections`}
          style={{
            display: "flex", gap: "0.4rem", background: "var(--wash)", borderRadius: "9999px",
            padding: "0.5rem", border: "1px solid var(--line)", width: "fit-content", margin: "0 auto 2.4rem",
          }}
        >
          {blocks.map((b, i) => {
            const on = i === active;
            return (
              <button
                key={b.key}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(i)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.8rem", padding: "1rem 2rem",
                  borderRadius: "9999px", border: "none", background: on ? "var(--panel)" : "none",
                  color: on ? "#fff" : "var(--secondary)", fontSize: "1.4rem", fontWeight: 700, cursor: "pointer",
                  boxShadow: on ? "0 0.8rem 2rem -0.8rem rgba(12, 92, 81,0.55)" : "none", transition: "color 0.2s, background 0.2s",
                }}
              >
                <span style={{ display: "flex", color: on ? "var(--rose)" : "var(--muted)" }}><b.Icon size={1.7} /></span>
                {b.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="v2-routine-content" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.8rem 3.2rem", maxWidth: gate === "hair" ? "82rem" : "60rem", margin: "0 auto" }}>
        <div className="v2-routine-context">
          <span><current.Icon size={1.8} /></span>
          <div><strong>{current.label} plan</strong><p>{current.note}</p></div>
        </div>
        <ol className={gate === "hair" ? "v2-hair-routine-list" : undefined} style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {(recommendations?.[current.key] ?? []).map((s, i) => {
            const HairIcon = HAIR_ROUTINE_ICONS[i % HAIR_ROUTINE_ICONS.length];
            return (
            <li key={i} style={{ display: "flex", gap: "1rem", padding: "1rem 0", fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.55, textAlign: "left", borderBottom: "1px solid var(--line)" }}>
              <span style={{ display: "grid", placeItems: "center", width: gate === "hair" ? "3.6rem" : "2.6rem", height: gate === "hair" ? "3.6rem" : "2.6rem", borderRadius: "50%", background: "rgba(26,158,143,0.1)", color: "var(--rose)", fontWeight: 700, flexShrink: 0 }}>
                {gate === "hair" ? <HairIcon size={18} strokeWidth={1.8} /> : i + 1}
              </span>
              <span style={{ paddingTop: "0.2rem" }}>{s}</span>
            </li>
          )})}
        </ol>
        <p className="v2-routine-note" style={{ margin: "1.6rem 0 0", color: "var(--muted)", fontSize: "1.15rem", lineHeight: 1.5 }}>
          {gate === "hair" && <ShieldCheck size={16} strokeWidth={1.8} />}
          <span>Introduce one change at a time. Stop if irritation occurs.</span>
        </p>
      </div>
    </div>
  );
}

export default function V2ReportPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [metrics, setMetrics] = useState<AnalysisMetric[]>([]);
  const [purchased, setPurchased] = useState<Set<ModuleId> | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<Array<{ photoType: string; url: string }>>([]);
  const [colourAnalysis, setColourAnalysis] = useState<ColourAnalysis | null>(null);
  // null until the user picks: the default tab depends on which modules were
  // purchased, which is not known until after load, and these hooks have to
  // run before the loading/paywall early returns.
  const [tab, setTab] = useState<TabId | null>(null);
  const [metricFilter, setMetricFilter] = useState<BandKey>("all");
  // Storage paths of grids generated on earlier visits. Both routes already
  // persisted their output, but nothing read it back, so every report view
  // billed a fresh generation of an image the user had already paid for.
  const [hairGridPath, setHairGridPath] = useState<string | null>(null);
  const [frameGridPath, setFrameGridPath] = useState<string | null>(null);
  const [beardGridPath, setBeardGridPath] = useState<string | null>(null);
  // Row counts double as the generation counters, so redos left is derived
  // rather than stored. The routes re-check this, so it is only for the button.
  const [hairUsed, setHairUsed] = useState(0);
  const [frameUsed, setFrameUsed] = useState(0);
  const [beardUsed, setBeardUsed] = useState(0);
  // Guards report_generated against firing again on every 4s poll tick once
  // status has already flipped to complete.
  const reportedRef = useRef(false);

  async function load(): Promise<string | undefined> {
    // A hard timeout around the auth check specifically: if getUser() hangs
    // (a stale/corrupted refresh token in localStorage can do this — the
    // Supabase client retries internally rather than rejecting quickly) the
    // page previously had no fallback and sat on the blank loading screen
    // forever, with no redirect and no error shown. Any failure here now
    // sends the user to login instead, which is always a safe recovery.
    let user;
    try {
      const authResult = await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("auth check timed out")), 8000)),
      ]);
      user = authResult.data.user;
    } catch {
      router.replace(`/auth/login?next=/report/${sessionId}`);
      setLoading(false);
      return;
    }
    if (!user) { router.replace(`/auth/login?next=/report/${sessionId}`); setLoading(false); return; }

    // Everything below this point used to be unguarded — any unexpected
    // failure (a dropped connection mid-fetch, a storage signing error) threw
    // an unhandled rejection and left the page on the blank loading screen
    // forever, the same silent-stuck failure as the auth check above. Same
    // fix: fall back to a visible state (reuses the existing "not found" UI,
    // which already has a way back to the dashboard) rather than hang.
    try {

    const [{ data: sess }, { data: purchase }, { data: metricRows }, { data: photoRows }, { data: colourRow }] = await Promise.all([
      supabase.from("analysis_sessions_v2").select("id, status, overall_score, skin_age, image_quality_score, created_at, stage, fail_reason").eq("id", sessionId).eq("user_id", user.id).maybeSingle(),
      supabase.from("report_purchases_v2").select("modules").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
      supabase.from("analysis_metrics_v2").select("category, metric_name, score, label, confidence, explanation, recommendation, is_premium").eq("session_id", sessionId).eq("user_id", user.id),
      supabase.from("analysis_photos_v2").select("photo_type, storage_path").eq("session_id", sessionId).eq("user_id", user.id),
      supabase.from("colour_analysis_v2").select("data").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle(),
    ]);

    if (!sess) { setNotFound(true); setLoading(false); return; }

    // Newest row wins: the grid routes insert rather than upsert, so a
    // regeneration leaves the older row in place.
    const [{ data: hairGrids }, { data: frameGrids }, { data: beardGrids }] = await Promise.all([
      supabase.from("hairstyle_generations_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id)
        .eq("style_name", "Style grid").order("created_at", { ascending: false }),
      supabase.from("frame_generations_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id)
        .eq("frame_name", "Frame grid").order("created_at", { ascending: false }),
      supabase.from("grooming_generations_v2").select("storage_path").eq("session_id", sessionId).eq("user_id", user.id)
        .eq("kind", "beard").order("created_at", { ascending: false }),
    ]);
    setHairGridPath(hairGrids?.[0]?.storage_path ?? null);
    setFrameGridPath(frameGrids?.[0]?.storage_path ?? null);
    setBeardGridPath(beardGrids?.[0]?.storage_path ?? null);
    setHairUsed(hairGrids?.length ?? 0);
    setFrameUsed(frameGrids?.length ?? 0);
    setBeardUsed(beardGrids?.length ?? 0);

    // Bundle-first model: no purchase record means nothing was bought yet —
    // used to hard-redirect to the paywall here. Now renders a teaser instead
    // (real score + locked metric names, no explanations) so there's something
    // worth being curious about before asking for payment. purchased stays an
    // empty Set (not null) to distinguish "loaded, nothing bought" from "still
    // loading" — the render below branches on that.

    // Separate, best-effort fetch for the richer report content — kept apart
    // from the core session query above so a pre-migration environment
    // (columns not added yet, see supabase/migrations/20260727000000_*.sql)
    // degrades to "no routine/observations shown" instead of breaking the
    // entire report page with a 400 on an unknown column.
    let content: Pick<SessionRow, "positive_observations" | "recommendations" | "limitations"> = {
      positive_observations: null, recommendations: null, limitations: null,
    };
    try {
      const { data: contentRow, error: contentErr } = await supabase
        .from("analysis_sessions_v2").select("positive_observations, recommendations, limitations")
        .eq("id", sessionId).eq("user_id", user.id).maybeSingle();
      if (contentErr) throw contentErr;
      if (contentRow) content = contentRow;
    } catch {
      // Columns not present yet — content stays empty, rest of the report renders normally.
    }

    setSession({ ...sess, ...content });
    setPurchased(new Set((purchase?.modules ?? []) as ModuleId[]));
    setMetrics((metricRows ?? []).map((r) => ({
      category: r.category as MetricCategory, metricName: r.metric_name, score: r.score,
      label: r.label as AnalysisMetric["label"], confidence: r.confidence, explanation: r.explanation,
      recommendation: r.recommendation, isPremium: r.is_premium,
    })));
    setColourAnalysis((colourRow?.data as ColourAnalysis) ?? null);

    if (photoRows?.length) {
      const signedEntries = await Promise.all(
        photoRows.map(async (p) => {
          const { data: signed } = await supabase.storage.from("photos_v2").createSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
          return signed?.signedUrl ? { photoType: p.photo_type, url: signed.signedUrl } : null;
        }),
      );
      const signed = signedEntries.filter((e): e is { photoType: string; url: string } => e !== null);
      signed.sort((a, b) => PHOTO_ORDER.indexOf(a.photoType) - PHOTO_ORDER.indexOf(b.photoType));
      setAllPhotos(signed);
      // Every generated preview (colour, hairstyle, frames) is built from this
      // photo, so it must be a front-facing shot. A profile or angled source
      // makes the model reconstruct the far side of the face and the identity
      // drifts. Fall back only to the front close-up, never to a side angle or
      // a scalp shot, and rather show nothing than generate from a bad source.
      const frontOnly = ["face_front", "face_detail"];
      setPhoto(frontOnly.map((t) => signed.find((p) => p.photoType === t)?.url).find(Boolean) ?? null);
    }

    setLoading(false);
    return sess.status;
    } catch (err) {
      logV2.error("v2_report_load_failed", { message: err instanceof Error ? err.message : String(err), session_id: sessionId });
      setNotFound(true);
      setLoading(false);
      return undefined;
    }
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  useEffect(() => {
    if (session?.status === "complete" && !reportedRef.current) {
      reportedRef.current = true;
      trackEvent("report_generated", { session_id: sessionId, overall_score: session.overall_score });
    }
  }, [session?.status, sessionId]);

  // Real analysis (Claude vision over 7 photos) takes ~60-100s. A user can
  // reach this page before it finishes — e.g. background-kicked analysis on
  // the bundle page hasn't caught up with a fast checkout. Poll instead of
  // dead-ending on "still processing" with no way to know it'll resolve.
  useEffect(() => {
    if (!session || session.status === "complete" || session.stage === "failed") return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const status = await load();
      if (status === "complete" || status === "failed" || attempts >= 20) clearInterval(interval);
    }, 4000);
    return () => clearInterval(interval);
  }, [session?.status, session?.stage, sessionId]);

  const [retrying, setRetrying] = useState(false);
  // A user can land here directly (bookmark, notification) after an analysis
  // that already failed — this page used to poll 20 times, give up silently,
  // and leave the spinner and "still finishing up" text on screen forever
  // with no way to know it was dead or to do anything about it.
  async function retryAnalysis() {
    setRetrying(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;
      await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ sessionId }),
      });
      await load();
    } finally {
      setRetrying(false);
    }
  }

  if (loading || !purchased) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;
  if (notFound) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem" }}>
        <p style={{ fontSize: "1.8rem", color: "var(--secondary)" }}>Report not found or you don&apos;t have access.</p>
        <PrimaryButton fullWidth={false} onClick={() => router.push("/dashboard")}>Back to dashboard</PrimaryButton>
      </div>
    );
  }
  if (session?.stage === "failed") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem", padding: "2.4rem" }}>
        <p style={{ fontSize: "1.8rem", color: "var(--primary)", fontWeight: 600, textAlign: "center" }}>Your analysis didn&apos;t finish</p>
        <p style={{ fontSize: "1.5rem", color: "var(--secondary)", textAlign: "center", maxWidth: "36rem" }}>
          {session.fail_reason || "Something went wrong. Your photos are still saved, so retrying won't cost you another scan."}
        </p>
        <div style={{ display: "flex", gap: "1.2rem" }}>
          <PrimaryButton fullWidth={false} loading={retrying} onClick={retryAnalysis}>Try again</PrimaryButton>
          <PrimaryButton fullWidth={false} variant="outline" onClick={() => router.push("/dashboard")}>Back to dashboard</PrimaryButton>
        </div>
      </div>
    );
  }
  if (session?.status !== "complete") {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem" }}>
        <div style={{ width: "3.2rem", height: "3.2rem", borderRadius: "50%", border: "3px solid var(--line)", borderTopColor: "var(--primary)", animation: "v2-spin 1s linear infinite" }} />
        <p style={{ fontSize: "1.8rem", color: "var(--secondary)", textAlign: "center", maxWidth: "36rem" }}>Your analysis is still finishing up. This page will update automatically, usually within a minute or two.</p>
        <PrimaryButton fullWidth={false} onClick={() => router.push("/dashboard")}>Back to dashboard</PrimaryButton>
        <style>{`@keyframes v2-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Nothing purchased yet, but analysis is done (it always runs before
  // checkout). The free tier lives here: a working slice of the skin read plus
  // the live try-on, with the other three modules present but locked. All four
  // tabs render so the shape of the full report is visible rather than implied.
  if (purchased.size === 0) {
    const score = session.overall_score ?? 0;
    const skinMetrics = metrics.filter((m) => m.category === "skin");
    const faceMetrics = metrics.filter((m) => m.category === "face");
    const harmonyMetrics = faceMetrics.filter((m) => (HARMONY_METRIC_NAMES as string[]).includes(m.metricName));
    const angularityMetrics = faceMetrics.filter((m) => (ANGULARITY_METRIC_NAMES as string[]).includes(m.metricName));
    const hairMetrics = metrics.filter((m) => m.category === "hair");

    // Lowest scores first, so the free rows are the ones actually worth acting
    // on. Metric identity, not index, decides what stays locked — the two lists
    // are rendered separately and must not overlap.
    const freeSkin = [...skinMetrics].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).slice(0, FREE_METRIC_COUNT);
    const freeNames = new Set(freeSkin.map((m) => m.metricName));
    const lockedSkin = skinMetrics.filter((m) => !freeNames.has(m.metricName));

    const freeTabs: TabId[] = ["skin", "hairstyle", "colour", "frame"];
    const lockedTabs = new Set<TabId>(["hairstyle", "colour"]);
    const freeActive: TabId = tab && freeTabs.includes(tab) ? tab : "skin";
    const unlock = () => router.push(`/bundle/${sessionId}`);

    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "4rem 2.4rem" }}>
        <div style={{ maxWidth: "108rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6rem", marginBottom: "3.2rem" }}>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: 0 }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Dashboard
            </button>
            <PrimaryButton size="sm" fullWidth={false} onClick={() => router.push(`/perceptgpt?session=${sessionId}`)}>Ask PerceptGPT →</PrimaryButton>
          </div>

          <div className="v2-hero-grid" style={{ display: "grid", gridTemplateColumns: photo ? "26rem 1fr" : "1fr", gap: "4rem", alignItems: "center", marginBottom: "3.2rem" }}>
            {photo && (
              <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: "2rem", overflow: "hidden", boxShadow: "0 2.4rem 4.8rem -1.2rem var(--shadow-strong)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Your guided-capture photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ textAlign: photo ? "left" : "center" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.6rem",
                fontSize: "1.15rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                background: "var(--rose)", color: "#fff", borderRadius: "9999px", padding: "0.5rem 1.4rem",
              }}>
                Free preview
              </span>
              <div style={{ margin: photo ? 0 : "0 auto" }}><ScoreReveal score={score} /></div>
              <p style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", marginTop: "1.4rem" }}>{verdictFor(score)} · Percept Score</p>
              {session.skin_age !== null && (
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.8rem", marginTop: "1.4rem", background: "var(--wash)", borderRadius: "9999px", padding: "0.8rem 1.8rem" }}>
                  <span style={{ fontSize: "1.3rem", color: "var(--secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Skin age</span>
                  <span style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--primary)" }}>{session.skin_age}</span>
                </div>
              )}
              <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginTop: "1.8rem", lineHeight: 1.6, maxWidth: "44rem" }}>
                Your score and your first {freeSkin.length} skin readings are yours to keep, free. The live frame try-on is free too.
              </p>
            </div>
          </div>

          <TabBar
            tabs={freeTabs}
            active={freeActive}
            locked={lockedTabs}
            onChange={(t) => {
              setTab(t);
              document.getElementById("v2-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />

          <div>
            <div hidden={freeActive !== "skin"}>
              <FreeSkinSection
                title="Skin"
                intro={SECTION_INTRO.Skin}
                free={freeSkin}
                locked={lockedSkin}
                accent={TAB_LABELS.skin.accent}
                onUnlock={unlock}
              />
              <FreeSkinSection title="Harmony" intro={SECTION_INTRO.Harmony} free={[]} locked={harmonyMetrics} accent="#D9A62E" onUnlock={unlock} />
              <FreeSkinSection title="Angularity" intro={SECTION_INTRO.Angularity} free={[]} locked={angularityMetrics} accent="#C8503A" onUnlock={unlock} />
              <FreeSkinSection title="Hair & Scalp" intro={SECTION_INTRO["Hair & Scalp"]} free={[]} locked={hairMetrics} accent="#E8604F" onUnlock={unlock} />
            </div>

            <div hidden={freeActive !== "hairstyle"}>
              <LockedTabPanel {...LOCKED_TAB_COPY.hairstyle} accent={TAB_LABELS.hairstyle.accent} onUnlock={unlock} />
            </div>

            <div hidden={freeActive !== "colour"}>
              <LockedTabPanel {...LOCKED_TAB_COPY.colour} accent={TAB_LABELS.colour.accent} onUnlock={unlock} />
            </div>

            {/* The live try-on is free outright. It runs entirely on the device
                — face tracking in the browser, frame art served as static PNGs,
                no generation call and no per-view cost — so gating it would be
                withholding something that costs nothing to give. */}
            {/* Rendered whether or not a front photo exists: the try-on falls
                back to live camera on its own, and a free user without a usable
                capture would otherwise land on a tab that is entirely locked
                while the header promises the try-on is free. */}
            <div hidden={freeActive !== "frame"}>
              <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.8rem" }}>Try frames on, free</h2>
              <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2.4rem", lineHeight: 1.5 }}>
                Ten frame styles on your photo, or live through your camera. Runs on your device, nothing uploads.
              </p>
              <GlassesVirtualTryOn photoUrl={photo} seasonalColour={null} />
              <div style={{ marginTop: "3.2rem" }}>
                <LockedTabPanel {...LOCKED_TAB_COPY.frame} accent={TAB_LABELS.frame.accent} onUnlock={unlock} />
              </div>
            </div>
          </div>

          <div style={{ background: "var(--panel)", borderRadius: "1.6rem", padding: "3.6rem", textAlign: "center", marginTop: "3.2rem" }}>
            <p style={{ fontSize: "2rem", fontWeight: 500, color: "#fff", marginBottom: "0.8rem" }}>Every score is already computed from your photos</p>
            <p style={{ fontSize: "1.5rem", color: "rgba(255,255,255,0.7)", marginBottom: "2.4rem", maxWidth: "48rem", marginLeft: "auto", marginRight: "auto" }}>
              Unlock the remaining numbers, what they mean, your routine, and the colour, hairstyle and frame previews generated on your own face.
            </p>
            <PrimaryButton variant="onDark" fullWidth={false} onClick={unlock}>Unlock full report →</PrimaryButton>
          </div>
        </div>
        <style>{`
          @media (max-width: 900px) {
            .v2-metric-cols { grid-template-columns: 1fr !important; }
            .v2-hero-grid { grid-template-columns: 1fr !important; }
            .v2-hero-grid > div:first-child { max-width: 22rem; margin: 0 auto; }
          }
          @media (max-width: 700px) { .v2-guide-cols { grid-template-columns: 1fr !important; } }
          @media (max-width: 600px) {
            .v2-tabrail { padding: 0.4rem !important; gap: 0.2rem !important; overflow-x: visible !important; }
            .v2-tabrail button {
              flex: 1 1 0 !important; min-width: 0 !important; justify-content: center;
              padding: 1rem 0.4rem !important; font-size: 1.3rem !important; gap: 0 !important;
            }
            .v2-tab-icon { display: none !important; }
            .v2-tab-number { display: none !important; }
            .v2-tab-full { display: none !important; }
            .v2-tab-short { display: inline !important; }
            .v2-metric-bar > div:first-child { display: none !important; }
            .v2-metric-bar { flex: 0 0 auto !important; }
            .v2-metric-row { flex-wrap: wrap !important; gap: 0.7rem 1rem !important; padding: 1.3rem 0 !important; }
            .v2-metric-row > span:first-child { flex: 1 1 100% !important; }
          }
        `}</style>
      </div>
    );
  }

  // "Skin Analysis" module includes the Face metric category; "Hairstyle
  // Recommendations" includes the Hair & Scalp metric category — both merges
  // decided during the bundle-flow build so no metric category is orphaned
  // outside the 4 purchasable modules.
  const hasSkin = purchased.has("skin");
  const hasColour = purchased.has("colour");
  const hasHairstyle = purchased.has("hairstyle");
  const hasFrame = purchased.has("frame");

  const skinMetrics = hasSkin ? metrics.filter((m) => m.category === "skin") : [];
  const faceMetrics = hasSkin ? metrics.filter((m) => m.category === "face") : [];
  const harmonyMetrics = faceMetrics.filter((m) => (HARMONY_METRIC_NAMES as string[]).includes(m.metricName));
  const angularityMetrics = faceMetrics.filter((m) => (ANGULARITY_METRIC_NAMES as string[]).includes(m.metricName));
  const hairMetrics = hasHairstyle ? metrics.filter((m) => m.category === "hair") : [];
  const score = session.overall_score ?? 0;

  // /api/analyse always computes skin+face+hair metrics regardless of what
  // was purchased (analysis kicks off before purchase, in the bundle-page
  // background fetch). The summary strip must only surface categories the
  // user actually paid for, or it leaks metric names from unpurchased modules.
  const purchasedCategories = new Set<MetricCategory>([
    ...(hasSkin ? (["skin", "face"] as MetricCategory[]) : []),
    ...(hasHairstyle ? (["hair"] as MetricCategory[]) : []),
  ]);
  const assessed = metrics.filter((m) => purchasedCategories.has(m.category) && m.score !== null);
  const sorted = assessed
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const strongest = sorted.slice(0, 3).map((m) => m.metricName);
  const priorityMetrics = [...assessed].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).slice(0, 3);
  const priority = priorityMetrics.map((m) => m.metricName);
  const unavailable = metrics.filter((m) => purchasedCategories.has(m.category) && m.score === null);
  const categoryScore = (rows: AnalysisMetric[]) => {
    const values = rows.flatMap((m) => m.score === null ? [] : [m.score]);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  };
  const categoryCards = [
    ...(hasSkin ? [{ tab: "skin" as TabId, label: "Skin", score: categoryScore(skinMetrics), detail: "Texture, tone and visible skin quality" }, { tab: "skin" as TabId, label: "Face", score: categoryScore(faceMetrics), detail: "Balance, harmony and definition" }] : []),
    ...(hasHairstyle ? [{ tab: "hairstyle" as TabId, label: "Hair", score: categoryScore(hairMetrics), detail: "Hairline, density and scalp presentation" }] : []),
    ...(hasColour ? [{ tab: "colour" as TabId, label: "Colour", score: null, detail: colourAnalysis?.season ? `${colourAnalysis.season} palette` : "Personal palette and contrast" }] : []),
  ];
  const qualityLabel = (session.image_quality_score ?? 0) >= 75 ? "Strong scan quality" : "Review with care";
  const nextScanDate = new Date(new Date(session.created_at).getTime() + 21 * 24 * 60 * 60 * 1000)
    .toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const reportDate = new Date(session.created_at)
    .toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  // positiveObservations/limitations/recommendations are generated from
  // whatever photos existed at analysis time, not tagged per module — only
  // show them if the user actually bought at least one of skin/hairstyle
  // (same access boundary the metric sections use).
  const hasContentAccess = hasSkin || hasHairstyle;
  const limitations = hasContentAccess ? (session.limitations ?? []) : [];
  const recommendations = hasContentAccess ? session.recommendations : null;

  // Part numbers come from the sections that actually render, so a
  // skin-only purchase reads "Part 01 Skin, Part 02 Face" rather than
  // skipping numbers for modules that were never bought.
  type Part = { id: string; title: string; metrics: AnalysisMetric[] };
  const isPart = (p: unknown): p is Part => Boolean(p) && (p as Part).metrics.length > 0;
  const skinParts = [
    hasSkin && { id: "skin", title: "Skin", metrics: skinMetrics },
    hasSkin && { id: "harmony", title: "Harmony", metrics: harmonyMetrics },
    hasSkin && { id: "angularity", title: "Angularity", metrics: angularityMetrics },
  ].filter(isPart);
  const hairParts = [
    hasHairstyle && { id: "hair", title: "Hair & Scalp", metrics: hairMetrics },
  ].filter(isPart);

  const tabs: TabId[] = [
    ...(hasSkin ? (["skin"] as TabId[]) : []),
    ...(hasHairstyle ? (["hairstyle"] as TabId[]) : []),
    ...(hasColour ? (["colour"] as TabId[]) : []),
    ...(hasFrame ? (["frame"] as TabId[]) : []),
  ];
  const activeTab: TabId | null = tab && tabs.includes(tab) ? tab : (tabs[0] ?? null);

  // Metrics the filter bar operates on for the active tab — the bar is only
  // meaningful where a tab actually renders scored rows.
  const filterableMetrics = activeTab === "skin" ? [...skinMetrics, ...faceMetrics]
    : activeTab === "hairstyle" ? hairMetrics : [];

  function openCategory(tabId: TabId) {
    setTab(tabId);
    setMetricFilter("all");
    window.setTimeout(() => {
      document.getElementById("v2-analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div className="v2-report-page" style={{ minHeight: "100dvh", background: "var(--canvas)", padding: "4rem 2.4rem" }}>
      <div style={{ maxWidth: "108rem", margin: "0 auto" }}>

        <div className="v2-report-toolbar" style={{ position: "sticky", top: 0, zIndex: 60, background: "var(--canvas)", borderBottom: "1px solid var(--line)", padding: "1.2rem 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6rem", marginBottom: "2.4rem" }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: "0.8rem", background: "none", border: "none", color: "var(--secondary)", fontSize: "1.4rem", cursor: "pointer", padding: 0 }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Dashboard
          </button>
          <div className="v2-report-actions">
            <PrimaryButton size="sm" fullWidth={false} variant="outline" onClick={() => router.push(`/report/${sessionId}/print`)}>
              Download report ↓
            </PrimaryButton>
            <PrimaryButton size="sm" fullWidth={false} onClick={() => router.push(`/perceptgpt?session=${sessionId}`)}>Ask PerceptGPT →</PrimaryButton>
          </div>
        </div>

        <div className="v2-hero-grid" style={{ display: "grid", gridTemplateColumns: photo ? "28rem 1fr" : "1fr", gap: "4rem", alignItems: "center", padding: "3.2rem", borderRadius: "2rem", marginBottom: "2.4rem" }}>
          {photo && (
            <div className="v2-hero-photo" style={{ position: "relative", aspectRatio: "4/5", borderRadius: "1.6rem", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Your guided-capture photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span>Percept scan</span>
            </div>
          )}
          <div className="v2-overview-copy">
            <div className="v2-report-meta"><span>Personal beauty intelligence</span><time dateTime={session.created_at}>{reportDate}</time></div>
            <p className="v2-hero-kicker">Your personal report</p>
            <h1 className="v2-hero-title">Understand what suits you.<br /><em>Act on what matters.</em></h1>
            <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", flexWrap: "wrap" }}>
              <div className="v2-score-compact"><ScoreReveal score={score} size={10} ringColor="#72E0C8" trackColor="rgba(255,255,255,.18)" textColor="#FFFFFF" /></div>
              <div><p className="v2-score-label">Percept score</p><h2 className="v2-score-verdict">{verdictFor(score)} overall</h2><p className="v2-score-caption">A clear baseline across your visible features.</p></div>
            </div>
            {/* The sentence that used to sit here ("Your scan shows a strong
                baseline...") was static copy, unchanged regardless of the actual
                score, and said nothing the pills below don't already say in three
                words each — pure duplicate prose. Cut, not shortened. */}
            <div className="v2-overview-pills" style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "1.8rem" }}>
              <span>{qualityLabel}</span>
              {session.skin_age !== null && <span>Estimated skin age: <strong>{session.skin_age}</strong></span>}
              <span>{assessed.length} measurements assessed</span>
            </div>
            {limitations.length > 0 && <p className="v2-quality-note">Some results are less certain because the scan was underexposed or a requested photo was missing. Those items are marked as not assessed.</p>}
          </div>
        </div>

        {tabs.length > 1 && (<>
          <section className="v2-hero-picker" aria-labelledby="report-categories-title">
            <div className="v2-picker-heading">
              <div>
                <p className="v2-eyebrow">Your report, your way</p>
                <h2 id="report-categories-title">Choose what to explore</h2>
              </div>
              <p>Your categories stay within reach as you move through the report.</p>
            </div>
          </section>
          <nav className="v2-category-dock" aria-label="Report categories">
            <TabBar tabs={tabs} active={activeTab ?? "skin"} onChange={openCategory} variant="hero" />
          </nav>
        </>)}

        {assessed.length > 0 && (
          <section className="v2-priority-panel">
            <div className="v2-priority-intro"><p className="v2-eyebrow">Your priorities</p><h2>Three clear next moves</h2><p>Start here, then explore the measurements for supporting detail.</p></div>
            <div className="v2-priority-grid">
              <article className="maintain"><div className="v2-priority-card-top"><span className="v2-priority-icon"><IconCheck size={1.7} /></span><small>01 · Protect</small></div><div><strong>Maintain what works</strong><div className="v2-factor-list">{(session.positive_observations?.slice(0, 2) ?? strongest.slice(0, 2)).map((factor) => <b key={factor}>{factor}</b>)}</div></div><i className="v2-priority-signal"><b style={{ width: "88%" }} /></i></article>
              <article className="improve"><div className="v2-priority-card-top"><span className="v2-priority-icon"><IconSparkle size={1.7} /></span><small>02 · Focus</small></div><div><strong>Improve or monitor</strong><div className="v2-factor-list">{priority.map((factor) => <b key={factor}>{factor}</b>)}</div></div><i className="v2-priority-signal"><b style={{ width: "58%" }} /></i></article>
              <article className="retake"><div className="v2-priority-card-top"><span className="v2-priority-icon"><IconFaceScan size={1.7} /></span><small>03 · Verify</small></div><div><strong>{unavailable.length ? "Retake for clarity" : "Keep your baseline"}</strong><div className="v2-factor-list">{unavailable.length ? unavailable.map((m) => <b key={m.metricName}>{m.metricName}</b>) : <b>Same lighting and angle</b>}</div></div><i className="v2-priority-signal"><b style={{ width: unavailable.length ? "34%" : "76%" }} /></i></article>
            </div>
          </section>
        )}

        {categoryCards.length > 0 && (
          <section className="v2-report-block v2-category-block">
            <div className="v2-category-intro">
              <div><p className="v2-eyebrow">Your results at a glance</p><h2>See your whole picture.</h2><p>Select any card to open the complete analysis and personalised recommendations.</p></div>
              <span><IconSparkle size={1.35} /> {categoryCards.length} insights ready</span>
            </div>
            <div className="v2-category-grid">{categoryCards.map((card) => {
              const categoryBand = bandFor(card.score);
              const CategoryIcon = card.label === "Face" ? IconSparkle : TAB_LABELS[card.tab].Icon;
              const accent = card.score === null ? TAB_LABELS[card.tab].accent : categoryBand.color;
              return <motion.button key={card.label} onClick={() => openCategory(card.tab)} whileHover={{ y: -5 }} whileTap={{ scale: .985 }} style={{ "--category-accent": accent } as React.CSSProperties}>
                <div className="v2-category-card-top"><span className="v2-category-icon"><CategoryIcon size={2.1} strokeWidth={2} /></span><span className="v2-category-open" aria-hidden>↗</span></div>
                <div className="v2-category-heading"><span>{card.label}</span><strong style={{ color: accent }}>{card.score ?? "View"}{card.score !== null && <small>/100</small>}</strong></div>
                {card.score !== null && <div className="v2-category-bar"><i style={{ width: `${card.score}%`, background: categoryBand.color }} /></div>}
                <p>{card.detail}</p><span className="v2-category-cta">Open {card.label.toLowerCase()} analysis <b aria-hidden>→</b></span>
              </motion.button>;
            })}</div>
          </section>
        )}

        {/* All 7 guided-capture photos — previously only face_front ever
            rendered anywhere on the report; the other 6 (angles, hairline,
            crown, parting) were captured but never shown back to the user. */}
        {allPhotos.length > 0 && (
          <section className="v2-report-block v2-photo-block">
            <div className="v2-block-heading"><div><p className="v2-eyebrow">Capture record</p><h2>Your scan photos</h2></div><span>{allPhotos.length} captured</span></div>
            <div style={{ display: "flex", gap: "1.2rem", overflowX: "auto", paddingBottom: "0.4rem" }}>
              {allPhotos.map((p) => (
                <div key={p.photoType} style={{ flex: "0 0 auto", width: "11rem" }}>
                  <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: "1rem", overflow: "hidden", border: "1px solid var(--line)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={PHOTO_LABELS[p.photoType] ?? p.photoType} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <p style={{ fontSize: "1.2rem", color: "var(--secondary)", marginTop: "0.6rem", textAlign: "center" }}>{PHOTO_LABELS[p.photoType] ?? p.photoType}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* One module per tab, so the page is only ever as long as the thing
            being read. Replaces the old anchor-link contents list, which still
            left every module stacked in one scroll. */}
        <section id="v2-analysis" className="v2-analysis-block">
        <div className="v2-analysis-heading">
          <div className="v2-analysis-heading-icon" aria-hidden><IconSparkle size={1.8} /></div>
          <div className="v2-analysis-heading-copy">
            <p className="v2-eyebrow">Detailed analysis</p>
            <h2>Explore your personalised report</h2>
          </div>
          <span className="v2-category-count"><b>{tabs.length}</b> categories ready <span aria-hidden>↓</span></span>
        </div>
        <div className="v2-score-legend" aria-label="Score colour guide"><strong>How to read your scores</strong><span><i className="strong" />Strong</span><span><i className="watch" />Watch</span><span><i className="focus" />Needs attention</span><span><i className="unknown" />Not assessed</span></div>

        {/* Every purchased panel stays mounted, with inactive ones hidden,
            rather than swapping a single keyed child through AnimatePresence.
            Unmounting destroyed each panel's generated image, and since the
            parent only learned about stored images at page load, returning to a
            tab paid for a fresh generation of a picture the user already had. */}
        <div>
          {filterableMetrics.length > COLLAPSED_COUNT && (
            <MetricFilterBar value={metricFilter} onChange={setMetricFilter} metrics={filterableMetrics} />
          )}

          {hasSkin && (
            <div hidden={activeTab !== "skin"}>
              {skinParts.map((p, i) => (
                <Section key={p.id} index={i + 1} total={skinParts.length} id={p.id} title={p.title} intro={SECTION_INTRO[p.title]} metrics={p.metrics} filter={metricFilter} />
              ))}
              <div style={{ marginTop: "3.2rem" }}><RoutinePanel gate="skin" recommendations={recommendations} /></div>
            </div>
          )}

          {hasHairstyle && (
            <div hidden={activeTab !== "hairstyle"}>
              <HairstylePanel
                sessionId={sessionId}
                photo={photo}
                isPremium // purchased = unlocked, no further gate
                onRequirePremium={() => {}}
                initialPath={hairGridPath}
                initialRemaining={Math.max(0, MAX_GENERATIONS - hairUsed)}
              />
              {beardGridPath && <GroomingPanel
                sessionId={sessionId}
                photo={photo}
                isPremium
                onRequirePremium={() => {}}
                initialBeardPath={beardGridPath}
                initialBeardRemaining={Math.max(0, MAX_GENERATIONS - beardUsed)}
              />}
              {hairParts.map((p, i) => (
                <Section key={p.id} index={i + 1} total={hairParts.length} id={p.id} title={p.title} intro={SECTION_INTRO[p.title]} metrics={p.metrics} filter={metricFilter} />
              ))}
              <div style={{ marginTop: "3.2rem" }}><RoutinePanel gate="hair" recommendations={recommendations} /></div>
              <HairCarePointers />
            </div>
          )}

          {hasColour && (
            <div hidden={activeTab !== "colour"}>
              <ColourAnalysisPanel sessionId={sessionId} photo={photo} initialAnalysis={colourAnalysis} />
            </div>
          )}

          {hasFrame && photo && (
            <div hidden={activeTab !== "frame"}>
              {/* Same elevated card as the hairstyle/beard/colour previews —
                  was a bare h2, the quietest heading in a tab whose entire
                  point is the generated try-on image below it. */}
              <div style={{
                marginBottom: "2.4rem", padding: "2.8rem", background: "var(--surface)",
                border: "1px solid var(--line)", borderTop: `0.4rem solid ${TAB_LABELS.frame.accent}`, borderRadius: "1.6rem",
              }}>
                <p style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", fontSize: "1.1rem", fontWeight: 800, color: TAB_LABELS.frame.accent, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.8rem" }}>
                  <IconSparkle size={1.3} strokeWidth={2} />AI-generated preview
                </p>
                <h2 style={{ fontSize: "2.3rem", fontWeight: 800, color: "var(--primary)", letterSpacing: "-0.015em", marginBottom: "0.6rem" }}>Frames For Your Face</h2>
                <p style={{ fontSize: "1.5rem", color: "var(--secondary)", lineHeight: 1.5 }}>
                  Try on frames matched to your face shape{colourAnalysis ? " and colour season" : ""}.
                </p>
              </div>
              <FrameGrid sessionId={sessionId} photo={photo} initialPath={frameGridPath} initialRemaining={Math.max(0, MAX_GENERATIONS - frameUsed)} />
              <GlassesVirtualTryOn photoUrl={photo} seasonalColour={colourAnalysis?.season ?? null} />
              <FrameAIPanel sessionId={sessionId} photo={photo} isPremium onRequirePremium={() => {}} />
            </div>
          )}
        </div>
        </section>

        {hasContentAccess && (
          <section className="v2-progress-panel">
            <div className="v2-progress-copy">
              <p className="v2-eyebrow">Track your progress</p>
              <h2>Make this scan your baseline</h2>
              <p>Use similar lighting and the same angles so your next comparison is meaningful.</p>
            </div>
            <div className="v2-next-scan"><span>Recommended next scan</span><strong>{nextScanDate}</strong><small>21-day check-in</small></div>
            <div className="v2-progress-metrics">
              <span>Watch next time</span>
              <strong>{priority.slice(0, 2).join(" and ") || "your key measurements"}</strong>
            </div>
            <div className="v2-progress-action"><PrimaryButton variant="onDark" fullWidth={false} onClick={() => router.push("/scan-prep")}>Plan next scan →</PrimaryButton><small>Compare trends, not daily fluctuations</small></div>
          </section>
        )}

        {limitations.length > 0 && (
          <div className="v2-limitations" style={{ marginTop: "3.2rem", padding: "2.4rem 2.8rem", background: "var(--wash)", borderRadius: "1.2rem" }}>
            <p style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>
              <IconInfo size={1.35} strokeWidth={2} />Good to know
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {limitations.map((l, i) => (
                <li key={i} style={{ display: "flex", gap: "1rem", fontSize: "1.3rem", color: "var(--secondary)", lineHeight: 1.6 }}>
                  <span aria-hidden style={{ color: "var(--muted)", flexShrink: 0, display: "flex", alignItems: "center", height: "1.9rem" }}>
                    <IconInfo size={1.3} strokeWidth={2} />
                  </span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
      <style>{`
        .v2-report-page {
          --canvas: #F4F2ED;
          --surface: #FCFBF8;
          --wash: #EEECE6;
          --line: #DCD8CF;
          --primary: #0D3028;
          --secondary: #334F47;
          --muted: #5F746D;
          --panel: #173E35;
          --rose: #3E7B68;
          background-image: radial-gradient(circle at 84% 1%, rgba(133,164,151,0.18), transparent 32rem), linear-gradient(180deg, #F8F6F1 0, #F4F2ED 36rem);
        }
        .v2-report-actions { display: flex; align-items: center; gap: .8rem; }
        .v2-hero-grid { position: relative; overflow: hidden; color: #fff; border: 1px solid rgba(255,255,255,.1); background: linear-gradient(132deg, #082A23 0%, #103E34 57%, #1C5D4E 100%); box-shadow: 0 3rem 7rem -4rem rgba(8,42,35,.85); }
        .v2-hero-grid:after { content: ""; position: absolute; width: 34rem; height: 34rem; right: -15rem; top: -20rem; border: 1px solid rgba(255,255,255,.09); border-radius: 50%; box-shadow: 0 0 0 5rem rgba(255,255,255,.025), 0 0 0 10rem rgba(255,255,255,.018); pointer-events: none; }
        .v2-hero-photo { z-index: 1; border: 1px solid rgba(255,255,255,.18); box-shadow: 0 2.5rem 5rem -2rem rgba(0,0,0,.62); }
        .v2-hero-photo:after { content: ""; position: absolute; inset: 45% 0 0; background: linear-gradient(transparent, rgba(3,20,16,.72)); pointer-events: none; }
        .v2-hero-photo span { position: absolute; z-index: 1; left: 1.4rem; bottom: 1.2rem; color: rgba(255,255,255,.84); font-size: 1rem; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
        .v2-overview-copy { position: relative; z-index: 1; }
        .v2-report-meta { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 2.2rem; padding-bottom: 1.2rem; border-bottom: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.62); font-size: 1rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
        .v2-hero-kicker { margin: 0 0 .8rem; color: #8FD9C8; font-size: 1.05rem; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .v2-hero-title { margin: 0 0 2.4rem; color: #fff; font-size: clamp(3rem, 4vw, 4.8rem); font-weight: 500; letter-spacing: -.045em; line-height: 1.02; }
        .v2-hero-title em { color: #B9E1D6; font-family: Georgia, serif; font-weight: 400; }
        .v2-score-label { margin: 0; color: #8FD9C8; font-size: 1rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        .v2-score-verdict { margin: .35rem 0 0; color: #fff; font-size: 2.2rem; letter-spacing: -.025em; }
        .v2-score-caption { margin: .45rem 0 0; color: rgba(255,255,255,.62); font-size: 1.15rem; }
        .v2-hero-grid .v2-overview-pills span { color: rgba(255,255,255,.84); border-color: rgba(255,255,255,.16); background: rgba(255,255,255,.08); }
        .v2-score-compact { width: 10rem; height: 10rem; display: grid; place-items: center; flex: 0 0 auto; }
        .v2-score-legend { display: flex; flex-wrap: wrap; align-items: center; gap: .7rem 1.5rem; margin: -.6rem 0 1.8rem; padding: .9rem 1.2rem; border: 1px solid var(--line); border-radius: 1rem; background: #F7F5F0; }
        .v2-score-legend > strong { margin-right: auto; color: var(--primary); font-size: 1.08rem; font-weight: 800; }
        .v2-score-legend span { display: inline-flex; align-items: center; gap: .55rem; color: var(--secondary); font-size: 1.12rem; font-weight: 650; }
        .v2-score-legend i { width: .8rem; height: .8rem; border-radius: 50%; }
        .v2-score-legend .strong { background: #217A55; } .v2-score-legend .watch { background: #C28A27; } .v2-score-legend .focus { background: #B33B3B; } .v2-score-legend .unknown { background: #7A8581; }
        .v2-title-with-info { display: flex; align-items: center; gap: .8rem; }
        .v2-info-wrap { position: relative; display: inline-flex; flex: 0 0 auto; }
        .v2-info-button { display: grid; place-items: center; width: 2.2rem; height: 2.2rem; padding: 0; border: 1px solid #AEBDB7; border-radius: 50%; background: #F5F7F5; color: #476A60; font: 700 1.2rem/1 Georgia, serif; cursor: help; }
        .v2-info-button:hover, .v2-info-button:focus-visible { border-color: #3E7B68; background: #E8F0EC; outline: none; }
        .v2-info-popover { position: absolute; z-index: 50; top: calc(100% + .8rem); left: 50%; width: min(30rem, calc(100vw - 4rem)); padding: 1.5rem; border: 1px solid #D6D2C8; border-radius: 1rem; background: #FFFDF9; box-shadow: 0 1.6rem 4rem -1.8rem rgba(23,62,53,.4); transform: translateX(-50%); }
        .v2-info-popover:before { content: ""; position: absolute; top: -.5rem; left: calc(50% - .5rem); width: 1rem; height: 1rem; border-left: 1px solid #D6D2C8; border-top: 1px solid #D6D2C8; background: #FFFDF9; transform: rotate(45deg); }
        .v2-info-popover strong, .v2-info-popover small, .v2-info-popover span { display: block; }
        .v2-info-popover strong { margin-bottom: .55rem; color: var(--primary); font-size: 1.3rem; }
        .v2-info-popover span { color: var(--secondary); font-size: 1.15rem; line-height: 1.5; }
        .v2-info-popover small { margin: 1rem 0 .35rem; color: #3E7B68; font-size: .95rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .v2-info-close { position: absolute; top: .7rem; right: .7rem; width: 2.4rem; height: 2.4rem; border: 0; border-radius: 50%; background: var(--wash); color: var(--secondary); font-size: 1.6rem; line-height: 1; cursor: pointer; }
        .v2-report-section { overflow: visible !important; }
        .v2-hero-grid { box-shadow: 0 1.8rem 5rem -4rem rgba(23,62,53,0.45); }
        .v2-report-block, .v2-analysis-block { margin: 3.2rem 0; padding: 2.6rem 2.8rem; border: 1px solid #D8D4CA; border-radius: 1.6rem; background: rgba(252,251,248,0.82); box-shadow: 0 1.6rem 4rem -4rem rgba(23,62,53,0.5); }
        .v2-category-block { position: relative; border: 1px solid #CEDCD7; border-top: 0.45rem solid #3A8D78; background: linear-gradient(145deg, #FCFBF8 0%, #F0F7F4 100%); }
        .v2-photo-block { border-top: 0.35rem solid #A38B69; }
        .v2-analysis-block { position: relative; overflow: hidden; scroll-margin-top: 9rem; border: 1px solid #BFD4CC; border-top: 0.45rem solid #20A58F; background: linear-gradient(180deg, rgba(229,246,240,.92) 0, rgba(252,251,248,.96) 24rem); box-shadow: 0 2.2rem 5rem -3.5rem rgba(13,48,40,.62); }
        .v2-block-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.6rem; margin-bottom: 1.8rem; padding-bottom: 1.4rem; border-bottom: 1px solid var(--line); }
        .v2-block-heading h2 { margin: 0; color: var(--primary); font-size: 2.1rem; }
        .v2-block-heading > span { padding: 0.55rem 0.9rem; border: 1px solid var(--line); border-radius: 9999px; background: #F5F3EE; color: var(--muted); font-size: 1.05rem; font-weight: 700; white-space: nowrap; }
        .v2-category-intro { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; padding-bottom: 1.8rem; border-bottom: 1px solid #D4DFDB; }
        .v2-category-intro h2 { margin: 0; color: var(--primary); font-size: clamp(2.5rem, 3vw, 3.35rem); font-weight: 850; letter-spacing: -.035em; line-height: 1.08; }
        .v2-category-intro > div > p:last-child { margin: .75rem 0 0; color: var(--secondary); font-size: 1.25rem; line-height: 1.5; }
        .v2-category-intro > span { display: inline-flex; align-items: center; gap: .55rem; padding: .75rem 1rem; border: 1px solid #BFD7CF; border-radius: 9999px; background: #E4F3EE; color: #176D5C; font-size: 1.05rem; font-weight: 800; white-space: nowrap; }
        /* This banner introduces the tab bar — it is not a section of its own,
           and previously outsized everything inside the tabs it introduces,
           including the actual generated hairstyle/colour/frame preview
           images, which is the part users are paying to see. Shrunk from a
           hero (up to 3.35rem type, animated glow, 5.3rem icon) to a slim
           strip: real content below now reads as the peak of the page. */
        .v2-analysis-heading { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1.2rem; margin: -1rem -1.1rem 1.6rem; padding: 1.3rem 1.8rem; overflow: hidden; border: 1px solid rgba(255,255,255,.13); border-radius: 1.2rem; background: linear-gradient(125deg, #092F27 0%, #11594C 62%, #168D78 100%); box-shadow: 0 1rem 2.4rem -1.8rem rgba(9,47,39,.7); }
        .v2-analysis-heading-icon { position: relative; z-index: 1; display: grid; place-items: center; width: 3.6rem; height: 3.6rem; flex-shrink: 0; border: 1px solid rgba(255,255,255,.25); border-radius: 1rem; background: linear-gradient(145deg, rgba(255,255,255,.2), rgba(255,255,255,.08)); color: #FFD166; box-shadow: inset 0 1px rgba(255,255,255,.22); }
        .v2-analysis-heading-copy { position: relative; z-index: 1; }
        .v2-analysis-heading .v2-eyebrow { margin-bottom: .3rem; color: #70E1CD; font-size: .98rem; }
        .v2-analysis-heading h2 { margin: 0; max-width: 54rem; color: #fff; font-size: clamp(1.7rem, 1.6vw, 2rem); font-weight: 800; letter-spacing: -.02em; line-height: 1.15; }
        .v2-category-count { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: .45rem; padding: .75rem 1rem; border: 1px solid rgba(255,255,255,.22); border-radius: 9999px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.86); font-size: 1rem; font-weight: 750; white-space: nowrap; backdrop-filter: blur(8px); }
        .v2-category-count b { color: #FFD166; font-size: 1.25rem; }
        .v2-category-count span { color: #70E1CD; font-size: 1.25rem; animation: v2-analysis-nudge 1.5s ease-in-out infinite; }
        .v2-analysis-block .v2-tabbar { background: transparent !important; margin-bottom: 1.8rem !important; padding-top: 0 !important; }
        .v2-analysis-block .v2-tabrail { gap: .65rem !important; padding: .65rem !important; border-color: #D1DDD8 !important; border-radius: 1.55rem !important; background: rgba(255,255,255,.76) !important; box-shadow: inset 0 1px rgba(255,255,255,.9), 0 1.2rem 3rem -2.5rem rgba(13,48,40,.55); }
        .v2-tab-option:not(.is-active):hover { background: rgba(23,62,53,.06) !important; }
        @keyframes v2-analysis-nudge { 0%,100% { transform: translateY(-.1rem); } 50% { transform: translateY(.2rem); } }
        .v2-analysis-block .v2-report-section { box-shadow: 0 1rem 2.8rem -2.8rem rgba(23,62,53,0.5); }
        .v2-limitations { border: 1px solid #DDD5C5; border-left: 0.35rem solid #A97931; }
        .v2-overview-pills span { padding: 0.7rem 1.1rem; border-radius: 9999px; background: #F0EEE8; border: 1px solid #E2DED5; color: #425E56; font-size: 1.15rem; }
        .v2-quality-note { margin: 1.4rem 0 0; padding: 1rem 1.2rem; border-left: 3px solid #A97931; background: #F6EFE3; color: #66553A; font-size: 1.2rem; line-height: 1.5; }
        .v2-eyebrow { margin: 0 0 0.5rem; color: var(--rose); font-size: 1.1rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
        .v2-hero-picker { position: relative; padding: 2.6rem 2.8rem 2rem; overflow: hidden; border: 1px solid #D4DDD9; border-bottom: 0; border-radius: 1.8rem 1.8rem 0 0; background: linear-gradient(145deg, #FFFDF9, #F2F7F4); }
        .v2-hero-picker:before { content: ""; position: absolute; inset: 0 0 auto; height: .35rem; background: linear-gradient(90deg, #13A895 0 25%, #D39A32 25% 50%, #D35F47 50% 75%, #347B5C 75%); }
        .v2-picker-heading { display: flex; align-items: end; justify-content: space-between; gap: 2rem; }
        .v2-picker-heading h2 { margin: 0; color: var(--primary); font-size: clamp(2.5rem, 3vw, 3.4rem); font-weight: 850; letter-spacing: -.04em; line-height: 1.05; }
        .v2-picker-heading > p { max-width: 35rem; margin: 0; color: var(--secondary); font-size: 1.25rem; line-height: 1.5; text-align: right; }
        /* Sits below the sticky report toolbar (Dashboard / Download / Ask). */
        .v2-category-dock { position: sticky; top: 7.4rem; z-index: 40; margin-bottom: 2.8rem; padding: .8rem; border: 1px solid #D4DDD9; border-radius: 0 0 1.8rem 1.8rem; background: rgba(250,249,245,.95); box-shadow: 0 1.4rem 3.5rem -2.6rem rgba(13,48,40,.5); backdrop-filter: blur(18px) saturate(1.2); }
        .v2-category-dock .v2-tabbar { margin: 0 !important; }
        /* Active-tab pill and every tab button: no rounded corners. */
        .v2-tab-option, .v2-tab-option > span[aria-hidden] { border-radius: 0 !important; }
        .v2-tabrail-hero { padding: .7rem !important; gap: .3rem !important; border: 1px solid var(--line) !important; background: var(--surface) !important; }
        .v2-tabrail-hero .v2-tab-option { min-height: 6.2rem; border-color: transparent !important; border-radius: 1.15rem !important; background: transparent !important; font-size: 1.45rem !important; box-shadow: none !important; }
        .v2-tabrail-hero .v2-tab-option:not(.is-active):hover { border-color: transparent !important; background: color-mix(in srgb, var(--rose) 5%, var(--surface)) !important; }
        .v2-tabrail-hero .v2-tab-icon { border-radius: 50% !important; }
        .v2-tabrail-hero .is-active { box-shadow: none !important; }
        .v2-priority-panel { padding: 2.8rem 3.2rem 3.2rem; border: 1px solid var(--line); border-radius: 1.6rem; background: #FCFBF8; margin-bottom: 3.2rem; box-shadow: 0 1.8rem 5rem -4.2rem rgba(23,62,53,0.55); }
        .v2-priority-intro { display: flex; align-items: end; gap: 1.8rem; margin-bottom: 2rem; }
        .v2-priority-intro .v2-eyebrow { flex: 0 0 auto; margin-bottom: 0.35rem; }
        .v2-priority-panel h2 { margin: 0; color: var(--primary); font-size: 2.2rem; }
        .v2-priority-intro > p:last-child { margin: 0 0 0.2rem auto; max-width: 34rem; color: var(--secondary); font-size: 1.25rem; line-height: 1.5; text-align: right; }
        .v2-priority-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
        .v2-priority-grid article { display: flex; flex-direction: column; min-height: 17rem; padding: 1.6rem; border: 1px solid var(--line); border-radius: 1.2rem; background: #F7F5F0; }
        .v2-priority-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.6rem; }
        .v2-priority-card-top small { color: var(--muted); font-size: 1rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; }
        .v2-priority-grid strong { color: var(--primary); font-size: 1.4rem; }
        .v2-priority-grid p { margin: 0.5rem 0 1.5rem; color: var(--secondary); font-size: 1.2rem; line-height: 1.5; }
        .v2-factor-list { display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 1rem 0 1.5rem; }
        .v2-factor-list b { padding: 0.5rem 0.75rem; border: 1px solid #D9D5CC; border-radius: 0.65rem; background: #fff; color: #244A40; font-size: 1.12rem; font-weight: 750; line-height: 1.3; }
        article.improve .v2-factor-list b { color: #79551E; background: #FCF8EF; border-color: #E8D9BC; }
        article.retake .v2-factor-list b { color: #405F57; background: #F2F6F4; border-color: #D6E1DD; }
        .v2-priority-icon { display: grid; place-items: center; width: 3.2rem; height: 3.2rem; flex: 0 0 auto; border-radius: 0.9rem; }
        .v2-priority-grid article.maintain .v2-priority-icon { background: #E6EFEA; color: #356B57; } .v2-priority-grid article.improve .v2-priority-icon { background: #F5EBD8; color: #966A27; } .v2-priority-grid article.retake .v2-priority-icon { background: #E7EEEC; color: #55756C; }
        .v2-priority-signal { display: block; width: 100%; height: 0.45rem; margin-top: auto; overflow: hidden; border-radius: 9999px; background: #E4E1DA; }
        .v2-priority-signal b { display: block; height: 100%; border-radius: inherit; background: #356B57; }
        article.improve .v2-priority-signal b { background: #A97931; } article.retake .v2-priority-signal b { background: #66847A; }
        .v2-category-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
        .v2-category-grid button { position: relative; min-height: 19rem; padding: 2rem 2.1rem 1.5rem; overflow: hidden; text-align: left; border: 1px solid #D6DFDB; border-radius: 1.5rem; background: rgba(255,255,255,.87); cursor: pointer; color: var(--primary); box-shadow: 0 1.4rem 3.4rem -2.8rem rgba(23,62,53,.58); transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }
        .v2-category-grid button:before { content: ""; position: absolute; inset: 0 auto 0 0; width: .38rem; background: var(--category-accent); transition: width .2s ease; }
        .v2-category-grid button:after { content: ""; position: absolute; width: 9rem; height: 9rem; right: -5rem; top: -5rem; border-radius: 50%; background: color-mix(in srgb, var(--category-accent) 12%, transparent); transition: transform .3s ease; }
        .v2-category-grid button:hover { border-color: var(--category-accent); background: #fff; box-shadow: 0 2rem 4.2rem -2.6rem color-mix(in srgb, var(--category-accent) 45%, transparent); }
        .v2-category-grid button:hover:before { width: .65rem; }
        .v2-category-grid button:hover:after { transform: scale(1.5); }
        .v2-category-grid button:focus-visible { outline: .25rem solid color-mix(in srgb, var(--category-accent) 45%, transparent); outline-offset: .2rem; }
        .v2-category-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.2rem; }
        .v2-category-icon { display: grid; place-items: center; width: 4.3rem; height: 4.3rem; border-radius: 1.1rem; background: color-mix(in srgb, var(--category-accent) 12%, white); color: var(--category-accent); }
        .v2-category-open { display: grid; place-items: center; width: 2.7rem; height: 2.7rem; border: 1px solid #D5DEDA; border-radius: 50%; color: var(--secondary); font-size: 1.25rem; transition: color .2s ease, background .2s ease, transform .2s ease; }
        .v2-category-grid button:hover .v2-category-open { color: #fff; border-color: var(--category-accent); background: var(--category-accent); transform: rotate(45deg); }
        .v2-category-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
        .v2-category-heading > span { color: var(--primary); font-size: 1.65rem; font-weight: 850; letter-spacing: -.015em; }
        .v2-category-heading > strong { font-size: 3.4rem; line-height: 1; font-variant-numeric: tabular-nums; }
        .v2-category-heading > strong small { margin-left: .2rem; color: var(--muted); font-size: 1rem; font-weight: 700; }
        .v2-category-bar { width: 100%; height: 0.65rem; margin: 1rem 0 1.15rem; border-radius: 9999px; overflow: hidden; background: #E4E1DA; }
        .v2-category-bar i { display: block; height: 100%; border-radius: inherit; }
        .v2-category-grid button p { margin: 0 0 1.4rem; color: var(--secondary); font-size: 1.25rem; line-height: 1.45; }
        .v2-category-cta { position: absolute; left: 2.1rem; right: 2.1rem; bottom: 1.4rem; display: flex; align-items: center; justify-content: space-between; padding-top: 1rem; border-top: 1px solid #E1E6E3; color: var(--category-accent); font-size: 1.12rem; font-weight: 850; }
        .v2-category-cta b { font-size: 1.35rem; transition: transform .2s ease; }
        .v2-category-grid button:hover .v2-category-cta b { transform: translateX(.35rem); }
        .v2-progress-panel { display: grid; grid-template-columns: minmax(20rem, 1.2fr) auto minmax(16rem, .7fr) auto; align-items: center; gap: 2.4rem; margin-top: 3.2rem; padding: 3rem; overflow: hidden; position: relative; background: linear-gradient(135deg, #173E35 0%, #244F43 68%, #315F52 100%); border: 1px solid #315F52; border-radius: 1.6rem; box-shadow: 0 2.2rem 5rem -3.6rem rgba(23,62,53,.8); }
        .v2-progress-panel:after { content: ""; position: absolute; width: 18rem; height: 18rem; right: -8rem; top: -10rem; border-radius: 50%; border: 1px solid rgba(255,255,255,.12); box-shadow: 0 0 0 3rem rgba(255,255,255,.025), 0 0 0 6rem rgba(255,255,255,.018); pointer-events: none; }
        .v2-progress-panel .v2-eyebrow { color: #91C6B3; }
        .v2-progress-panel h2 { margin: 0 0 0.7rem; color: #fff; font-size: 2.25rem; line-height: 1.15; } .v2-progress-panel p { margin: 0; max-width: 42rem; color: rgba(255,255,255,.74); font-size: 1.3rem; line-height: 1.55; }
        .v2-next-scan { min-width: 17rem; padding: 1.4rem 1.6rem; border: 1px solid rgba(255,255,255,.18); border-radius: 1.2rem; background: rgba(255,255,255,.09); }
        .v2-next-scan span, .v2-next-scan small { display: block; color: rgba(255,255,255,.68); font-size: 1rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
        .v2-next-scan strong { display: block; margin: .55rem 0; color: #fff; font-size: 2rem; white-space: nowrap; }
        .v2-next-scan small { color: #9ED2BF; font-size: .95rem; }
        .v2-progress-metrics { padding-left: 2rem; border-left: 1px solid rgba(255,255,255,.18); } .v2-progress-metrics span { display: block; color: #9ED2BF; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.08em; } .v2-progress-metrics strong { display: block; max-width: 22rem; margin-top: 0.55rem; color: #fff; font-size: 1.25rem; line-height: 1.4; }
        .v2-progress-action { position: relative; z-index: 1; text-align: center; }
        .v2-progress-action small { display: block; max-width: 16rem; margin: .7rem auto 0; color: rgba(255,255,255,.6); font-size: .95rem; line-height: 1.35; }
        .v2-section-summary { display: flex; flex-wrap: wrap; gap: 0.7rem 1.6rem; margin-top: 1.4rem; padding-top: 1.2rem; border-top: 1px solid var(--line); }
        .v2-section-summary span { display: inline-flex; align-items: center; gap: 0.55rem; color: var(--muted); font-size: 1.1rem; }
        .v2-section-summary i { width: 0.65rem; height: 0.65rem; border-radius: 50%; }
        .v2-routine-context { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; padding-bottom: 1.6rem; border-bottom: 1px solid var(--line); }
        .v2-routine-context > span { display: grid; width: 3.6rem; height: 3.6rem; flex: 0 0 auto; place-items: center; border-radius: 1rem; background: rgba(26,158,143,0.1); color: var(--rose); }
        .v2-routine-context strong { display: block; margin-bottom: 0.35rem; color: var(--primary); font-size: 1.35rem; font-weight: 600; }
        .v2-routine-context p { margin: 0; color: var(--muted); font-size: 1.15rem; line-height: 1.45; }
        .v2-hair-routine { position: relative; padding: 3.2rem clamp(1.4rem, 3vw, 3.2rem); overflow: hidden; border: 1px solid #E7D3A9; background: radial-gradient(circle at 8% 12%, rgba(255,255,255,.85) 0 6rem, transparent 6.1rem), radial-gradient(circle at 94% 85%, rgba(238,167,143,.2) 0 8rem, transparent 8.1rem), linear-gradient(135deg, #FFF5D9, #F5E8F0 52%, #DFF2EB); }
        .v2-hair-routine-mark { display: grid; place-items: center; width: 5rem; height: 5rem; margin: 0 auto 1.2rem; border-radius: 50%; color: #8D5C12; background: #FFE29A; box-shadow: 0 1rem 2.4rem -1.5rem rgba(141,92,18,.5); }
        .v2-hair-routine > h2 { font-size: clamp(2.4rem, 3vw, 3.2rem) !important; font-weight: 750 !important; letter-spacing: -.025em; }
        .v2-hair-routine > .v2-routine-content { background: rgba(255,255,255,.76) !important; border-color: rgba(141,92,18,.18) !important; box-shadow: 0 2rem 5rem -4rem rgba(71,48,20,.55); backdrop-filter: blur(12px); }
        .v2-hair-routine .v2-routine-context > span { color: #8D5C12; background: #FFE8AE; }
        .v2-hair-routine-list { display: grid !important; grid-template-columns: 1fr 1fr; gap: 1rem !important; }
        .v2-hair-routine-list li { min-height: 7rem; align-items: center; padding: 1.2rem !important; border: 1px solid rgba(141,92,18,.12) !important; background: rgba(255,255,255,.62); }
        .v2-hair-routine-list li:nth-child(4n+1) > span:first-child { color: #9B6818 !important; background: #FFE6A8 !important; }
        .v2-hair-routine-list li:nth-child(4n+2) > span:first-child { color: #287A68 !important; background: #D7F1E8 !important; }
        .v2-hair-routine-list li:nth-child(4n+3) > span:first-child { color: #A6524C !important; background: #F9DDD7 !important; }
        .v2-hair-routine-list li:nth-child(4n+4) > span:first-child { color: #775A9C !important; background: #EADFF5 !important; }
        .v2-routine-note { display: flex; align-items: center; gap: .6rem; }
        @media (max-width: 900px) {
          .v2-metric-cols { grid-template-columns: 1fr !important; }
          .v2-hero-grid { grid-template-columns: 1fr !important; }
          .v2-hero-grid > div:first-child { max-width: 24rem; margin: 0 auto; }
          .v2-priority-intro { display: block; }
          .v2-priority-intro > p:last-child { margin: 0.8rem 0 0; text-align: left; }
          .v2-priority-grid { grid-template-columns: 1fr; }
          .v2-category-intro { align-items: flex-start; }
          .v2-progress-panel { grid-template-columns: 1fr; }
          .v2-progress-metrics { padding: 1.4rem 0 0; border-left: 0; border-top: 1px solid rgba(255,255,255,.18); }
        }
        @media (max-width: 700px) {
          .v2-guide-cols { grid-template-columns: 1fr !important; }
        }
        /* The tab strip scrolls sideways on narrow screens rather than
           wrapping to two rows, so the sticky header stays one line tall. */
        .v2-tabbar [role="tablist"]::-webkit-scrollbar { display: none; }
        @media (max-width: 600px) {
          /* overflow-x clip stops sideways drift WITHOUT making this a scroll
             container. overflow-x hidden here silently broke position sticky on
             .v2-category-dock (worked on desktop, which has no clip). */
          .v2-report-page { padding: 2rem 1.4rem 6rem !important; overflow-x: clip; }
          /* Stay a single compact row so the sticky header does not eat a
             third of the screen on mobile. */
          .v2-report-toolbar { flex-wrap: wrap; align-items: center !important; margin-bottom: 1.8rem !important; padding: 1rem 0 !important; }
          .v2-report-actions { flex: 1 1 100%; align-items: stretch; }
          .v2-report-actions button { flex: 1 1 0; min-width: 0 !important; padding-left: 1rem !important; padding-right: 1rem !important; font-size: 1.25rem !important; }
          .v2-report-block, .v2-analysis-block { margin: 2rem 0; padding: 1.6rem 1.4rem; border-radius: 1.3rem; }
          .v2-block-heading { align-items: center; margin-bottom: 1.4rem; padding-bottom: 1.2rem; }
          .v2-block-heading h2 { font-size: 1.8rem; }
          .v2-block-heading > span { font-size: 0.95rem; }
          .v2-analysis-block { padding: 1.1rem !important; background: linear-gradient(180deg, rgba(229,246,240,.96) 0, rgba(252,251,248,.98) 22rem); }
          .v2-analysis-heading { grid-template-columns: auto minmax(0, 1fr); gap: 1rem; margin: 0 0 1.3rem; padding: 1.2rem 1.3rem; border-radius: 1.2rem; }
          .v2-analysis-heading-icon { width: 3.2rem; height: 3.2rem; border-radius: 0.9rem; }
          .v2-analysis-heading h2 { font-size: 1.6rem; line-height: 1.15; }
          .v2-category-count { grid-column: 1 / -1; justify-self: start; margin-left: 5.2rem; }
          .v2-score-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; margin-top: -.5rem; }
          .v2-score-legend > strong { grid-column: 1 / -1; }
          .v2-score-legend span { font-size: 1.05rem; }
          .v2-hero-grid { padding: 1.6rem !important; gap: 1.8rem !important; border-radius: 1.4rem !important; }
          .v2-hero-grid > div:first-child { max-width: 18rem !important; }
          .v2-score-compact { width: 10rem; height: 10rem; }
          .v2-overview-copy h1 { font-size: 2.2rem !important; }
          .v2-report-meta { align-items: flex-start; flex-direction: column; margin-bottom: 1.6rem; }
          .v2-hero-title { margin-bottom: 2rem; font-size: 3.2rem; }
          .v2-score-caption { max-width: 18rem; }
          .v2-hero-picker { padding: 2rem 1.4rem 1.2rem; border-radius: 1.4rem 1.4rem 0 0; }
          .v2-picker-heading { display: block; margin-bottom: 1.4rem; }
          .v2-picker-heading h2 { font-size: 2.35rem; }
          .v2-picker-heading > p { margin-top: .7rem; text-align: left; }
          .v2-category-dock { top: 9.4rem; margin-bottom: 2rem; padding: 0; border-radius: 0; }
          .v2-tabrail-hero { grid-template-columns: repeat(4, 1fr) !important; padding: .4rem !important; gap: .2rem !important; background: var(--surface) !important; border: 1px solid var(--line) !important; }
          .v2-tabrail-hero .v2-tab-option {
            min-height: 5.4rem; padding: .8rem .3rem !important; font-size: 1.1rem !important;
            border: 0 !important; border-radius: .8rem !important; background: transparent !important; box-shadow: none !important;
          }
          .v2-tabrail-hero .v2-tab-option:not(.is-active) { color: var(--muted) !important; }
          .v2-tabrail-hero .v2-tab-icon { display: grid !important; width: 2.8rem !important; height: 2.8rem !important; border-radius: 50% !important; }
          .v2-tabrail-hero .v2-tab-icon svg { width: 1.65rem !important; height: 1.65rem !important; }
          .v2-tabrail-hero .is-active > span[aria-hidden] { border-radius: .8rem !important; }
          .v2-tabrail-hero .v2-tab-option > span { flex-direction: column; gap: .35rem !important; }
          .v2-tabrail-hero .v2-tab-full { display: none !important; }
          .v2-tabrail-hero .v2-tab-short { display: inline !important; }
          .v2-priority-panel { padding: 2rem 1.6rem; border-radius: 1.3rem; }
          .v2-priority-grid article { min-height: 0; padding: 1.4rem; }
          .v2-priority-card-top { margin-bottom: 1rem; }
          .v2-category-intro { display: block; }
          .v2-category-intro h2 { font-size: 2.35rem; }
          .v2-category-intro > span { margin-top: 1rem; }
          .v2-category-grid { grid-template-columns: 1fr; }
          .v2-category-grid button { min-height: 18rem; padding: 1.6rem 1.6rem 1.4rem; }
          .v2-category-heading > strong { font-size: 2.2rem; }
          .v2-category-grid button p { padding-right: 1rem; }
          .v2-category-cta { left: 1.6rem; right: 1.6rem; bottom: 1.25rem; }
          .v2-progress-panel { padding: 2rem 1.6rem; gap: 1.5rem; }
          .v2-progress-panel h2 { font-size: 2rem; }
          .v2-next-scan { min-width: 0; }
          .v2-next-scan strong { font-size: 1.8rem; }
          .v2-progress-action { text-align: left; }
          .v2-progress-action small { margin-left: 0; }
          /* Segments share the width equally and the decorative icons and long
             labels drop out, so all four fit the rail exactly. Previously the
             rail scrolled and clipped the last tab mid-word. */
          .v2-tabrail { padding: 0.4rem !important; gap: 0.2rem !important; overflow-x: visible !important; }
          .v2-tabrail button {
            flex: 1 1 0 !important; min-width: 0 !important; justify-content: center;
            padding: 1rem 0.4rem !important; font-size: 1.3rem !important; gap: 0 !important;
          }
          .v2-tab-icon { display: none !important; }
          .v2-tab-number { display: none !important; }
          .v2-tab-full { display: none !important; }
          .v2-tab-short { display: inline !important; }
          /* Two columns keep labels and counts readable without horizontal overflow. */
          .v2-filter-label { display: none !important; }
          .v2-filter-row { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; gap: 0.7rem !important; overflow: visible !important; }
          .v2-filter-row button {
            width: 100%; min-width: 0 !important; justify-content: space-between;
            padding: 0.9rem 1rem !important; font-size: 1.2rem !important;
            border-width: 1px !important; gap: 0.5rem !important;
          }
          .v2-filter-dot { display: none !important; }
          .v2-filter-full { display: none !important; }
          .v2-filter-short { display: inline !important; }
          .v2-report-section { margin-bottom: 1.2rem !important; border-radius: 1.25rem !important; }
          .v2-info-popover { position: fixed; top: 20dvh; left: 1.6rem; right: 1.6rem; width: auto; max-width: none; max-height: 60dvh; overflow-y: auto; transform: none !important; box-shadow: 0 0 0 100vmax rgba(18,35,31,.42), 0 2rem 5rem -1rem rgba(18,35,31,.45); }
          .v2-info-popover:before { display: none; }
          .v2-section-header { padding: 1.5rem 1.6rem 1.4rem !important; }
          .v2-section-header h2 { font-size: 2.1rem !important; }
          .v2-section-header > div:first-child > span { padding: 0.45rem 0.8rem !important; }
          .v2-section-summary { gap: 0.6rem 1.2rem; margin-top: 1.1rem; padding-top: 1rem; }
          .v2-section-body { padding: 0 1.6rem 1.5rem !important; }
          .v2-metric-bar { flex: 1 1 auto !important; min-width: 10rem; }
          /* Even without the bar, a name like "Sun-damage appearance" competing
             with the status chip on one line broke over three lines. Giving the
             name its own full-width row keeps every metric to two tidy lines. */
          .v2-metric-row { flex-wrap: wrap !important; gap: 0.7rem 1rem !important; padding: 1.3rem 0 !important; }
          .v2-metric-row > span:first-child { flex: 1 1 100% !important; }
          .v2-metric-detail { gap: 1.3rem !important; padding-bottom: 1.6rem !important; }
          .v2-metric-finding { gap: 1rem !important; padding-left: 1rem !important; }
          .v2-metric-finding p { overflow-wrap: anywhere; }
          .v2-metric-finding > div > p:last-child { font-size: 1.28rem !important; line-height: 1.55 !important; }
          .v2-metric-finding > p:last-child { font-size: 1.05rem !important; line-height: 1.45 !important; }
          .v2-metric-guide { padding: 1.4rem 1.2rem !important; border-radius: 1rem !important; overflow:hidden; }
          .v2-metric-guide > p { font-size: 1.22rem !important; line-height: 1.55 !important; overflow-wrap:anywhere; }
          .v2-metric-guide > p:first-child { font-size: .98rem !important; line-height: 1.45 !important; letter-spacing: .06em !important; }
          .v2-routine-tabs { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100% !important; max-width: 100%; border-radius: 1.4rem !important; }
          .v2-routine-tabs button { min-width: 0; justify-content: center; gap: 0.45rem !important; padding: 1rem 0.5rem !important; font-size: 1.15rem !important; }
          .v2-routine-tabs button span { display: none !important; }
          .v2-routine-content { padding: 2rem 1.6rem !important; border-radius: 1.25rem !important; }
          .v2-routine-content li { gap: 0.8rem !important; font-size: 1.3rem !important; }
          .v2-hair-routine { padding: 2.4rem 1rem; }
          .v2-hair-routine-list { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .v2-category-count span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
