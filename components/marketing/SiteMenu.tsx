"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";

interface MenuLink {
  label: string;
  href: string;
}

const LINKS: MenuLink[] = [
  { label: "What you get", href: "#what-you-get" },
  { label: "Why Percept", href: "#why" },
  { label: "Experts", href: "#experts" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

// Full-screen nav overlay — breadcrumb, stacked link list, CTA-with-badge,
// footer credit. Layout pattern only; palette/type are Percept's own
// tokens (app/globals.css), not the reference site's.
export function SiteMenu({ open, onClose }: Props) {
  // Signed-out visitors get "Log in"; signed-in ones get "Dashboard", same
  // reasoning as the header link this replaced — sending an authenticated
  // user to the login form is a dead end they have to back out of.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setSignedIn(Boolean(data.user)); });
    return () => { alive = false; };
  }, []);

  function go(href: string) {
    onClose();
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "var(--header-bg)", backdropFilter: "blur(18px)",
            display: "flex", flexDirection: "column",
          }}
        >
          <div aria-hidden style={{
            position: "absolute", top: "-10%", right: "-10%", width: "48rem", height: "48rem",
            borderRadius: "50%", background: "radial-gradient(circle, var(--rose) 0%, transparent 70%)",
            opacity: 0.08, filter: "blur(50px)", pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2.4rem 3.2rem" }}>
            <a href="/" style={{ display: "block" }}>
              <Logo height="clamp(2.6rem, 7vw, 4.2rem)" />
            </a>
            <button
              onClick={onClose}
              aria-label="Close menu"
              style={{ width: "4.4rem", height: "4.4rem", borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "56rem", width: "100%", margin: "0 auto", padding: "0 3.2rem", position: "relative" }}>
            <p style={{ fontSize: "1.1rem", fontFamily: "ui-monospace, monospace", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", marginBottom: "2.4rem" }}>
              Main menu /
            </p>

            <nav style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
              {LINKS.map((link, i) => (
                <motion.button
                  key={link.href}
                  onClick={() => go(link.href)}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.35 }}
                  style={{
                    textAlign: "left", background: "none", border: "none", cursor: "pointer", width: "fit-content",
                    fontSize: "clamp(2.6rem, 5vw, 3.4rem)", fontWeight: 500, color: "var(--primary)",
                    letterSpacing: "-0.01em", padding: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--rose)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--primary)"; }}
                >
                  {link.label}
                </motion.button>
              ))}
            </nav>

            <div style={{ height: "1px", background: "var(--line)", margin: "3.2rem 0" }} />

            <a
              href="/splash"
              style={{ display: "inline-flex", alignItems: "center", gap: "1rem", width: "fit-content", fontSize: "clamp(2.2rem, 4vw, 2.8rem)", fontWeight: 500, color: "var(--rose)" }}
            >
              Start your scan
              <span style={{
                fontSize: "1.1rem", fontFamily: "ui-monospace, monospace", textTransform: "uppercase",
                letterSpacing: "0.12em", background: "rgba(26,158,143,0.1)", color: "var(--rose)",
                padding: "0.4rem 1.2rem", borderRadius: "9999px",
              }}>
                Free
              </span>
            </a>

            {/* On a phone the header's own login link is hidden (<520px, see
                .site-header-login) to keep the bar from crowding, so the
                account route has to live here too — not just the desktop
                header bar. */}
            <a
              href={signedIn ? "/dashboard" : "/auth/login"}
              style={{ marginTop: "2rem", width: "fit-content", fontSize: "1.7rem", fontWeight: 500, color: "var(--secondary)" }}
            >
              {signedIn ? (
                <span style={{ color: "var(--primary)", fontWeight: 700 }}>Go to dashboard</span>
              ) : (
                <>Already have an account? <span style={{ color: "var(--primary)", fontWeight: 700 }}>Log in</span></>
              )}
            </a>
          </div>

          <p style={{ textAlign: "center", fontSize: "1.2rem", color: "var(--muted)", padding: "2.4rem" }}>
            © 2026 Percept
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
