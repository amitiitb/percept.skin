// Gemini image generation wrapper — AI hairstyle suggestions (Design/CEO review
// cherry-pick). Uses gemini-2.5-flash-image (image-to-image editing): takes the
// user's own captured photo + a style description, returns a generated preview.
//
// Cost note: each call is a real, billed generation. Gated behind an explicit
// user action in the UI (never auto-run on every scan) per the cherry-pick decision.

import { GoogleAuth } from "google-auth-library";

const GEMINI_MODEL = "gemini-2.5-flash-image";

// Vertex AI, not the Gemini Developer API (generativelanguage.googleapis.com).
// Both serve the same models, but they bill through different rails: the
// Developer API draws down an AI Studio "prepay" wallet, while Vertex bills
// through ordinary Google Cloud billing on the project. This account's prepay
// wallet is empty and, per Google's billing docs, prepay users cannot apply
// Cloud credits until they have first bought prepay credit, so every Developer
// API call returned 429 RESOURCE_EXHAUSTED even for a two-word text prompt.
// Vertex sidesteps that entirely. Verified working on this project before the
// switch: text and a real 1.1MB image edit both returned 200.
const VERTEX_LOCATION = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";
const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "glowmetry";

export class GeminiGenerationError extends Error {}
export class GeminiEmptyResponseError extends Error {}
export class GeminiQuotaError extends Error {}

// Unlike a static API key, OAuth access tokens expire (~1h), so they are
// cached and refreshed rather than re-minted per call. GoogleAuth resolves
// credentials in this order: GOOGLE_SERVICE_ACCOUNT_JSON (set in deployed
// environments), then Application Default Credentials (gcloud login locally,
// or the attached service account when running on Google Cloud).
let authClient: GoogleAuth | null = null;

function getAuth(): GoogleAuth {
  if (authClient) return authClient;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  authClient = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    ...(raw ? { credentials: JSON.parse(raw) } : {}),
  });
  return authClient;
}

async function vertexAccessToken(): Promise<string> {
  try {
    const token = await getAuth().getAccessToken();
    if (!token) throw new Error("empty token");
    return token;
  } catch (err) {
    throw new GeminiGenerationError(
      `Could not obtain Google Cloud credentials for Vertex AI: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

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
  const token = await vertexAccessToken();
  const { mimeType, data } = await toImageBytes(photoDataUrl);

  const url =
    `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}` +
    `/locations/${VERTEX_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        // Vertex uses camelCase (inlineData/mimeType) where the Developer API
        // used snake_case, and needs responseModalities set explicitly or it
        // returns only a text description instead of an edited image.
        parts: [
          { text: editInstruction },
          { inlineData: { mimeType, data } },
        ],
      }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // 429 here means a real Vertex quota/rate limit for the project, which is
    // worth surfacing distinctly so the message doesn't wrongly say "retry".
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

// Colour draping: the same person, same everything, only the garment colour
// changed, so the user is comparing colours against their own skin rather
// than against a model's. Claude decides the palette; this only renders it.
// The "pixel for pixel" framing is doing real work here, without it the model
// tends to re-pose or re-light the subject, which destroys the comparison.
export function generateColourDraping(photoDataUrl: string, colourName: string, hex: string) {
  return generateImageEdit(
    photoDataUrl,
    `Replace only the clothing in this photo with a plain ${colourName} (${hex}) crew-neck t-shirt. ` +
    `Keep the person's face, skin tone, hair, expression, head position, body position and the background EXACTLY unchanged, pixel for pixel. ` +
    `Only the garment and its colour may change. The garment colour must read as accurate ${colourName}. ` +
    `Photorealistic studio portrait, natural even lighting, no text, no logos, no patterns.`
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
