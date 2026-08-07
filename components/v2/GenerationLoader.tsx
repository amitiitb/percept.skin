interface Props {
  title: string;
  detail?: string;
  kind?: "skin" | "hairstyle" | "beard" | "colour" | "frame";
}

function LoaderGraphic({ kind }: { kind: NonNullable<Props["kind"]> }) {
  if (kind === "hairstyle") return (
    <svg viewBox="0 0 160 120" aria-hidden>
      <path className="gl-soft" d="M49 92c0-25 14-45 31-45s31 20 31 45" />
      <path className="gl-main gl-draw" d="M46 53c3-29 20-43 40-38 18 4 28 20 26 42-9-13-19-20-31-21-13 0-23 6-35 17Z" />
      <path className="gl-line" d="M56 34c14-13 35-13 47 3M66 24c15-8 29-4 38 7" />
      <path className="gl-accent gl-float" d="m127 29 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" />
      <circle className="gl-dot" cx="69" cy="66" r="3" /><circle className="gl-dot" cx="92" cy="66" r="3" />
    </svg>
  );
  if (kind === "beard") return (
    <svg viewBox="0 0 160 120" aria-hidden>
      <path className="gl-soft" d="M49 48c0-24 14-38 31-38s31 14 31 38v18c0 28-14 45-31 45S49 94 49 66V48Z" />
      <path className="gl-main gl-draw" d="M48 66c8 8 15 11 22 10l10 8 10-8c7 1 14-2 22-10-1 31-13 46-32 46S49 97 48 66Z" />
      <path className="gl-main" d="M64 70c6-7 11-7 16-1 5-6 10-6 16 1-6 3-11 4-16 1-5 3-10 2-16-1Z" />
      <path className="gl-line" d="M57 79c8 2 13 8 16 18M103 79c-8 2-13 8-16 18M80 84v22" />
      <circle className="gl-dot" cx="68" cy="52" r="3" /><circle className="gl-dot" cx="92" cy="52" r="3" />
    </svg>
  );
  if (kind === "frame") return (
    <svg viewBox="0 0 160 120" aria-hidden>
      <path className="gl-soft" d="M51 56c0-27 13-43 29-43s29 16 29 43v11c0 25-13 42-29 42S51 92 51 67V56Z" />
      <g className="gl-fit">
        <rect className="gl-main gl-draw" x="39" y="48" width="37" height="27" rx="9" />
        <rect className="gl-main gl-draw" x="84" y="48" width="37" height="27" rx="9" />
        <path className="gl-line" d="M76 56c3-3 5-3 8 0M39 53 25 49M121 53l14-4" />
      </g>
      <path className="gl-accent gl-float" d="m132 22 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" />
    </svg>
  );
  if (kind === "colour") return (
    <svg viewBox="0 0 160 120" aria-hidden>
      <path className="gl-soft" d="M52 106V66c0-17 12-27 28-27s28 10 28 27v40" />
      <circle className="gl-soft" cx="80" cy="25" r="18" />
      <path className="gl-main gl-draw" d="M58 54 80 75l22-21 12 11-13 42H59L46 65l12-11Z" />
      <circle className="gl-swatch a" cx="128" cy="42" r="9" />
      <circle className="gl-swatch b" cx="136" cy="65" r="7" />
      <circle className="gl-swatch c" cx="127" cy="84" r="6" />
      <path className="gl-line" d="M69 83h22" />
    </svg>
  );
  return (
    <svg viewBox="0 0 160 120" aria-hidden>
      <path className="gl-soft" d="M49 51c0-26 14-42 31-42s31 16 31 42v16c0 26-14 44-31 44S49 93 49 67V51Z" />
      <circle className="gl-dot" cx="68" cy="55" r="3" /><circle className="gl-dot" cx="92" cy="55" r="3" />
      <path className="gl-line" d="M72 82c5 3 11 3 16 0" />
      <path className="gl-scan" d="M35 31h90M35 48h90M35 65h90M35 82h90" />
      <path className="gl-accent gl-float" d="m132 20 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" />
    </svg>
  );
}

/** A task-specific visual loader for paid report generation. */
export function GenerationLoader({ title, detail = "This can take up to a minute.", kind = "skin" }: Props) {
  return (
    <div className={`generation-loader generation-${kind}`} role="status" aria-live="polite">
      <div className="generation-graphic"><LoaderGraphic kind={kind} /></div>
      <p>{title}</p>
      <small>{detail}</small>
      <div className="generation-progress" aria-hidden><i /></div>
      <style>{`
        .generation-loader { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:24rem; padding:3.2rem 2rem; overflow:hidden; border:1px solid var(--line); border-radius:1.2rem; background:linear-gradient(145deg,var(--surface),var(--wash)); text-align:center; }
        .generation-graphic { width:12rem; height:9rem; margin-bottom:1.8rem; filter:drop-shadow(0 1rem 1.4rem rgba(22,83,69,.1)); }
        .generation-graphic svg { width:100%; height:100%; overflow:visible; }
        .gl-soft { fill:rgba(255,255,255,.5); stroke:#397C6C; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; }
        .gl-main { fill:#326B5E; stroke:#174C40; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; }
        .gl-line { fill:none; stroke:#E9C675; stroke-width:2.5; stroke-linecap:round; stroke-linejoin:round; }
        .gl-dot { fill:#174C40; }.gl-accent { fill:#D9A225; }.gl-swatch { stroke:rgba(23,76,64,.25); stroke-width:1.5; }
        .gl-swatch.a { fill:#B4543C; }.gl-swatch.b { fill:#D9A225; }.gl-swatch.c { fill:#2C8D83; }
        .gl-scan { fill:none; stroke:#19A995; stroke-width:2; stroke-linecap:round; stroke-dasharray:18 72; animation:gl-scan 2s linear infinite; filter:drop-shadow(0 0 5px rgba(25,169,149,.6)); }
        .gl-draw { stroke-dasharray:240; animation:gl-draw 2.4s ease-in-out infinite; }
        .gl-float { transform-origin:center; animation:gl-float 1.7s ease-in-out infinite; }
        .gl-fit { transform-origin:80px 60px; animation:gl-fit 1.8s ease-in-out infinite; }
        .generation-colour .gl-swatch.a { animation:gl-swatch 1.6s ease-in-out infinite; }.generation-colour .gl-swatch.b { animation:gl-swatch 1.6s .25s ease-in-out infinite; }.generation-colour .gl-swatch.c { animation:gl-swatch 1.6s .5s ease-in-out infinite; }
        .generation-loader p { margin:0 0 .6rem; color:var(--primary); font-size:1.55rem; font-weight:700; }
        .generation-loader small { color:var(--secondary); font-size:1.25rem; }
        .generation-progress { width:min(24rem,72%); height:.45rem; margin-top:1.8rem; overflow:hidden; border-radius:999px; background:rgba(57,124,108,.14); }
        .generation-progress i { display:block; width:42%; height:100%; border-radius:inherit; background:#168C79; animation:generation-progress 1.7s ease-in-out infinite; }
        @keyframes gl-scan { to { stroke-dashoffset:-90; } }
        @keyframes gl-draw { 0%,100% { stroke-dashoffset:0; } 50% { stroke-dashoffset:45; } }
        @keyframes gl-float { 0%,100% { transform:scale(.8) rotate(0); opacity:.45; } 50% { transform:scale(1.15) rotate(12deg); opacity:1; } }
        @keyframes gl-fit { 0%,100% { transform:translateY(-2px); } 50% { transform:translateY(3px); } }
        @keyframes gl-swatch { 0%,100% { transform:scale(.85); opacity:.55; } 50% { transform:scale(1.12); opacity:1; } }
        @keyframes generation-progress { 0% { transform:translateX(-110%); } 100% { transform:translateX(350%); } }
        @media (prefers-reduced-motion:reduce) { .gl-scan,.gl-draw,.gl-float,.gl-fit,.gl-swatch,.generation-progress i { animation:none!important; } }
      `}</style>
    </div>
  );
}
