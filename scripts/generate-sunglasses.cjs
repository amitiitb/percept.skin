// Generates the sunglasses product-shot PNGs in public/frames/photo/, in the
// same photoreal catalogue style as the existing eyeglasses cutouts there.
// One-off/occasional tool, not part of the app's runtime — run by hand with
// `node scripts/generate-sunglasses.cjs` when adding or regenerating a style.
//
// GlassesVirtualTryOn.tsx draws these PNGs directly onto a real face photo
// via canvas, so they need genuine alpha transparency and a colour-clean
// edge, not just a plain background — image models don't reliably output
// true alpha even when asked for one, so this asks for a flat colour
// background instead and processes it out afterward. Three real failure
// modes surfaced getting this pipeline right, in the order they were found
// (worth keeping as comments — simplifying any one of these three steps
// reintroduces the failure it fixes):
//
//   1. Assuming the background renders as the exact requested hex. It
//      doesn't — a "#FF00FF" request came back as a muted rose in testing,
//      nowhere close enough to a naive assumed-colour distance check. Fixed
//      by sampling each image's own corner pixels as the key colour.
//
//   2. Colour-only keying with no spatial awareness. A cat-eye lens's pale
//      gradient rendered close enough to the background's colour that keying
//      by colour alone ate into the lens itself. Fixed with connected-
//      component labelling: only background-coloured regions that either (a)
//      touch the image border, or (b) are small enough to be a real enclosed
//      gap (a nose-bridge notch, a hinge crevice — a few thousand pixels) get
//      cleared. A same-coloured patch fully enclosed by product material and
//      too large to be a notch (the lens) stays opaque regardless of colour.
//
//   3. Two defects only showed up once tested against a real face photo
//      (not just an isolated product shot): a baked-in studio shadow left a
//      visible tinted residue under the lenses — removed below the last row
//      containing any fully-opaque (alpha=255) pixel, since the app already
//      casts its own contact shadow onto the real face and this one was
//      redundant. And thin structures (a wire frame's rim) have many
//      semi-transparent edge pixels that are a genuine optical blend of
//      product colour and background colour — alpha alone can't remove a
//      tint baked into the RGB, so those pixels get colour-decontaminated
//      (unmixed against the sampled key colour) rather than left tinted.
//
// A row-opacity-COUNT heuristic was tried for the shadow cutoff first and
// discarded — it false-triggered inside round/shield's actual lens, because
// circular and wraparound silhouettes have natural non-monotonic pixel-count
// variation row to row that looks like a "rising" shadow signature but isn't.
// Max-alpha-per-row doesn't have that failure mode: a genuine lens interior
// always has some fully-opaque pixels even where its row-by-row count
// wobbles; only the soft shadow lacks any.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { GoogleAuth } = require("google-auth-library");

const PROJECT_ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(PROJECT_ROOT, "public/frames/photo");
require("@next/env").loadEnvConfig(PROJECT_ROOT);

const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "glowmetry";
const VERTEX_LOCATION = process.env.GOOGLE_VERTEX_IMAGE_LOCATION || "global";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const HOST = VERTEX_LOCATION === "global" ? "aiplatform.googleapis.com" : `${VERTEX_LOCATION}-aiplatform.googleapis.com`;
// Named GENERATE_URL, not URL — shadowing the global URL constructor broke
// google-auth-library's internal HTTP client in a way that took a while to
// trace back to this file.
const GENERATE_URL = `https://${HOST}/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${MODEL}:generateContent`;

// Not colour-critical (only used as the chroma-key target, then discarded) —
// chosen because no realistic sunglasses colourway lands anywhere near magenta.
const KEY_HEX = "#FF00FF";
// A real enclosed gap (nose bridge, hinge notch) measured a few thousand
// pixels in testing at 1344x768; a lens measured 100k+. This sits well
// between the two.
const SMALL_ISLAND_MAX_PX = 25000;
const BG_MATCH_THRESHOLD = 55;
const OPAQUE_THRESHOLD = 250;

async function getToken() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    ...(raw ? { credentials: JSON.parse(raw) } : {}),
  });
  return await auth.getAccessToken();
}

async function generate(prompt) {
  const token = await getToken();
  const res = await fetch(GENERATE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: "2K" } },
    }),
  });
  if (!res.ok) throw new Error(`Vertex ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.filter(p => p.inlineData).at(-1)?.inlineData;
  if (!part) throw new Error("No image returned — request may have been refused: " + JSON.stringify(json).slice(0, 500));
  return Buffer.from(part.data, "base64");
}

// Step 1+2: chroma-key by sampled corner colour, connected-component gated
// so the key can't eat into a same-coloured lens.
async function chromaKeyToAlpha(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const n = width * height;

  const { kr, kg, kb } = sampleCorners(data, width, height, channels);

  const isBg = new Uint8Array(n);
  const distArr = new Float32Array(n);
  for (let idx = 0; idx < n; idx++) {
    const i = idx * channels;
    const d = colourDistance(data[i], data[i + 1], data[i + 2], kr, kg, kb);
    distArr[idx] = d;
    if (d <= BG_MATCH_THRESHOLD) isBg[idx] = 1;
  }

  const { label, componentSize, componentTouchesBorder } = labelComponents(isBg, width, height);

  for (let idx = 0; idx < n; idx++) {
    const lbl = label[idx];
    let alpha = 255;
    if (lbl !== -1 && (componentTouchesBorder[lbl] || componentSize[lbl] <= SMALL_ISLAND_MAX_PX)) {
      const d = distArr[idx];
      alpha = d < BG_MATCH_THRESHOLD * 0.4 ? 0 : Math.round((d / BG_MATCH_THRESHOLD) * 255);
    }
    data[idx * channels + 3] = alpha;
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

// Step 3a: drop the studio shadow below the last row with any fully-opaque
// pixel (with a small margin so the product's own soft anti-aliased bottom
// edge survives).
async function removeShadow(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let lastFullyOpaqueRow = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] >= OPAQUE_THRESHOLD) { lastFullyOpaqueRow = y; break; }
    }
  }
  const cutoff = lastFullyOpaqueRow + 3;
  for (let y = cutoff; y < height; y++) {
    for (let x = 0; x < width; x++) data[(y * width + x) * channels + 3] = 0;
  }

  return { buffer: await sharp(data, { raw: { width, height, channels } }).png().toBuffer(), cutoff, width, height };
}

// Step 3b: unmix true foreground colour out of every semi-transparent pixel,
// removing the background tint that chroma-keying alpha alone leaves behind.
async function decontaminate(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const { kr, kg, kb } = sampleCorners(data, width, height, channels);

  for (let idx = 0; idx < width * height; idx++) {
    const i = idx * channels;
    const a = data[i + 3];
    if (a === 0 || a === 255) continue;
    const af = a / 255;
    data[i]     = clamp255(Math.round((data[i]     - kr * (1 - af)) / af));
    data[i + 1] = clamp255(Math.round((data[i + 1] - kg * (1 - af)) / af));
    data[i + 2] = clamp255(Math.round((data[i + 2] - kb * (1 - af)) / af));
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

function sampleCorners(data, width, height, channels) {
  const corners = [[4, 4], [width - 5, 4], [4, height - 5], [width - 5, height - 5]];
  let kr = 0, kg = 0, kb = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * channels;
    kr += data[i]; kg += data[i + 1]; kb += data[i + 2];
  }
  return { kr: kr / 4, kg: kg / 4, kb: kb / 4 };
}

function colourDistance(r, g, b, kr, kg, kb) {
  const dr = r - kr, dg = g - kg, db = b - kb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function clamp255(v) { return Math.max(0, Math.min(255, v)); }

function labelComponents(isBg, width, height) {
  const n = width * height;
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let nextLabel = 0;
  const componentSize = [];
  const componentTouchesBorder = [];

  for (let start = 0; start < n; start++) {
    if (!isBg[start] || label[start] !== -1) continue;
    let qHead = 0, qTail = 0;
    queue[qTail++] = start;
    label[start] = nextLabel;
    let size = 0, touchesBorder = false;
    while (qHead < qTail) {
      const idx = queue[qHead++];
      size++;
      const x = idx % width, y = (idx / width) | 0;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      const neighbours = [
        x > 0 ? idx - 1 : -1, x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1, y < height - 1 ? idx + width : -1,
      ];
      for (const nb of neighbours) {
        if (nb >= 0 && isBg[nb] && label[nb] === -1) {
          label[nb] = nextLabel;
          queue[qTail++] = nb;
        }
      }
    }
    componentSize[nextLabel] = size;
    componentTouchesBorder[nextLabel] = touchesBorder;
    nextLabel++;
  }
  return { label, componentSize, componentTouchesBorder };
}

// Measures the opacity-weighted centroid of the left/right halves of the
// (by this point, shadow-free) frame body — the starting point for a style's
// lx/ly/rx/ry anchors in GlassesVirtualTryOn.tsx. Bounding-box-derived
// anchors put round/wayfarer up on the forehead in testing, since temple arms
// extend the box much further out than the lenses actually sit; the centroid
// tracks the visual mass of each half instead. Still worth a live on-face
// check before trusting a new style's anchors — this is a good starting
// estimate, not a guarantee.
async function measureAnchors(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const midX = width / 2;
  let lSumX = 0, lSumY = 0, lWeight = 0;
  let rSumX = 0, rSumY = 0, rWeight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a < 40) continue;
      if (x < midX) { lSumX += x * a; lSumY += y * a; lWeight += a; }
      else { rSumX += x * a; rSumY += y * a; rWeight += a; }
    }
  }
  return {
    lx: (lSumX / lWeight / width).toFixed(3), ly: (lSumY / lWeight / height).toFixed(3),
    rx: (rSumX / rWeight / width).toFixed(3), ry: (rSumY / rWeight / height).toFixed(3),
  };
}

// Add a new style here and re-run to extend the set — the prompt convention
// (dead-on frontal, symmetric, NO temple arms, flat KEY_HEX background,
// realistic lens material/reflection, no props/text/hands/face) is what keeps
// new styles visually consistent with each other.
//
// Deliberately cropped tight with no temple arms, unlike the pre-existing
// eyeglasses in this same folder (which do show arms) — a geometric
// post-crop was tried first and discarded: column-height-based arm detection
// works for roughly-oval shapes but cateye's silhouette genuinely narrows
// toward its swept outer corners, so at the x-position that needed cutting,
// the lens itself was legitimately short there — indistinguishable from an
// arm by height alone, and impossible to fix with a better threshold. Asking
// the model to never draw the arm in the first place sidesteps that
// entirely: no post-hoc geometry has to guess where product ends and arm
// begins.
const STYLES = [
  {
    file: "aviator-sunglasses.png",
    label: "Aviator Sunglasses",
    prompt: `Professional retail eyewear catalogue product photograph of a pair of classic aviator sunglasses, dead-on frontal symmetric view exactly like an optician's product listing. Thin polished gold metal frame with a double bridge and teardrop-shaped lenses. Lenses are a dark green gradient tint, slightly darker at the top fading lighter toward the bottom, with a soft realistic reflection, not flat opaque black. Crop tight to just the lens rims, bridge and the short hinge stub on each side — do NOT draw the temple arms that would fold back over the ears; the frame should end cleanly at each hinge with nothing extending further outward. Solid flat ${KEY_HEX} background, no shadow, no reflection surface, no props, no text, no watermark, no hands or face. Sharp focus, studio product lighting, high resolution, photorealistic.`,
  },
  {
    file: "wayfarer-sunglasses.png",
    label: "Wayfarer Sunglasses",
    prompt: `Professional retail eyewear catalogue product photograph of a pair of classic Wayfarer sunglasses, dead-on frontal symmetric view exactly like an optician's product listing. Thick glossy matte-black acetate frame with a trapezoidal silhouette. Lenses are solid dark charcoal-black with a faint realistic sheen, not flat opaque paint. Crop tight to just the lens rims, bridge and the short hinge stub on each side — do NOT draw the temple arms that would fold back over the ears; the frame should end cleanly at each hinge with nothing extending further outward. Solid flat ${KEY_HEX} background, no shadow, no reflection surface, no props, no text, no watermark, no hands or face. Sharp focus, studio product lighting, high resolution, photorealistic.`,
  },
  {
    file: "round-sunglasses.png",
    label: "Round Sunglasses",
    prompt: `Professional retail eyewear catalogue product photograph of a pair of round sunglasses, dead-on frontal symmetric view exactly like an optician's product listing. Thin gunmetal-grey circular metal frame, John Lennon style, with a thin keyhole bridge. Lenses are solid medium-grey tint with a soft realistic reflection, not flat opaque paint. Crop tight to just the lens rims, bridge and the short hinge stub on each side — do NOT draw the temple arms that would fold back over the ears; the frame should end cleanly at each hinge with nothing extending further outward. Solid flat ${KEY_HEX} background, no shadow, no reflection surface, no props, no text, no watermark, no hands or face. Sharp focus, studio product lighting, high resolution, photorealistic.`,
  },
  {
    file: "shield-sunglasses.png",
    label: "Oversized Shield Sunglasses",
    prompt: `Professional retail eyewear catalogue product photograph of a pair of modern oversized shield sunglasses, dead-on frontal symmetric view exactly like an optician's product listing. Single continuous wraparound dark lens with a slim matte-black frame along the top edge only, sporty and contemporary. Lens is a solid dark smoke-grey tint with a subtle realistic gradient and reflection, not flat opaque paint. Crop tight to just the lens and the short hinge stub on each side — do NOT draw the temple arms that would fold back over the ears; the frame should end cleanly at each hinge with nothing extending further outward. Solid flat ${KEY_HEX} background, no shadow, no reflection surface, no props, no text, no watermark, no hands or face. Sharp focus, studio product lighting, high resolution, photorealistic.`,
  },
  {
    file: "cateye-sunglasses.png",
    label: "Cat-Eye Sunglasses",
    prompt: `Professional retail eyewear catalogue product photograph of a pair of cat-eye sunglasses, dead-on frontal symmetric view exactly like an optician's product listing. Warm tortoiseshell acetate frame with an upswept outer corner silhouette. Lenses are a warm brown gradient tint, darker at the top fading lighter toward the bottom, with a soft realistic reflection, not flat opaque paint. Crop tight to just the lens rims, bridge and the short hinge stub on each side — do NOT draw the temple arms that would fold back over the ears; the frame should end cleanly at each hinge with nothing extending further outward. Solid flat ${KEY_HEX} background, no shadow, no reflection surface, no props, no text, no watermark, no hands or face. Sharp focus, studio product lighting, high resolution, photorealistic.`,
  },
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const s of STYLES) {
    process.stdout.write(`Generating ${s.label}... `);
    try {
      const raw = await generate(s.prompt);
      const keyed = await chromaKeyToAlpha(raw);
      const { buffer: shadowless } = await removeShadow(keyed);
      const clean = await decontaminate(shadowless);
      const outPath = path.join(OUT_DIR, s.file);
      fs.writeFileSync(outPath, clean);
      const meta = await sharp(clean).metadata();
      const anchors = await measureAnchors(clean);
      console.log(`OK  ${s.file}  ${meta.width}x${meta.height}  anchors lx=${anchors.lx} ly=${anchors.ly} rx=${anchors.rx} ry=${anchors.ry}`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }
})();
