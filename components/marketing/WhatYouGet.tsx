"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { BUNDLE_PRICE } from "@/lib/v2/reportModules";
import {
  IconCheck,
  IconArrowRight,
  IconFaceScan,
  IconPalette,
  IconScissors,
  IconGlasses,
  IconLiveCamera,
} from "@/components/ui/icons";

/**
 * "Five analysis systems" — an alternating editorial layout (visual|copy,
 * copy|visual...) instead of five equal cards in a grid, so Skin can read
 * as the featured, dominant system and the section has one clear focal
 * point per row rather than five objects competing for attention.
 */

const GOLD = "#D9A62E";
const CORAL = "#E8604F";
const VIOLET = "#7C6CC4";

type Access = "free" | "paid";

interface Feature {
  id: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  emoji: string;
  title: string;
  blurb: string;
  points: string[];
  access: Access;
  accessNote: string;
  accent: string;
  image: string;
  /** Matches each image's real pixel dimensions so object-fit:cover never
   *  crops any of it — these are pre-composed dashboard screenshots, not
   *  portraits, so losing an edge loses real UI content. */
  aspect: string;
}

const FEATURES: Feature[] = [
  {
    id: "skin",
    icon: IconFaceScan,
    emoji: "🧴",
    title: "Skin",
    blurb: "20 scores from your photos: texture, tone, pores, hydration, each with the one thing to do about it.",
    points: ["Face proportion & symmetry", "Morning, evening & weekly routine", "First scores free"],
    access: "free",
    accessNote: "Free preview",
    accent: "var(--rose)",
    image: "/images/wyg-skin-v6.png",
    aspect: "1672/941",
  },
  {
    id: "colour",
    icon: IconPalette,
    emoji: "🎨",
    title: "Colour",
    blurb: "Your season, worked out from skin, hair and eyes: the palette to wear and the shades that wash you out.",
    points: ["Seasonal palette, named", "Draping preview on your photo"],
    access: "paid",
    accessNote: "Full report",
    accent: GOLD,
    image: "/images/wyg-colour-v4.png",
    aspect: "1672/941",
  },
  {
    id: "hair",
    icon: IconScissors,
    emoji: "💇",
    title: "Hair",
    blurb: "Cuts matched to your face shape, rendered on your own photo. See it before the chair.",
    points: ["A cut for every occasion", "Hair & scalp health scored"],
    access: "paid",
    accessNote: "Full report",
    accent: CORAL,
    image: "/images/wyg-hair-v4.png",
    aspect: "1672/941",
  },
  {
    id: "frame",
    icon: IconGlasses,
    emoji: "👓",
    title: "Face & Eyewear",
    blurb: "Frames and contact lens colours chosen for your face geometry and colour season, previewed on you.",
    points: ["Frame shapes fitted to your proportions", "Contact lens colours cross-checked with your palette"],
    access: "paid",
    accessNote: "Full report",
    accent: VIOLET,
    image: "/images/wyg-eyecolour-v4.png",
    aspect: "1402/1122",
  },
  {
    id: "live",
    icon: IconLiveCamera,
    emoji: "🎥",
    title: "Live try-on",
    blurb: "Point your camera. Frames track your face in real time, entirely on-device.",
    points: ["10 styles, switch instantly", "No scan or account needed"],
    access: "free",
    accessNote: "Free, always",
    accent: "var(--rose)",
    image: "/images/wyg-live.png",
    aspect: "1/1",
  },
];

function AccessPill({ access, note }: { access: Access; note: string }) {
  const free = access === "free";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.5rem",
        fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        padding: "0.4rem 1rem", borderRadius: "9999px",
        background: free ? "var(--ink)" : "rgba(255,255,255,0.9)",
        color: free ? "var(--bg-neutral)" : "var(--ink-secondary)",
        border: free ? "none" : "1px solid var(--border-neutral)",
      }}
    >
      {free && <IconCheck size={1.1} strokeWidth={2.8} />}
      {note}
    </span>
  );
}

function Visual({ f }: { f: Feature }) {
  return (
    <div
      className="pg-card"
      style={{ position: "relative", width: "100%", maxHeight: "42rem", aspectRatio: f.aspect, overflow: "hidden" }}
    >
      <Image src={f.image} alt={f.title} fill sizes="(max-width: 900px) 100vw, 60vw" style={{ objectFit: "cover" }} />
    </div>
  );
}

function Copy({ f }: { f: Feature }) {
  const Icon = f.icon;
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.4rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "4rem", height: "4rem", borderRadius: "1.2rem", background: f.accent, color: "#fff", flexShrink: 0 }}>
          <Icon size={1.9} strokeWidth={2} />
        </span>
        <AccessPill access={f.access} note={f.accessNote} />
      </div>
      <h3 className="pg-card-h" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span aria-hidden style={{ fontSize: "2.4rem" }}>{f.emoji}</span>
        {f.title}
      </h3>
      <p className="pg-body" style={{ maxWidth: "44rem" }}>{f.blurb}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        {f.points.map((p) => (
          <li key={p} style={{ display: "flex", gap: "0.8rem", fontSize: "1.4rem", color: "var(--ink)" }}>
            <span aria-hidden style={{ color: f.accent, display: "flex", marginTop: "0.15rem" }}>
              <IconCheck size={1.35} strokeWidth={2.6} />
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ f, index, reverse }: { f: Feature; index: number; reverse: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.24, 0.43, 0.15, 0.97], delay: index * 0.04 }}
      className="wyg-row"
      style={{
        display: "grid",
        gridTemplateColumns: index === 0 ? "1.7fr 1fr" : "1fr 1fr",
        gap: "4.8rem",
        alignItems: "center",
        direction: reverse ? "rtl" : "ltr",
      }}
    >
      <div style={{ direction: "ltr" }}><Visual f={f} /></div>
      <div style={{ direction: "ltr" }}><Copy f={f} /></div>
    </motion.div>
  );
}

export function WhatYouGet() {
  const [skin, ...rest] = FEATURES;
  const live = rest.pop()!;

  return (
    <section id="what-you-get" className="pg-section" style={{ background: "var(--bg-neutral)" }}>
      <div className="pg-container" style={{ display: "flex", flexDirection: "column", gap: "8rem" }}>
        <div style={{ maxWidth: "72rem" }}>
          <p className="pg-eyebrow" style={{ marginBottom: "1.6rem" }}>What you get</p>
          <h2 className="pg-h2" style={{ marginBottom: "1.6rem" }}>One scan. Multiple ways to understand your appearance.</h2>
          <p className="pg-body">Skin, colour, hair, and eyewear, read from the same set of photos. Full report ${BUNDLE_PRICE}.</p>
        </div>

        <Row f={skin} index={0} reverse={false} />
        {rest.map((f, i) => (
          <Row key={f.id} f={f} index={i + 1} reverse={i % 2 === 0} />
        ))}

        {/* Live try-on — distinct treatment: full-width band, not a row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.24, 0.43, 0.15, 0.97] }}
          className="pg-card wyg-live"
          style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1.2fr 1fr", minHeight: "32rem" }}
        >
          <div style={{ padding: "4rem", display: "flex", flexDirection: "column", justifyContent: "center", gap: "1.4rem" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "4rem", height: "4rem", borderRadius: "1.2rem", background: "var(--ink)", color: "var(--bg-neutral)" }}>
              <IconLiveCamera size={2} strokeWidth={2} />
            </span>
            <h3 className="pg-card-h" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span aria-hidden style={{ fontSize: "2.4rem" }}>{live.emoji}</span>
              {live.title}
            </h3>
            <p className="pg-body">{live.blurb}</p>
            <a href="/splash" style={{ display: "inline-flex", alignItems: "center", gap: "0.8rem", fontSize: "1.5rem", fontWeight: 600, color: "var(--ink)", width: "fit-content" }}>
              Try it now <IconArrowRight size={1.5} strokeWidth={2} />
            </a>
          </div>
          <div style={{ position: "relative" }}>
            <Image src={live.image} alt={live.title} fill sizes="40vw" style={{ objectFit: "cover" }} />
          </div>
        </motion.div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <a href="/splash">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.8rem", height: "5.4rem", padding: "0 3.2rem", borderRadius: "9999px", background: "var(--ink)", color: "var(--bg-neutral)", fontSize: "1.6rem", fontWeight: 600 }}>
              Start your free scan <IconArrowRight size={1.6} strokeWidth={2} />
            </span>
          </a>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.wyg-row) { grid-template-columns: 1fr !important; direction: ltr !important; }
          :global(.wyg-live) { grid-template-columns: 1fr !important; }
          :global(.wyg-live) > div:last-child { min-height: 24rem; }
        }
      `}</style>
    </section>
  );
}
