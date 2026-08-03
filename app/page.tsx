import { HomeClient } from "@/components/marketing/HomeClient";
import { FAQS } from "@/lib/v2/homeFaqs";
import { BUNDLE_PRICE, DOCTOR_CONSULTATION_PRICE } from "@/lib/v2/reportModules";

// Server Component wrapper so the JSON-LD <script> below is only ever
// rendered once, server-side — put it inside HomeClient (a Client Component
// with interactive state) instead and every re-render (opening the menu,
// the research slider ticking) makes React throw "Encountered a script tag
// while rendering React component" since client re-renders can't re-insert
// <script> tags the way the initial server HTML can.
export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "FAQPage",
                mainEntity: FAQS.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              },
              {
                "@type": "Service",
                serviceType: "AI skin, face, and hair analysis",
                provider: { "@id": "https://percept.skin/#organization" },
                url: "https://percept.skin/",
                description:
                  "A guided photo scan analysed by AI, scoring skin, face, and hair across 20 metrics, with an optional licensed-dermatologist review.",
                offers: [
                  {
                    "@type": "Offer",
                    name: "Percept bundle",
                    price: BUNDLE_PRICE,
                    priceCurrency: "USD",
                  },
                  {
                    "@type": "Offer",
                    name: "Dermatologist consultation",
                    price: DOCTOR_CONSULTATION_PRICE,
                    priceCurrency: "USD",
                  },
                ],
              },
            ],
          }),
        }}
      />
      <HomeClient />
    </>
  );
}
