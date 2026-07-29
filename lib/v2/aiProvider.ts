import { z } from "zod";
import type { AnalysisMetric, AnalysisResultV2, MetricCategory, SkinConcern, UserProfileV2 } from "./types";

export class SchemaParseError extends Error {}
export class SchemaValidationError extends Error {}
export class ClaudeTimeoutError extends Error {}
export class ClaudeRateLimitError extends Error {}
export class ClaudeAPIError extends Error {}

export interface AnalysisInput {
  photoUrls: Partial<Record<string, string>>; // photoType -> signed URL
  profile: Pick<UserProfileV2, "skinType" | "skinConcerns" | "ageRange">;
}

export interface AnalysisProvider {
  analyse(input: AnalysisInput): Promise<AnalysisResultV2>;
}

// Defensive net regardless of the system prompt instruction — models don't
// always follow style instructions perfectly, and this text renders directly
// on the report page (standing site-wide rule: no em dash anywhere in
// user-facing content). Deep-walks any object/array of strings.
export function stripEmDash<T>(value: T): T {
  if (typeof value === "string") return (value as string).replace(/\s*—\s*/g, ", ") as unknown as T;
  if (Array.isArray(value)) return value.map(stripEmDash) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripEmDash(v);
    return out as T;
  }
  return value;
}

function labelFor(score: number): AnalysisMetric["label"] {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Moderate";
  return "Needs attention";
}

// Wellness/cosmetic framing only — never diagnostic. Mirrors the non-clinical
// tone required by the product spec; the existing app/api/analyse/route.ts
// system prompt ("clinical dermatological AI assistant") must NOT be reused
// here (flagged in the CEO review).
const SKIN_METRIC_NAMES = [
  "Skin texture", "Fine lines", "Pore visibility", "Dark spots & pigmentation",
  "Uneven skin tone", "Redness appearance", "Dryness indicators", "Under-eye appearance",
  "Facial hydration estimate", "Sun-damage appearance",
];
const FACE_METRIC_NAMES = [
  "Facial symmetry", "Jawline definition", "Cheek balance", "Forehead proportion", "Overall facial harmony",
];
const HAIR_METRIC_NAMES = [
  "Hair density estimate", "Hairline pattern", "Scalp visibility", "Hair part width", "Overall hair health",
];

function concernToPriority(concerns: SkinConcern[]): string[] {
  const labels: Record<SkinConcern, string> = {
    acne: "Occasional blemishes", fine_lines: "Fine lines", wrinkles: "Wrinkles",
    dark_spots: "Dark spots", uneven_tone: "Uneven skin tone", redness: "Redness",
    dryness: "Dryness", enlarged_pores: "Enlarged pores", under_eye: "Under-eye appearance",
    hair_thinning: "Hair thinning", hair_fall: "Hair fall", scalp_visibility: "Scalp visibility",
    dandruff: "Flaking",
  };
  return concerns.slice(0, 3).map((c) => labels[c] ?? c);
}

// ── Mock provider — deterministic, clearly synthetic. Kept for local/offline
// dev and as a documented fallback shape reference; getAnalysisProvider()
// below does NOT use it once ANTHROPIC_API_KEY is configured (see the
// "no silent mock-fallback-shown-as-real-data" rule in docs/V2_PLAN.md).
function mockMetrics(names: string[], category: MetricCategory, seed: number): AnalysisMetric[] {
  return names.map((metricName, i) => {
    const score = Math.max(30, Math.min(95, 60 + ((seed + i * 7) % 35) - 15));
    return {
      category,
      metricName,
      score,
      label: labelFor(score),
      confidence: "Based on mock data, image quality checks passed",
      explanation: `${metricName} appears within a typical range for your profile.`,
      recommendation: "Consistent skincare and good lighting for future scans will refine this estimate.",
      isPremium: false,
    };
  });
}

export const mockProvider: AnalysisProvider = {
  async analyse(input: AnalysisInput): Promise<AnalysisResultV2> {
    const photoCount = Object.values(input.photoUrls).filter(Boolean).length;
    const seed = photoCount * 13;

    const skinMetrics = mockMetrics(SKIN_METRIC_NAMES, "skin", seed);
    const faceMetrics = mockMetrics(FACE_METRIC_NAMES, "face", seed + 3);
    const hairMetrics = mockMetrics(HAIR_METRIC_NAMES, "hair", seed + 5);

    const overallScore = Math.round(
      [...skinMetrics, ...faceMetrics, ...hairMetrics].reduce((sum, m) => sum + (m.score ?? 0), 0) /
      (skinMetrics.length + faceMetrics.length + hairMetrics.length)
    );

    return {
      overallScore,
      skinAgeEstimate: 24 + (seed % 12),
      imageQuality: photoCount >= 6 ? "good" : photoCount >= 3 ? "fair" : "poor",
      skinMetrics,
      faceMetrics,
      hairMetrics,
      priorityConcerns: concernToPriority(input.profile.skinConcerns),
      positiveObservations: ["Even hydration in most areas", "Balanced facial proportions"],
      recommendations: {
        morning: ["Gentle cleanser", "Broad-spectrum sunscreen", "Hydrating serum"],
        evening: ["Gentle cleanser", "Moisturizer", "Niacinamide (patch-test first)"],
        weekly: ["Gentle exfoliation, 1-2x per week"],
        hairScalp: ["Scalp cleansing", "Reduced heat styling"],
      },
      limitations: photoCount < 7
        ? ["Some photos were missing or low quality. Retake for a more complete report."]
        : [],
      professionalConsultationNote:
        "This is a cosmetic and wellness estimate, not a medical diagnosis. Consult a qualified dermatologist for any visible change that concerns you.",
    };
  },
};

// ── Real provider — Claude Sonnet vision call over the guided-capture photo set ──

const PHOTO_LABELS: Record<string, string> = {
  face_front: "Front face, straight-on, neutral expression",
  face_left: "Left angle, head turned to show the left side",
  face_right: "Right angle, head turned to show the right side",
  face_detail: "Close-up of forehead, eyes, nose, and cheeks",
  hairline_front: "Front hairline and both temples",
  scalp_crown: "Top and crown of the scalp, viewed from above",
  hair_parting: "Close-up of the natural hair parting",
};

const metricSchema = z.object({
  // Nullable on purpose. The model correctly returns null when a metric
  // cannot be judged from the photos supplied, and metricsFromMap already
  // handles that case ("Not enough visual data for this metric"), as does
  // AnalysisMetric, whose score is `number | null`. Requiring a number here
  // meant an honest null failed schema validation and killed the whole
  // analysis. That became common once the hair-parting capture step was
  // dropped, since "Hair part width" is exactly the metric that shot fed.
  score: z.number().min(0).max(100).nullable(),
  confidence: z.string(),
  explanation: z.string(),
  recommendation: z.string(),
});
const metricsMapSchema = z.record(z.string(), metricSchema);

const claudeResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  skinAgeEstimate: z.number().min(10).max(100),
  imageQuality: z.enum(["good", "fair", "poor"]),
  skinMetrics: metricsMapSchema,
  faceMetrics: metricsMapSchema,
  hairMetrics: metricsMapSchema,
  priorityConcerns: z.array(z.string()),
  positiveObservations: z.array(z.string()),
  recommendations: z.object({
    morning: z.array(z.string()),
    evening: z.array(z.string()),
    weekly: z.array(z.string()),
    hairScalp: z.array(z.string()),
  }),
  limitations: z.array(z.string()),
});

async function toBase64(photoUrl: string): Promise<{ mediaType: string; data: string }> {
  const res = await fetch(photoUrl);
  if (!res.ok) throw new ClaudeAPIError(`Could not fetch photo: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = await res.arrayBuffer();
  return { mediaType: contentType.split(";")[0], data: Buffer.from(buf).toString("base64") };
}

function metricsFromMap(map: Record<string, { score: number | null; confidence: string; explanation: string; recommendation: string }>, names: string[], category: MetricCategory): AnalysisMetric[] {
  return names.map((metricName) => {
    const m = map[metricName];
    if (!m) {
      return {
        category, metricName, score: null, label: "Moderate", confidence: "Not enough visual data for this metric",
        explanation: "This metric could not be assessed from the provided photos.",
        recommendation: "Retake the relevant photo with better lighting or framing for a full estimate.",
        isPremium: false,
      };
    }
    // A returned-but-unscoreable metric keeps the model's own explanation of
    // why, which is more useful than the generic missing-key copy above.
    if (m.score === null) {
      return {
        category, metricName, score: null, label: "Moderate", confidence: m.confidence,
        explanation: m.explanation, recommendation: m.recommendation, isPremium: false,
      };
    }
    return {
      category, metricName, score: m.score, label: labelFor(m.score), confidence: m.confidence,
      explanation: m.explanation, recommendation: m.recommendation, isPremium: false,
    };
  });
}

export const claudeProvider: AnalysisProvider = {
  async analyse(input: AnalysisInput): Promise<AnalysisResultV2> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ClaudeAPIError("ANTHROPIC_API_KEY not configured");

    const entries = Object.entries(input.photoUrls).filter(([, url]) => !!url) as [string, string][];
    if (entries.length === 0) throw new ClaudeAPIError("No photos available to analyse");

    const images = await Promise.all(
      entries.map(async ([photoType, url]) => ({ photoType, ...(await toBase64(url)) }))
    );

    const missing = Object.keys(PHOTO_LABELS).filter((type) => !entries.some(([t]) => t === type));

    const profileLines = [
      input.profile.skinType ? `Self-reported skin type: ${input.profile.skinType}` : null,
      input.profile.skinConcerns.length ? `Self-reported concerns: ${input.profile.skinConcerns.join(", ")}` : null,
      input.profile.ageRange ? `Age range: ${input.profile.ageRange}` : null,
    ].filter(Boolean).join("\n");

    const userPrompt = `Analyze these guided-capture photos and produce a cosmetic/wellness skin, face, and hair assessment. Each photo is labeled with what it shows.

${images.map((img) => `- ${PHOTO_LABELS[img.photoType] ?? img.photoType}`).join("\n")}
${missing.length ? `\nMissing (not provided, do not invent data for these): ${missing.map((m) => PHOTO_LABELS[m]).join("; ")}` : ""}

${profileLines}

Return ONLY valid JSON (no markdown fences, no extra text) with exactly this shape:
{
  "overallScore": 0-100,
  "skinAgeEstimate": integer,
  "imageQuality": "good" | "fair" | "poor",
  "skinMetrics": { ${SKIN_METRIC_NAMES.map((n) => `"${n}": {"score":0-100,"confidence":"...","explanation":"...","recommendation":"..."}`).join(", ")} },
  "faceMetrics": { ${FACE_METRIC_NAMES.map((n) => `"${n}": {"score":0-100,"confidence":"...","explanation":"...","recommendation":"..."}`).join(", ")} },
  "hairMetrics": { ${HAIR_METRIC_NAMES.map((n) => `"${n}": {"score":0-100,"confidence":"...","explanation":"...","recommendation":"..."}`).join(", ")} },
  "priorityConcerns": ["string", ...],
  "positiveObservations": ["string", ...],
  "recommendations": {"morning":["string",...],"evening":["string",...],"weekly":["string",...],"hairScalp":["string",...]},
  "limitations": ["string", ...]
}
Every key listed above under skinMetrics/faceMetrics/hairMetrics must be present. "explanation" and "confidence" must be 1-2 sentences each, specific to what you actually observe in the photos, not generic filler. If a relevant photo is missing or too unclear to assess a metric, give it a lower confidence description and note it in "limitations" rather than guessing wildly. This is cosmetic and wellness guidance only, never a medical or dermatological diagnosis.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: "You are a cosmetic and wellness photo analysis assistant. You never provide medical or dermatological diagnoses, only general cosmetic/wellness observations framed as estimates, not facts. Return only valid JSON with no extra text. Never use the em dash character (—) anywhere in your output; use a comma, colon, period, or hyphen instead.",
          messages: [{
            role: "user",
            content: [
              ...images.map((img) => ({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } })),
              { type: "text", text: userPrompt },
            ],
          }],
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw new ClaudeTimeoutError("Claude API timed out after 60s");
      throw new ClaudeAPIError(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) throw new ClaudeRateLimitError("Claude API rate limited");
    if (!response.ok) {
      const errText = await response.text();
      throw new ClaudeAPIError(`Claude API error: ${response.status} ${errText}`);
    }

    const body = await response.json() as { content: Array<{ type: string; text?: string }> };
    const rawText = body.content.find((b) => b.type === "text")?.text ?? "";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new SchemaParseError(`Claude returned non-JSON response: ${rawText.slice(0, 300)}`);
    }

    const validated = claudeResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new SchemaValidationError(`Claude response failed schema validation: ${validated.error.message}`);
    }
    const r = validated.data;

    return stripEmDash({
      overallScore: Math.round(r.overallScore),
      skinAgeEstimate: Math.round(r.skinAgeEstimate),
      imageQuality: r.imageQuality,
      skinMetrics: metricsFromMap(r.skinMetrics, SKIN_METRIC_NAMES, "skin"),
      faceMetrics: metricsFromMap(r.faceMetrics, FACE_METRIC_NAMES, "face"),
      hairMetrics: metricsFromMap(r.hairMetrics, HAIR_METRIC_NAMES, "hair"),
      priorityConcerns: r.priorityConcerns.length ? r.priorityConcerns : concernToPriority(input.profile.skinConcerns),
      positiveObservations: r.positiveObservations,
      recommendations: r.recommendations,
      limitations: missing.length
        ? [...r.limitations, `Missing photos: ${missing.map((m) => PHOTO_LABELS[m]).join(", ")}`]
        : r.limitations,
      professionalConsultationNote:
        "This is a cosmetic and wellness estimate, not a medical diagnosis. Consult a qualified dermatologist for any visible change that concerns you.",
    });
  },
};

export function getAnalysisProvider(): AnalysisProvider {
  // Real analysis when configured — never silently serve mock data as real
  // (docs/V2_PLAN.md "critical rule enforced across all AI failure paths").
  // Falls back to mock only when the key is genuinely absent (local/offline
  // dev), which is visibly different data, not a disguised failure.
  return process.env.ANTHROPIC_API_KEY ? claudeProvider : mockProvider;
}
