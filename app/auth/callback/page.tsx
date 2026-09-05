"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash;
    const search = window.location.search;

    // A first-time OAuth (Google) user has no user_profiles_v2 row yet — same
    // check the mobile app's index.tsx splash screen does — so send them to
    // profile-setup instead of dropping them straight on an empty dashboard.
    // Existing users always have a profile with consent_given already true,
    // so this is a no-op for the password/magic-link paths that already
    // worked before Google sign-in existed.
    async function routeAfterAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles_v2")
          .select("consent_given")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profile?.consent_given) { router.replace("/profile-setup"); return; }
      }
      router.replace("/dashboard");
    }

    async function verify() {
      if (hash && hash.includes("access_token")) {
        // Implicit flow — token in URL hash
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) { router.replace("/auth/signup?error=invalid"); return; }
          await routeAfterAuth();
          return;
        }
      }

      if (search) {
        const params = new URLSearchParams(search);
        const code = params.get("code");
        const token_hash = params.get("token_hash");
        const type = params.get("type") ?? "signup";

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) { router.replace("/auth/signup?error=invalid"); return; }
          await routeAfterAuth();
          return;
        }

        if (token_hash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "signup" | "recovery" | "email",
          });
          if (error) { router.replace("/auth/signup?error=invalid"); return; }
          await routeAfterAuth();
          return;
        }
      }

      router.replace("/auth/signup?error=missing");
    }

    verify();
  }, [router]);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--canvas)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "2rem",
    }}>
      <a href="/splash" style={{ display: "block" }}>
        <Logo height="4.6rem" />
      </a>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        style={{
          width: "3.2rem", height: "3.2rem",
          borderRadius: "50%",
          border: "2px solid var(--line)",
          borderTopColor: "var(--primary)",
        }}
      />
      <p style={{ fontSize: "1.6rem", color: "var(--secondary)" }}>Verifying your account…</p>
    </div>
  );
}
