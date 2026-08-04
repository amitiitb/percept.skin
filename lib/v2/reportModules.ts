export type ModuleId = "skin" | "colour" | "hairstyle" | "frame";

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  price: number; // USD, individual price
}

// "Skin Analysis" includes the existing Face metric category (symmetry, jawline,
// etc — not a standalone purchasable item). "Hairstyle Recommendations" includes
// the existing Hair & Scalp analysis metrics alongside the Gemini style-preview
// generator — same reasoning, no orphaned 5th category.
export const MODULES: ModuleDef[] = [
  { id: "skin", label: "Skin Analysis", description: "Texture, tone, fine lines, pores, and facial balance", price: 5 },
  { id: "colour", label: "Color Analysis", description: "Your seasonal palette, best colours, and draping preview", price: 5 },
  { id: "hairstyle", label: "Hairstyle Recommendations", description: "Hair & scalp health plus AI-generated hairstyle and beard previews", price: 5 },
  { id: "frame", label: "Frame Recommendations", description: "Eyewear frames matched to your face shape", price: 5 },
];

export const BUNDLE_PRICE = 10;
export const INDIVIDUAL_TOTAL = MODULES.reduce((s, m) => s + m.price, 0); // 20
export const BUNDLE_SAVINGS = INDIVIDUAL_TOTAL - BUNDLE_PRICE; // 10
export const BUNDLE_DISCOUNT_PCT = Math.round((BUNDLE_SAVINGS / INDIVIDUAL_TOTAL) * 100); // 50

export function priceFor(selected: ModuleId[]): number {
  if (selected.length === MODULES.length) return BUNDLE_PRICE;
  return selected.length * 5;
}

export function moduleLabel(id: ModuleId): string {
  return MODULES.find((m) => m.id === id)?.label ?? id;
}

// Doctor Consultation — separate paid tier from the AI-generated Full Report
// above. A real dermatologist follow-up, not part of the module bundle
// (different fulfillment: human contact, not an unlocked report section).
export const DOCTOR_CONSULTATION_PRICE = 10;
