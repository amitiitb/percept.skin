"use client";
import { motion } from "framer-motion";
import { BUNDLE_PRICE } from "@/lib/v2/reportModules";
import { IconLock, IconCheck, IconArrowRight } from "@/components/ui/icons";

/**
 * The five things a scan actually produces, on the landing page.
 *
 * Two rules shaped it. First, every feature gets its own drawn preview rather
 * than an icon in a box: a palette, a haircut, and a frame are different kinds
 * of thing and should not look identical. Second, the layout alternates side
 * to side down the page and each row carries its own accent, so it reads as a
 * sequence rather than a grid of five squares.
 *
 * The free/paid pill on each row is the whole point of the section: skin gives
 * a real preview and the live try-on is free outright, everything else needs
 * the bundle. That boundary is stated per feature, not buried in the pricing
 * table further down.
 */

const GOLD = "#D9A62E";
const CORAL = "#E8604F";
const VIOLET = "#7C6CC4";

type Access = "free" | "paid";

interface Feature {
  id: string;
  title: string;
  blurb: string;
  points: string[];
  access: Access;
  accessNote: string;
  accent: string;
  visual: React.ReactNode;
}

/* ── 1. Skin: score rows, the first few readable and the rest locked ─────── */

const SKIN_ROWS: Array<{ name: string; score: number; free: boolean }> = [
  { name: "Hydration", score: 74, free: true },
  { name: "Texture", score: 61, free: true },
  { name: "Pore visibility", score: 48, free: true },
  { name: "Even tone", score: 66, free: false },
  { name: "Fine lines", score: 55, free: false },
  { name: "Jawline definition", score: 71, free: false },
];

function bandColour(score: number): string {
  if (score >= 70) return "#2E7D5B";
  if (score >= 55) return "var(--rose)";
  if (score >= 40) return GOLD;
  return CORAL;
}

function SkinPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
      {SKIN_ROWS.map((r, i) => (
        <motion.div
          key={r.name}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35, delay: i * 0.06 }}
          style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}
        >
          <span style={{
            flex: "1 1 auto", minWidth: 0, fontSize: "1.4rem", color: "var(--primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{r.name}</span>
          <div
            aria-hidden={!r.free}
            style={{
              display: "flex", alignItems: "center", gap: "1rem", flex: "0 0 11rem",
              filter: r.free ? "none" : "blur(4px)", opacity: r.free ? 1 : 0.55, userSelect: r.free ? "auto" : "none",
            }}
          >
            <div style={{ flex: 1, height: "0.5rem", borderRadius: "9999px", background: "var(--line)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${r.score}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.06 }}
                style={{ height: "100%", borderRadius: "9999px", background: bandColour(r.score) }}
              />
            </div>
            <span style={{ fontSize: "1.4rem", fontWeight: 700, color: bandColour(r.score), width: "2.4rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {r.score}
            </span>
          </div>
          {!r.free && <span style={{ display: "flex", color: "var(--muted)" }}><IconLock size={1.4} title="Locked" /></span>}
        </motion.div>
      ))}
    </div>
  );
}

/* ── 2. Colour: the shades that work, then the ones that do not ─────────── */

const SUITS = ["#8B4513", "#C8503A", "#B8860B", "#556B2F", "#D2691E", "#6B4423"];
const AVOIDS = ["#AED6F1", "#D7BDE2", "#AAB7B8"];

function ColourPreview() {
  return (
    <div>
      <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 1rem" }}>WEAR THESE</p>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "2rem", paddingLeft: "0.3rem" }}>
        {SUITS.map((c, i) => (
          <motion.span
            key={c}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.05 }}
            style={{
              width: "4rem", height: "4rem", borderRadius: "50%", background: c, flexShrink: 0,
              marginLeft: i === 0 ? 0 : "-1.1rem", border: "2px solid var(--surface)",
              boxShadow: "0 0.2rem 0.6rem rgba(0,0,0,0.14)", zIndex: SUITS.length - i,
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--muted)", letterSpacing: "0.1em", margin: "0 0 1rem" }}>SKIP THESE</p>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {AVOIDS.map((c) => (
          <span key={c} style={{ position: "relative", width: "3rem", height: "3rem", borderRadius: "50%", background: c, opacity: 0.55, flexShrink: 0 }}>
            <span aria-hidden style={{
              position: "absolute", left: "-0.3rem", right: "-0.3rem", top: "50%",
              height: "2px", background: "var(--secondary)", transform: "rotate(-38deg)", borderRadius: "2px",
            }} />
          </span>
        ))}
        <span style={{ fontSize: "1.35rem", color: "var(--secondary)" }}>drain your complexion</span>
      </div>
    </div>
  );
}

/* ── 3. Hairstyles: occasion-labelled cards, generated on your own photo ── */

// One head, three cuts. The face, ears and shoulders are identical in all
// three and only the hair mass changes, which is what makes the difference
// between the styles legible at this size — redraw the head each time and the
// eye reads three different people rather than three haircuts.
// Each cut is one filled shape over the same head. The three differ in
// outline, not detail: a cap that stops above the ears, a length that falls
// past the jaw, and a taller textured mass. Anything finer than that
// disappears at this size and the three read as the same haircut.
const CUTS = [
  {
    label: "Office",
    // Short, neat, tight to the skull.
    hair: "M18 33q0-19 16-19t16 19q-1-10-6-12-4 4-10 4t-10-3q-5 2-6 11Z",
  },
  {
    label: "Wedding",
    // Same cap, plus two lengths falling to the shoulder line.
    hair: "M18 34q0-20 16-20t16 20q-1-11-6-13-4 4-10 4t-10-3q-5 2-6 12Z M16.5 30q-3.5 15-1.5 27 5-13 4.5-27Z M51.5 30q3.5 15 1.5 27-5-13-4.5-27Z",
  },
  {
    label: "Weekend",
    // Volume on top, so the silhouette sits higher than the other two.
    hair: "M16 34q-2-13 5-19 3 4 7 1 2 4 7 2 2 4 6 2 5 5 4 14-2-9-7-11-4 4-10 4t-10-3q-5 2-6 11Z M16 34q-2 8 0 15 2-7 0-15Z M52 34q2 8 0 15-2-7 0-15Z",
  },
];

function HairPreview() {
  return (
    <div style={{ display: "flex", gap: "1.2rem" }}>
      {CUTS.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          style={{
            flex: 1, minWidth: 0, background: "var(--wash)", borderRadius: "1.2rem",
            padding: "1.4rem 0.8rem 1.1rem", textAlign: "center", border: "1px solid var(--line)",
          }}
        >
          <svg viewBox="4 6 60 62" width="100%" height="10rem" aria-hidden style={{ display: "block" }}>
            {/* Shoulders, so the head has a body to sit on and the silhouette
                reads as a portrait rather than a floating oval. */}
            <path d="M14 72q2-11 20-13t20 13Z" fill="var(--sage)" />
            <path d="M28 52h12v8H28Z" fill="var(--sage)" />
            <ellipse cx="34" cy="36" rx="14" ry="17.5" fill="var(--sage)" />
            <path d="M19 34a2.6 2.6 0 0 0 0 5.2M49 34a2.6 2.6 0 0 1 0 5.2" fill="var(--sage)" />
            <path d={c.hair} fill="var(--primary)" opacity="0.85" />
            <circle cx="29" cy="36" r="1.3" fill="var(--surface)" />
            <circle cx="39" cy="36" r="1.3" fill="var(--surface)" />
            <path d="M31 44q3 2 6 0" fill="none" stroke="var(--surface)" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
          </svg>
          <p style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--primary)", margin: "0.6rem 0 0" }}>{c.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

/* ── 4. Frames: shape outlines fitted to face proportions ───────────────── */

// Drawn on one 64×26 grid with a shared geometry: lens centres at x=18 and
// x=46, a bridge across the middle, and temple arms running off both edges.
// Only the lens outline changes between them, which is what actually
// distinguishes the four shapes — vary the construction as well and they stop
// reading as one family of frames.
const FRAME_SHAPES: Array<{ name: string; lens: React.ReactNode }> = [
  {
    name: "Wayfarer",
    lens: <><path d="M6 8h24v7.5a5 5 0 0 1-5 5h-14a5 5 0 0 1-5-5Z" /><path d="M34 8h24v7.5a5 5 0 0 1-5 5H39a5 5 0 0 1-5-5Z" /></>,
  },
  {
    name: "Round",
    lens: <><circle cx="18" cy="14" r="9" /><circle cx="46" cy="14" r="9" /></>,
  },
  {
    name: "Cat eye",
    lens: <><path d="M7 8.5q6-4.5 22-1.5-1 12-11 13T7 8.5Z" /><path d="M57 8.5q-6-4.5-22-1.5 1 12 11 13t11-11.5Z" /></>,
  },
  {
    name: "Rimless",
    lens: <><path d="M7 8h22v6a5 5 0 0 1-5 5h-12a5 5 0 0 1-5-5Z" strokeDasharray="0.1 3.4" /><path d="M12 19h12" /><path d="M35 8h22v6a5 5 0 0 1-5 5H40a5 5 0 0 1-5-5Z" strokeDasharray="0.1 3.4" /><path d="M40 19h12" /></>,
  },
];

function FramePreview() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
      {FRAME_SHAPES.map((f, i) => (
        <motion.div
          key={f.name}
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35, delay: i * 0.08 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem",
            padding: "1.6rem 1.2rem 1.2rem", borderRadius: "1.2rem", border: "1px solid var(--line)", background: "var(--wash)",
          }}
        >
          <svg
            viewBox="0 0 64 26" width="100%" height="3.2rem" fill="none" stroke="var(--primary)"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden
            style={{ display: "block", maxWidth: "11rem" }}
          >
            {f.lens}
            <path d="M30 10.5h4" />
            <path d="M6 8 1 5.5M58 8l5-2.5" />
          </svg>
          <span style={{ fontSize: "1.25rem", color: "var(--primary)", fontWeight: 600 }}>{f.name}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── 5. Live try-on: the camera view, not a still ────────────────────────── */

function LivePreview() {
  return (
    <div style={{
      position: "relative", borderRadius: "1.6rem", overflow: "hidden",
      background: "var(--panel)", aspectRatio: "4/3", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg viewBox="0 0 120 100" width="60%" aria-hidden style={{ display: "block" }}>
        <ellipse cx="60" cy="52" rx="30" ry="38" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" />
        <motion.g
          initial={{ opacity: 0, y: -6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <rect x="34" y="42" width="22" height="15" rx="4" fill="none" stroke="var(--rose)" strokeWidth="2.4" />
          <rect x="64" y="42" width="22" height="15" rx="4" fill="none" stroke="var(--rose)" strokeWidth="2.4" />
          <path d="M56 48h8" stroke="var(--rose)" strokeWidth="2.4" />
        </motion.g>
        <path d="M50 74q10 6 20 0" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>

      {/* Corner brackets, the visual grammar of a live viewfinder rather than a photo */}
      {[
        { top: "1.2rem", left: "1.2rem", borderTop: "2px solid", borderLeft: "2px solid" },
        { top: "1.2rem", right: "1.2rem", borderTop: "2px solid", borderRight: "2px solid" },
        { bottom: "1.2rem", left: "1.2rem", borderBottom: "2px solid", borderLeft: "2px solid" },
        { bottom: "1.2rem", right: "1.2rem", borderBottom: "2px solid", borderRight: "2px solid" },
      ].map((pos, i) => (
        <span key={i} aria-hidden style={{ position: "absolute", width: "1.8rem", height: "1.8rem", borderColor: "rgba(255,255,255,0.4)", ...pos }} />
      ))}

      <span style={{
        position: "absolute", top: "1.2rem", left: "50%", transform: "translateX(-50%)",
        display: "inline-flex", alignItems: "center", gap: "0.6rem",
        background: "rgba(0,0,0,0.4)", borderRadius: "9999px", padding: "0.4rem 1.2rem",
        fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.1em", color: "#fff",
      }}>
        <motion.span
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ width: "0.7rem", height: "0.7rem", borderRadius: "50%", background: CORAL, display: "block" }}
        />
        LIVE
      </span>
    </div>
  );
}

const FEATURES: Feature[] = [
  {
    id: "skin",
    title: "Your full skin and face profile",
    blurb: "Twenty separate scores from your own photos, each with what the model saw and the one thing to do about it.",
    points: ["Texture, tone, pores, hydration, fine lines", "Face proportion and symmetry", "A morning, evening and weekly routine"],
    access: "free",
    accessNote: "First scores free",
    accent: "var(--rose)",
    visual: <SkinPreview />,
  },
  {
    id: "colour",
    title: "The colours that suit you, and the ones that don't",
    blurb: "Your season worked out from your skin, hair and eyes, with the palette to wear and the shades that wash you out.",
    points: ["Your seasonal palette named and explained", "Colours to avoid, with the reason", "Draping previews on your own photo"],
    access: "paid",
    accessNote: "In the full report",
    accent: GOLD,
    visual: <ColourPreview />,
  },
  {
    id: "hair",
    title: "Hairstyles generated on your face",
    blurb: "Cuts matched to your face shape and hairline, rendered on your own photo so you see it before the chair, not after.",
    points: ["A cut for each occasion", "Hair and scalp health scored separately", "Regenerate for a different set"],
    access: "paid",
    accessNote: "In the full report",
    accent: CORAL,
    visual: <HairPreview />,
  },
  {
    id: "frame",
    title: "Eyewear matched to your proportions",
    blurb: "Frame shapes chosen for your face, then previewed on you, so the shortlist is yours rather than the shop's bestsellers.",
    points: ["Shapes fitted to your face geometry", "Cross-checked against your colour season", "Previewed on your own photo"],
    access: "paid",
    accessNote: "In the full report",
    accent: VIOLET,
    visual: <FramePreview />,
  },
  {
    id: "live",
    title: "Live frame try-on in your browser",
    blurb: "Point your camera and the frames track your face in real time. Nothing uploads, nothing renders on a server, it runs on your device.",
    points: ["Ten frame styles, switch instantly", "Tracks as you turn your head", "Works without a scan or an account"],
    access: "free",
    accessNote: "Free, always",
    accent: "var(--rose)",
    visual: <LivePreview />,
  },
];

function AccessPill({ access, note }: { access: Access; note: string }) {
  const free = access === "free";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.6rem", flexShrink: 0,
      fontSize: "1.15rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "0.5rem 1.2rem", borderRadius: "9999px",
      background: free ? "var(--rose)" : "var(--wash)",
      color: free ? "#fff" : "var(--secondary)",
      border: free ? "none" : "1px solid var(--line)",
    }}>
      {free && <IconCheck size={1.3} strokeWidth={2.6} />}
      {note}
    </span>
  );
}

export function WhatYouGet() {
  return (
    <section id="what-you-get" style={{ padding: "8rem 3.2rem", background: "var(--surface)", position: "relative" }}>
      <div style={{ maxWidth: "104rem", margin: "0 auto" }}>
        <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "1.2rem", textAlign: "center" }}>
          What you get
        </p>
        <h2 style={{ fontSize: "clamp(2.8rem, 5vw, 4rem)", fontWeight: 400, color: "var(--primary)", textAlign: "center", lineHeight: 1.15, maxWidth: "58rem", margin: "0 auto 1.6rem" }}>
          Five readings from one set of photos
        </h2>
        <p style={{ fontSize: "1.6rem", color: "var(--secondary)", textAlign: "center", maxWidth: "52rem", margin: "0 auto 6rem", lineHeight: 1.6 }}>
          Start free and see real scores from your own scan. The rest unlocks together for ${BUNDLE_PRICE}.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {FEATURES.map((f, i) => (
            <motion.article
              key={f.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className={i % 2 === 1 ? "wyg-row wyg-row-flip" : "wyg-row"}
              style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center",
                background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "2rem",
                borderTop: `0.4rem solid ${f.accent}`, padding: "3.2rem",
              }}
            >
              <div className="wyg-copy">
                <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "1.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, color: f.accent, letterSpacing: "0.12em" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <AccessPill access={f.access} note={f.accessNote} />
                </div>
                <h3 style={{ fontSize: "clamp(2rem, 3.2vw, 2.6rem)", fontWeight: 500, color: "var(--primary)", lineHeight: 1.2, margin: "0 0 1.2rem" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: "1.55rem", color: "var(--secondary)", lineHeight: 1.6, margin: "0 0 2rem" }}>{f.blurb}</p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  {f.points.map((p) => (
                    <li key={p} style={{ display: "flex", gap: "1rem", fontSize: "1.4rem", color: "var(--primary)", lineHeight: 1.5 }}>
                      <span aria-hidden style={{ color: f.accent, display: "flex", marginTop: "0.15rem" }}><IconCheck size={1.5} strokeWidth={2.4} /></span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="wyg-visual" style={{ minWidth: 0 }}>{f.visual}</div>
            </motion.article>
          ))}
        </div>

        <div style={{ display: "flex", gap: "1.2rem", justifyContent: "center", flexWrap: "wrap", marginTop: "4rem" }}>
          <a href="/splash"><PrimaryLink>Start your free scan<IconArrowRight size={1.6} strokeWidth={2} /></PrimaryLink></a>
          <a href="#pricing" style={{
            display: "inline-flex", alignItems: "center", height: "5.8rem", padding: "0 3.2rem",
            borderRadius: "9999px", border: "1px solid var(--line-strong)", color: "var(--primary)",
            fontSize: "1.7rem", fontWeight: 500,
          }}>
            See what ${BUNDLE_PRICE} unlocks
          </a>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .wyg-row { grid-template-columns: 1fr !important; gap: 2.8rem !important; padding: 2.4rem !important; }
          /* The visual leads on a phone: it is what makes the feature legible
             at a glance, and a wall of five text blocks reads as a list of
             claims rather than a set of things you get. */
          .wyg-row .wyg-visual { order: -1; }
        }
        @media (min-width: 861px) {
          /* Alternating sides so the eye zig-zags down the page instead of
             tracking one straight column of identical cards. */
          .wyg-row-flip .wyg-copy   { order: 2; }
          .wyg-row-flip .wyg-visual { order: 1; }
        }
      `}</style>
    </section>
  );
}

// Local rather than the shared PrimaryButton: that one is a <button> and this
// sits inside an <a>, which nests interactive elements.
function PrimaryLink({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: "5.8rem", padding: "0 3.2rem",
      borderRadius: "9999px", background: "var(--btn-fill)", color: "var(--btn-fill-ink)",
      fontSize: "1.7rem", fontWeight: 500, whiteSpace: "nowrap", gap: "0.8rem",
    }}>
      {children}
    </span>
  );
}
