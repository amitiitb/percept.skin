"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  return <Suspense><ForgotPasswordForm /></Suspense>;
}

function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/auth/reset-password` }
    );

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--canvas)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "3.2rem 2.4rem",
    }}>
      <a href="/splash" style={{ display: "block", marginBottom: "4.8rem" }}>
        <Logo height="4.6rem" />
      </a>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", maxWidth: "44rem" }}
      >
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: "center" }}
            >
              <div style={{
                width: "6.4rem", height: "6.4rem", borderRadius: "50%",
                border: "2px solid var(--primary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 2.4rem",
              }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--primary)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 style={{ fontSize: "2.8rem", fontWeight: 300, color: "var(--primary)", margin: "0 0 1.2rem" }}>
                Check your email.
              </h1>
              <p style={{ fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.6, marginBottom: "3.2rem" }}>
                We sent a password reset link to <strong style={{ color: "var(--primary)" }}>{email}</strong>.
                It expires in 24 hours.
              </p>
              <a href="/auth/login" style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 500 }}>
                ← Back to sign in
              </a>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div style={{ marginBottom: "3.6rem" }}>
                <h1 style={{ fontSize: "3.4rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.025em", margin: 0 }}>
                  Reset password.
                </h1>
                <p style={{ marginTop: "1.2rem", fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.6 }}>
                  Enter your account email and we&apos;ll send a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "1.3rem", fontWeight: 500, color: "var(--secondary)", marginBottom: "0.8rem" }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
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

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ fontSize: "1.4rem", color: "var(--rose)", margin: 0 }}
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
                    marginTop: "0.8rem", height: "6rem",
                    background: loading ? "var(--secondary)" : "var(--btn-fill)",
                    color: "#fff", border: "none", borderRadius: "9999px",
                    fontSize: "1.8rem", fontWeight: 500,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s",
                  }}
                >
                  {loading ? (
                    <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </motion.svg>
                  ) : "Send Reset Link →"}
                </motion.button>
              </form>

              <p style={{ marginTop: "2.4rem", fontSize: "1.3rem", color: "var(--muted)", textAlign: "center" }}>
                <a href="/auth/login" style={{ color: "var(--primary)", fontWeight: 500 }}>← Back to sign in</a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
