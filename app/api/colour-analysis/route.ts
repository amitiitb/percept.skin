import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { hasPurchasedModule } from "@/lib/v2/requirePurchase";
import { logV2 } from "@/lib/v2/log";
import { vertexAccessToken, VERTEX_LOCATION, VERTEX_PROJECT } from "@/lib/v2/gemini";
import { stripEmDash } from "@/lib/v2/aiProvider";
import type { ColourAnalysis } from "@/lib/v2/types";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";

function scopedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
}

function stripPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx !== -1 ? dataUrl.slice(idx + 1) : dataUrl;
}

// The report page passes a Supabase signed URL (https://...), not a base64
// data URL — fetch it server-side and encode it. A remote URL string is not
// valid base64 and Claude rejects it outright ("invalid base64 data").
async function toBase64(photoSource: string): Promise<string> {
  if (photoSource.startsWith("data:")) return stripPrefix(photoSource);
  const res = await fetch(photoSource);
  if (!res.ok) throw new Error(`Could not fetch photo: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

const USER_PROMPT = `Analyze the skin tone and facial features in this photo and return a detailed personal colour analysis as JSON with exactly this structure (no markdown, no extra text):
{
  "season": "Spring",
  "sub_season": "Warm Spring",
  "undertone": "warm",
  "contrast_level": "medium",
  "description": "2-3 sentence description of this person's colouring and season type",
  "best_colours": [{ "hex": "#C8503A", "name": "Terracotta", "category": "power" }],
  "worst_colours": [{ "hex": "#708090", "name": "Slate Grey", "category": "power" }],
  "neutrals": [{ "hex": "#D4B896", "name": "Sand", "category": "neutral" }],
  "metal_recommendation": "gold",
  "metal_reason": "Gold complements warm undertones beautifully.",
  "makeup_palette": {
    "lip_colours": ["Rose Mauve", "Coral Nude"],
    "blush_tones": ["Peach", "Warm Rose"],
    "eye_shadows": ["Bronze", "Copper", "Taupe"],
    "avoid": ["Cool Pinks", "Ash Greys"]
  },
  "clothing_tips": ["Wear earthy tones", "Avoid icy pastels", "Opt for warm whites over stark white", "Navy can work if it has warm undertones"]
}
season must be one of: Spring, Summer, Autumn, Winter.
undertone: warm | cool | neutral | olive.
contrast_level: low | medium | high.
metal_recommendation: gold | silver | rose_gold | mixed.
category for each colour: power | accent | neutral.
Provide 6-8 best_colours, 4-5 worst_colours, 4-5 neutrals.
Return ONLY valid JSON — no explanation, no markdown fences.`;

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySupabaseUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId, photoDataUrl } = await req.json() as { sessionId?: string; photoDataUrl?: string };
    if (!sessionId || !photoDataUrl) return NextResponse.json({ error: "sessionId and photoDataUrl are required" }, { status: 400 });

    const token = req.headers.get("authorization")!.slice(7);
    const supabase = scopedClient(token);

    if (!(await hasPurchasedModule(supabase, auth.userId, sessionId, "colour"))) {
      return NextResponse.json({ error: "Purchase the Color Analysis module to generate this report" }, { status: 403 });
    }

    const base64Photo = await toBase64(photoDataUrl);

    const url =
      `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}` +
      `/locations/${VERTEX_LOCATION}/publishers/google/models/${GEMINI_TEXT_MODEL}:generateContent`;
    const vertexToken = await vertexAccessToken();

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${vertexToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are a certified personal colour analysis expert trained in seasonal colour theory. Analyze facial photos accurately to determine skin undertone, contrast level, and seasonal colour type. This is cosmetic/wellness guidance, not medical advice. Return only valid JSON with no extra text. Never use the em dash character (—) anywhere in your output; use a comma, colon, period, or hyphen instead." }] },
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Photo } },
            { text: USER_PROMPT },
          ],
        }],
        // Native JSON mode — the markdown-fence stripping below is a no-op
        // safety net here, same as the main analysis path. thinkingBudget caps
        // internal reasoning so it can't crowd out the JSON body (measured
        // thinking spend up to ~2470 tokens on this exact prompt); maxOutputTokens
        // is well above budget + JSON body (~900 tokens observed) so a truncated,
        // unparseable reply is a config bug here, not something the model did.
        generationConfig: {
          responseMimeType: "application/json", maxOutputTokens: 6000, temperature: 0.4,
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errText}`);
    }

    const geminiResponse = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    };
    const candidate = geminiResponse.candidates?.[0];
    // Same truncation shape as the main analysis path: MAX_TOKENS means the
    // reply was cut off mid-JSON, not that the model wrote invalid JSON.
    // Caught explicitly so the failure reads as "ran out of budget", not a
    // confusing JSON.parse syntax error over a string that looks fine at a glance.
    if (candidate?.finishReason === "MAX_TOKENS") {
      throw new Error("Gemini exhausted its output budget before producing a complete result");
    }
    const rawText = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const analysis = stripEmDash(JSON.parse(cleaned) as ColourAnalysis);

    const { error } = await supabase.from("colour_analysis_v2").upsert({
      session_id: sessionId, user_id: auth.userId, data: analysis,
    }, { onConflict: "session_id" });
    if (error) throw error;

    logV2.info("v2_colour_analysis_completed", { session_id: sessionId, season: analysis.season });
    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logV2.error("v2_colour_analysis_failed", { message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
