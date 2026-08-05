"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  analysis_session_id: string;
  updated_at: string;
}

const SUGGESTED_PROMPTS = [
  { label: "Understand my score", prompt: "What is my Percept Score based on?" },
  { label: "Find my strengths", prompt: "What are my strongest features?" },
  { label: "Choose a focus", prompt: "What should I focus on improving first?" },
  { label: "Explain my colours", prompt: "Explain my colour season in simple terms" },
];

function Icon({ name, size = 18 }: { name: "chat" | "plus" | "menu" | "trash" | "reset" | "back" | "send" | "close"; size?: number }) {
  const paths = {
    chat: <path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.55L4 19.2l1.25-3.72A7.5 7.5 0 1 1 20 11.5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    trash: <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />,
    reset: <path d="M20 7v5h-5M4 17v-5h5M6.1 8.2A7 7 0 0 1 18.8 10M17.9 15.8A7 7 0 0 1 5.2 14" />,
    back: <path d="m15 18-6-6 6-6" />,
    send: <path d="M12 19V5M5 12l7-7 7 7" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function relativeDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function PerceptGPTInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [supabase] = useState(() => createClient());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [noSession, setNoSession] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function initialise() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth/login?next=/perceptgpt"); return; }
      const requested = params.get("session");
      let query = supabase.from("analysis_sessions_v2").select("id").eq("user_id", user.id).eq("status", "complete");
      if (requested) query = query.eq("id", requested);
      const { data } = await query.order("created_at", { ascending: false }).limit(1);
      if (cancelled) return;
      if (!data?.[0]) { setNoSession(true); setReady(true); return; }

      const scanId = data[0].id;
      setUserId(user.id);
      setSessionId(scanId);
      const { data: chats } = await supabase
        .from("perceptgpt_conversations_v2")
        .select("id, title, analysis_session_id, updated_at")
        .eq("user_id", user.id)
        .eq("analysis_session_id", scanId)
        .order("updated_at", { ascending: false });
      if (cancelled) return;
      const list = (chats ?? []) as Conversation[];
      setConversations(list);
      const requestedChat = params.get("chat");
      const first = list.find((chat) => chat.id === requestedChat) ?? list[0];
      if (first) await openConversation(first.id, false);
      setReady(true);
    }
    initialise();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function openConversation(id: string, closeSidebar = true) {
    setActiveId(id);
    setLoadingMessages(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("perceptgpt_messages_v2")
      .select("id, role, content, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    if (loadError) setError("Could not load this conversation.");
    setMessages((data ?? []) as ChatMessage[]);
    setLoadingMessages(false);
    if (closeSidebar) setSidebarOpen(false);
  }

  async function createConversation() {
    if (!sessionId || !userId) return null;
    const now = new Date().toISOString();
    const { data, error: createError } = await supabase.from("perceptgpt_conversations_v2").insert({
      user_id: userId,
      analysis_session_id: sessionId,
      title: "New conversation",
      updated_at: now,
    }).select("id, title, analysis_session_id, updated_at").single();
    if (createError || !data) { setError("Could not start a new conversation."); return null; }
    const chat = data as Conversation;
    setConversations((current) => [chat, ...current]);
    setActiveId(chat.id);
    setMessages([]);
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
    return chat.id;
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Delete this conversation permanently?")) return;
    const { error: deleteError } = await supabase.from("perceptgpt_conversations_v2").delete().eq("id", id);
    if (deleteError) { setError("Could not delete this conversation."); return; }
    const remaining = conversations.filter((chat) => chat.id !== id);
    setConversations(remaining);
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
      if (remaining[0]) await openConversation(remaining[0].id);
    }
  }

  async function resetConversation() {
    if (!activeId || !window.confirm("Clear every message in this conversation?")) return;
    const [{ error: messageError }, { error: titleError }] = await Promise.all([
      supabase.from("perceptgpt_messages_v2").delete().eq("conversation_id", activeId),
      supabase.from("perceptgpt_conversations_v2").update({ title: "New conversation", updated_at: new Date().toISOString() }).eq("id", activeId),
    ]);
    if (messageError || titleError) { setError("Could not reset this conversation."); return; }
    setMessages([]);
    setConversations((current) => current.map((chat) => chat.id === activeId ? { ...chat, title: "New conversation", updated_at: new Date().toISOString() } : chat));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || !sessionId) return;
    let conversationId = activeId;
    if (!conversationId) conversationId = await createConversation();
    if (!conversationId) return;

    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch("/api/perceptgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId, conversationId, messages: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "PerceptGPT could not respond. Please try again.");
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
      const updatedAt = new Date().toISOString();
      setConversations((current) => {
        const updated = current.map((chat) => chat.id === conversationId ? { ...chat, title: result.title, updated_at: updatedAt } : chat);
        return updated.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  }

  if (!ready) return <div className="gpt-loading" />;
  if (noSession) {
    return (
      <div className="gpt-no-session">
        <div className="gpt-mark"><Icon name="chat" size={24} /></div>
        <h1>Complete a scan first</h1>
        <p>PerceptGPT uses your own results to answer clearly and personally.</p>
        <PrimaryButton fullWidth={false} onClick={() => router.push("/dashboard")}>Back to dashboard</PrimaryButton>
      </div>
    );
  }

  const activeConversation = conversations.find((chat) => chat.id === activeId);

  return (
    <div className="gpt-shell">
      {sidebarOpen && <button className="gpt-sidebar-scrim" aria-label="Close history" onClick={() => setSidebarOpen(false)} />}
      <aside className={`gpt-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="gpt-sidebar-head">
          <a href="/dashboard" aria-label="Percept dashboard"><Logo height="2.8rem" /></a>
          <button className="gpt-mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close history"><Icon name="close" /></button>
        </div>
        <button className="gpt-new-chat" onClick={createConversation}><Icon name="plus" /> New chat</button>
        <div className="gpt-history-label">Conversations</div>
        <div className="gpt-history-list">
          {conversations.length === 0 && <p className="gpt-history-empty">Your conversations will appear here.</p>}
          {conversations.map((chat) => (
            <div key={chat.id} className={`gpt-history-row${chat.id === activeId ? " active" : ""}`}>
              <button className="gpt-history-main" onClick={() => openConversation(chat.id)}>
                <Icon name="chat" size={16} />
                <span><strong>{chat.title}</strong><small>{relativeDate(chat.updated_at)}</small></span>
              </button>
              <button className="gpt-history-delete" onClick={() => deleteConversation(chat.id)} aria-label={`Delete ${chat.title}`}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
        <div className="gpt-sidebar-foot">
          <button onClick={() => router.push("/dashboard")}><Icon name="back" /> Dashboard</button>
          <p>Chats are private to your account.</p>
        </div>
      </aside>

      <main className="gpt-main">
        <header className="gpt-header">
          <button className="gpt-history-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open chat history"><Icon name="menu" /></button>
          <div className="gpt-header-identity">
            <div className="gpt-mark"><Icon name="chat" /></div>
            <div><h1>PerceptGPT</h1><p>Grounded in your latest Percept report</p></div>
          </div>
          <div className="gpt-header-actions">
            <button onClick={createConversation} title="New chat"><Icon name="plus" /><span>New</span></button>
            <button onClick={resetConversation} disabled={!activeId || messages.length === 0} title="Reset current chat"><Icon name="reset" /><span>Reset</span></button>
            <button className="danger" onClick={() => activeId && deleteConversation(activeId)} disabled={!activeId} title="Delete current chat"><Icon name="trash" /><span>Delete</span></button>
          </div>
        </header>

        <div className="gpt-thread">
          {loadingMessages ? (
            <div className="gpt-thread-loading">Loading conversation...</div>
          ) : messages.length === 0 ? (
            <section className="gpt-welcome">
              <div className="gpt-welcome-mark"><Icon name="chat" size={26} /></div>
              <p className="gpt-eyebrow">Your report, made clearer</p>
              <h2>What would you like to understand?</h2>
              <p className="gpt-welcome-copy">Ask about a score, a visible strength, your colour profile, or where to focus next.</p>
              <div className="gpt-prompt-grid">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button key={prompt.label} onClick={() => send(prompt.prompt)}><strong>{prompt.label}</strong><span>{prompt.prompt}</span></button>
                ))}
              </div>
            </section>
          ) : (
            <div className="gpt-messages">
              <div className="gpt-conversation-title"><span>{activeConversation?.title}</span></div>
              {messages.map((message, index) => (
                <div key={message.id ?? index} className={`gpt-message ${message.role}`}>
                  {message.role === "assistant" && <div className="gpt-message-avatar"><Icon name="chat" size={15} /></div>}
                  <div className="gpt-message-content">{message.content}</div>
                </div>
              ))}
              {sending && <div className="gpt-message assistant"><div className="gpt-message-avatar"><Icon name="chat" size={15} /></div><div className="gpt-thinking"><i /><i /><i /></div></div>}
            </div>
          )}
          {error && <div className="gpt-error">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <footer className="gpt-composer-wrap">
          <form className="gpt-composer" onSubmit={(event) => { event.preventDefault(); send(input); }}>
            <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Ask about your report..." disabled={sending} />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send message"><Icon name="send" /></button>
          </form>
          <p>PerceptGPT offers cosmetic guidance, not medical diagnosis. Verify medical concerns with a qualified professional.</p>
        </footer>
      </main>

      <style jsx global>{`
        .gpt-loading, .gpt-no-session { min-height: 100dvh; background: #f4f5f3; }
        .gpt-no-session { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; text-align: center; }
        .gpt-no-session h1 { margin: 2rem 0 1rem; color: var(--primary); font-size: 2.8rem; font-weight: 500; }
        .gpt-no-session p { max-width: 42rem; margin: 0 0 3rem; color: var(--secondary); font-size: 1.5rem; line-height: 1.6; }
        .gpt-shell { display: grid; grid-template-columns: 29rem minmax(0, 1fr); min-height: 100dvh; background: #f5f6f4; color: var(--primary); }
        .gpt-sidebar { position: sticky; top: 0; z-index: 30; display: flex; height: 100dvh; flex-direction: column; padding: 2.2rem 1.6rem 1.6rem; border-right: 1px solid #dfe4e1; background: #eef1ef; }
        .gpt-sidebar-head { display: flex; align-items: center; justify-content: space-between; min-height: 4rem; padding: 0 0.8rem; }
        .gpt-mobile-close { display: none; }
        .gpt-new-chat { display: flex; min-height: 4.8rem; align-items: center; justify-content: center; gap: 0.9rem; margin: 2.4rem 0 2.8rem; border: 0; border-radius: 1.2rem; background: var(--primary); color: #fff; font-size: 1.4rem; font-weight: 600; cursor: pointer; }
        .gpt-history-label { padding: 0 1rem 1rem; color: #81918d; font-size: 1.05rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .gpt-history-list { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 0.4rem; overflow-y: auto; }
        .gpt-history-empty { padding: 1rem; color: #82918d; font-size: 1.25rem; line-height: 1.5; }
        .gpt-history-row { display: flex; align-items: center; border-radius: 1rem; }
        .gpt-history-row.active { background: #fff; box-shadow: 0 1px 0 rgba(7,61,54,0.05); }
        .gpt-history-main { display: flex; min-width: 0; flex: 1; align-items: center; gap: 1rem; padding: 1.1rem 0.8rem 1.1rem 1rem; border: 0; background: none; color: #526762; text-align: left; cursor: pointer; }
        .gpt-history-main > span { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 0.3rem; }
        .gpt-history-main strong { overflow: hidden; color: #274c47; font-size: 1.25rem; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
        .gpt-history-main small { color: #8b9996; font-size: 1.05rem; }
        .gpt-history-delete { display: grid; width: 3.4rem; height: 3.4rem; place-items: center; margin-right: 0.5rem; border: 0; border-radius: 0.8rem; background: none; color: #94a19e; cursor: pointer; opacity: 0; }
        .gpt-history-row:hover .gpt-history-delete, .gpt-history-row.active .gpt-history-delete { opacity: 1; }
        .gpt-history-delete:hover { background: #fff0ee; color: #bd5548; }
        .gpt-sidebar-foot { padding: 1.6rem 0.8rem 0; border-top: 1px solid #d8dfdc; }
        .gpt-sidebar-foot button { display: flex; align-items: center; gap: 0.8rem; padding: 0; border: 0; background: none; color: #49615c; font-size: 1.25rem; cursor: pointer; }
        .gpt-sidebar-foot p { margin: 1.2rem 0 0; color: #899793; font-size: 1.05rem; }
        .gpt-main { display: grid; min-width: 0; height: 100dvh; grid-template-rows: auto minmax(0, 1fr) auto; }
        .gpt-header { display: flex; min-height: 8rem; align-items: center; gap: 1.6rem; padding: 1.4rem 2.4rem; border-bottom: 1px solid #e0e5e2; background: rgba(250,251,249,0.88); backdrop-filter: blur(18px); }
        .gpt-history-toggle { display: none; }
        .gpt-header-identity { display: flex; min-width: 0; flex: 1; align-items: center; gap: 1.1rem; }
        .gpt-mark, .gpt-welcome-mark, .gpt-message-avatar { display: grid; flex: 0 0 auto; place-items: center; border-radius: 50%; background: #e2efeb; color: #168f80; }
        .gpt-mark { width: 4rem; height: 4rem; }
        .gpt-header h1 { margin: 0; font-size: 1.55rem; font-weight: 650; letter-spacing: -0.02em; }
        .gpt-header p { margin: 0.3rem 0 0; color: #82938f; font-size: 1.15rem; }
        .gpt-header-actions { display: flex; gap: 0.6rem; }
        .gpt-header-actions button, .gpt-history-toggle, .gpt-mobile-close { display: flex; height: 3.8rem; align-items: center; justify-content: center; gap: 0.6rem; padding: 0 1.1rem; border: 1px solid #dce2df; border-radius: 1rem; background: #fff; color: #526762; font-size: 1.15rem; cursor: pointer; }
        .gpt-header-actions button:disabled { cursor: default; opacity: 0.35; }
        .gpt-header-actions button.danger:not(:disabled):hover { border-color: #efcac5; background: #fff4f2; color: #b84b3f; }
        .gpt-thread { min-height: 0; overflow-y: auto; padding: 4rem 3rem 2rem; }
        .gpt-thread > * { width: min(78rem, 100%); margin-right: auto; margin-left: auto; }
        .gpt-thread-loading { padding-top: 10rem; color: #83928f; text-align: center; }
        .gpt-welcome { padding-top: min(12vh, 10rem); text-align: center; }
        .gpt-welcome-mark { width: 5.6rem; height: 5.6rem; margin: 0 auto 2.2rem; }
        .gpt-eyebrow { margin: 0 0 1rem; color: #168f80; font-size: 1.05rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
        .gpt-welcome h2 { max-width: 60rem; margin: 0 auto; color: #103e38; font-size: clamp(3rem, 5vw, 4.6rem); font-weight: 400; line-height: 1.08; letter-spacing: -0.045em; }
        .gpt-welcome-copy { max-width: 52rem; margin: 1.6rem auto 3.6rem; color: #71847f; font-size: 1.4rem; line-height: 1.6; }
        .gpt-prompt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; max-width: 68rem; margin: 0 auto; text-align: left; }
        .gpt-prompt-grid button { padding: 1.6rem 1.8rem; border: 1px solid #dce3df; border-radius: 1.4rem; background: #fff; color: #1e4c46; cursor: pointer; transition: border-color 160ms, transform 160ms; }
        .gpt-prompt-grid button:hover { transform: translateY(-2px); border-color: #8ab7ae; }
        .gpt-prompt-grid strong, .gpt-prompt-grid span { display: block; }
        .gpt-prompt-grid strong { margin-bottom: 0.5rem; font-size: 1.3rem; font-weight: 600; }
        .gpt-prompt-grid span { overflow: hidden; color: #82928e; font-size: 1.15rem; text-overflow: ellipsis; white-space: nowrap; }
        .gpt-conversation-title { display: flex; align-items: center; gap: 1.2rem; margin-bottom: 3.2rem; color: #8b9895; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.1em; }
        .gpt-conversation-title::before, .gpt-conversation-title::after { content: ""; height: 1px; flex: 1; background: #e0e5e2; }
        .gpt-message { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; }
        .gpt-message.user { justify-content: flex-end; }
        .gpt-message-avatar { width: 3rem; height: 3rem; margin-top: 0.3rem; }
        .gpt-message-content { max-width: min(65rem, 82%); padding: 1.35rem 1.65rem; border-radius: 1.5rem; font-size: 1.4rem; line-height: 1.65; white-space: pre-wrap; }
        .gpt-message.assistant .gpt-message-content { border: 1px solid #dfe5e2; border-top-left-radius: 0.5rem; background: #fff; color: #344f4a; }
        .gpt-message.user .gpt-message-content { border-bottom-right-radius: 0.5rem; background: #0c5c51; color: #fff; }
        .gpt-thinking { display: flex; gap: 0.45rem; padding: 1.5rem 1.7rem; border: 1px solid #dfe5e2; border-radius: 0.5rem 1.5rem 1.5rem 1.5rem; background: #fff; }
        .gpt-thinking i { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: #75a69d; animation: gpt-dot 1.1s infinite; }
        .gpt-thinking i:nth-child(2) { animation-delay: 0.15s; }.gpt-thinking i:nth-child(3) { animation-delay: 0.3s; }
        @keyframes gpt-dot { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-0.35rem); } }
        .gpt-error { margin-top: 1.5rem; padding: 1.2rem 1.4rem; border: 1px solid #efcec9; border-radius: 1rem; background: #fff4f2; color: #a9473d; font-size: 1.25rem; }
        .gpt-composer-wrap { padding: 1.4rem 2.4rem 1.2rem; border-top: 1px solid #e0e5e2; background: rgba(250,251,249,0.94); backdrop-filter: blur(18px); }
        .gpt-composer { display: flex; width: min(78rem, 100%); align-items: flex-end; gap: 1rem; margin: 0 auto; padding: 0.7rem 0.7rem 0.7rem 1.8rem; border: 1px solid #d8e0dc; border-radius: 1.7rem; background: #fff; box-shadow: 0 1.2rem 3rem -2rem rgba(8,60,53,0.35); }
        .gpt-composer textarea { min-height: 4.2rem; max-height: 12rem; flex: 1; resize: none; padding: 1rem 0; border: 0; outline: 0; background: transparent; color: #16463f; font: inherit; font-size: 1.4rem; line-height: 1.5; }
        .gpt-composer textarea::placeholder { color: #9aa7a4; }
        .gpt-composer button { display: grid; width: 4.2rem; height: 4.2rem; flex: 0 0 auto; place-items: center; border: 0; border-radius: 1.2rem; background: #0c5c51; color: #fff; cursor: pointer; }
        .gpt-composer button:disabled { cursor: default; opacity: 0.35; }
        .gpt-composer-wrap > p { margin: 0.8rem auto 0; color: #98a4a1; font-size: 1rem; text-align: center; }
        .gpt-sidebar-scrim { display: none; }
        @media (prefers-reduced-motion: reduce) { .gpt-thinking i { animation: none; } }
        @media (max-width: 820px) {
          .gpt-shell { display: block; }
          .gpt-sidebar { position: fixed; left: 0; top: 0; width: min(32rem, 88vw); transform: translateX(-105%); transition: transform 220ms ease; box-shadow: 2rem 0 5rem rgba(9,48,43,0.16); }
          .gpt-sidebar.open { transform: translateX(0); }
          .gpt-sidebar-scrim { position: fixed; inset: 0; z-index: 25; display: block; border: 0; background: rgba(5,28,25,0.35); }
          .gpt-mobile-close, .gpt-history-toggle { display: flex; width: 3.8rem; padding: 0; }
          .gpt-main { height: 100dvh; }
          .gpt-header { min-height: 7rem; padding: 1rem 1.4rem; }
          .gpt-header-identity .gpt-mark { display: none; }
          .gpt-header-actions button { width: 3.8rem; padding: 0; }
          .gpt-header-actions span { display: none; }
          .gpt-thread { padding: 2.4rem 1.6rem 1.4rem; }
          .gpt-welcome { padding-top: 4rem; }
          .gpt-welcome h2 { font-size: 3.2rem; }
          .gpt-prompt-grid { grid-template-columns: 1fr; }
          .gpt-message-content { max-width: 86%; }
          .gpt-composer-wrap { padding: 1rem 1.2rem 0.8rem; }
          .gpt-composer-wrap > p { padding: 0 1rem; line-height: 1.35; }
        }
      `}</style>
    </div>
  );
}

export default function PerceptGPTPage() {
  return <Suspense><PerceptGPTInner /></Suspense>;
}
