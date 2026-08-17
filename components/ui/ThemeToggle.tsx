"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconSun, IconMoon } from "@/components/ui/icons";

/**
 * Light/dark switch.
 *
 * The theme itself is a single `data-theme` attribute on <html>; every colour
 * in the app is a CSS custom property that reads off it, so nothing here has
 * to know about individual components. The attribute is stamped by the inline
 * script in app/layout.tsx before first paint, which is why this component
 * reads the current value rather than deciding one on mount: deciding here
 * would mean a frame of the wrong theme on every page load.
 *
 * A stored choice always beats the OS preference, so once someone has picked,
 * changing their system setting will not yank the site out from under them.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "percept-theme";

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // Keeps the mobile browser chrome in step with the page, otherwise a dark
  // page sits under a beige address bar. Created if absent rather than only
  // updated: the layout script normalises the tags at load, but a client
  // navigation can land here first.
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", theme === "dark" ? "#181B19" : "#E8E7E5");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "light";
    setTheme(current);
    setReady(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode, theme just won't persist */ }
  }

  const size = compact ? "3.8rem" : "4.2rem";

  return (
    <button
      type="button"
      onClick={toggle}
      // Before hydration the label would be wrong half the time, so it is only
      // announced once the real theme is known.
      aria-label={ready ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Switch colour theme"}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        border: "1px solid var(--line)", background: "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--primary)", cursor: "pointer", position: "relative", overflow: "hidden",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
          transition={{ duration: 0.22 }}
          style={{ display: "flex" }}
        >
          {theme === "dark" ? <IconSun size={1.7} /> : <IconMoon size={1.7} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
