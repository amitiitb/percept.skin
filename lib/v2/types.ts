export type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive" | "not_sure";

export type SkinConcern =
  | "acne" | "fine_lines" | "wrinkles" | "dark_spots" | "uneven_tone"
  | "redness" | "dryness" | "enlarged_pores" | "under_eye"
  | "hair_thinning" | "hair_fall" | "scalp_visibility" | "dandruff";

export interface UserProfileV2 {
  id: string;
  userId: string;
  name: string;
  ageRange: string;
  dateOfBirth: string | null;
  gender: string | null;
  country: string;
  skinType: SkinType | null;
  skinConcerns: SkinConcern[];
  hairType: string | null;
  hairConcerns: string[];
  currentRoutine: string | null;
  subscriptionStatus: "free" | "active" | "cancelled" | "past_due";
  subscriptionPlan: "monthly" | "quarterly" | "annual" | null;
  consentGiven: boolean;
}

// 15 guided capture steps — 9 face + 6 hair/scalp, phase-grouped (Design review Decision #13)
export type PhotoType =
  | "face_front" | "face_left" | "face_right" | "forehead" | "eye_left" | "eye_right"
  | "nose_cheek" | "smile" | "chin_jaw"
  | "hairline_front" | "temple_left" | "temple_right" | "scalp_top" | "crown" | "hair_parting";

export interface CaptureStepDef {
  photoType: PhotoType;
  phase: "face" | "hair";
  phaseIndex: number; // 1-based index within its phase
  phaseTotal: number;
  label: string;
  instruction: string;
}

export type MetricCategory = "skin" | "face" | "hair";

export interface AnalysisMetric {
  category: MetricCategory;
  metricName: string;
  score: number | null;
  label: "Excellent" | "Good" | "Moderate" | "Needs attention";
  confidence: string;
  explanation: string;
  recommendation: string;
  isPremium: boolean;
}

export interface RecommendationSet {
  morning: string[];
  evening: string[];
  weekly: string[];
  hairScalp: string[];
}

// Structured AI output — Section 23 of the product spec. Non-clinical, cosmetic/wellness framing only.
export interface AnalysisResultV2 {
  overallScore: number; // Glow Score, 0-100
  skinAgeEstimate: number;
  imageQuality: "good" | "fair" | "poor";
  skinMetrics: AnalysisMetric[];
  faceMetrics: AnalysisMetric[];
  hairMetrics: AnalysisMetric[];
  priorityConcerns: string[];
  positiveObservations: string[];
  recommendations: RecommendationSet;
  limitations: string[];
  professionalConsultationNote: string | null;
}

export interface AnalysisSessionV2 {
  id: string;
  userId: string;
  status: "pending" | "capturing" | "analyzing" | "complete" | "failed";
  startedAt: string;
  completedAt: string | null;
  overallScore: number | null;
  skinAge: number | null;
  imageQualityScore: number | null;
}

export type SeasonalColour = "Spring" | "Summer" | "Autumn" | "Winter";

export interface ColourSwatch {
  hex: string;
  name: string;
  category: "power" | "accent" | "neutral";
}

export interface ColourAnalysis {
  season: SeasonalColour;
  sub_season: string;
  undertone: "warm" | "cool" | "neutral" | "olive";
  contrast_level: "low" | "medium" | "high";
  description: string;
  best_colours: ColourSwatch[];
  worst_colours: ColourSwatch[];
  neutrals: ColourSwatch[];
  metal_recommendation: "gold" | "silver" | "rose_gold" | "mixed";
  metal_reason: string;
  makeup_palette: {
    lip_colours: string[];
    blush_tones: string[];
    eye_shadows: string[];
    avoid: string[];
  };
  clothing_tips: string[];
}
