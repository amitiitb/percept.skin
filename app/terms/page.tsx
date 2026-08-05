import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of Percept's AI skin, face, and hair analysis service.",
  alternates: { canonical: "/terms" },
  openGraph: { url: "/terms", title: "Terms of Service | Percept" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "August 5, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "4rem" }}>
      <h2 style={{ fontSize: "2.2rem", fontWeight: 600, color: "var(--primary)", marginBottom: "1.4rem", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <div style={{ fontSize: "1.6rem", color: "var(--secondary)", lineHeight: 1.75 }}>{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 1.4rem" }}>{children}</p>;
}

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 1.4rem", paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", padding: "9.6rem 2.4rem 6.4rem" }}>
      <div style={{ maxWidth: "112rem", margin: "0 auto" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", fontSize: "1.4rem", color: "var(--secondary)", textDecoration: "none", marginBottom: "4rem" }}>
          ← Back
        </a>

        <h1 style={{ fontSize: "3.6rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 1.2rem" }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: "1.4rem", color: "var(--muted)", marginBottom: "4.8rem" }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div style={{ maxWidth: "84rem" }}>
          <Section title="1. Agreement to these terms">
            <P>
              These Terms of Service ("Terms") govern your use of Percept's website and app (the "Service"). By
              creating an account or using the Service, you agree to these Terms and to our{" "}
              <a href="/privacy" style={{ color: "var(--primary)" }}>Privacy Policy</a>. If you don't agree, please
              don't use the Service.
            </P>
          </Section>

          <Section title="2. Not medical advice">
            <P>
              Percept generates AI-based observations about your skin, face, and hair from photos you provide. This is
              a cosmetic and informational tool, not a medical device, and it does not diagnose, treat, cure, or
              prevent any disease or condition.{" "}
              <strong style={{ color: "var(--primary)" }}>Nothing in your report is medical advice, and using it does
              not create a doctor-patient relationship.</strong> If you book a paid consultation with a dermatologist
              through Percept, that consultation, not your AI report, is where any medical advice comes from. Always
              consult a qualified healthcare professional about any skin, hair, or health concern, and don't disregard
              or delay seeking professional advice because of something in your Percept report.
            </P>
          </Section>

          <Section title="3. Eligibility">
            <P>
              You must be at least 18 years old to create an account or use the Service. By using Percept, you confirm
              that you meet this requirement.
            </P>
          </Section>

          <Section title="4. Your account">
            <P>
              You're responsible for keeping your login credentials secure and for all activity under your account.
              Tell us right away at{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a> if you
              suspect unauthorized use.
            </P>
          </Section>

          <Section title="5. Photos you upload">
            <P>
              You keep ownership of the photos you upload. By uploading a photo, you grant Percept a limited,
              revocable license to process it solely to generate your analysis, report, and any preview you
              specifically request (e.g. a hairstyle try-on). We do not use your photos to train any AI model without
              asking you separately and explicitly first, as described in our{" "}
              <a href="/privacy" style={{ color: "var(--primary)" }}>Privacy Policy</a>.
            </P>
            <P>
              Only upload photos of yourself, or of someone else with their clear permission. Don't upload photos of
              anyone who hasn't agreed to it.
            </P>
          </Section>

          <Section title="6. Paid services">
            <P>
              Some features, including full reports and dermatologist consultations, require payment processed through
              PayPal. Prices are shown before you pay. Because reports are generated and delivered immediately once
              paid for, purchases are generally non-refundable once your report has been generated, except where
              required by applicable law. If a consultation needs to be cancelled or rescheduled, contact{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a> as
              early as possible.
            </P>
          </Section>

          <Section title="7. Acceptable use">
            <P>You agree not to:</P>
            <Ul items={[
              "Use the Service for any unlawful purpose.",
              "Upload a photo of someone else without their permission.",
              "Attempt to reverse-engineer, scrape, or extract the underlying models or data behind the Service.",
              "Interfere with or disrupt the Service's operation or security.",
              "Misrepresent your identity or age.",
            ]} />
          </Section>

          <Section title="8. Intellectual property">
            <P>
              Percept's branding, software, and the design of the Service are owned by Percept and protected by
              intellectual property law. Your photos remain yours. Your generated report is yours to keep and use
              personally.
            </P>
          </Section>

          <Section title="9. Third-party services">
            <P>
              We use third-party providers, including Supabase, Anthropic, Google, PayPal, and Resend, to run parts
              of the Service, described in our <a href="/privacy" style={{ color: "var(--primary)" }}>Privacy Policy</a>.
              Your use of the Service is also subject to their applicable terms where they interact directly with you
              (for example, PayPal's own terms when you pay).
            </P>
          </Section>

          <Section title="10. Disclaimers">
            <P>
              The Service is provided "as is" and "as available," without warranties of any kind, express or implied,
              including accuracy, merchantability, or fitness for a particular purpose. AI-generated analysis can be
              wrong or incomplete. You use it at your own discretion and risk.
            </P>
          </Section>

          <Section title="11. Limitation of liability">
            <P>
              To the fullest extent permitted by law, Percept won't be liable for any indirect, incidental, special,
              consequential, or punitive damages, or for any loss of data, arising from your use of the Service. Our
              total liability for any claim relating to the Service is limited to the amount you paid us in the 12
              months before the claim arose.
            </P>
          </Section>

          <Section title="12. Termination">
            <P>
              You can delete your account at any time from Settings, which removes your stored photos and profile
              data. We may suspend or terminate your account if you violate these Terms.
            </P>
          </Section>

          <Section title="13. Changes to these terms">
            <P>
              We may update these Terms as the Service evolves. If we make material changes, we'll update the "Last
              updated" date above and, where appropriate, notify you directly. Continuing to use the Service after
              changes take effect means you accept the updated Terms.
            </P>
          </Section>

          <Section title="14. Contact us">
            <P>
              Questions about these Terms: email{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a>.
            </P>
          </Section>
        </div>
      </div>
    </div>
  );
}
