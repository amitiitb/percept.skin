import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { vertexAccessToken, VERTEX_LOCATION, VERTEX_PROJECT } from "@/lib/v2/gemini";
import { logV2 } from "@/lib/v2/log";
import type { ColourAnalysis } from "@/lib/v2/types";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const MAX_HISTORY_MESSAGES = 20; // caps context size; a chat this long is already an outlier

function scopedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Builds the grounding context from the user's own analysis rather than
// answering generically — the whole point of PerceptGPT is that it can say
// "your redness score was 72" instead of "redness varies from person to person".
async function buildSystemPrompt(supabase: ReturnType<typeof scopedClient>, userId: string, sessionId: string): Promise<string> {
  const [{ data: session }, { data: metrics }, { data: colour }] = await Promise.all([
    supabase.from("analysis_sessions_v2")
      .select("overall_score, skin_age, positive_observations, limitations")
      .eq("id", sessionId).eq("user_id", userId).maybeSingle(),
    supabase.from("analysis_metrics_v2")
      .select("category, metric_name, score, label, explanation, recommendation")
      .eq("session_id", sessionId).eq("user_id", userId),
    supabase.from("colour_analysis_v2").select("data").eq("session_id", sessionId).eq("user_id", userId).maybeSingle(),
  ]);

  const lines: string[] = [];
  if (session?.overall_score != null) lines.push(`Percept Score: ${session.overall_score}/100${session.skin_age != null ? `, estimated skin age ${session.skin_age}` : ""}.`);
  if (session?.positive_observations?.length) lines.push(`Strengths noted: ${session.positive_observations.join("; ")}.`);
  if (session?.limitations?.length) lines.push(`Analysis limitations: ${session.limitations.join("; ")}.`);

  if (metrics?.length) {
    lines.push("Per-metric results:");
    for (const m of metrics) {
      lines.push(`- [${m.category}] ${m.metric_name}: score ${m.score ?? "n/a"}, ${m.label}. ${m.explanation ?? ""} Recommendation: ${m.recommendation ?? "none"}`);
    }
  }

  const colourData = colour?.data as ColourAnalysis | undefined;
  if (colourData) {
    lines.push(
      `Colour analysis: ${colourData.season} (${colourData.sub_season}), ${colourData.undertone} undertone, ${colourData.contrast_level} contrast. ` +
      `Best colours: ${colourData.best_colours.map((c) => c.name).join(", ")}. Avoid: ${colourData.worst_colours.map((c) => c.name).join(", ")}. ` +
      `Best metal tone: ${colourData.metal_recommendation}.`
    );
  }

  const context = lines.length ? lines.join("\n") : "No analysis data is available for this scan yet.";

  return (
    `You are PerceptGPT, the conversational assistant inside Percept, an AI skin/face/hair analysis app. ` +
    `You are talking to the person whose own scan produced the data below. Your main job is explaining THEIR report: what a score means, why it's high or low, and which of their own metrics/recommendations are behind that.\n\n` +
    `Their data:\n${context}\n\n` +
    `Hard rules, follow every one of them:\n` +
    `- ALWAYS SHORT. 1-3 sentences, or a short bullet list of at most 4 bullets. Never write a paragraph, never write an essay, no matter how big or open-ended the question sounds. If you notice your answer running long, cut it down before responding.\n` +
    `- You cannot generate, edit, or show images. If asked for one, say that in one short sentence and stop, don't explain why or offer alternatives at length.\n` +
    `- Never recommend a specific treatment, medicine, drug, supplement, or over-the-counter product, and never suggest a procedure. The only exception is repeating a recommendation that is already word-for-word in their data above. If asked for suggestions beyond that, give only generic safe-habit advice (sleep, hydration, sunscreen, gentle cleansing, a balanced diet) in one line, never anything branded or ingredient-specific.\n` +
    `- Cosmetic and wellness framing only, never diagnose, never claim to detect a medical condition. If a question sounds medical (a lesion, sudden pain, a mole that changed), say briefly this isn't a diagnosis and to see a dermatologist or doctor, one sentence, don't elaborate.\n` +
    `- If asked about a metric or score not present in the data above, say plainly it wasn't part of this scan rather than inventing a number.\n` +
    `- You can answer general beauty, skincare, haircare, grooming, and style questions too, same length rules apply.\n` +
    `- Never use an em dash (—) anywhere in your response.`
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySupabaseUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { sessionId?: string; conversationId?: string; messages?: ChatMessage[] };
    const { sessionId, conversationId, messages } = body;
    if (!sessionId || !conversationId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "sessionId, conversationId and messages are required" }, { status: 400 });
    }

    const token = req.headers.get("authorization")!.slice(7);
    const supabase = scopedClient(token);

    const { data: conversation } = await supabase
      .from("perceptgpt_conversations_v2")
      .select("id, title")
      .eq("id", conversationId)
      .eq("analysis_session_id", sessionId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!latestUserMessage?.content.trim()) return NextResponse.json({ error: "A message is required" }, { status: 400 });

    const { error: userMessageError } = await supabase.from("perceptgpt_messages_v2").insert({
      conversation_id: conversationId,
      user_id: auth.userId,
      role: "user",
      content: latestUserMessage.content.trim(),
    });
    if (userMessageError) throw userMessageError;

    const systemPrompt = await buildSystemPrompt(supabase, auth.userId, sessionId);
    const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);

    const vertexToken = await vertexAccessToken();
    const url =
      `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}` +
      `/locations/${VERTEX_LOCATION}/publishers/google/models/${GEMINI_TEXT_MODEL}:generateContent`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${vertexToken}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: trimmed.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          // Low ceiling on purpose: this is a "keep it short" chat, not a
          // report-generation call, and a low thinkingBudget matches the
          // simple conversational task (no multi-step reasoning needed).
          generationConfig: { maxOutputTokens: 500, temperature: 0.6, thinkingConfig: { thinkingBudget: 200 } },
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json({ error: "PerceptGPT timed out, please try again" }, { status: 504 });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) return NextResponse.json({ error: "PerceptGPT is busy, please try again shortly" }, { status: 429 });
    if (!response.ok) {
      const errText = await response.text();
      logV2.error("perceptgpt_api_error", { status: response.status, errText });
      return NextResponse.json({ error: "PerceptGPT couldn't respond, please try again" }, { status: 500 });
    }

    const json = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };
    const reply = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!reply.trim()) {
      return NextResponse.json({ error: "PerceptGPT didn't return a response, please try again" }, { status: 500 });
    }

    const cleanReply = reply.replace(/—/g, "-").trim();
    const title = conversation.title === "New conversation"
      ? latestUserMessage.content.trim().replace(/\s+/g, " ").slice(0, 52)
      : conversation.title;
    const [{ error: assistantMessageError }, { error: conversationError }] = await Promise.all([
      supabase.from("perceptgpt_messages_v2").insert({
        conversation_id: conversationId,
        user_id: auth.userId,
        role: "assistant",
        content: cleanReply,
      }),
      supabase.from("perceptgpt_conversations_v2").update({ title, updated_at: new Date().toISOString() }).eq("id", conversationId),
    ]);
    if (assistantMessageError) throw assistantMessageError;
    if (conversationError) throw conversationError;

    return NextResponse.json({ reply: cleanReply, title });
  } catch (err) {
    logV2.error("perceptgpt_route_failed", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Something went wrong, please try again" }, { status: 500 });
  }
}
