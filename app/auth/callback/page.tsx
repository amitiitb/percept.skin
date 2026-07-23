"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash;
    const search = window.location.search;

    async function verify() {
      if (hash && hash.includes("access_token")) {
        // Implicit flow — token in URL hash
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) { router.replace("/auth/signup?error=invalid"); return; }
          router.replace("/v2/dashboard");
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
          router.replace("/v2/dashboard");
          return;
        }

        if (token_hash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as "signup" | "recovery" | "email",
          });
          if (error) { router.replace("/auth/signup?error=invalid"); return; }
          router.replace("/v2/dashboard");
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
      <a href="/v2/splash" style={{ fontSize: "2.2rem", fontWeight: 500, color: "var(--primary)", letterSpacing: "-0.02em" }}>
        Glow<span style={{ color: "var(--rose)" }}>metry</span>
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
