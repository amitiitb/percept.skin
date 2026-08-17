"use client";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The report's payoff moment (Design review Decision #12) — was a static
// number, which undersold the one screen the whole flow builds toward.
// Ring + count-up give it an actual reveal. Respects prefers-reduced-motion
// by jumping straight to the final value instead of animating.
export function ScoreReveal({
  score,
  ringColor = "var(--primary)",
  trackColor = "var(--line)",
  textColor = "var(--primary)",
  size = 22,
}: {
  score: number;
  ringColor?: string;
  trackColor?: string;
  textColor?: string;
  size?: number;
}) {
  const [display, setDisplay] = useState(0);
  const progress = useMotionValue(0);
  const dashOffset = useTransform(progress, (v) => CIRCUMFERENCE - (v / 100) * CIRCUMFERENCE);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      progress.set(score);
      // Deferred a tick so this isn't a synchronous setState-in-effect
      // (which forces a same-commit cascading re-render) — still lands
      // before the next paint, imperceptible to the user.
      queueMicrotask(() => setDisplay(score));
      return;
    }
    const controls = animate(progress, score, {
      duration: 1.6,
      ease: [0.24, 0.43, 0.15, 0.97],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [score]);

  return (
    <div style={{ position: "relative", width: `${size}rem`, height: `${size}rem`, margin: "0 auto", flexShrink: 0 }}>
      <svg width="100%" height="100%" viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="100" cy="100" r={RADIUS} fill="none" stroke={trackColor} strokeWidth="8" />
        <motion.circle
          cx="100" cy="100" r={RADIUS} fill="none" stroke={ringColor} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <strong style={{ fontSize: `${size * 0.29}rem`, fontWeight: 500, color: textColor, lineHeight: 1 }}>{display}</strong>
      </div>
    </div>
  );
}
