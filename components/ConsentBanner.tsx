"use client";
import { useEffect, useState } from "react";
import Script from "next/script";

const STORAGE_KEY = "percept-cookie-consent";
// Any part of the site can re-open the banner (footer "Cookie Preferences",
// Settings) by dispatching this event, without needing a shared context.
export const OPEN_COOKIE_PREFS_EVENT = "percept:open-cookie-prefs";

type Consent = "granted" | "denied" | null;

export function ConsentBanner() {
  const [consent, setConsent] = useState<Consent>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "granted" || stored === "denied") {
      setConsent(stored);
    } else {
      setVisible(true);
    }
    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_COOKIE_PREFS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_PREFS_EVENT, reopen);
  }, []);

  function choose(value: "granted" | "denied") {
    localStorage.setItem(STORAGE_KEY, value);
    setConsent(value);
    setVisible(false);
  }

  return (
    <>
      {consent === "granted" && (
        <>
          <Script src="https://www.googletagmanager.com/gtag/js?id=G-ELGVCD5CYZ" strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ELGVCD5CYZ');
              gtag('config', 'G-VBV34ETWWN');`}
          </Script>
          <Script src="https://t.contentsquare.net/uxa/f9da0da61a34e.js" strategy="afterInteractive" />
        </>
      )}

      {visible && (
        <div
          className="consent-panel"
          role="dialog"
          aria-label="Cookie preferences"
          style={{
            position: "fixed", right: "1.4rem", bottom: "1.4rem", zIndex: 1000,
            width: "min(42rem, calc(100vw - 2.8rem))",
            background: "rgba(5, 12, 11, 0.66)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "1.6rem",
            padding: "1.5rem", boxShadow: "0 1.2rem 3.2rem rgba(0,0,0,0.24)", backdropFilter: "blur(24px) saturate(115%)", WebkitBackdropFilter: "blur(24px) saturate(115%)",
          }}
        >
          <p style={{ fontSize: "1.15rem", color: "rgba(255,255,255,0.9)", lineHeight: 1.45, margin: "0 0 1.2rem" }}>
            We use cookies to keep Percept working and remember your preferences. Optional analytics help us improve the experience. Read our <a href="/privacy" style={{ color: "#fff", textDecoration: "underline", textUnderlineOffset: "0.2em" }}>Privacy Policy</a>.
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <button
              type="button"
              onClick={() => choose("denied")}
              style={{
                height: "3.5rem", padding: "0", borderRadius: "9999px", fontSize: "1.1rem", fontWeight: 500,
                background: "transparent", color: "rgba(255,255,255,0.82)", border: "0", textDecoration: "underline", textUnderlineOffset: "0.25em", cursor: "pointer",
              }}
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => choose("granted")}
              style={{
                height: "3.5rem", minWidth: "9rem", padding: "0 1.5rem", borderRadius: "9999px", fontSize: "1.15rem", fontWeight: 500,
                background: "#fff", color: "#123f39", border: "1px solid rgba(255,255,255,0.8)", cursor: "pointer",
              }}
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </>
  );
}
