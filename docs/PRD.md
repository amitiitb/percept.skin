# Glowmetry — Product Requirements Document

Status: reflects the live product as of 2026-07-28 (glowmetry.superapp.digital). Written from the shipped codebase, not a forward-looking spec — see "Not yet built" for gaps.

## 1. What it is

Glowmetry is an AI-powered skin, face, and hair/scalp analysis app. A user takes 7 guided selfie-style photos; Claude Sonnet analyses them and returns a "Glow Score," an estimated skin age, and 20+ individually scored metrics across three domains, plus a personalized morning/evening/weekly routine. Optional add-ons: AI colour analysis (seasonal palette), AI-generated hairstyle previews, AI/live eyewear frame try-on, and a paid follow-up with a real dermatologist.

Non-clinical framing throughout: cosmetic/wellness observations and estimates, never a medical diagnosis.

## 2. Target user

Someone curious about their skin/hair health who wants a fast, private, guided read without booking a dermatologist visit — the entry point is convenience and curiosity, with the paid dermatologist consultation as an upsell for anyone who wants a real second opinion after seeing their AI results.

## 3. Core user journey

```
/splash → /onboard → sign up / log in → /profile-setup (concerns, skin/hair
  type, consent) → /scan-prep → /capture (7 guided steps: 4 face + 3 hair/scalp)
  → /bundle/[sessionId] (pick modules, pay via PayPal — analysis runs in the
  background while they choose) → /report/[id] (Glow Score, sectioned report) →
  optional: doctor consultation upsell → /dashboard (returning-user home) →
  /history, /settings
```

Purchase happens **before** results are shown for a given scan (bundle-first, not the freemium-teaser model an earlier draft of this product used) — every report page requires a `report_purchases_v2` row before it renders anything beyond a teaser.

## 4. Features

### 4.1 Guided capture
7 steps, phase-grouped: **Face** (front, left, right, one combined close-up) then **Hair & Scalp** (hairline & temples, top & crown, parting close-up). Live MediaPipe face-mesh overlay during face steps (real landmark tesselation, corner-bracket reticle, scan-line sweep, cycling feature callouts — forehead/cheeks/jawline), client-side quality gate (no face / multiple faces / too dark / too blurry / model unavailable) before a photo is accepted.

### 4.2 AI analysis (the core product)
- **Glow Score** (0-100) and **estimated skin age**, both prominent on the report.
- 20+ metrics across three sections: **Skin**, **Face**, **Hair & Scalp** — each metric has a score, a plain-language label (Excellent/Good/Moderate/Needs attention), a confidence note, an explanation, and a recommendation.
- Priority concerns, positive observations, and a structured routine (morning/evening/weekly/hair-scalp) — the most personally useful part of the output, and previously silently discarded until this was fixed.
- Standing content rule: no em dash anywhere in AI-generated or hardcoded user-facing text (a defensive sanitizer runs on every AI response regardless of prompt instructions, since models don't reliably follow style instructions).

### 4.3 Paid add-on modules
Four purchasable modules, priced individually or as a bundle:

| Module | Includes |
|---|---|
| Skin Analysis | Texture, tone, fine lines, pores, facial balance |
| Color Analysis | Seasonal palette, best colours, draping preview |
| Hairstyle Recommendations | Hair & scalp metrics + AI-generated style previews (Gemini) |
| Frame Recommendations | Eyewear frames matched to face shape (live try-on + AI-generated preview) |

$5 per module individually, **$10 for all four bundled** (a 50% discount, the only bundle economics in the product — buying fewer than all four is linear, $5 × count, no partial discount).

### 4.4 Doctor consultation upsell
A separate $10 paid tier from the AI report: queues a real dermatologist follow-up (phone/email, no scheduling system yet — payment just creates a `pending` record for manual outreach). Offered after the AI report and via the post-purchase confirmation email.

### 4.5 Returning-user experience
Dashboard shows the latest Glow Score, an animated first-scan empty state (stat teasers + a waiting-ring animation) for brand-new users, scan history, and account/subscription settings.

## 5. Business model

One-time, pay-per-scan purchases (module or bundle), plus the doctor-consultation upsell — this is the active revenue model. A separate recurring-subscription code path exists (`subscriptions_v2`, monthly $9.99 / quarterly $24.99 / annual $79.99) but is **dormant** — built, wired, real PayPal sandbox order-creation confirmed working, but not linked to anything in the current purchase flow. Kept as a possible future "skip the paywall" perk, not part of today's product.

All payments via PayPal (Orders v2 API, sandbox credentials today — see Tech Stack doc for production gap).

## 6. Non-goals / not yet built

- **Live PayPal payments** — sandbox only; this is the single blocker to real revenue.
- **Scheduling for doctor consultations** — payment queues a manual follow-up, no calendar/booking system.
- **Subscription tier as an active product surface** — code exists, not exposed to users as a real choice today.
- **Real PDF report export** — a print-optimized web view (`@media print`) stands in for now.
- **Migrating/consolidating any pre-rewrite data** — the original (pre-v2) app and its tables have been fully retired and dropped; there was never a migration path from it, by design.

## 7. Suggested success metrics (not yet instrumented beyond structured logs)

- Scan-start → purchase conversion rate (the bundle page is the real paywall moment).
- Bundle vs individual-module purchase mix (validates whether the $10 bundle discount is doing its job).
- Report-purchase → doctor-consultation upsell conversion.
- Analysis completion rate (`analysis_sessions_v2.status = complete` / sessions started) — the one metric that tells you the AI pipeline is healthy.
