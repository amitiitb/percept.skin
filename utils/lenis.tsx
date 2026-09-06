"use client";
import Lenis from "lenis";
import { useEffect, ReactNode } from "react";

export function ReactLenis({ children, root }: { children: ReactNode; root?: boolean }) {
  useEffect(() => {
    const lenis = new Lenis({
      // Was duration 1.2 with the default (1x) wheel distance — a single
      // fast flick covered enough scroll distance to blow straight past
      // 2-3 sections before anyone had a chance to register them. Longer
      // duration plus a reduced wheelMultiplier means the same physical
      // scroll gesture travels less and settles slower, without touching
      // scroll-snap/section-locking (would fight badly with long-scroll
      // pages like /report or /history, which aren't slide decks).
      duration: 1.8,
      wheelMultiplier: 0.75,
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
