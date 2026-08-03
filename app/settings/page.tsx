"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const ICON = {
  person: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0" strokeLinecap="round" strokeLinejoin="round" />,
  sliders: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h13M20 18h0" strokeLinecap="round" strokeLinejoin="round" />,
  folder: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" strokeLinecap="round" strokeLinejoin="round" />,
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />,
  doc: <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z M14 3v4h4" strokeLinecap="round" strokeLinejoin="round" />,
  mail: <path d="M4 5h16v14H4V5zm0 0l8 7 8-7" strokeLinecap="round" strokeLinejoin="round" />,
  refresh: <path d="M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M4 4v5h5M20 20v-5h-5" strokeLinecap="round" strokeLinejoin="round" />,
  warning: <path d="M12 9v4m0 4h.01M10.3 3.9L2.5 17a1.5 1.5 0 001.3 2.2h16.4a1.5 1.5 0 001.3-2.2L13.7 3.9a1.5 1.5 0 00-2.6 0z" strokeLinecap="round" strokeLinejoin="round" />,
};

function RowIcon({ path, tint }: { path: React.ReactNode; tint: string }) {
  return (
    <span style={{ width: "4rem", height: "4rem", flexShrink: 0, borderRadius: "1rem", background: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8">{path}</svg>
    </span>
  );
}

function Chevron() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" style={{ flexShrink: 0 }}>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsRow({
  icon, tint, label, sublabel, value, onClick, href, external,
}: {
  icon: React.ReactNode; tint: string; label: string; sublabel?: string;
  value?: string; onClick?: () => void; href?: string; external?: boolean;
}) {
  const content = (
    <>
      <RowIcon path={icon} tint={tint} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "1.55rem", color: "var(--primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {sublabel && <span style={{ display: "block", fontSize: "1.25rem", color: "var(--muted)", marginTop: "0.2rem" }}>{sublabel}</span>}
      </span>
      {value && <span style={{ flexShrink: 0, fontSize: "1.3rem", color: "var(--secondary)" }}>{value}</span>}
      <Chevron />
    </>
  );
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "1.6rem", padding: "1.6rem 0",
    borderBottom: "1px solid var(--line)", width: "100%", background: "none", border: "none",
    textAlign: "left", cursor: onClick || href ? "pointer" : "default",
  };
  if (href) {
    return (
      <motion.a whileTap={{ scale: 0.98 }} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} style={{ ...rowStyle, color: "inherit", textDecoration: "none" }}>
        {content}
      </motion.a>
    );
  }
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} style={rowStyle}>
      {content}
    </motion.button>
  );
}

function Card({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ marginBottom: "2.8rem" }}
    >
      {eyebrow && (
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", paddingLeft: "0.4rem" }}>
          {eyebrow}
        </p>
      )}
      <div style={{
        background: "var(--surface)", borderRadius: "1.8rem", padding: "0 2.4rem",
        boxShadow: "0 1.2rem 2.8rem -1.6rem rgba(0,57,52,0.22)", border: "1px solid var(--line)",
      }}>
        {children}
      </div>
    </motion.div>
  );
}

export default function V2SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [subStatus, setSubStatus] = useState("free");
  const [subPlan, setSubPlan] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/settings"); return; }
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("user_profiles_v2").select("name, subscription_status, subscription_plan").eq("user_id", user.id).maybeSingle();
      setName(profile?.name ?? "");
      setSubStatus(profile?.subscription_status ?? "free");
      setSubPlan(profile?.subscription_plan ?? null);
      setLoading(false);
    });
  }, []);

  async function refreshBilling() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: sub } = await supabase.from("subscriptions_v2").select("status, plan").eq("user_id", user.id).maybeSingle();
    if (sub) { setSubStatus(sub.status); setSubPlan(sub.plan); }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please log in again.");
      const res = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed to delete account");
      await supabase.auth.signOut();
      router.push("/splash");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/splash");
  }

  if (loading) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;

  const firstName = name ? name.split(" ")[0] : "";
  const initial = (firstName || email || "?").charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", padding: "2rem 3.2rem", borderBottom: "1px solid var(--line)", background: "var(--canvas)", position: "sticky", top: 0, zIndex: 10 }}>
        <button
          onClick={() => router.push("/dashboard")}
          aria-label="Back to dashboard"
          style={{ width: "4.4rem", height: "4.4rem", flexShrink: 0, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span style={{ fontSize: "1.8rem", fontWeight: 500, color: "var(--primary)" }}>Settings</span>
      </div>

      <div style={{ padding: "3.2rem 3.2rem 6rem" }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>

        {/* Profile header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: "flex", alignItems: "center", gap: "1.8rem", padding: "2.8rem",
            background: "var(--panel)", borderRadius: "1.8rem", marginBottom: "3.2rem",
            position: "relative", overflow: "hidden",
          }}
        >
          <div aria-hidden style={{ position: "absolute", top: "-45%", right: "-10%", width: "26rem", height: "26rem", borderRadius: "50%", background: "#D9A62E", opacity: 0.22, filter: "blur(60px)" }} />
          <div aria-hidden style={{ position: "absolute", bottom: "-50%", left: "10%", width: "16rem", height: "16rem", borderRadius: "50%", background: "var(--rose)", opacity: 0.16, filter: "blur(50px)" }} />
          <span style={{
            position: "relative", flexShrink: 0, width: "6.4rem", height: "6.4rem", borderRadius: "50%",
            background: "linear-gradient(135deg, var(--rose) 0%, #D9A62E 130%)", color: "#fff", fontSize: "2.4rem", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0.8rem 2.4rem -0.8rem rgba(217,166,46,0.6)",
          }}>
            {initial}
          </span>
          <div style={{ position: "relative", minWidth: 0 }}>
            <p style={{ fontSize: "2rem", fontWeight: 500, color: "#fff", marginBottom: "0.4rem" }}>
              {firstName ? `Hey, ${firstName}` : "Your account"}
            </p>
            <p style={{ fontSize: "1.4rem", color: "rgba(255,255,255,0.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
          </div>
        </motion.div>

        <Card eyebrow="Account">
          <SettingsRow icon={ICON.person} tint="rgba(26,158,143,0.12)" label="Edit profile" sublabel="Name, age range, country" onClick={() => router.push("/profile-setup")} />
          <SettingsRow icon={ICON.sliders} tint="rgba(217,166,46,0.14)" label="Skin & hair concerns" sublabel="Tune what your reports focus on" onClick={() => router.push("/profile-setup")} />
        </Card>

        {/* Legacy monthly-subscription row only shown if a subscription actually
            exists (pre-bundle-model holdover). New scans are unlocked via
            per-scan bundle purchase (/bundle), not a subscription — so the
            "Upgrade" link to /plans is hidden by default rather than
            pointing users at a paywall model the shipped flow no longer uses. */}
        {subStatus === "active" && (
          <Card eyebrow="Subscription">
            <SettingsRow icon={ICON.shield} tint="rgba(76,140,95,0.14)" label={`Premium (${subPlan})`} value="Active" />
            <SettingsRow icon={ICON.refresh} tint="rgba(76,140,95,0.14)" label="Refresh billing status" onClick={refreshBilling} />
          </Card>
        )}

        <Card eyebrow="Reports & support">
          <SettingsRow icon={ICON.folder} tint="rgba(26,158,143,0.12)" label="Scan reports" sublabel="Every report you've unlocked" onClick={() => router.push("/history")} />
          <SettingsRow icon={ICON.shield} tint="rgba(232,96,79,0.1)" label="Privacy Policy" href="/privacy" external />
          <SettingsRow icon={ICON.doc} tint="rgba(232,96,79,0.1)" label="Terms of Service" href="/terms" external />
          <SettingsRow icon={ICON.mail} tint="rgba(217,166,46,0.14)" label="Contact support" href="mailto:support@percept.skin" />
        </Card>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ marginBottom: "2.8rem" }}>
          <PrimaryButton variant="outline" onClick={handleSignOut}>Sign out</PrimaryButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ border: "1px solid rgba(200,80,58,0.35)", background: "rgba(200,80,58,0.04)", borderRadius: "1.8rem", padding: "2.6rem 2.8rem" }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.4rem", marginBottom: "1.6rem" }}>
            <span style={{ width: "3.6rem", height: "3.6rem", flexShrink: 0, borderRadius: "1rem", background: "rgba(200,80,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C8503A" strokeWidth="1.8">{ICON.warning}</svg>
            </span>
            <div>
              <p style={{ fontSize: "1.6rem", color: "#C8503A", fontWeight: 600, marginBottom: "0.4rem" }}>Delete account</p>
              <p style={{ fontSize: "1.4rem", color: "var(--secondary)", lineHeight: 1.5 }}>
                Permanently deletes your profile, all photos, and all reports. This cannot be undone.
              </p>
            </div>
          </div>
          {error && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.2rem" }}>{error}</p>}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "1px solid #C8503A", color: "#C8503A", borderRadius: "9999px", padding: "1.2rem 2.4rem", fontSize: "1.4rem", cursor: "pointer" }}>
              Delete my account
            </button>
          ) : (
            <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{ background: "#C8503A", border: "none", color: "#fff", borderRadius: "9999px", padding: "1.2rem 2.4rem", fontSize: "1.4rem", cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Deleting…" : "Yes, permanently delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={{ background: "none", border: "1px solid var(--line)", color: "var(--secondary)", borderRadius: "9999px", padding: "1.2rem 2.4rem", fontSize: "1.4rem", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </motion.div>
      </div>
      </div>
    </div>
  );
}
