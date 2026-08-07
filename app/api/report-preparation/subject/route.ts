import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifySupabaseUser } from "@/lib/supabase/verifyRequest";
import { signedFrontPhotoForSession } from "@/lib/v2/sessionPhoto";
import { vertexAccessToken, VERTEX_LOCATION, VERTEX_PROJECT } from "@/lib/v2/gemini";
import { logV2 } from "@/lib/v2/log";

type SubjectCategory = "adult_masculine" | "adult_feminine" | "child" | "neutral";

function scopedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  const auth = await verifySupabaseUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json() as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  try {
    const token = req.headers.get("authorization")!.slice(7);
    const supabase = scopedClient(token);
    const photoUrl = await signedFrontPhotoForSession(supabase, auth.userId, sessionId);
    const photoResponse = await fetch(photoUrl);
    if (!photoResponse.ok) throw new Error(`Could not fetch source photo: ${photoResponse.status}`);
    const photo = Buffer.from(await photoResponse.arrayBuffer()).toString("base64");
    const mimeType = photoResponse.headers.get("content-type") ?? "image/jpeg";
    const accessToken = await vertexAccessToken();
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}` +
      `/locations/${VERTEX_LOCATION}/publishers/google/models/gemini-2.5-flash:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { inlineData: { mimeType, data: photo } },
          { text: "Assess only what is visibly useful for cosmetic styling. Do not infer or claim gender identity and do not use account profile information. Classify the styling presentation as adult_masculine, adult_feminine, child, or neutral. Separately report whether clearly visible beard, moustache, or substantial facial hair is present. Beard previews are appropriate when the subject is visibly an adult and either has clear facial hair already or has an unambiguously masculine styling presentation. A clearly bearded adult must be beard-eligible even if presentation is otherwise neutral. Return JSON only." },
        ] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              category: { type: "STRING", enum: ["adult_masculine", "adult_feminine", "child", "neutral"] },
              facialHairPresent: { type: "BOOLEAN" },
              beardEligible: { type: "BOOLEAN" },
            },
            required: ["category", "facialHairPresent", "beardEligible"],
          },
          // This is a tiny grounded classification, not a reasoning task.
          // With the model's default thinking enabled and maxOutputTokens at
          // 100, repeated real requests spent the allowance internally and
          // returned no text at all. Reserve the response budget for JSON.
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0,
          maxOutputTokens: 500,
        },
      }),
    });
    if (!response.ok) throw new Error(`Gemini classification failed: ${response.status}`);
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
    const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    // Some Vertex responses still wrap schema-constrained JSON with a short
    // sentence or markdown fence. Extract the object rather than silently
    // converting a formatting mistake into "neutral" and omitting beard work.
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (!objectMatch) throw new Error(`Gemini classification returned no JSON object (finish: ${data.candidates?.[0]?.finishReason ?? "unknown"})`);
    const parsed = JSON.parse(objectMatch[0]) as { category?: SubjectCategory; facialHairPresent?: boolean; beardEligible?: boolean };
    const allowed: SubjectCategory[] = ["adult_masculine", "adult_feminine", "child", "neutral"];
    const category = parsed.category && allowed.includes(parsed.category) ? parsed.category : "neutral";
    const facialHairPresent = parsed.facialHairPresent === true;
    const beardEligible = category !== "child" && (
      facialHairPresent || category === "adult_masculine" || parsed.beardEligible === true
    );
    logV2.info("v2_subject_styling_classified", { session_id: sessionId, category, facial_hair_present: facialHairPresent, beard_eligible: beardEligible });
    return NextResponse.json({ category, facialHairPresent, beardEligible });
  } catch (error) {
    logV2.error("v2_subject_styling_classification_failed", {
      session_id: sessionId,
      message: error instanceof Error ? error.message : String(error),
    });
    // Do not silently turn an infrastructure/formatting error into an
    // ineligible result. The preparation screen retries instead of opening an
    // incomplete paid report with its beard section missing.
    return NextResponse.json({ error: "Could not determine whether beard recommendations apply. Please retry." }, { status: 503 });
  }
}
