"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * The account link in the marketing header.
 *
 * Signed-out visitors get "Log in"; signed-in ones get "Dashboard", because
 * sending someone who is already authenticated to a login form is a dead end
 * they have to back out of. The session check runs client-side after paint, so
 * the link renders as "Log in" first and swaps if a session turns up — the
 * wrong-but-harmless default, since a logged-in user clicking Log in lands on
 * their dashboard anyway via the redirect already in /auth/login.
 */
export function HeaderAuth() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setSignedIn(Boolean(data.user)); });
    return () => { alive = false; };
  }, []);

  return (
    <a
      href={signedIn ? "/dashboard" : "/auth/login"}
      className="site-header-login"
      style={{
        display: "none", alignItems: "center", padding: "0 1.6rem", height: "4.4rem",
        fontSize: "1.5rem", fontWeight: 600, color: "var(--secondary)", whiteSpace: "nowrap",
        borderRadius: "9999px", transition: "color 0.18s, background 0.18s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; e.currentTarget.style.background = "var(--wash)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--secondary)"; e.currentTarget.style.background = "transparent"; }}
    >
      {signedIn ? "Dashboard" : "Log in"}
    </a>
  );
}
