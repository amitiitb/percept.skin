"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setError(signInError.message === "Invalid login credentials"
        ? "Incorrect email or password."
        : signInError.message);
      setLoading(false);
      return;
    }

    // See app/auth/signup/page.tsx — next=/profile-setup would otherwise
    // send an existing user through profile creation again on every scan.
    const next = params.get("next") || "/dashboard";
    if (next === "/profile-setup" && signInData.user) {
      const { data: profile } = await supabase.from("user_profiles_v2").select("name").eq("user_id", signInData.user.id).maybeSingle();
      router.replace(profile ? "/scan-prep" : next);
      return;
    }
    router.replace(next);
  }

  return (
    <div style={{
      position: "relative",
      minHeight: "100dvh",
      background: "var(--canvas)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "3.2rem 2.4rem",
    }}>
      <div style={{ position: "absolute", top: "2rem", right: "2rem" }}><ThemeToggle compact /></div>
      <a href="/splash" style={{ display: "block", marginBottom: "4.8rem" }}>
        <Logo height="3rem" />
      </a>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", maxWidth: "44rem" }}
      >
        <div style={{ marginBottom: "3.6rem" }}>
          <h1 style={{ fontSize: "3.4rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.025em", margin: 0 }}>
            Welcome back.
          </h1>
          <p style={{ marginTop: "1.2rem", fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.6 }}>
            Sign in to access your skin report.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
          <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: "1.4rem", color: "var(--rose)", lineHeight: 1.5, margin: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={!loading ? { scale: 0.985 } : {}}
            style={{
              marginTop: "0.8rem",
              height: "6rem",
              background: loading ? "var(--secondary)" : "var(--btn-fill)",
              color: "var(--btn-fill-ink)",
              border: "none",
              borderRadius: "9999px",
              fontSize: "1.8rem",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.8rem",
              transition: "background 0.2s",
            }}
          >
            {loading ? (
              <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </motion.svg>
            ) : "Sign In →"}
          </motion.button>
        </form>

        <p style={{ marginTop: "2.4rem", fontSize: "1.3rem", color: "var(--muted)", textAlign: "center" }}>
          Don't have an account?{" "}
          <a href="/auth/signup" style={{ color: "var(--primary)", fontWeight: 500, textDecoration: "underline" }}>
            Create one
          </a>
        </p>
        <p style={{ marginTop: "1.2rem", fontSize: "1.3rem", color: "var(--muted)", textAlign: "center" }}>
          <a href="/auth/forgot-password" style={{ color: "var(--secondary)", textDecoration: "underline" }}>
            Forgot password?
          </a>
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, autoComplete }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string; autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: "1.3rem", fontWeight: 500, color: "var(--secondary)", marginBottom: "0.8rem", letterSpacing: "0.02em" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: "5.6rem", padding: "0 2rem",
          fontSize: "1.6rem", color: "var(--primary)", background: "var(--surface)",
          border: `1px solid ${focused ? "var(--primary)" : "var(--line)"}`,
          borderRadius: "1.2rem", outline: "none",
          transition: "border-color 0.15s", boxSizing: "border-box",
        }}
      />
    </div>
  );
}
