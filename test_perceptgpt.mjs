import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,"")]; })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const email = `perceptgpt-test-${Date.now()}@example.com`;
const password = "Test1234!perceptgpt";

async function main() {
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (userErr) throw userErr;
  const userId = userData.user.id;
  console.log("created test user", userId);

  const { data: sessionRow, error: sessErr } = await admin.from("analysis_sessions_v2").insert({
    user_id: userId, status: "complete", overall_score: 74, skin_age: 29,
    positive_observations: ["Good facial symmetry", "Minimal redness"],
    limitations: ["Hair parting close-up not provided"],
  }).select("id").single();
  if (sessErr) throw sessErr;
  const sessionId = sessionRow.id;
  console.log("created session", sessionId);

  const { error: metricsErr } = await admin.from("analysis_metrics_v2").insert([
    { session_id: sessionId, user_id: userId, category: "skin", metric_name: "Redness appearance", score: 82, label: "Excellent", confidence: "high", explanation: "Minimal visible redness.", recommendation: "Maintain current routine.", is_premium: false },
    { session_id: sessionId, user_id: userId, category: "skin", metric_name: "Dryness indicators", score: 58, label: "Moderate", confidence: "medium", explanation: "Some flakiness around the cheeks.", recommendation: "Add a richer moisturizer at night.", is_premium: false },
    { session_id: sessionId, user_id: userId, category: "hair", metric_name: "Hair density estimate", score: 45, label: "Needs attention", confidence: "medium", explanation: "Visible thinning at the crown.", recommendation: "Consider a scalp serum.", is_premium: true },
  ]);
  if (metricsErr) throw metricsErr;
  console.log("inserted metrics");

  const { error: colourErr } = await admin.from("colour_analysis_v2").insert({
    session_id: sessionId, user_id: userId,
    data: { season: "Autumn", sub_season: "Deep Autumn", undertone: "warm", contrast_level: "medium",
      description: "Warm golden undertone.", best_colours: [{hex:"#B7410E",name:"Rust",category:"power"}],
      worst_colours: [{hex:"#ADD8E6",name:"Icy Blue",category:"power"}], neutrals: [{hex:"#5C4033",name:"Dark Brown",category:"neutral"}],
      metal_recommendation: "gold", metal_reason: "Gold complements warm undertones.",
      makeup_palette: { lip_colours: [], blush_tones: [], eye_shadows: [], avoid: [] }, clothing_tips: [] },
  });
  if (colourErr) throw colourErr;
  console.log("inserted colour analysis");

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  const token = signIn.session.access_token;
  console.log("signed in, got token");

  const res = await fetch("http://localhost:3000/api/perceptgpt", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId, messages: [{ role: "user", content: "What's my biggest concern and what should I do about it?" }] }),
  });
  const json = await res.json();
  console.log("STATUS:", res.status);
  console.log("RESPONSE:", JSON.stringify(json, null, 2));

  // cleanup
  await admin.from("colour_analysis_v2").delete().eq("session_id", sessionId);
  await admin.from("analysis_metrics_v2").delete().eq("session_id", sessionId);
  await admin.from("analysis_sessions_v2").delete().eq("id", sessionId);
  await admin.auth.admin.deleteUser(userId);
  console.log("cleaned up");
}

main().catch(e => { console.error("TEST FAILED:", e); process.exit(1); });
