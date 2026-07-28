"use client";
import { useRef, useEffect, useState, useMemo } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";

/* ── Capture step: phone + oval + scan line ── */
function CaptureVisual() {
  const [scanY, setScanY] = useState(0);
  const [angle, setAngle] = useState(0);
  const ANGLES = ["Front", "Left", "Right", "Smile", "Crown", "Eye"];
  useEffect(() => {
    let y = 0; let dir = 1; let tick = 0;
    const id = setInterval(() => {
      y += dir * 2;
      if (y >= 100) dir = -1;
      if (y <= 0)   dir = 1;
      setScanY(y);
      tick++;
      if (tick % 40 === 0) setAngle(a => (a + 1) % ANGLES.length);
    }, 16);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2.4rem" }}>
      {/* Phone shell */}
      <div style={{ width: "18rem", height: "32rem", background: "#1a1a1a", borderRadius: "2.4rem", border: "0.3rem solid #333", position: "relative", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.45)" }}>
        {/* Screen bg */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#0d1a17 0%,#1a2e28 100%)" }} />
        {/* Camera notch */}
        <div style={{ position: "absolute", top: "1.2rem", left: "50%", transform: "translateX(-50%)", width: "5rem", height: "0.8rem", background: "#000", borderRadius: "9999px", zIndex: 10 }} />
        {/* Oval guide */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "9rem", height: "12rem", border: "2px solid rgba(255,255,255,0.5)", borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
        {/* Scan line */}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: `calc(${scanY}% * 0.6 + 20%)`, width: "9rem", height: "2px", background: "linear-gradient(90deg, transparent, #4ade80, transparent)", filter: "blur(1px)" }} />
        {/* Corner brackets */}
        {[["top:20%;left:calc(50% - 4.5rem)", "border-top:2px solid #4ade80;border-left:2px solid #4ade80"],
          ["top:20%;right:calc(50% - 4.5rem)", "border-top:2px solid #4ade80;border-right:2px solid #4ade80"],
          ["bottom:20%;left:calc(50% - 4.5rem)", "border-bottom:2px solid #4ade80;border-left:2px solid #4ade80"],
          ["bottom:20%;right:calc(50% - 4.5rem)", "border-bottom:2px solid #4ade80;border-right:2px solid #4ade80"],
        ].map(([pos, bdr], i) => (
          <div key={i} style={{ position: "absolute", width: "1.2rem", height: "1.2rem", ...(Object.fromEntries(pos.split(";").map(p => { const [k,v] = p.split(":"); return [k.trim(), v.trim()]; }))), ...(Object.fromEntries(bdr.split(";").map(p => { const [k,v] = p.split(":"); return [k.trim(), v.trim()]; }))) }} />
        ))}
        {/* Angle label */}
        <div style={{ position: "absolute", bottom: "3.2rem", left: 0, right: 0, textAlign: "center" }}>
          <AnimatePresence mode="wait">
            <motion.span key={angle} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {ANGLES[angle]}
            </motion.span>
          </AnimatePresence>
        </div>
        {/* Dot dots at bottom */}
        <div style={{ position: "absolute", bottom: "1.2rem", left: 0, right: 0, display: "flex", justifyContent: "center", gap: "0.5rem" }}>
          {ANGLES.map((_, i) => (
            <div key={i} style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: i === angle ? "#4ade80" : "rgba(255,255,255,0.2)", transition: "background 0.3s" }} />
          ))}
        </div>
      </div>
      <p style={{ fontSize: "1.3rem", color: "var(--secondary)", textAlign: "center", lineHeight: 1.5 }}>6 guided angles · under 2 minutes</p>
    </div>
  );
}

/* ── Analyse step: AI landmark dots ── */
function AnalyseVisual() {
  const [active, setActive] = useState<number[]>([]);
  // Fixed once per mount via a useState lazy initializer — the one place
  // React's purity rules allow a one-time impure call (useMemo's callback
  // is still expected to be pure and can legitimately re-run under the
  // compiler, so it doesn't qualify). Without this, DOTS/LINES were
  // recomputed with fresh Math.random() on every render, reshuffling the
  // layout on each `active`/`paramIdx` tick and mismatching between the
  // server and client hydration passes.
  const [DOTS] = useState(() => Array.from({ length: 32 }, () => ({
    x: 10 + Math.random() * 80,
    y: 8 + Math.random() * 84,
    r: 0.8 + Math.random() * 1.4,
  })));
  const [LINES] = useState(() => Array.from({ length: 20 }, () => ({
    i: Math.floor(Math.random() * DOTS.length),
    j: Math.floor(Math.random() * DOTS.length),
  })));
  const PARAMS = ["Texture","Tone","Pores","Wrinkles","Hydration","Inflammation","Pigmentation","Dark circles","Acne","Oil balance"];

  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      setActive(prev => {
        if (prev.length >= DOTS.length) return [];
        return [...prev, idx % DOTS.length];
      });
      idx++;
    }, 60);
    return () => clearInterval(id);
  }, []);

  const [paramIdx, setParamIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setParamIdx(p => (p + 1) % PARAMS.length), 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
      {/* Face wireframe */}
      <div style={{ width: "22rem", height: "26rem", position: "relative", background: "linear-gradient(160deg,#0d1a17,#1a2e28)", borderRadius: "1.6rem", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {/* Connection lines */}
          {LINES.map((l, i) => (
            active.includes(l.i) && active.includes(l.j) ? (
              <line key={i} x1={`${DOTS[l.i].x}%`} y1={`${DOTS[l.i].y}%`} x2={`${DOTS[l.j].x}%`} y2={`${DOTS[l.j].y}%`} stroke="rgba(74,222,128,0.18)" strokeWidth="0.4" />
            ) : null
          ))}
          {/* Landmark dots */}
          {DOTS.map((d, i) => (
            <circle key={i} cx={`${d.x}%`} cy={`${d.y}%`} r={active.includes(i) ? d.r * 1.4 : d.r} fill={active.includes(i) ? "#4ade80" : "rgba(255,255,255,0.12)"} style={{ transition: "r 0.2s, fill 0.2s" }} />
          ))}
        </svg>
        {/* Scanning param */}
        <div style={{ position: "absolute", bottom: "1.6rem", left: 0, right: 0, textAlign: "center" }}>
          <span style={{ fontSize: "0.9rem", color: "rgba(74,222,128,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Scanning </span>
          <AnimatePresence mode="wait">
            <motion.span key={paramIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} style={{ fontSize: "0.9rem", color: "#4ade80", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {PARAMS[paramIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
        {/* 478 landmark count */}
        <div style={{ position: "absolute", top: "1.2rem", right: "1.2rem", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: "0.6rem", padding: "0.4rem 0.8rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#4ade80", fontWeight: 600 }}>478 landmarks</span>
        </div>
      </div>
      <p style={{ fontSize: "1.3rem", color: "var(--secondary)", textAlign: "center", lineHeight: 1.5 }}>21 parameters · MediaPipe AI · instant</p>
    </div>
  );
}

/* ── Report step: tabbed preview ── */
function ReportVisual() {
  const TABS = [
    { id: "skin", label: "Skin Report", color: "#2B3530" },
    { id: "frames", label: "Frame Try-On", color: "#C8503A" },
    { id: "colour", label: "Colour Analysis", color: "#8FA49A" },
  ];
  const [tab, setTab] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTab(t => (t + 1) % TABS.length), 2800);
    return () => clearInterval(id);
  }, []);

  const BARS = [
    { label: "Skin Clarity", pct: 72, color: "#4ade80" },
    { label: "Hydration", pct: 58, color: "#60a5fa" },
    { label: "Texture", pct: 81, color: "#a78bfa" },
    { label: "Pigmentation", pct: 64, color: "#fb923c" },
  ];

  const FRAME_SHAPES = [
    { w: 28, h: 14, rx: 14, label: "Round" },
    { w: 32, h: 12, rx: 2, label: "Rectangle" },
    { w: 30, h: 16, rx: 6, label: "Cat-eye" },
  ];

  const COLOURS = [
    { c: "#C8503A", label: "Warm Coral" },
    { c: "#2B3530", label: "Forest" },
    { c: "#8FA49A", label: "Sage" },
    { c: "#D4B896", label: "Sand" },
    { c: "#6B3A2A", label: "Rust" },
    { c: "#E8D5B7", label: "Cream" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
      {/* Report card */}
      <div style={{ width: "26rem", background: "#fff", borderRadius: "1.6rem", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #eee" }}>
          {TABS.map((t, i) => (
            <button key={t.id} onClick={() => setTab(i)} style={{ flex: 1, padding: "1rem 0", fontSize: "0.85rem", fontWeight: tab === i ? 600 : 400, color: tab === i ? t.color : "#999", background: "none", border: "none", cursor: "pointer", borderBottom: tab === i ? `2px solid ${t.color}` : "2px solid transparent", transition: "all 0.25s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div style={{ padding: "1.6rem", minHeight: "17rem" }}>
          <AnimatePresence mode="wait">
            {tab === 0 && (
              <motion.div key="skin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>Parameter Breakdown</p>
                {BARS.map(b => (
                  <div key={b.label} style={{ marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                      <span style={{ fontSize: "1rem", color: "#2B3530" }}>{b.label}</span>
                      <span style={{ fontSize: "1rem", fontWeight: 600, color: b.color }}>{b.pct}</span>
                    </div>
                    <div style={{ height: "0.5rem", background: "#f0f0f0", borderRadius: "9999px", overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${b.pct}%` }} transition={{ duration: 0.8, delay: 0.1 }} style={{ height: "100%", background: b.color, borderRadius: "9999px" }} />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
            {tab === 1 && (
              <motion.div key="frames" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.6rem" }}>Best Frames for Your Face</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  {FRAME_SHAPES.map((f, i) => (
                    <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "1.6rem", padding: "1rem", background: i === 0 ? "#f9f5f0" : "transparent", borderRadius: "0.8rem", border: i === 0 ? "1px solid #e8ddd0" : "1px solid transparent" }}>
                      <svg width={f.w * 1.4} height={f.h * 1.4} viewBox={`0 0 ${f.w} ${f.h}`}>
                        <rect x="1" y="1" width={f.w - 2} height={f.h - 2} rx={f.rx} ry={f.rx} fill="none" stroke={i === 0 ? "#C8503A" : "#ccc"} strokeWidth="1.5" />
                        <line x1={f.w / 2 - 1} y1="0" x2={f.w / 2 + 1} y2={f.h} stroke={i === 0 ? "#C8503A" : "#ccc"} strokeWidth="1" />
                      </svg>
                      <div>
                        <p style={{ fontSize: "1rem", fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "#C8503A" : "#999", margin: 0 }}>{f.label}</p>
                        {i === 0 && <p style={{ fontSize: "0.85rem", color: "#888", margin: "0.2rem 0 0" }}>Best match</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {tab === 2 && (
              <motion.div key="colour" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.2rem" }}>Your Colour Palette</p>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.6rem" }}>
                  <div style={{ width: "4rem", height: "4rem", borderRadius: "50%", background: "linear-gradient(135deg, #C8503A, #D4B896)" }} />
                  <div>
                    <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#2B3530", margin: 0 }}>Warm Autumn</p>
                    <p style={{ fontSize: "0.9rem", color: "#888", margin: "0.2rem 0 0" }}>Season type · 12 colour analysis</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>
                  {COLOURS.map(c => (
                    <div key={c.c} title={c.label} style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: c.c, boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }} />
                  ))}
                </div>
                <p style={{ fontSize: "1rem", color: "#666", marginTop: "1.2rem", lineHeight: 1.5 }}>Wear earthy tones, terracotta, and warm neutrals for your best look.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p style={{ fontSize: "1.3rem", color: "var(--secondary)", textAlign: "center", lineHeight: 1.5 }}>Skin · Frames · Colour, all in one report</p>
    </div>
  );
}

/* ── Main exported section ── */
const STEPS = [
  {
    n: "01",
    title: "Capture",
    subtitle: "6-angle face scan",
    body: "Our AI camera assistant guides you through 6 positions, front, left, right, smile, crown, and eye close-up, in under 2 minutes. No special equipment needed.",
    Visual: CaptureVisual,
    tag: "Camera · 6 angles · guided",
  },
  {
    n: "02",
    title: "Analyse",
    subtitle: "478 face landmarks · 21 parameters",
    body: "MediaPipe AI maps 478 facial landmarks, then scores 21 skin parameters: texture, hydration, pigmentation, wrinkles, acne, inflammation, and more.",
    Visual: AnalyseVisual,
    tag: "AI · MediaPipe · instant",
  },
  {
    n: "03",
    title: "Report",
    subtitle: "3-section personalised report",
    body: "Your report covers Skin Analysis with parameter scores, Frame Try-On to find your best eyewear, and Colour Analysis to discover your seasonal palette.",
    Visual: ReportVisual,
    tag: "Skin · Frames · Colour",
  },
];

export default function HowItWorksAnimated() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  // IntersectionObserver per step to update active
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = stepRefs.current.indexOf(e.target as HTMLDivElement);
          if (idx !== -1) setActiveStep(idx);
        }
      });
    }, { threshold: 0.55 });
    stepRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how-it-works" style={{ background: "var(--canvas)", borderBottom: "1px solid var(--line)" }}>
      {/* Section header */}
      <div style={{ borderBottom: "1px solid var(--line)", padding: "8rem calc(64 * var(--multiplier)) 6rem" }}>
        <p style={{ fontSize: "1.1rem", color: "var(--secondary)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "2rem" }}>Process</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8rem", alignItems: "end" }}>
          <h2 style={{ fontSize: "clamp(3.2rem,4vw,5.6rem)", fontWeight: 300, color: "var(--primary)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: 0 }}>
            From selfie to<br /><em style={{ fontStyle: "italic" }}>expert report.</em>
          </h2>
          <p style={{ fontSize: "1.8rem", color: "var(--secondary)", lineHeight: 1.65, margin: 0 }}>
            Three steps. Six photos. Twenty-one parameters checked, skin, eyewear, and colour, delivered in under 5 minutes.
          </p>
        </div>
      </div>

      {/* Desktop: sticky visual + scrolling steps */}
      <div className="hiw-desktop" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh" }}>
        {/* Left: sticky visual */}
        <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--line)", background: "var(--surface)" }}>
          <AnimatePresence mode="wait">
            <motion.div key={activeStep} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.45, ease: [0.24, 0.43, 0.15, 0.97] }}>
              {activeStep === 0 && <CaptureVisual />}
              {activeStep === 1 && <AnalyseVisual />}
              {activeStep === 2 && <ReportVisual />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: scroll steps */}
        <div>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              ref={el => { stepRefs.current[i] = el; }}
              style={{ padding: "10rem calc(64 * var(--multiplier))", borderBottom: i < STEPS.length - 1 ? "1px solid var(--line)" : "none", minHeight: "45vh", display: "flex", flexDirection: "column", justifyContent: "center" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "2rem" }}>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: activeStep === i ? "var(--rose)" : "var(--secondary)", letterSpacing: "0.12em", textTransform: "uppercase", transition: "color 0.4s" }}>{s.n}</span>
                <span style={{ width: activeStep === i ? "3.2rem" : "1.6rem", height: "1px", background: activeStep === i ? "var(--rose)" : "var(--line-strong)", transition: "all 0.4s" }} />
                <span style={{ fontSize: "1rem", color: "var(--secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.subtitle}</span>
              </div>
              <h3 style={{ fontSize: "clamp(3.2rem,3.5vw,5.2rem)", fontWeight: 300, color: "var(--primary)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: "2rem" }}>{s.title}</h3>
              <p style={{ fontSize: "1.8rem", color: "var(--secondary)", lineHeight: 1.65, maxWidth: "48rem", marginBottom: "2.4rem" }}>{s.body}</p>
              <span style={{ display: "inline-block", fontSize: "1.1rem", color: "var(--secondary)", background: "var(--wash)", padding: "0.6rem 1.4rem", borderRadius: "9999px", letterSpacing: "0.06em" }}>{s.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: vertical stack (visual above each step) */}
      <div className="hiw-mobile" style={{ display: "none" }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ borderBottom: i < STEPS.length - 1 ? "1px solid var(--line)" : "none" }}>
            {/* Visual */}
            <div style={{ background: "var(--surface)", padding: "5.6rem 2.4rem 4rem", display: "flex", justifyContent: "center" }}>
              {i === 0 && <CaptureVisual />}
              {i === 1 && <AnalyseVisual />}
              {i === 2 && <ReportVisual />}
            </div>
            {/* Text */}
            <div style={{ padding: "4rem 2.4rem 5.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.6rem" }}>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--rose)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.n}</span>
                <span style={{ width: "2.4rem", height: "1px", background: "var(--rose)" }} />
                <span style={{ fontSize: "1rem", color: "var(--secondary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.subtitle}</span>
              </div>
              <h3 style={{ fontSize: "3.2rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: "1.6rem" }}>{s.title}</h3>
              <p style={{ fontSize: "1.7rem", color: "var(--secondary)", lineHeight: 1.65, marginBottom: "2rem" }}>{s.body}</p>
              <span style={{ display: "inline-block", fontSize: "1.1rem", color: "var(--secondary)", background: "var(--wash)", padding: "0.6rem 1.4rem", borderRadius: "9999px", letterSpacing: "0.06em" }}>{s.tag}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 767px) {
          .hiw-desktop { display: none !important; }
          .hiw-mobile  { display: block !important; }
        }
      `}</style>
    </section>
  );
}
