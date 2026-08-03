"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedPw, setFocusedPw] = useState(false);
  const [focusedCf, setFocusedCf] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);

    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  const inputStyle = (focused: boolean) => ({
    width: "100%", height: "5.6rem", padding: "0 2rem",
    fontSize: "1.6rem", color: "var(--primary)", background: "var(--surface)",
    border: `1px solid ${focused ? "var(--primary)" : "var(--line)"}`,
    borderRadius: "1.2rem", outline: "none",
    transition: "border-color 0.15s", boxSizing: "border-box" as const,
  });

  return (
    <div style={{
      minHeight: "100dvh", background: "var(--canvas)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "3.2rem 2.4rem",
    }}>
      <a href="/splash" style={{ display: "block", marginBottom: "4.8rem" }}>
        <Logo height="4rem" />
      </a>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", maxWidth: "44rem" }}
      >
        <div style={{ marginBottom: "3.6rem" }}>
          <h1 style={{ fontSize: "3.4rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.025em", margin: 0 }}>
            Choose a new password.
          </h1>
          <p style={{ marginTop: "1.2rem", fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.6 }}>
            Must be at least 8 characters.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "1.3rem", fontWeight: 500, color: "var(--secondary)", marginBottom: "0.8rem" }}>
              New password
            </label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters" required
              onFocus={() => setFocusedPw(true)} onBlur={() => setFocusedPw(false)}
              style={inputStyle(focusedPw)}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "1.3rem", fontWeight: 500, color: "var(--secondary)", marginBottom: "0.8rem" }}>
              Confirm password
            </label>
            <input
              type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password" required
              onFocus={() => setFocusedCf(true)} onBlur={() => setFocusedCf(false)}
              style={inputStyle(focusedCf)}
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
            type="submit" disabled={loading}
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
            ) : "Update Password →"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
