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
export const VERTEX_LOCATION = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";
export const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "glowmetry";

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

// Exported so the text-generation callers (aiProvider.ts, colour-analysis
// route) share this token cache instead of each standing up their own
// GoogleAuth instance and re-authenticating on every request.
export async function vertexAccessToken(): Promise<string> {
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

// Shared by every grid generator below (colour/frame/hairstyle/beard) so a
// reliability tweak — panel count, no repeated looks, consistent expression —
// only has to change in one place instead of four near-identical copies.
const GRID_CONSISTENCY_RULES =
  `Return EXACTLY 6 panels arranged in a grid 3 panels wide and 2 panels tall, and fill every one of the 6 cells. ` +
  `Never leave a cell blank, grey or empty, and never pad the grid with a duplicate. ` +
  `Not one of the 6 panels may be the original unedited photograph: every panel must show a real, visible change. ` +
  `All 6 panels must be clearly different from every other panel — before drawing each panel, check it against the ones already drawn, and if it would repeat an earlier look, draw a different variation instead; a repeated panel is a failure. ` +
  `Keep the exact same neutral facial expression, head angle, and eye direction in every single panel — do not let the face's expression shift from panel to panel, only the styling changes. `;

// Account profile data deliberately does not participate in image styling: an
// account holder may scan a partner, relative, client, or child. The source
// photograph is the authority for this generation. This is phrased as visual
// presentation rather than a claim about the person's gender identity.
const SUBJECT_ADAPTATION_RULES =
  `First inspect only the supplied subject and choose one visual styling category for this generation: adult masculine-presenting, adult feminine-presenting, child, or ambiguous/neutral. ` +
  `Use that one category consistently in all six panels and never borrow identity or styling assumptions from an account owner. ` +
  `If the subject is a child, use only age-appropriate child styling and clothing: no beard, mustache, stubble, adult formalwear, sexualized styling, or adult body proportions. ` +
  `If presentation is ambiguous, keep styling neutral and close to the source instead of making a strong masculine or feminine guess. ` +
  `This classification controls styling only; it must not change the subject's face, body, age, skin, or identity. `;

// One composite grid rather than one call per colour. Measured on real runs:
// a single grid costs ~1/6th of six separate generations, returns in ~10s
// instead of ~17s, and reads as more cohesive because every panel is lit and
// framed identically by construction.
//
// "No text" is load-bearing. Image models garble small type badly, so every
// label, swatch and hex code is rendered in HTML over/around this image
// instead, where it stays crisp, selectable and translatable.
//
// Panel count is a request, not a guarantee: observed runs returned 9 panels
// for a 6-panel ask and 6 for a 5-panel ask. So the UI must never label
// panels positionally, it shows the palette names separately. Same reason
// the colour list is phrased as "drawn from" rather than an exact sequence.
// Occasions rather than abstract options. "Deep olive crew-neck" is a swatch
// with a person behind it; "what to wear to an office day" is a decision the
// user actually has to make. The occasion list is fixed and ordered so the UI
// can caption the panels underneath in the same order.
export const COLOUR_OCCASIONS = [
  "everyday office wear, a smart plain shirt",
  "a formal suit with shirt and tie",
  "a wedding or festive celebration outfit",
  "a relaxed weekend casual top",
  "an evening party or night-out outfit",
  "a smart-casual blazer over a plain tee",
] as const;

export function generateColourGrid(photoDataUrl: string, colourNames: string[]) {
  return generateImageEdit(
    photoDataUrl,
    `Create a single clean grid collage image of THIS EXACT person: same face, same hair, same neutral background in every panel. ` +
    SUBJECT_ADAPTATION_RULES +
    `Each panel shows them dressed for a different occasion, in this exact order: ${COLOUR_OCCASIONS.join("; then ")}. ` +
    `Every outfit must use colours drawn from this palette: ${colourNames.join(", ")}. ` +
    `Preserve the subject's identity, body proportions and existing gender presentation. All six outfits must be coherent with the same presentation visible in the source; do not masculinize, feminize or mix presentation between panels. ` +
    GRID_CONSISTENCY_RULES +
    `Photorealistic studio portraits, identical framing, pose and lighting in every panel, thin white gutters between panels. ` +
    `Absolutely no text, no words, no letters, no labels and no colour names anywhere in the image.`
  );
}

// Frames need more prompt weight than colour or hair: the model will happily
// return the same silhouette five times, or float the frame off the face, so
// the distinctness and fit requirements are stated explicitly. The existing
// per-frame route stays for users who want to try one style at a time.
export const FRAME_OCCASIONS = [
  "professional office eyeglasses, understated and formal",
  "bold statement eyeglasses for evenings and parties",
  "classic timeless eyeglasses for formal and wedding wear",
  "relaxed everyday casual eyeglasses",
  "lightweight minimal rimless eyeglasses for all-day wear",
  "sporty lightweight frames for everyday errands",
] as const;

export function generateFrameGrid(photoDataUrl: string, frameNames: string[]) {
  const requiredPanels = frameNames.map((frame, index) =>
    `panel ${index + 1}: ${frame}, for ${FRAME_OCCASIONS[index]}`
  ).join("; ");
  return generateImageEdit(
    photoDataUrl,
    `Create a single clean grid collage image of THIS EXACT person: same face, same skin tone, same hair, same neutral background and same clothing in every panel. ` +
    SUBJECT_ADAPTATION_RULES +
    `Render these six prescribed and visibly different designs in this exact panel order: ${requiredPanels}. ` +
    `Every panel must show a visibly distinct frame shape and material, never the same design twice. ` +
    GRID_CONSISTENCY_RULES +
    `First assess the subject's face shape and proportions. Each prescribed frame must be adapted in width, lens height and scale to flatter this specific face; do not use an oversized or poorly proportioned frame merely to exaggerate variety. ` +
    `The six silhouettes must remain unmistakably different: rectangular, browline, cat-eye, hexagonal, rimless, and trapezoidal Wayfarer respectively. In particular panels 4 and 6 must not both become rectangular. ` +
    `In each panel the glasses must sit correctly on the face: temple width matching face width, bridge centred on the nose, ` +
    `a subtle realistic shadow on the nose bridge and under the brow, and a faint lens sheen rather than flat opaque glass. ` +
    `No warping, no floating frames, no misaligned temples. ` +
    `Photorealistic, identical framing and lighting in every panel, thin white gutters between panels. ` +
    `Absolutely no text, no words, no letters and no labels anywhere in the image.`
  );
}

export const HAIRSTYLE_OCCASIONS = [
  "a clean professional office look",
  "a formal wedding or black-tie look",
  "a relaxed everyday casual look",
  "a sharp evening party look",
  "a low-maintenance short practical look",
  "a textured, slightly tousled everyday look",
] as const;

export function generateHairstyleGrid(photoDataUrl: string, styleNames: string[]) {
  const requiredPanels = styleNames.map((style, index) =>
    `panel ${index + 1}: ${style}, styled for ${HAIRSTYLE_OCCASIONS[index]}`
  ).join("; ");
  return generateImageEdit(
    photoDataUrl,
    `Use the supplied photograph as an IMMUTABLE identity reference and create a single clean grid collage of THIS EXACT person. ` +
    SUBJECT_ADAPTATION_RULES +
    `Render these six prescribed and visibly different hairstyles in this exact panel order: ${requiredPanels}. ` +
    `Every panel must show a visibly distinct cut and styling, never the same look twice. ` +
    GRID_CONSISTENCY_RULES +
    `Before rendering, determine the single styling presentation already expressed by the subject in the source photograph. Keep that same presentation consistently across all six panels. Do not mix conventionally masculine and conventionally feminine hairstyle families in one grid. Do not introduce ponytails, buns, curtain bangs, bobs or long flowing layers unless they are consistent with the source subject's existing presentation. ` +
    `EDIT ONLY THE HAIR PIXELS ON THE TOP AND SIDES OF THE HEAD. Preserve the original hairline and natural hair colour. ` +
    `Preserve the subject's presentation exactly as shown in the source. Do not masculinize, feminize, or change their apparent gender presentation. ` +
    `Facial-hair presence is immutable: if the source has no beard, mustache or stubble, every panel must remain completely free of beard, mustache and stubble; if facial hair is present, preserve it pixel-for-pixel. ` +
    `Everything below the scalp hairline must remain visually identical to the source photograph: exact facial identity, face shape, eyes, eyebrows, nose, lips, ears, skin tone, skin texture, neck, clothing, pose, expression, camera perspective, lighting, shadows and background. ` +
    `Do not beautify, retouch, sharpen, relight, smooth skin, remove marks, alter facial hair, change body proportions, or reconstruct the face. Do not make the person younger, slimmer, more symmetrical or more conventionally attractive. ` +
    `The result must look like the original unedited photo with only a hairstyle placed naturally onto it. Identical framing and thin white gutters between panels. ` +
    `Absolutely no text, no words, no letters and no labels anywhere in the image.`
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

// "Simulate" grooming previews — deliberately scoped to styling choices
// (beard shape), never bone-structure reshaping. A user can grow or shave a
// beard; that implies no surgical or medical outcome, unlike a simulated
// nose/cheekbone/chin change would. Same 6-panel grid mechanism as
// hairstyle/frame/colour.
//
// An eyebrow-shape version of this (EYEBROW_STYLES/generateEyebrowGrid) was
// built and tried, then removed: two real generation rounds, including a
// prompt explicitly demanding exaggerated differences, both came back with
// all 6 panels showing near-identical brows. Beard presence/coverage is a
// large, reliable edit for this model; eyebrow shape is not — that appears to
// be a capability limit, not a prompt-wording problem.
export const BEARD_STYLES = [
  "fully clean-shaven",
  "light stubble, a few days of growth",
  "short boxed beard, neatly lined",
  "full classic beard, moderate length",
  "goatee with a trimmed mustache",
  "mustache only, no beard",
] as const;

export function generateBeardGrid(photoDataUrl: string, styleNames: string[]) {
  const requiredPanels = styleNames.map((style, index) => `panel ${index + 1}: ${style}`).join("; ");
  return generateImageEdit(
    photoDataUrl,
    `Create a single clean grid collage image of THIS EXACT person: same face, same skin tone, same hairstyle, same neutral background and same clothing in every panel. ` +
    `This facial-hair preview is for adults only. If the supplied subject appears to be a child, do not generate facial hair or an image; return a brief text refusal instead. ` +
    `For an adult, infer styling from the photographed subject only, never from the account owner. ` +
    `Render exactly these six facial-hair maps in order: ${requiredPanels}. ` +
    `Every panel must show a visibly distinct facial hair style, never the same look twice. ` +
    GRID_CONSISTENCY_RULES +
    `The coverage geometry is mandatory: panel 1 has zero facial hair; panel 2 is sparse short stubble over beard areas; panel 3 is a short sharply edged boxed beard; panel 4 is a visibly longer full beard extending well below the chin; panel 5 has completely clean-shaven cheeks and jaw with hair only around the mouth and chin; panel 6 has completely clean-shaven cheeks, chin and jaw with hair only on the upper lip. Panels 4 and 5 must never share the same full-beard coverage. ` +
    `EDIT ONLY THE FACIAL-HAIR PIXELS around the upper lip, cheeks, chin and jaw. Keep the person's own hair colour, jawline and bone structure completely unchanged. ` +
    `Preserve the source face, skin texture, hairstyle, clothing, pose, lighting, shadows and background exactly. Do not beautify, retouch, smooth skin, relight or reconstruct the person. ` +
    `The result must look like the original unedited photo with only the facial hair changed. Identical framing and thin white gutters between panels. ` +
    `Absolutely no text, no words, no letters and no labels anywhere in the image.`
  );
}
