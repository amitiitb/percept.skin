// Gemini image generation wrapper — AI hairstyle suggestions (Design/CEO review
// cherry-pick). Uses gemini-2.5-flash-image (image-to-image editing): takes the
// user's own captured photo + a style description, returns a generated preview.
//
// Cost note: each call is a real, billed generation. Gated behind an explicit
// user action in the UI (never auto-run on every scan) per the cherry-pick decision.

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiGenerationError extends Error {}
export class GeminiEmptyResponseError extends Error {}
export class GeminiQuotaError extends Error {}

// The report page passes a Supabase signed URL (https://...), not a base64
// data URL — fetch it server-side when needed rather than treating the URL
// string itself as image bytes.
async function toImageBytes(photoSource: string): Promise<{ mimeType: string; data: string }> {
  const match = photoSource.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };

  const res = await fetch(photoSource);
  if (!res.ok) throw new GeminiGenerationError(`Could not fetch source photo: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = await res.arrayBuffer();
  return { mimeType, data: Buffer.from(buf).toString("base64") };
}

// Generic image-edit call — takes the user's own photo + a plain-English edit
// instruction, returns the edited photo. Used by both hairstyle suggestions
// and AI frame try-on (same model, same cost/error profile, different prompts).
export async function generateImageEdit(
  photoDataUrl: string,
  editInstruction: string
): Promise<{ mimeType: string; base64: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiGenerationError("GEMINI_API_KEY not configured");

  const { mimeType, data } = await toImageBytes(photoDataUrl);

  const res = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: editInstruction },
          { inline_data: { mime_type: mimeType, data } },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // 429 RESOURCE_EXHAUSTED on this model usually means image generation isn't
    // enabled for the project (needs billing, not just a rate-limit backoff) —
    // surface that distinctly so the error message doesn't lie by saying "retry".
    if (res.status === 429 && /RESOURCE_EXHAUSTED|quota/i.test(errText)) {
      throw new GeminiQuotaError(`Gemini quota exceeded: ${errText}`);
    }
    throw new GeminiGenerationError(`Gemini API error: ${res.status} ${errText}`);
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
  };

  const imagePart = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!imagePart) throw new GeminiEmptyResponseError("Gemini returned no image — the request may have been refused");

  return { mimeType: imagePart.mimeType, base64: imagePart.data };
}

export function generateHairstylePreview(photoDataUrl: string, stylePrompt: string) {
  return generateImageEdit(
    photoDataUrl,
    `Edit this photo to show the person with the following hairstyle, keeping their face, skin tone, and background unchanged: ${stylePrompt}. Photorealistic, natural lighting, cosmetic preview only.`
  );
}

export function generateFramePreview(photoDataUrl: string, framePrompt: string) {
  return generateImageEdit(
    photoDataUrl,
    `Edit this photo to show the person wearing the following eyeglasses, keeping their face, identity, skin tone, hair, expression, and background pixel-for-pixel unchanged: ${framePrompt}. ` +
    `Match the quality of a professional retail virtual try-on (e.g. Lenskart) — this is the bar, not an approximation: ` +
    `the frame must sit at the correct scale relative to the face (temple width matching face width, bridge centered on the nose), ` +
    `follow the exact head angle and perspective of the original photo, cast a subtle realistic shadow from the frame onto the skin below the brow and on the nose bridge, ` +
    `show correct material rendering (metal frames must have visible specular highlights, acetate frames must look matte/glossy as appropriate), ` +
    `and render lenses with a faint realistic reflection/sheen rather than flat opaque glass. ` +
    `No warping, no floating frame, no misaligned temples. Photorealistic, natural studio lighting, cosmetic preview only — not a cartoon or sketch.`
  );
}
