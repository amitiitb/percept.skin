"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { V2Layout } from "@/components/v2/V2Layout";
import styles from "./scan-prep.module.css";

const CHECKLIST = [
  { title: "Find soft daylight", detail: "Face a window and avoid strong shadows." },
  { title: "Keep your face natural", detail: "Remove glasses and skip heavy makeup." },
  { title: "Clear the frame", detail: "Pull back your hair and turn off filters." },
  { title: "Clean your camera", detail: "A quick lens wipe keeps fine details sharp." },
  { title: "Look relaxed", detail: "Face forward with a calm, neutral expression." },
];

export default function V2ScanPrepPage() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);

  function beginCapture() {
    sessionStorage.setItem("percept_photo_consent", "true");
    router.push("/capture/0");
  }

  return (
    <V2Layout headline="A clearer scan starts here" sub="A little preparation helps us see the details that matter." progress={35} backHref="/dashboard">
      <main className={styles.shell}>
        <header className={styles.intro}>
          <div className={styles.meta}><span className={styles.metaDot} aria-hidden />Guided setup<span className={styles.metaDivider} aria-hidden />2–4 minutes</div>
          <h1>Prepare once.<br />Get a clearer report.</h1>
          <p>Five small checks improve image quality and make your recommendations more reliable.</p>
        </header>

        <section className={styles.checklist} aria-labelledby="scan-essentials-title">
          <div className={styles.sectionHeading}><h2 id="scan-essentials-title">Scan essentials</h2><span>5 quick checks</span></div>
          <div className={styles.checkGrid}>
            {CHECKLIST.map((item, index) => (
              <article className={styles.checkItem} key={item.title}>
                <span className={styles.checkNumber} aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{item.title}</h3><p>{item.detail}</p></div>
                <span className={styles.checkMark} aria-hidden><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.6 2.6L10 3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </article>
            ))}
          </div>
          <p className={styles.guideNote}>You’ll also see live guidance for lighting and framing during capture.</p>
        </section>

        <section className={styles.actionPanel} aria-labelledby="privacy-title">
          <label className={styles.consentRow}>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span className={styles.checkbox} aria-hidden>{consent && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.6 2.6L10 3.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
            <span className={styles.consentCopy}>
              <strong id="privacy-title">Your photos stay private</strong>
              <span>I agree that Percept may securely process and store my photos to create this report. They are never used to train AI models unless I separately opt in.</span>
            </span>
          </label>
          <div className={styles.actionFooter}>
            <p>Read our <Link href="/privacy">Privacy Policy</Link></p>
            <button type="button" onClick={beginCapture} disabled={!consent}>Begin guided scan<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          </div>
        </section>
      </main>
    </V2Layout>
  );
}
