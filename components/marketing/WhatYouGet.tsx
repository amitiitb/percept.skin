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
 * "What you get" — five feature cards, each led by a real photograph
 * instead of the old hand-drawn SVG previews. The layout is a compact
 * stacked-card design: hero image on top, short copy underneath, three
 * bullet points, and a free/paid pill. Much less vertical space than the
 * old side-by-side grid while still being scannable.
 */

const GOLD = "#D9A62E";
const CORAL = "#E8604F";
const VIOLET = "#7C6CC4";

type Access = "free" | "paid";

interface Feature {
  id: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  blurb: string;
  points: string[];
  access: Access;
  accessNote: string;
  accent: string;
  image: string;
}

const FEATURES: Feature[] = [
  {
    id: "skin",
    icon: IconFaceScan,
    title: "Full skin & face profile",
    blurb:
      "20 scores from your photos — texture, tone, pores, hydration — each with the one thing to do about it.",
    points: [
      "Face proportion & symmetry",
      "Morning, evening & weekly routine",
      "First scores completely free",
    ],
    access: "free",
    accessNote: "Free preview",
    accent: "var(--rose)",
    image: "/images/wyg-skin.png",
  },
  {
    id: "colour",
    icon: IconPalette,
    title: "Colours that suit you",
    blurb:
      "Your season worked out from skin, hair & eyes — the palette to wear and the shades that wash you out.",
    points: [
      "Seasonal palette named & explained",
      "Colours to avoid, with reasons",
      "Draping previews on your photo",
    ],
    access: "paid",
    accessNote: "Full report",
    accent: GOLD,
    image: "/images/wyg-colour-v2.png",
  },
  {
    id: "hair",
    icon: IconScissors,
    title: "Hairstyles on your face",
    blurb:
      "Cuts matched to your face shape, rendered on your own photo — see it before the chair.",
    points: [
      "A cut for every occasion",
      "Hair & scalp health scored",
      "Regenerate for a new set",
    ],
    access: "paid",
    accessNote: "Full report",
    accent: CORAL,
    image: "/images/wyg-hair-v2.png",
  },
  {
    id: "frame",
    icon: IconGlasses,
    title: "Eyewear for your proportions",
    blurb:
      "Frames chosen for your face geometry and colour season, previewed on you.",
    points: [
      "Shapes fitted to your face",
      "Cross-checked with your colours",
      "Previewed on your own photo",
    ],
    access: "paid",
    accessNote: "Full report",
    accent: VIOLET,
    image: "/images/wyg-frames-v3.png",
  },
  {
    id: "live",
    icon: IconLiveCamera,
    title: "Live frame try-on",
    blurb:
      "Point your camera and frames track your face in real time. Everything runs on-device.",
    points: [
      "10 frame styles, switch instantly",
      "Tracks as you turn your head",
      "No scan or account needed",
    ],
    access: "free",
    accessNote: "Free, always",
    accent: "var(--rose)",
    image: "/images/wyg-live.png",
  },
];

/* ── Pill showing free vs paid ──────────────────────────────────────────── */

function AccessPill({ access, note }: { access: Access; note: string }) {
  const free = access === "free";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "1.05rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "0.4rem 1rem",
        borderRadius: "9999px",
        background: free ? "var(--rose)" : "rgba(255,255,255,0.08)",
        color: free ? "#fff" : "var(--secondary)",
        border: free ? "none" : "1px solid var(--line)",
        backdropFilter: free ? undefined : "blur(6px)",
      }}
    >
      {free && <IconCheck size={1.1} strokeWidth={2.8} />}
      {note}
    </span>
  );
}

/* ── Single feature card ────────────────────────────────────────────────── */

function FeatureCard({ f, index }: { f: Feature; index: number }) {
  const Icon = f.icon;
  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      className="wyg-card"
      style={{
        position: "relative",
        borderRadius: "2rem",
        overflow: "hidden",
        background: "var(--canvas)",
        border: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Image ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          overflow: "hidden",
        }}
      >
        <Image
          src={f.image}
          alt={f.title}
          fill
          sizes="(max-width: 860px) 100vw, 50vw"
          style={{ objectFit: "cover" }}
        />
        {/* Gradient scrim so the pill reads over the photo */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%)",
          }}
        />
        {/* Step number + pill, bottom-left over the image */}
        <div
          style={{
            position: "absolute",
            bottom: "1.4rem",
            left: "1.6rem",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
          }}
        >
          <span
            style={{
              fontSize: "1.15rem",
              fontWeight: 800,
              color: "#fff",
              opacity: 0.7,
              letterSpacing: "0.12em",
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <AccessPill access={f.access} note={f.accessNote} />
        </div>
      </div>

      {/* ── Copy ──────────────────────────────────────────────────── */}
      <div style={{ padding: "2rem 2.2rem 2.4rem", flex: 1 }}>
        {/* Icon + Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "0.8rem",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "3.6rem",
              height: "3.6rem",
              borderRadius: "1rem",
              background: f.accent,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Icon size={1.8} strokeWidth={2} />
          </span>
          <h3
            style={{
              fontSize: "clamp(1.7rem, 2.6vw, 2.2rem)",
              fontWeight: 600,
              color: "var(--primary)",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {f.title}
          </h3>
        </div>

        <p
          style={{
            fontSize: "1.4rem",
            color: "var(--secondary)",
            lineHeight: 1.55,
            margin: "0 0 1.6rem",
          }}
        >
          {f.blurb}
        </p>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
          }}
        >
          {f.points.map((p) => (
            <li
              key={p}
              style={{
                display: "flex",
                gap: "0.8rem",
                fontSize: "1.3rem",
                color: "var(--primary)",
                lineHeight: 1.45,
              }}
            >
              <span
                aria-hidden
                style={{
                  color: f.accent,
                  display: "flex",
                  marginTop: "0.1rem",
                  flexShrink: 0,
                }}
              >
                <IconCheck size={1.35} strokeWidth={2.6} />
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Accent top edge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "0.35rem",
          background: f.accent,
        }}
      />
    </motion.article>
  );
}

/* ── Main section ───────────────────────────────────────────────────────── */

export function WhatYouGet() {
  return (
    <section
      id="what-you-get"
      style={{
        padding: "6rem 2.4rem 7rem",
        background: "var(--surface)",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: "104rem", margin: "0 auto" }}>
        {/* Header */}
        <p
          style={{
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "var(--rose)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          What you get
        </p>
        <h2
          style={{
            fontSize: "clamp(2.6rem, 4.5vw, 3.8rem)",
            fontWeight: 400,
            color: "var(--primary)",
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: "52rem",
            margin: "0 auto 1.2rem",
          }}
        >
          Five readings from one set of photos
        </h2>
        <p
          style={{
            fontSize: "1.5rem",
            color: "var(--secondary)",
            textAlign: "center",
            maxWidth: "46rem",
            margin: "0 auto 4.5rem",
            lineHeight: 1.6,
          }}
        >
          Start free with real scores. Unlock everything for ${BUNDLE_PRICE}.
        </p>

        {/* ── Card grid: 2 cols on desktop, 1 col on mobile ─────── */}
        <div className="wyg-grid">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.id} f={f} index={i} />
          ))}
        </div>

        {/* ── CTA ───────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: "1.2rem",
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: "4rem",
          }}
        >
          <a href="/splash">
            <PrimaryLink>
              Start your free scan
              <IconArrowRight size={1.6} strokeWidth={2} />
            </PrimaryLink>
          </a>
          <a
            href="#pricing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "5.4rem",
              padding: "0 2.8rem",
              borderRadius: "9999px",
              border: "1px solid var(--line-strong)",
              color: "var(--primary)",
              fontSize: "1.55rem",
              fontWeight: 500,
            }}
          >
            See what ${BUNDLE_PRICE} unlocks
          </a>
        </div>
      </div>

      <style>{`
        .wyg-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2rem;
        }
        /* Let the 5th card (live try-on) span full width on desktop */
        .wyg-grid > :nth-child(5) {
          grid-column: 1 / -1;
        }
        .wyg-grid > :nth-child(5) .wyg-card {
          max-width: 100%;
        }
        /* On the full-width 5th card, use side-by-side layout */
        @media (min-width: 861px) {
          .wyg-grid > :nth-child(5) {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border-radius: 2rem;
            overflow: hidden;
            background: var(--canvas);
            border: 1px solid var(--line);
            position: relative;
          }
        }
        .wyg-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        @media (hover: hover) {
          .wyg-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 1.2rem 3.6rem rgba(0,0,0,0.1);
          }
        }
        @media (max-width: 860px) {
          .wyg-grid {
            grid-template-columns: 1fr !important;
          }
          .wyg-grid > :nth-child(5) {
            grid-column: auto;
          }
        }
      `}</style>
    </section>
  );
}

/* ── Local CTA link (not a button, since it sits inside <a>) ──────────── */
function PrimaryLink({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "5.4rem",
        padding: "0 2.8rem",
        borderRadius: "9999px",
        background: "var(--btn-fill)",
        color: "var(--btn-fill-ink)",
        fontSize: "1.55rem",
        fontWeight: 500,
        whiteSpace: "nowrap",
        gap: "0.8rem",
      }}
    >
      {children}
    </span>
  );
}
