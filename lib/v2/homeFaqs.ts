import { MODULES, BUNDLE_PRICE, INDIVIDUAL_TOTAL, BUNDLE_SAVINGS } from "@/lib/v2/reportModules";

// Plain data, no "use client" — needs to be importable from both the
// homepage's Server Component (for FAQPage JSON-LD) and its Client
// Component (for the rendered FaqRow list). A "use client" module can only
// hand a Server Component its component exports, not plain data, so this
// can't live inside HomeClient.tsx.
export const FAQS = [
  {
    q: "Is this a medical diagnosis?",
    a: "No. Percept gives cosmetic and wellness insights, not a medical or dermatological diagnosis. For a real diagnosis, see the Experts section below or consult a licensed professional directly.",
  },
  {
    q: "What happens to my photos?",
    a: "Your photos are used only to generate your analysis. They are never used to train AI models without separate, explicit consent. You control that choice during setup.",
  },
  {
    q: "How is pricing structured?",
    a: `Each report module is $${MODULES[0].price}, or get all ${MODULES.length} for $${BUNDLE_PRICE} instead of $${INDIVIDUAL_TOTAL}, a $${BUNDLE_SAVINGS} saving. You only pay for the scan you take, no subscription required.`,
  },
  {
    q: "How long does a scan take?",
    a: "A few minutes for the guided photo capture, plus a short wait while your report is generated.",
  },
];
