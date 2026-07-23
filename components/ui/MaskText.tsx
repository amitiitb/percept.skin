"use client";
import { useEffect, useRef, CSSProperties, ReactNode } from "react";

interface MaskTextProps {
  lines: ReactNode[];
  className?: string;
  style?: CSSProperties;
  delay?: number;     // seconds before first line
  stagger?: number;   // seconds between lines
  threshold?: number; // 0–1 visibility to trigger
}

export default function MaskText({
  lines,
  className,
  style,
  delay = 0,
  stagger = 0.08,
  threshold = 0.15,
}: MaskTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const lineEls = Array.from(container.querySelectorAll<HTMLElement>("[data-mask-inner]"));

    // Set initial state
    lineEls.forEach(el => {
      el.style.transform = "translateY(108%)";
      el.style.clipPath = "inset(0% 0% 100% 0%)";
      el.style.opacity = "1";
    });

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);
          lineEls.forEach((el, i) => {
            const d = delay + i * stagger;
            el.style.transition = `transform 0.72s cubic-bezier(0.24,0.43,0.15,0.97) ${d}s, clip-path 0.72s cubic-bezier(0.24,0.43,0.15,0.97) ${d}s`;
            el.style.transform = "translateY(0%)";
            el.style.clipPath = "inset(0% 0% 0% 0%)";
          });
        });
      },
      { threshold }
    );

    obs.observe(container);
    return () => obs.disconnect();
  }, [delay, stagger, threshold]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{ overflow: "hidden", lineHeight: "inherit", display: "block" }}
        >
          <div data-mask-inner="" style={{ willChange: "transform, clip-path" }}>
            {line}
          </div>
        </div>
      ))}
    </div>
  );
}
