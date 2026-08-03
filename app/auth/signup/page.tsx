"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { IconLock } from "@/components/ui/icons";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmailLocal] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.get("error")) setError("That link is invalid or has expired. Please try again.");
  }, [params]);

  // Already a real logged-in user → skip signup, go wherever this link was
  // pointed (v2 callers pass ?next=/... — defaulting to /dashboard,
  // never /results which doesn't exist in this project). If that next hop is
  // profile-setup and this user already has a saved profile, honoring next
  // as-is would send an existing user through the whole "create profile"
  // journey again on every single scan (real report: users landing here from
  // the marketing site's "Start your scan" link, which always appends
  // ?next=/profile-setup regardless of login state) — skip straight to a
  // new scan instead.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user || session.user.is_anonymous) return;
      const next = params.get("next") || "/dashboard";
      if (next === "/profile-setup") {
        const { data: profile } = await supabase.from("user_profiles_v2").select("name").eq("user_id", session.user.id).maybeSingle();
        router.replace(profile ? "/scan-prep" : next);
        return;
      }
      router.replace(next);
    });
  }, [router, params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);

    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: cleanEmail, password }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Instant access — no email-verification wall
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (loginErr) {
      setError(loginErr.message);
      setLoading(false);
      return;
    }

    router.replace(params.get("next") || "/dashboard");
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
      {/* Logo */}
      <a href="/splash" style={{ display: "block", marginBottom: "4.8rem" }}>
        <Logo height="4rem" />
      </a>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", maxWidth: "44rem" }}
      >
        {/* Header */}
        <div style={{ marginBottom: "3.6rem" }}>
          <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 3.6rem)", fontWeight: 600, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.025em", margin: 0 }}>
            Create your account.
          </h1>
          <p style={{ marginTop: "1.4rem", fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.6 }}>
            Takes a minute, then we'll guide you through your guided scan.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
          <Field
            label="Full name"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Your name"
            autoComplete="name"
            required
          />
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={setEmailLocal}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
          />

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
            ) : "Create Account & View Report →"}
          </motion.button>
        </form>

        <p style={{ marginTop: "2.4rem", fontSize: "1.3rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
          Already have an account?{" "}
          <a href="/auth/login" style={{ color: "var(--primary)", fontWeight: 500, textDecoration: "underline" }}>
            Sign in
          </a>
        </p>

        <p style={{ marginTop: "2rem", fontSize: "1.2rem", color: "var(--muted)", textAlign: "center" }}>
          <IconLock size={1.4} /> Your data is encrypted and never shared.
        </p>
      </motion.div>
    </div>
  );
}

function Field({
  label, type, value, onChange, placeholder, autoComplete, required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
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
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          height: "5.6rem",
          padding: "0 2rem",
          fontSize: "1.6rem",
          color: "var(--primary)",
          background: "var(--surface)",
          border: `1px solid ${focused ? "var(--primary)" : "var(--line)"}`,
          borderRadius: "1.2rem",
          outline: "none",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
