"use client";
import Lenis from "lenis";
import { useEffect, useRef, ReactNode } from "react";

export function ReactLenis({ children, root }: { children: ReactNode; root?: boolean }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    // Sync Lenis scroll position with Framer Motion's useScroll
    // (Framer Motion reads window.scrollY via native 'scroll' events)
    lenis.on("scroll", () => {
      // Lenis already dispatches native scroll events — this fires Framer Motion listeners
    });

    let raf: number;
    function animate(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    if (root) (window as unknown as Record<string, unknown>).__lenis = lenis;
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [root]);

  return <>{children}</>;
}
