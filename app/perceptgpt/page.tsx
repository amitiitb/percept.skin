"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_PROMPTS = [
  "What's my Percept Score based on?",
  "What are my strongest features?",
  "What should I focus on improving?",
  "Explain my colour season",
  "What's a simple morning routine for me?",
];

function ChatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8.5 8.5 0 01-8.5 8.5c-1.35 0-2.62-.32-3.73-.9L3 21l1.46-4.38A8.46 8.46 0 013.5 12 8.5 8.5 0 0112 3.5 8.5 8.5 0 0121 12z" />
    </svg>
  );
}

function PerceptGPTInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [noSession, setNoSession] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/perceptgpt"); return; }

      const requested = params.get("session");
      if (requested) {
        setSessionId(requested);
        setReady(true);
        return;
      }

      const { data } = await supabase
        .from("analysis_sessions_v2")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1);

      if (data?.[0]) setSessionId(data[0].id);
      else setNoSession(true);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || !sessionId) return;

    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError("");

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error("Please log in again.");

      const res = await fetch("/api/perceptgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authSession.access_token}` },
        body: JSON.stringify({ sessionId, messages: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "PerceptGPT couldn't respond, please try again.");

      setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (!ready) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;

  if (noSession) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3.2rem 2.4rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "2.4rem", fontWeight: 600, color: "var(--primary)", marginBottom: "1.2rem" }}>Complete a scan first</h1>
        <p style={{ fontSize: "1.6rem", color: "var(--secondary)", marginBottom: "3.2rem", maxWidth: "40rem" }}>
          PerceptGPT answers questions about your own results, so it needs a finished analysis to talk about.
        </p>
        <PrimaryButton fullWidth={false} onClick={() => router.push("/dashboard")}>Back to dashboard</PrimaryButton>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)", display: "flex", flexDirection: "column" }}>
      <div style={{ borderBottom: "1px solid var(--line)", padding: "1.6rem 2.4rem", display: "flex", alignItems: "center", gap: "1.2rem", flexShrink: 0 }}>
        <button
          // A deterministic destination rather than router.back() — back()
          // depends on the browser's history stack, and if that stack has an
          // old /auth/login redirect in it (e.g. from before the user signed
          // in), back() replays that instead of returning to the dashboard.
          onClick={() => router.push("/dashboard")}
          aria-label="Back to dashboard"
          style={{ width: "4rem", height: "4rem", borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "var(--secondary)" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ width: "3.6rem", height: "3.6rem", borderRadius: "50%", background: "var(--wash)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rose)", flexShrink: 0 }}>
          <ChatIcon size={18} />
        </div>
        <div>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary)", lineHeight: 1.2 }}>PerceptGPT</p>
          <p style={{ fontSize: "1.2rem", color: "var(--muted)" }}>Ask about your results, or anything beauty</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "2.4rem", maxWidth: "76rem", width: "100%", margin: "0 auto" }}>
        {messages.length === 0 && (
          <div style={{ marginBottom: "2.4rem" }}>
            <p style={{ fontSize: "1.5rem", color: "var(--secondary)", marginBottom: "1.6rem" }}>Try asking:</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem" }}>
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{ fontSize: "1.4rem", padding: "0.9rem 1.6rem", borderRadius: "9999px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--primary)", cursor: "pointer", textAlign: "left" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1.6rem" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%", padding: "1.2rem 1.8rem", borderRadius: "1.6rem", fontSize: "1.5rem", lineHeight: 1.55, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--primary)" : "var(--surface)",
                color: m.role === "user" ? "var(--canvas)" : "var(--body)",
                border: m.role === "assistant" ? "1px solid var(--line)" : "none",
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "1.2rem 1.8rem", borderRadius: "1.6rem", background: "var(--surface)", border: "1px solid var(--line)", fontSize: "1.5rem", color: "var(--muted)" }}>
                Thinking…
              </div>
            </div>
          )}
        </div>
        {error && <p style={{ fontSize: "1.4rem", color: "#C8503A", marginTop: "1.6rem" }}>{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: "1px solid var(--line)", padding: "1.6rem 2.4rem", flexShrink: 0 }}>
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          style={{ maxWidth: "76rem", margin: "0 auto", display: "flex", gap: "1rem" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask PerceptGPT anything…"
            disabled={sending}
            style={{ flex: 1, height: "5.2rem", borderRadius: "9999px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--primary)", padding: "0 2rem", fontSize: "1.5rem" }}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            style={{ width: "5.2rem", height: "5.2rem", borderRadius: "50%", border: "none", background: "var(--btn-fill)", color: "var(--btn-fill-ink)", display: "flex", alignItems: "center", justifyContent: "center", cursor: sending || !input.trim() ? "not-allowed" : "pointer", opacity: sending || !input.trim() ? 0.5 : 1, flexShrink: 0 }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </form>
        <p style={{ fontSize: "1.15rem", color: "var(--muted)", textAlign: "center", marginTop: "1rem", maxWidth: "76rem", marginLeft: "auto", marginRight: "auto" }}>
          Cosmetic and wellness guidance only, not a medical diagnosis. See a dermatologist for medical concerns.
        </p>
      </div>
    </div>
  );
}

export default function PerceptGPTPage() {
  return (
    <Suspense>
      <PerceptGPTInner />
    </Suspense>
  );
}
