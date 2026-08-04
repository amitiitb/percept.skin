"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScoreReveal } from "@/components/v2/ScoreReveal";
import ColourAnalysisPanel from "@/components/v2/ColourAnalysisPanel";
import HairstylePanel from "@/components/v2/HairstylePanel";
import GroomingPanel from "@/components/v2/GroomingPanel";
import GlassesVirtualTryOn from "@/components/v2/GlassesVirtualTryOn";
import FrameAIPanel from "@/components/v2/FrameAIPanel";
import { FrameGrid } from "@/components/v2/FrameGrid";
import { MAX_GENERATIONS } from "@/lib/v2/generationBudget";
import { guideFor } from "@/lib/v2/metricGuide";
import { trackEvent } from "@/lib/analytics";
import { logV2 } from "@/lib/v2/log";
import { HARMONY_METRIC_NAMES, ANGULARITY_METRIC_NAMES } from "@/lib/v2/faceMetricGroups";
import { IconFaceScan, IconScissors, IconPalette, IconGlasses, IconLock, IconCheck, IconSparkle, IconSun, IconMoon, IconStrands } from "@/components/ui/icons";
import type { AnalysisMetric, MetricCategory, ColourAnalysis, RecommendationSet } from "@/lib/v2/types";
import type { ModuleId } from "@/lib/v2/reportModules";

interface SessionRow {
  id: string;
  status: string;
  overall_score: number | null;
  skin_age: number | null;
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
  if (score === null) return { label: "No read", color: "var(--muted)", tint: "var(--wash)" };
  if (score >= 80) return { label: "Excellent", color: "#2E7D5B", tint: "rgba(46,125,91,0.1)" };
  if (score >= 60) return { label: "Good", color: "#1A9E8F", tint: "rgba(26,158,143,0.1)" };
  if (score >= 40) return { label: "Moderate", color: "#C08420", tint: "rgba(192,132,32,0.12)" };
  return { label: "Focus area", color: "#C8503A", tint: "rgba(200,80,58,0.1)" };
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
        <span style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500, flex: "1 1 auto", minWidth: 0 }}>{m.metricName}</span>
        <span style={{
          fontSize: "1.1rem", fontWeight: 700, color: band.color, background: band.tint, borderRadius: "9999px",
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
            <div style={{ paddingBottom: "2.4rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem", borderLeft: `2px solid ${band.color}`, paddingLeft: "1.8rem" }}>
                <div>
                  <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>In your scan</p>
                  <p style={{ fontSize: "1.5rem", color: "var(--primary)", lineHeight: 1.6, margin: 0 }}>{m.explanation}</p>
                </div>
                {m.recommendation && (
                  <div>
                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.5rem" }}>Suggested next step</p>
                    <p style={{ fontSize: "1.5rem", color: "var(--primary)", lineHeight: 1.6, margin: 0 }}>{m.recommendation}</p>
                  </div>
                )}
                {m.confidence && (
                  <p style={{ fontSize: "1.2rem", color: "var(--muted)", margin: 0 }}>Confidence: {m.confidence}</p>
                )}
              </div>

              {guide && (
                <div style={{ background: "var(--canvas)", borderRadius: "1.2rem", padding: "2.2rem 2.4rem" }}>
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
  Skin: "var(--rose)",
  Face: "#D9A62E",
  "Hair & Scalp": "#E8604F",
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
  { key: "focus", label: "Focus areas", short: "Focus", colour: "#C8503A", match: (s) => s !== null && s < 40 },
  { key: "moderate", label: "Moderate", short: "Moderate", colour: "#C08420", match: (s) => s !== null && s >= 40 && s < 60 },
  { key: "good", label: "Doing well", short: "Good", colour: "#2E7D5B", match: (s) => s !== null && s >= 60 },
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
        {BAND_FILTERS.map((f) => {
          const count = metrics.filter((m) => f.match(m.score)).length;
          const active = value === f.key;
          const empty = count === 0;
          // A filter that would empty the list stays visible but disabled, so
          // the row does not reflow as scores change between scans.
          return (
            <motion.button
              key={f.key}
              type="button"
              disabled={empty}
              onClick={() => onChange(f.key)}
              whileTap={empty ? undefined : { scale: 0.94 }}
              animate={{ scale: 1 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.8rem",
                padding: "1rem 1.6rem", borderRadius: "1.4rem",
                cursor: empty ? "default" : "pointer", fontSize: "1.45rem", fontWeight: 700,
                border: `2px solid ${active ? f.colour : "var(--line)"}`,
                background: active ? f.colour : "var(--surface)",
                color: active ? "#fff" : empty ? "var(--muted)" : "var(--primary)",
                opacity: empty ? 0.4 : 1,
                boxShadow: active ? `0 0.6rem 1.6rem -0.6rem ${f.colour}` : "none",
                transition: "background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s",
              }}
            >
              <span aria-hidden className="v2-filter-dot" style={{
                width: "0.9rem", height: "0.9rem", borderRadius: "50%", flexShrink: 0,
                background: active ? "rgba(255,255,255,0.9)" : f.colour,
                opacity: empty ? 0.5 : 1,
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

function Section({ index, id, title, intro, metrics, locked, filter = "all" }: {
  index: number; id: string; title: string; intro?: string; metrics: AnalysisMetric[]; locked?: boolean; filter?: BandKey;
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
  const hiddenCount = locked || filter !== "all" ? 0 : Math.max(0, ordered.length - COLLAPSED_COUNT);
  const visible = hiddenCount > 0 ? ordered.slice(0, COLLAPSED_COUNT) : ordered;

  return (
    <section id={id} style={{
      marginBottom: "1.6rem", background: "var(--surface)", borderRadius: "1.6rem",
      border: "1px solid var(--line)", overflow: "hidden", scrollMarginTop: "2.4rem",
    }}>
      {/* Eyebrow and average share one line, then the title, then the intro.
          The average used to be a three-line stack floated to the right, which
          wrapped below the title on a phone and left the header six lines tall
          before a single score appeared. */}
      <header style={{ borderTop: `0.4rem solid ${accent}`, padding: "2rem 2.4rem 1.6rem", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.2rem", marginBottom: "0.7rem" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: accent, letterSpacing: "0.12em", margin: 0 }}>
            PART {String(index).padStart(2, "0")}
          </p>
          {avg !== null && !locked && (
            <span style={{
              display: "inline-flex", alignItems: "baseline", gap: "0.5rem", flexShrink: 0,
              background: band.tint, borderRadius: "9999px", padding: "0.4rem 1.1rem",
            }}>
              <strong style={{ fontSize: "1.7rem", fontWeight: 800, color: band.color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{avg}</strong>
              <span style={{ fontSize: "1.1rem", fontWeight: 600, color: band.color, opacity: 0.85 }}>avg of {metrics.length}</span>
            </span>
          )}
        </div>
        <h2 style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
        {intro && <p style={{ fontSize: "1.4rem", color: "var(--secondary)", margin: "0.5rem 0 0", maxWidth: "52rem" }}>{intro}</p>}
      </header>

      <div style={{ padding: "0 2.4rem 1.8rem" }}>
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
        <h2 style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h2>
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
  Skin: "Texture, tone, and hydration.",
  Harmony: "How your features balance against each other.",
  Angularity: "Jawline, cheekbone, and chin definition.",
  "Hair & Scalp": "Density, hairline, and scalp health.",
};

// One tab per purchased module. Turning the report into four short documents
// instead of one long one is the whole point: previously everything a user
// bought rendered as a single scroll, so a bundle buyer met skin metrics,
// routine, colour analysis, frames, and hairstyles back to back.
type TabId = "skin" | "hairstyle" | "colour" | "frame";

// Each module carries its own accent, used on the tab icon and the section
// rules, so a glance at the bar tells you where in the report you are.
const TAB_LABELS: Record<TabId, { label: string; short: string; Icon: (p: { size?: number; strokeWidth?: number }) => React.ReactElement; accent: string }> = {
  skin:      { label: "Skin Analysis",          short: "Skin",       Icon: IconFaceScan, accent: "#1A9E8F" },
  hairstyle: { label: "Hairstyle Suggestions",  short: "Hair",       Icon: IconScissors, accent: "#C08420" },
  colour:    { label: "Colour Analysis",        short: "Colour",     Icon: IconPalette,  accent: "#C8503A" },
  frame:     { label: "Frame Try-On",           short: "Frames",     Icon: IconGlasses,  accent: "#2E7D5B" },
};

// A hairline underline on thin text was far too quiet for the primary
// navigation of a paid report. This is a raised segmented rail: the active
// segment is a filled pill that physically slides between tabs, which makes the
// switch feel like a control rather than a link changing colour.
// `locked` is only passed by the free preview, where all four tabs are shown
// on purpose: a tab you cannot open still tells you what the scan produced,
// which a hidden tab does not. They stay clickable so the panel behind them
// can make its own case.
function TabBar({ tabs, active, onChange, locked }: {
  tabs: TabId[]; active: TabId; onChange: (t: TabId) => void; locked?: Set<TabId>;
}) {
  if (tabs.length < 2) return null;
  return (
    <div
      id="v2-tabs"
      className="v2-tabbar"
      style={{
        position: "sticky", top: 0, zIndex: 20, marginBottom: "2.4rem",
        padding: "1rem 0 1.2rem", background: "var(--canvas)",
      }}
    >
      <div
        role="tablist"
        aria-label="Report sections"
        className="v2-tabrail"
        style={{
          display: "flex", gap: "0.4rem", overflowX: "auto", scrollbarWidth: "none",
          background: "var(--wash)", borderRadius: "9999px", padding: "0.5rem",
          border: "1px solid var(--line)",
          // Without this the rail stretched to the report column's full
          // width (a block div fills its parent by default) while the tab
          // buttons only filled part of it, leaving a long stretch of empty
          // pill-shaped background after the last tab.
          width: "fit-content", maxWidth: "100%",
        }}
      >
        {tabs.map((t) => {
          const on = t === active;
          const meta = TAB_LABELS[t];
          return (
            <motion.button
              key={t}
              role="tab"
              aria-selected={on}
              onClick={() => onChange(t)}
              whileTap={{ scale: 0.96 }}
              style={{
                position: "relative", flex: "0 0 auto", display: "inline-flex", alignItems: "center",
                gap: "0.8rem", padding: "1.1rem 2rem", borderRadius: "9999px", border: "none",
                background: "none", cursor: "pointer", whiteSpace: "nowrap",
                fontSize: "1.5rem", fontWeight: 700,
                color: on ? "#fff" : "var(--secondary)", transition: "color 0.2s",
              }}
            >
              {on && (
                <motion.span
                  layoutId="v2-tab-pill"
                  aria-hidden
                  style={{
                    position: "absolute", inset: 0, borderRadius: "9999px", background: "var(--panel)",
                    boxShadow: "0 0.8rem 2rem -0.8rem rgba(0,57,52,0.55)",
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: "0.8rem" }}>
                <span aria-hidden className="v2-tab-icon" style={{
                  display: "flex", color: on ? meta.accent : "var(--muted)", transition: "color 0.2s",
                }}><meta.Icon size={1.7} strokeWidth={2} /></span>
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

const ROUTINE_META: Array<{ key: keyof RecommendationSet; label: string; Icon: (p: { size?: number }) => React.ReactElement; gate: "skin" | "hair" }> = [
  { key: "morning", label: "Morning", Icon: IconSun, gate: "skin" },
  { key: "evening", label: "Evening", Icon: IconMoon, gate: "skin" },
  { key: "weekly", label: "Weekly", Icon: IconSparkle, gate: "skin" },
  { key: "hairScalp", label: "Hair & Scalp", Icon: IconStrands, gate: "hair" },
];

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
      supabase.from("analysis_sessions_v2").select("id, status, overall_score, skin_age, created_at, stage, fail_reason").eq("id", sessionId).eq("user_id", user.id).maybeSingle(),
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
  const sorted = metrics
    .filter((m) => purchasedCategories.has(m.category))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const strongest = sorted.slice(0, 3).map((m) => m.metricName);
  const priority = sorted.slice(-3).map((m) => m.metricName);

  // positiveObservations/limitations/recommendations are generated from
  // whatever photos existed at analysis time, not tagged per module — only
  // show them if the user actually bought at least one of skin/hairstyle
  // (same access boundary the metric sections use).
  const hasContentAccess = hasSkin || hasHairstyle;
  const positiveObservations = hasContentAccess ? (session.positive_observations ?? []) : [];
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

  function routineFor(gate: "skin" | "hair") {
    if (!recommendations) return null;
    const blocks = ROUTINE_META.filter((r) => r.gate === gate).filter((r) => recommendations[r.key]?.length);
    if (blocks.length === 0) return null;
    return (
      <div style={{ marginBottom: "3.2rem" }}>
        <h2 style={{ fontSize: "2.2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.6rem" }}>
          {gate === "skin" ? "Your Personalized Routine" : "Your Hair & Scalp Routine"}
        </h2>
        <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2rem", maxWidth: "60rem" }}>
          Based on what we saw in your photos and the concerns you shared.
        </p>
        <div className="v2-routine-grid" style={{ display: "grid", gridTemplateColumns: blocks.length > 1 ? "1fr 1fr" : "1fr", gap: "1.6rem" }}>
          {blocks.map(({ key, label, Icon }) => (
            <div key={key} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.8rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.8rem" }}>
                <span style={{ display: "flex", color: "var(--rose)" }}><Icon size={2} /></span>
                <h3 style={{ fontSize: "1.7rem", fontWeight: 500, color: "var(--primary)", margin: 0 }}>{label}</h3>
              </div>
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                {(recommendations[key] ?? []).map((s, i) => (
                  <li key={i} style={{ display: "flex", gap: "1rem", fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.55 }}>
                    <span style={{ color: "var(--rose)", fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    );
  }

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

        {/* Hero — portrait + Percept Score side by side (Design review Decision #12,
            extended with the user's own photo so the payoff moment feels like a
            personal consultation, not a bare number) */}
        <div className="v2-hero-grid" style={{ display: "grid", gridTemplateColumns: photo ? "30rem 1fr" : "1fr", gap: "4.8rem", alignItems: "center", marginBottom: "3.2rem" }}>
          {photo && (
            <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: "2rem", overflow: "hidden", boxShadow: "0 2.4rem 4.8rem -1.2rem rgba(0,57,52,0.28)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Your guided-capture photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ textAlign: photo ? "left" : "center" }}>
            <div style={{ margin: photo ? "0" : "0 auto" }}>
              <ScoreReveal score={score} />
            </div>
            <p style={{ fontSize: "2.4rem", fontWeight: 700, color: "var(--primary)", marginTop: "1.6rem" }}>{verdictFor(score)} · Percept Score</p>
            {session.skin_age !== null && (
              <div style={{ display: "inline-flex", alignItems: "baseline", gap: "0.8rem", marginTop: "1.4rem", background: "var(--wash)", borderRadius: "9999px", padding: "0.8rem 1.8rem" }}>
                <span style={{ fontSize: "1.3rem", color: "var(--secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Skin age</span>
                <span style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--primary)" }}>{session.skin_age}</span>
              </div>
            )}
            {sorted.length > 0 && (
              <div style={{ display: "flex", gap: "3.2rem", justifyContent: photo ? "flex-start" : "center", marginTop: "2.4rem", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Strongest</p>
                  <p style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{strongest.join(" · ")}</p>
                </div>
                <div>
                  <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Priority areas</p>
                  <p style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{priority.join(" · ")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All 7 guided-capture photos — previously only face_front ever
            rendered anywhere on the report; the other 6 (angles, hairline,
            crown, parting) were captured but never shown back to the user. */}
        {allPhotos.length > 0 && (
          <div style={{ marginBottom: "4.8rem" }}>
            <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.4rem" }}>Your photos</p>
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
          </div>
        )}

        {/* What's working well — the AI's positive observations, previously
            generated on every analysis but never surfaced anywhere. */}
        {positiveObservations.length > 0 && (
          <div style={{ background: "var(--panel)", borderRadius: "1.6rem", padding: "3.2rem 3.6rem", marginBottom: "4.8rem" }}>
            <p style={{ fontSize: "1.2rem", color: "var(--on-dark)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "1.8rem", opacity: 0.8 }}>What&apos;s working well</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {positiveObservations.slice(0, 3).map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "1.2rem", alignItems: "flex-start" }}>
                  <span style={{ color: "var(--rose)", flexShrink: 0, display: "flex", marginTop: "0.4rem" }}><IconSparkle size={1.7} /></span>
                  <p style={{ fontSize: "1.6rem", color: "#fff", lineHeight: 1.6, margin: 0 }}>{p}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* One module per tab, so the page is only ever as long as the thing
            being read. Replaces the old anchor-link contents list, which still
            left every module stacked in one scroll. */}
        <TabBar
          tabs={tabs}
          active={activeTab ?? "skin"}
          onChange={(t) => {
            setTab(t);
            setMetricFilter("all");
            document.getElementById("v2-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />

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
                <Section key={p.id} index={i + 1} id={p.id} title={p.title} intro={SECTION_INTRO[p.title]} metrics={p.metrics} filter={metricFilter} />
              ))}
              <div style={{ marginTop: "3.2rem" }}>{routineFor("skin")}</div>
            </div>
          )}

          {hasHairstyle && (
            <div hidden={activeTab !== "hairstyle"}>
              {hairParts.map((p, i) => (
                <Section key={p.id} index={i + 1} id={p.id} title={p.title} intro={SECTION_INTRO[p.title]} metrics={p.metrics} filter={metricFilter} />
              ))}
              <div style={{ marginTop: "3.2rem" }}>{routineFor("hair")}</div>
              <HairstylePanel
                sessionId={sessionId}
                photo={photo}
                isPremium // purchased = unlocked, no further gate
                onRequirePremium={() => {}}
                initialPath={hairGridPath}
                initialRemaining={Math.max(0, MAX_GENERATIONS - hairUsed)}
              />
              <GroomingPanel
                sessionId={sessionId}
                photo={photo}
                isPremium
                onRequirePremium={() => {}}
                initialBeardPath={beardGridPath}
                initialBeardRemaining={Math.max(0, MAX_GENERATIONS - beardUsed)}
              />
            </div>
          )}

          {hasColour && (
            <div hidden={activeTab !== "colour"}>
              <ColourAnalysisPanel sessionId={sessionId} photo={photo} initialAnalysis={colourAnalysis} />
            </div>
          )}

          {hasFrame && photo && (
            <div hidden={activeTab !== "frame"}>
              <h2 style={{ fontSize: "2rem", fontWeight: 500, color: "var(--primary)", marginBottom: "0.8rem" }}>Frames For Your Face</h2>
              <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "2.4rem", lineHeight: 1.5 }}>
                Try on frames matched to your face shape{colourAnalysis ? " and colour season" : ""}.
              </p>
              <FrameGrid sessionId={sessionId} photo={photo} initialPath={frameGridPath} initialRemaining={Math.max(0, MAX_GENERATIONS - frameUsed)} />
              <GlassesVirtualTryOn photoUrl={photo} seasonalColour={colourAnalysis?.season ?? null} />
              <FrameAIPanel sessionId={sessionId} photo={photo} isPremium onRequirePremium={() => {}} />
            </div>
          )}
        </div>

        {limitations.length > 0 && (
          <div style={{ marginTop: "3.2rem", padding: "2.4rem 2.8rem", background: "var(--wash)", borderRadius: "1.2rem" }}>
            <p style={{ fontSize: "1.2rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>Good to know</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {limitations.map((l, i) => <li key={i} style={{ fontSize: "1.3rem", color: "var(--secondary)", lineHeight: 1.6 }}>{l}</li>)}
            </ul>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "4.8rem" }}>
          <PrimaryButton fullWidth={false} variant="outline" onClick={() => router.push(`/report/${sessionId}/print`)}>
            Download report →
          </PrimaryButton>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .v2-metric-cols { grid-template-columns: 1fr !important; }
          .v2-hero-grid { grid-template-columns: 1fr !important; }
          .v2-hero-grid > div:first-child { max-width: 24rem; margin: 0 auto; }
        }
        @media (max-width: 700px) {
          .v2-guide-cols { grid-template-columns: 1fr !important; }
        }
        /* The tab strip scrolls sideways on narrow screens rather than
           wrapping to two rows, so the sticky header stays one line tall. */
        .v2-tabbar [role="tablist"]::-webkit-scrollbar { display: none; }
        @media (max-width: 600px) {
          .v2-routine-grid { grid-template-columns: 1fr !important; }
          /* Segments share the width equally and the decorative icons and long
             labels drop out, so all four fit the rail exactly. Previously the
             rail scrolled and clipped the last tab mid-word. */
          .v2-tabrail { padding: 0.4rem !important; gap: 0.2rem !important; overflow-x: visible !important; }
          .v2-tabrail button {
            flex: 1 1 0 !important; min-width: 0 !important; justify-content: center;
            padding: 1rem 0.4rem !important; font-size: 1.3rem !important; gap: 0 !important;
          }
          .v2-tab-icon { display: none !important; }
          .v2-tab-full { display: none !important; }
          .v2-tab-short { display: inline !important; }
          /* Four filters stacked into four full-width rows and ate a third of
             the screen. One compact scrollable row instead. */
          .v2-filter-label { display: none !important; }
          .v2-filter-row { flex-wrap: nowrap !important; overflow-x: auto; scrollbar-width: none; gap: 0.5rem !important; }
          .v2-filter-row::-webkit-scrollbar { display: none; }
          /* All four share the row rather than scrolling: a filter you cannot
             see is a filter nobody uses. */
          .v2-filter-row { flex-wrap: nowrap !important; gap: 0.4rem !important; }
          .v2-filter-row button {
            flex: 1 1 0 !important; min-width: 0 !important; justify-content: center;
            padding: 0.7rem 0.5rem !important; font-size: 1.2rem !important;
            border-width: 1px !important; gap: 0.4rem !important;
          }
          .v2-filter-dot { display: none !important; }
          .v2-filter-full { display: none !important; }
          .v2-filter-short { display: inline !important; }
          /* Bar + number would squeeze the metric name to a few characters at
             this width, so the row keeps name, status chip, and score only. */
          .v2-metric-bar > div:first-child { display: none !important; }
          .v2-metric-bar { flex: 0 0 auto !important; }
          /* Even without the bar, a name like "Sun-damage appearance" competing
             with the status chip on one line broke over three lines. Giving the
             name its own full-width row keeps every metric to two tidy lines. */
          .v2-metric-row { flex-wrap: wrap !important; gap: 0.7rem 1rem !important; padding: 1.3rem 0 !important; }
          .v2-metric-row > span:first-child { flex: 1 1 100% !important; }
        }
      `}</style>
    </div>
  );
}
