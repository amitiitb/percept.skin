"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { BUNDLE_PRICE } from "@/lib/v2/reportModules";
import { IconArrowRight, IconCheck, IconFaceScan, IconGlasses, IconLiveCamera, IconPalette, IconScissors } from "@/components/ui/icons";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type Feature = {
  id: string;
  title: string;
  blurb: string;
  note: string;
  accent: string;
  image: string;
  aspect: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const FEATURES: Feature[] = [
  { id: "skin", title: "Skin", blurb: "20 scores for texture, tone, pores and hydration — plus what to do next.", note: "First scores free", accent: "#1A9E8F", image: "/marketing/what-you-get/skin.png", aspect: "1672 / 941", icon: IconFaceScan },
  { id: "colour", title: "Colour", blurb: "Your season, best palette and the shades that wash you out.", note: "Full report", accent: "#D9A62E", image: "/marketing/what-you-get/colour.png", aspect: "1672 / 941", icon: IconPalette },
  { id: "hair", title: "Hair", blurb: "Cuts matched to your face shape and rendered on your photo.", note: "Full report", accent: "#E8604F", image: "/marketing/what-you-get/hair.png", aspect: "1672 / 941", icon: IconScissors },
  { id: "frame", title: "Face & eyewear", blurb: "Frames and lens colours selected for your geometry and palette.", note: "Full report", accent: "#7C6CC4", image: "/marketing/what-you-get/eyecolour.png", aspect: "1402 / 1122", icon: IconGlasses },
  { id: "live", title: "Live try-on", blurb: "Try 10 frame styles in real time. Face tracking stays on your device.", note: "Free, always", accent: "#2BB6A4", image: "/marketing/what-you-get/live.png", aspect: "1 / 1", icon: IconLiveCamera },
];

export function WhatYouGet() {
  const [activeId, setActiveId] = useState(FEATURES[0].id);
  const active = FEATURES.find((feature) => feature.id === activeId) ?? FEATURES[0];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentIndex = FEATURES.findIndex((feature) => feature.id === activeId);
      setActiveId(FEATURES[(currentIndex + 1) % FEATURES.length].id);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [activeId]);

  return (
    <section id="what-you-get" className="pg-section wyg-section">
      <div className="pg-container wyg-container">
        <div className="wyg-heading">
          <div>
            <p className="pg-eyebrow">What you get</p>
            <h2 className="pg-h2">One scan. Five ways to see what suits you.</h2>
          </div>
          <div className="wyg-intro">
            <p>Skin, colour, hair and eyewear insights from the same guided photos.</p>
            <span>Complete report · ${BUNDLE_PRICE} one-time</span>
          </div>
        </div>

        <div className="wyg-showcase">
          <div className="wyg-selector" role="tablist" aria-label="Analysis features">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              const selected = feature.id === active.id;
              return (
                <button
                  key={feature.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="feature-preview"
                  className={`wyg-option${selected ? " is-active" : ""}`}
                  style={{ ["--feature-accent" as string]: feature.accent }}
                  onClick={() => setActiveId(feature.id)}
                >
                  <span className="wyg-option-number">0{index + 1}</span>
                  <span className="wyg-option-icon"><Icon size={1.55} strokeWidth={2} /></span>
                  <span className="wyg-option-copy"><strong>{feature.title}</strong><small>{feature.blurb}</small></span>
                  <span className="wyg-option-arrow">→</span>
                </button>
              );
            })}
          </div>

          <div id="feature-preview" className="wyg-stage" role="tabpanel">
            <div className="wyg-stage-head">
              <span style={{ ["--feature-accent" as string]: active.accent }}><IconCheck size={1.1} strokeWidth={2.8} />{active.note}</span>
              <strong>{active.title}</strong>
            </div>
            <div className="wyg-stage-image">
              <AnimatePresence mode="wait">
                <motion.div key={active.id} className="wyg-stage-frame" initial={{ opacity: 0, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .24 }}>
                  <Image src={active.image} alt={`${active.title} analysis preview`} fill sizes="(max-width: 800px) 100vw, 850px" priority={active.id === "skin"} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="wyg-thumbs" aria-label="Choose preview">
              {FEATURES.map((feature) => (
                <button key={feature.id} type="button" className={feature.id === active.id ? "is-active" : ""} onClick={() => setActiveId(feature.id)} aria-label={`Show ${feature.title}`}>
                  <Image src={feature.image} alt="" fill sizes="100px" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="wyg-action">
          <a href="/splash"><PrimaryButton size="md" fullWidth={false}>Start your free scan <IconArrowRight size={1.5} /></PrimaryButton></a>
          <span>No app download · under 2 minutes</span>
        </div>
      </div>

      {/* Global on purpose: FeatureCard is a child component, so parent-scoped
          styled-jsx selectors cannot reach its generated markup. */}
      <style jsx global>{`
        .wyg-section { position: relative; background: var(--chapter-tint); }
        .wyg-container { max-width: none; padding-inline: clamp(1.6rem, 3vw, 4.8rem); }
        .wyg-heading { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(28rem, .75fr); gap: 5rem; align-items: end; margin-bottom: 3.6rem; }
        .wyg-heading :global(.pg-eyebrow) { margin: 0 0 1.2rem; }
        .wyg-heading :global(.pg-h2) { max-width: 72rem; font-size: clamp(3.4rem, 4vw, 5.6rem); }
        .wyg-intro p { margin: 0 0 1rem; color: var(--ink-secondary); font-size: 1.55rem; line-height: 1.55; }
        .wyg-intro span { color: var(--ink); font-size: 1.2rem; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
        .wyg-showcase { display: grid; grid-template-columns: minmax(30rem, .72fr) minmax(0, 1.28fr); min-height: 55rem; background: var(--surface-neutral); border: 1px solid var(--border-neutral); }
        .wyg-selector { display: flex; flex-direction: column; border-right: 1px solid var(--border-neutral); }
        .wyg-option { flex: 1; display: grid; grid-template-columns: 2.4rem 3.8rem minmax(0, 1fr) auto; align-items: center; gap: 1.2rem; width: 100%; padding: 1.5rem 1.8rem; color: var(--ink); text-align: left; border-bottom: 1px solid var(--border-neutral); transition: background .2s ease; }
        .wyg-option:last-child { border-bottom: 0; }
        .wyg-option:hover { background: color-mix(in srgb, var(--feature-accent) 7%, var(--surface-neutral)); }
        .wyg-option.is-active { background: color-mix(in srgb, var(--feature-accent) 12%, var(--surface-neutral)); box-shadow: inset 3px 0 0 var(--feature-accent); }
        .wyg-option.is-active::after { content: ""; position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; background: var(--feature-accent); transform-origin: left; animation: wygTimer 4.5s linear forwards; }
        .wyg-option { position: relative; overflow: hidden; }
        .wyg-option-number { color: var(--ink-secondary); font-size: 1rem; font-weight: 700; letter-spacing: .08em; }
        .wyg-option-icon { display: grid; place-items: center; width: 3.8rem; height: 3.8rem; color: var(--feature-accent); background: color-mix(in srgb, var(--feature-accent) 12%, transparent); }
        .wyg-option-copy { min-width: 0; }
        .wyg-option-copy strong { display: block; margin-bottom: .35rem; font-size: 1.55rem; font-weight: 650; }
        .wyg-option-copy small { display: -webkit-box; overflow: hidden; color: var(--ink-secondary); font-size: 1.1rem; line-height: 1.4; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .wyg-option-arrow { color: var(--feature-accent); font-size: 1.6rem; opacity: 0; transform: translateX(-.4rem); transition: opacity .2s, transform .2s; }
        .wyg-option.is-active .wyg-option-arrow { opacity: 1; transform: none; }
        .wyg-stage { min-width: 0; padding: 1.8rem; background: var(--bg-neutral); }
        .wyg-stage-head { display: flex; align-items: center; justify-content: space-between; min-height: 3.2rem; margin-bottom: 1.2rem; }
        .wyg-stage-head > span { display: inline-flex; align-items: center; gap: .45rem; padding: .5rem .8rem; color: var(--feature-accent); background: color-mix(in srgb, var(--feature-accent) 12%, transparent); font-size: 1rem; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; }
        .wyg-stage-head strong { color: var(--ink-secondary); font-size: 1.1rem; letter-spacing: .08em; text-transform: uppercase; }
        .wyg-stage-image { position: relative; height: 42rem; overflow: hidden; background: color-mix(in srgb, var(--wash) 60%, var(--surface-neutral)); }
        .wyg-stage-frame { position: absolute; inset: 0; }
        .wyg-stage-frame img { object-fit: contain; }
        .wyg-thumbs { display: grid; grid-template-columns: repeat(5, 1fr); gap: .8rem; margin-top: 1.2rem; }
        .wyg-thumbs button { position: relative; height: 5.2rem; overflow: hidden; border: 1px solid var(--border-neutral); opacity: .5; transition: opacity .2s, border-color .2s; }
        .wyg-thumbs button:hover, .wyg-thumbs button.is-active { opacity: 1; border-color: var(--ink); }
        .wyg-thumbs img { object-fit: cover; }
        @keyframes wygTimer { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .wyg-action { display: flex; align-items: center; justify-content: center; gap: 1.8rem; margin-top: 3.2rem; }
        .wyg-action span { color: var(--ink-secondary); font-size: 1.15rem; }
        @media (max-width: 900px) {
          .wyg-heading { grid-template-columns: 1fr; gap: 1.6rem; }
          .wyg-showcase { grid-template-columns: 1fr; min-height: 0; }
          .wyg-selector { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-right: 0; border-bottom: 1px solid var(--border-neutral); }
          .wyg-option { display: flex; justify-content: center; padding: 1.2rem .5rem; border-right: 1px solid var(--border-neutral); border-bottom: 0; }
          .wyg-option:last-child { border-right: 0; }
          .wyg-option.is-active { box-shadow: inset 0 -3px 0 var(--feature-accent); }
          .wyg-option-number, .wyg-option-copy small, .wyg-option-arrow { display: none; }
          .wyg-option-copy strong { margin: 0; font-size: 1.1rem; }
          .wyg-option-icon { width: 3rem; height: 3rem; }
        }
        @media (max-width: 600px) {
          .wyg-option { gap: 0; }
          .wyg-option-copy { display: none; }
          .wyg-stage { padding: 1rem; }
          .wyg-stage-image { height: min(60vw, 30rem); }
          .wyg-thumbs button { height: 4rem; }
          .wyg-action { flex-direction: column; gap: 1rem; }
        }
      `}</style>
    </section>
  );
}
