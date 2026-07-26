import type { AnalysisMetric, AnalysisResultV2, MetricCategory, SkinConcern, UserProfileV2 } from "./types";

export class SchemaParseError extends Error {}
export class SchemaValidationError extends Error {}

export interface AnalysisInput {
  photoUrls: Partial<Record<string, string>>; // photoType -> signed URL
  profile: Pick<UserProfileV2, "skinType" | "skinConcerns" | "ageRange">;
}

export interface AnalysisProvider {
  analyse(input: AnalysisInput): Promise<AnalysisResultV2>;
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

function mockMetrics(names: string[], category: MetricCategory, seed: number, premiumFrom: number): AnalysisMetric[] {
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
      isPremium: i >= premiumFrom,
    };
  });
}

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

// Mock provider — deterministic, clearly synthetic, satisfies the full schema.
// Used until real Claude prompts for hair/face are built (CEO review TODO #3).
export const mockProvider: AnalysisProvider = {
  async analyse(input: AnalysisInput): Promise<AnalysisResultV2> {
    const photoCount = Object.values(input.photoUrls).filter(Boolean).length;
    const seed = photoCount * 13;

    const skinMetrics = mockMetrics(SKIN_METRIC_NAMES, "skin", seed, 4);
    const faceMetrics = mockMetrics(FACE_METRIC_NAMES, "face", seed + 3, 2);
    const hairMetrics = mockMetrics(HAIR_METRIC_NAMES, "hair", seed + 5, 2);

    const overallScore = Math.round(
      [...skinMetrics, ...faceMetrics, ...hairMetrics].reduce((sum, m) => sum + (m.score ?? 0), 0) /
      (skinMetrics.length + faceMetrics.length + hairMetrics.length)
    );

    return {
      overallScore,
      skinAgeEstimate: 24 + (seed % 12),
      imageQuality: photoCount >= 12 ? "good" : photoCount >= 6 ? "fair" : "poor",
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
      limitations: photoCount < 15
        ? ["Some photos were missing or low quality. Retake for a more complete report."]
        : [],
      professionalConsultationNote:
        "This is a cosmetic and wellness estimate, not a medical diagnosis. Consult a qualified dermatologist for any visible change that concerns you.",
    };
  },
};

export function getAnalysisProvider(): AnalysisProvider {
  // Real Claude-based provider for hair/face domains is TODO #3 (CEO review) —
  // mock is the only provider wired up in Phase 1.
  return mockProvider;
}
