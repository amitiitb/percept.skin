import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Percept collects, uses, and protects your photos and personal data.",
  alternates: { canonical: "/privacy" },
  openGraph: { url: "/privacy", title: "Privacy Policy | Percept" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "August 5, 2026";

const SUBPROCESSORS: { name: string; purpose: string; data: string }[] = [
  { name: "Supabase", purpose: "Authentication, database, and private photo storage", data: "Account credentials, profile data, uploaded photos" },
  { name: "Anthropic (Claude)", purpose: "Generates your AI skin, face, and hair analysis", data: "Signed, time-limited URLs to your uploaded photos and profile inputs" },
  { name: "Google (Gemini / Vertex AI)", purpose: "Generates hairstyle and eyewear try-on previews", data: "Your uploaded photos" },
  { name: "PayPal", purpose: "Processes report and consultation payments", data: "Payment and billing details (Percept does not receive or store your card number)" },
  { name: "Resend", purpose: "Sends account and transactional email (welcome email, receipts)", data: "Name, email address" },
  { name: "Google Analytics & Google Tag Manager", purpose: "Understand site usage and traffic", data: "Device, browser, approximate location, pages viewed" },
  { name: "Contentsquare", purpose: "Session replay and heatmaps to improve site usability", data: "On-page interactions (clicks, scrolls and form focus), not photo content" },
];

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

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", padding: "9.6rem 2.4rem 6.4rem" }}>
      <div style={{ maxWidth: "112rem", margin: "0 auto" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", fontSize: "1.4rem", color: "var(--secondary)", textDecoration: "none", marginBottom: "4rem" }}>
          ← Back
        </a>

        <h1 style={{ fontSize: "3.6rem", fontWeight: 300, color: "var(--primary)", lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 1.2rem" }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: "1.4rem", color: "var(--muted)", marginBottom: "4.8rem" }}>
          Last updated: {LAST_UPDATED}
        </p>

        <div style={{ maxWidth: "84rem" }}>
          <Section title="1. Who we are">
            <P>
              Percept ("Percept", "we", "us") provides an AI-guided skin, face, and hair analysis service at percept.skin
              and through the Percept app (together, the "Service"). This policy explains what personal data we collect,
              why, who we share it with, and the choices and rights you have. It applies to everyone who visits our site
              or creates an account, regardless of where you're located.
            </P>
            <P>
              Contact us about anything in this policy, or to exercise any of the rights described below, at{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a>.
            </P>
          </Section>

          <Section title="2. Information we collect">
            <P><strong style={{ color: "var(--primary)" }}>Account information.</strong> Name, email address, and password when you sign up.</P>
            <P><strong style={{ color: "var(--primary)" }}>Profile information.</strong> Age range, gender, country, skin type and concerns, hair type and concerns, and your current skincare/haircare routine. All are optional beyond what is needed to generate your report.</P>
            <P><strong style={{ color: "var(--primary)" }}>Photos.</strong> The face, skin, and hair photos you capture during a guided scan. These are stored in a private storage bucket, not publicly accessible, and are only ever readable via short-lived signed URLs.</P>
            <P><strong style={{ color: "var(--primary)" }}>Consultation details.</strong> If you book a dermatologist consultation, your phone number and payment details, handled through PayPal.</P>
            <P><strong style={{ color: "var(--primary)" }}>Usage data.</strong> Pages visited, interactions, approximate location, and device/browser type, collected via Google Analytics, Google Tag Manager, and Contentsquare only after you accept analytics cookies in the cookie banner. See Section 8.</P>
            <P><strong style={{ color: "var(--primary)" }}>Communications.</strong> Emails we send you (e.g. a welcome email) are delivered through Resend and logged for delivery purposes.</P>
          </Section>

          <Section title="3. How we use your information">
            <Ul items={[
              "To create and secure your account, and to deliver the Service you signed up for.",
              "To generate your AI skin, face, and hair analysis and report.",
              "To generate optional hairstyle and eyewear try-on previews you request.",
              "To process payments for reports and consultations.",
              "To send service-related email (account confirmation, receipts, report-ready notices).",
              "To understand aggregate usage and improve the Service, where you've consented to analytics cookies.",
              "To detect, prevent, and respond to fraud, abuse, and security incidents.",
              "To comply with legal obligations.",
            ]} />
            <P>
              Where the law requires a specific legal basis (for example, under the GDPR), we rely on: your{" "}
              <strong style={{ color: "var(--primary)" }}>consent</strong> for photo processing and analytics cookies;{" "}
              <strong style={{ color: "var(--primary)" }}>contractual necessity</strong> to create your account and deliver
              reports you've purchased; and our <strong style={{ color: "var(--primary)" }}>legitimate interest</strong> in
              keeping the Service secure and improving it, balanced against your rights.
            </P>
          </Section>

          <Section title="4. How your photos are processed">
            <P>
              Your photos are the most sensitive data you give us, so here's the specific path they take. When you
              complete a guided scan, your photos are uploaded to a private Supabase storage bucket. To generate your
              analysis, a signed, time-limited URL to those photos is sent to Anthropic's Claude models. If you request
              a hairstyle or eyewear try-on preview, your photo is sent to Google's Gemini / Vertex AI models to generate
              the preview image.
            </P>
            <P>
              <strong style={{ color: "var(--primary)" }}>We do not use your photos to train any AI model, ours or a
              third party's, without asking you separately and explicitly first.</strong> Analysis and preview
              generation are the only uses of your photos unless you opt in to something further.
            </P>
            <P>
              You can permanently delete your photos and account at any time from Settings, or by emailing{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a>. Deletion
              removes your stored photos and cascades to your account records.
            </P>
          </Section>

          <Section title="5. Who we share data with">
            <P>
              We don't sell your personal data. We share it only with the service providers ("subprocessors") that help
              us run Percept, each bound to use your data solely to provide their service to us:
            </P>
            <div style={{ overflowX: "auto", marginBottom: "1.4rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "1.4rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line-strong)" }}>
                    <th style={{ textAlign: "left", padding: "1rem 1.2rem 1rem 0", color: "var(--primary)", fontWeight: 600 }}>Provider</th>
                    <th style={{ textAlign: "left", padding: "1rem 1.2rem", color: "var(--primary)", fontWeight: 600 }}>Purpose</th>
                    <th style={{ textAlign: "left", padding: "1rem 0", color: "var(--primary)", fontWeight: 600 }}>Data shared</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((s) => (
                    <tr key={s.name} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "1rem 1.2rem 1rem 0", fontWeight: 500, color: "var(--primary)", whiteSpace: "nowrap" }}>{s.name}</td>
                      <td style={{ padding: "1rem 1.2rem" }}>{s.purpose}</td>
                      <td style={{ padding: "1rem 0" }}>{s.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <P>
              We may also disclose data if required by law, to enforce our Terms of Service, or to protect the rights,
              safety, or property of Percept, our users, or the public.
            </P>
          </Section>

          <Section title="6. International data transfers">
            <P>
              Our subprocessors operate globally, which means your data may be processed in countries other than the
              one you're in, including the United States. Where required, we rely on appropriate safeguards for these
              transfers, such as standard contractual clauses.
            </P>
          </Section>

          <Section title="7. Data retention">
            <P>
              We keep your account, profile, and photos for as long as your account is active. If you delete your
              account, your photos and profile data are permanently removed from active storage. Payment and
              consultation records may be retained longer where we're legally required to keep them (e.g. for tax or
              accounting purposes).
            </P>
          </Section>

          <Section title="8. Cookies and tracking">
            <P>
              We use a small number of cookies and similar technologies:
            </P>
            <Ul items={[
              <><strong style={{ color: "var(--primary)" }}>Essential:</strong> keep you signed in and remember your cookie choice. Always on; the Service doesn't work without these.</>,
              <><strong style={{ color: "var(--primary)" }}>Analytics:</strong> Google Analytics and Google Tag Manager, so we can see aggregate traffic and usage patterns.</>,
              <><strong style={{ color: "var(--primary)" }}>Session replay:</strong> Contentsquare, which records on-page interactions (not photo content) to help us fix confusing UI.</>,
            ]} />
            <P>
              Analytics and session-replay cookies only load after you accept them in the cookie banner shown on your
              first visit. You can change your choice at any time via "Cookie Preferences" in the site footer or in
              Settings.
            </P>
          </Section>

          <Section title="9. Your rights">
            <P>
              Depending on where you live, you have some or all of the rights below. To exercise any of them, email{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a>. We will
              respond within the time limit your local law requires.
            </P>
            <P><strong style={{ color: "var(--primary)" }}>If you're in the EU/UK (GDPR):</strong> right to access, correct,
              erase, or restrict your data; right to data portability; right to object to processing; right to
              withdraw consent at any time without affecting prior processing; right to lodge a complaint with your
              local data protection authority.</P>
            <P><strong style={{ color: "var(--primary)" }}>If you're in California (CCPA/CPRA):</strong> right to know
              what personal information we collect and why; right to delete it; right to correct it; right to opt out
              of sale or sharing. We don't sell or share your personal information for cross-context behavioral
              advertising; right to non-discrimination for exercising these rights.</P>
            <P><strong style={{ color: "var(--primary)" }}>If you're in India (DPDP Act, 2023):</strong> as a Data
              Principal, you have the right to access a summary of your personal data and processing activities, the
              right to correction and erasure, the right to grievance redressal, and the right to nominate another
              individual to exercise your rights on your behalf in the event of death or incapacity. For grievances,
              contact our Grievance Officer at{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a>.</P>
            <P>Wherever you are, you can also delete your account and photos yourself at any time from Settings.</P>
          </Section>

          <Section title="10. Children's privacy">
            <P>
              Percept is not directed to, and may not be used by, anyone under 18. We don't knowingly collect personal
              data from minors. If we learn that we've collected data from someone under 18, we'll delete it. If you
              believe a minor has used the Service, contact{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a>.
            </P>
          </Section>

          <Section title="11. Security">
            <P>
              Photos are stored in a private, access-controlled bucket and served only via short-lived signed URLs.
              Passwords are hashed by our authentication provider and never stored in plain text. No method of
              transmission or storage is 100% secure, so while we work to protect your data, we can't guarantee
              absolute security.
            </P>
          </Section>

          <Section title="12. Changes to this policy">
            <P>
              We may update this policy as the Service evolves. If we make material changes, we'll update the "Last
              updated" date above and, where appropriate, notify you directly.
            </P>
          </Section>

          <Section title="13. Contact us">
            <P>
              Questions, requests, or complaints about this policy or your data: email{" "}
              <a href="mailto:support@percept.skin" style={{ color: "var(--primary)" }}>support@percept.skin</a>.
            </P>
          </Section>
        </div>
      </div>
    </div>
  );
}
