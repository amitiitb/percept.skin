declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Fires to whatever gtag configs are loaded in app/layout.tsx (both GA4
// properties get every event — gtag broadcasts to all configured targets).
// No-ops server-side and before the script has loaded, so call sites don't
// need their own guards.
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}
