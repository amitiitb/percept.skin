"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function V2SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState("free");
  const [subPlan, setSubPlan] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/auth/login?next=/v2/settings"); return; }
      setEmail(user.email ?? "");
      const { data: profile } = await supabase.from("user_profiles_v2").select("subscription_status, subscription_plan").eq("user_id", user.id).maybeSingle();
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
      const res = await fetch("/api/v2/account/delete", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "Failed to delete account");
      await supabase.auth.signOut();
      router.push("/v2/splash");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/v2/splash");
  }

  if (loading) return <div style={{ minHeight: "100dvh", background: "var(--canvas)" }} />;

  const Row = ({ label, action }: { label: string; action: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.2rem", padding: "1.8rem 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: "1.6rem", color: "var(--primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flexShrink: 0 }}>{action}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "var(--canvas)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", padding: "2rem 3.2rem", borderBottom: "1px solid var(--line)" }}>
        <button
          onClick={() => router.push("/v2/dashboard")}
          aria-label="Back to dashboard"
          style={{ width: "4.4rem", height: "4.4rem", flexShrink: 0, borderRadius: "50%", border: "1px solid var(--line)", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span style={{ fontSize: "1.8rem", fontWeight: 500, color: "var(--primary)" }}>Settings</span>
      </div>

      <div style={{ padding: "4rem 3.2rem 6rem" }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>

        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.4rem 3.2rem", marginBottom: "2.4rem" }}>
          <Row label={email} action={<span style={{ fontSize: "1.3rem", color: "var(--muted)" }}>Account email</span>} />
          <Row label="Edit profile" action={<button onClick={() => router.push("/v2/profile-setup")} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "1.4rem" }}>Edit →</button>} />
          <Row label="Skin & hair concerns" action={<button onClick={() => router.push("/v2/profile-setup")} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "1.4rem" }}>Update →</button>} />
        </div>

        {/* Legacy monthly-subscription row only shown if a subscription actually
            exists (pre-bundle-model holdover). New scans are unlocked via
            per-scan bundle purchase (/v2/bundle), not a subscription — so the
            "Upgrade" link to /v2/plans is hidden by default rather than
            pointing users at a paywall model the shipped flow no longer uses. */}
        {subStatus === "active" && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.4rem 3.2rem", marginBottom: "2.4rem" }}>
            <Row label={`Subscription: Premium (${subPlan})`} action={<span style={{ fontSize: "1.3rem", color: "#4C8C5F" }}>Active</span>} />
            <Row label="Refresh billing status" action={<button onClick={refreshBilling} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "1.4rem" }}>Refresh</button>} />
          </div>
        )}

        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "1.6rem", padding: "2.4rem 3.2rem", marginBottom: "2.4rem" }}>
          <Row label="Scan reports" action={<button onClick={() => router.push("/v2/history")} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "1.4rem" }}>View all →</button>} />
          <Row label="Privacy Policy" action={<a href="/privacy" target="_blank" style={{ color: "var(--primary)", fontSize: "1.4rem" }}>View →</a>} />
          <Row label="Terms of Service" action={<a href="/terms" target="_blank" style={{ color: "var(--primary)", fontSize: "1.4rem" }}>View →</a>} />
          <Row label="Contact support" action={<a href="mailto:support@glowmetry.com" style={{ color: "var(--primary)", fontSize: "1.4rem" }}>Email us →</a>} />
        </div>

        <div style={{ marginBottom: "2.4rem" }}>
          <PrimaryButton variant="outline" onClick={handleSignOut}>Sign out</PrimaryButton>
        </div>

        <div style={{ border: "1px solid #C8503A", borderRadius: "1.6rem", padding: "2.4rem 3.2rem" }}>
          <p style={{ fontSize: "1.6rem", color: "#C8503A", marginBottom: "1.2rem", fontWeight: 500 }}>Delete account</p>
          <p style={{ fontSize: "1.4rem", color: "var(--secondary)", marginBottom: "1.6rem", lineHeight: 1.5 }}>
            Permanently deletes your profile, all photos, and all reports. This cannot be undone.
          </p>
          {error && <p style={{ color: "#C8503A", fontSize: "1.4rem", marginBottom: "1.2rem" }}>{error}</p>}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "1px solid #C8503A", color: "#C8503A", borderRadius: "9999px", padding: "1.2rem 2.4rem", fontSize: "1.4rem", cursor: "pointer" }}>
              Delete my account
            </button>
          ) : (
            <div style={{ display: "flex", gap: "1.2rem" }}>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{ background: "#C8503A", border: "none", color: "#fff", borderRadius: "9999px", padding: "1.2rem 2.4rem", fontSize: "1.4rem", cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Deleting…" : "Yes, permanently delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={{ background: "none", border: "1px solid var(--line)", color: "var(--secondary)", borderRadius: "9999px", padding: "1.2rem 2.4rem", fontSize: "1.4rem", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
