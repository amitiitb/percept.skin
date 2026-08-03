# Percept — Master Reference Prompt

> **Reference product:** Dr.Skin by Sapat (analysis.drskin.ai)
> **Percept is:** A web-first AI skin analysis funnel that captures user data + face photos, runs skin condition detection, and converts to a paid dermatologist report or consultation.

---

## Product Definition

Build a mobile-optimised web app (PWA) that:
1. Guides users through a structured intake questionnaire
2. Captures 3 face photos (front + left + right) via AI auto-capture
3. Runs multi-parameter skin analysis (AI-detected conditions)
4. Shows personalised results with annotated face image
5. Converts users to a paid treatment plan (prescription or live consultation)

**Monetisation model:** Freemium — analysis is free, results unlock on payment.

---

## Complete User Journey (13 Screens)

### SCREEN 1 — Landing / Value Prop
- Headline: "Welcome to your in-depth skin check-up."
- 4 trust bullets:
  - Fast AI skin-scan
  - 3 scans → 1 complete diagnosis (21 parameters)
  - Expert knowledge base (years of dermatology data)
  - Secure data, seen only by dermatologists
- CTA: **NEXT**
- Footer: "Secure Photo | Privacy Protected"

---

### SCREEN 2 — User Profile Form
**Progress: 8%**
- Header: "Tell us about you."
- Subtext: "Your details help us advise you better."
- Fields:
  - Name (text input)
  - Gender (visual toggle: Male avatar | Female avatar)
  - Age (number input)
  - Phone Number (tel input)
- Checkbox: Terms of Service + Privacy Policy acceptance
- CTA: **NEXT** (disabled until all fields + checkbox filled)

---

### SCREEN 3 — Skin Concerns (Multi-select)
**Progress: 15%**
- Header: "What are your skin problems?"
- Section label: "Common skin problems — Choose all that apply"
- Options (checkboxes, scrollable):
  - Acne / Pimples — "Pimples or frequent breakouts"
  - Dark Spots / Marks — "Dark patches or uneven skin tone"
  - Wrinkles / Aging — "Fine lines, wrinkles, or sagging"
  - Redness
  - (+ more options below fold)
- CTA: **NEXT**

---

### SCREEN 4 — Photo Preparation (Carousel)
**Progress: 23%**
- Header: "How to prepare for your photo"
- 2-slide carousel:
  - Slide 1: "Remove glasses & tie hair back" + example photo
  - Slide 2: "Face the light for a clear photo" + example photo
- CTA: **ALLOW CAMERA ACCESS** (triggers iOS/browser camera permission)

---

### SCREEN 5 — AI Auto-Capture (Camera View)
**Full screen — no progress bar**
- Top label: "AI Auto-Capture"
- Upper half: Live camera feed with oval face guide overlay
- Guidance states (sequential, text on overlay):
  1. "Initializing Camera…" (spinner)
  2. "Turn towards bright light 💡"
  3. "Match the + and +" (red crosshair user, green crosshair target — user aligns face)
- Lower half: Reference thumbnail (correct positioning example)
- Help button: "How to take photo"
- Captures **3 angles**: front face, left profile, right profile
- Each capture triggers countdown:

---

### SCREEN 5b — Capture Countdown
- Full-screen camera with red corner brackets (capture frame)
- Countdown: 3 → 2 → 1
- Text: "Hold Still" + checkmark icon
- Green overlay flash on capture

---

### SCREEN 6 — Photos Confirmed
- Green checkmark (large)
- "Thank you for the photos!"
- Subhead: "We just need a few more details."
- CTA: **NEXT**

---

### SCREEN 7 — Skin Type
**Progress: 62%**
- Header: "What is your skin type?"
- Subtext: "Choose the option that best describes your skin."
- Single-select radio cards:
  - Oily
  - Dry
  - Sensitive
  - Normal
- CTA: **NEXT**

---

### SCREEN 8 — Problem Duration
**Progress: 69%**
- Header: "When did your skin problem start?"
- Subtext: "Select the time frame."
- Single-select radio:
  - Just started 2–3 days ago
  - Less than a month ago
  - 1–6 months ago
  - More than a year ago
- CTA: **NEXT**

---

### SCREEN 9 — Past Treatments
**Progress: 85%**
- Header: "Have you tried any treatment for your skin problem in the past?"
- Subtext: "For example: medicines, creams, or treatments."
- Options:
  - No
  - Yes (Please specify) → reveals text input
- CTA: **NEXT**

---

### SCREEN 10 — Current Medicines
**Progress: 92%**
- Header: "Are you currently taking any medicines?"
- Subtext: "For example: any daily or regular medicines."
- Options:
  - No
  - Yes (Please specify) → reveals text input
- CTA: **NEXT**

---

### SCREEN 11 — Medicine Allergies
**Progress: 100%**
- Header: "Are you allergic to any medicines?"
- Subtext: "For example: antibiotics, painkillers, or sulfa drugs."
- Options:
  - No
  - Yes (Please specify) → reveals text input
- CTA: **NEXT**

---

### SCREEN 12 — AI Processing
- Logo: "Skin Intelligence" (branded scan icon)
- Spinner animation
- Sequential status messages (each checks off as complete):
  - "Detecting blackheads and whiteheads"
  - "Detecting nodules and cysts"
  - (implied: more detection steps)
- No user action — auto-advances on completion

---

### SCREEN 13 — Results
- Greeting: "Hi [Name]! We have found [N] active skin concerns"
- Subtext: "We noticed [N] areas on your face that may benefit from care."
- Face photo with AI annotation overlay (dots/markers on concern areas)
- Tab bar: FACE (badge with concern count)
- Concern tags (horizontal scrollable pills): e.g. WRINKLES, DARK CIRCLE, INFLAMMATION
- CTA: **GET MY TREATMENT PLAN**

---

### SCREEN 14 — Paywall / Treatment Plan
- Dermatologist profile card (photo, name, designation, reg. number)
- Personal letter addressed to user
- Plan selector:
  - **Prescription ONLY** — ₹200/- ~~₹500/~~ (default selected)
    - "Fast dermatologist review without a live call"
    - After purchase: skin expert calls to confirm details
  - **Doctor Consultation Only** — ₹500/- ~~₹800/~~
    - "Speak with a dermatologist and get a tailored plan"
    - Tag: "Recommended for moderate & severe acne"
- CTA: **BUY NOW ₹[price]/-**

---

## Key UX Patterns

| Pattern | Detail |
|---|---|
| Progress bar | Thin linear bar, % label below, starts at 8% |
| Form validation | CTA stays washed-out/disabled until all required fields filled |
| Photo capture | Split-screen: live camera top, reference example bottom |
| Face alignment | Dual crosshair system (user = red, target = green) |
| Conditional inputs | Yes/No with text field expanding on "Yes" |
| Processing screen | Sequential checklist-style scan status |
| Results | Annotated photo + scrollable concern tags |
| Paywall | Dermatologist social proof + tiered pricing |

---

## Tech Stack (Recommended)

### Frontend
| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14** (App Router) | SSR for SEO, fast routing, PWA-ready |
| Styling | **Tailwind CSS** | Mobile-first, rapid iteration |
| Animations | **Framer Motion** | Progress bar, screen transitions, countdown |
| Camera | **WebRTC (`getUserMedia`)** | Native browser camera, no native app needed |
| Face detection (client) | **MediaPipe Face Mesh** (WASM) | Real-time oval guide + crosshair alignment, runs in-browser |
| State | **Zustand** | Lightweight, persist funnel state across steps |
| Forms | **React Hook Form + Zod** | Fast validation, schema-typed |

### Backend
| Layer | Choice | Why |
|---|---|---|
| API | **Next.js API Routes** (or Hono on Cloudflare Workers) | Co-located, serverless |
| Database | **Supabase (Postgres)** | Auth + storage + DB in one |
| Photo storage | **Supabase Storage** | Signed URLs, private buckets |
| AI analysis | **Claude claude-sonnet-4-6** (vision) via Anthropic API | Multi-image skin analysis, structured JSON output |
| Background jobs | **Inngest** or **Supabase Edge Functions** | Async AI processing after photo submission |

### AI / Analysis Layer
```
Input:  3 face images (front, left, right) + questionnaire answers
Model:  claude-sonnet-4-6 (vision)
Output: JSON {
  conditions: [{ name, severity, face_region, confidence }],
  skin_score: 0-100,
  recommendations: string[],
  detected_concerns: string[]
}
```

Prompt structure for analysis:
- System: "You are a clinical skin analysis AI. Analyse the provided face images and return structured JSON only."
- User: images + questionnaire context
- Tool use or structured output for typed response

### Payments
| | |
|---|---|
| Gateway | **Razorpay** (India) or Stripe |
| Flow | Order created server-side → Razorpay checkout → webhook confirms → unlock results |

### Hosting
| | |
|---|---|
| Frontend + API | **Vercel** |
| DB + Storage | **Supabase** |
| Domain | Custom domain with SSL |

---

## Data Model (Core Tables)

```sql
users          — id, name, gender, age, phone, created_at
sessions       — id, user_id, status (pending|analysed|paid), created_at
photos         — id, session_id, angle (front|left|right), storage_url
questionnaire  — id, session_id, skin_concerns[], skin_type, duration, 
                 past_treatments, current_medicines, allergies
analysis       — id, session_id, raw_json, conditions[], skin_score, 
                 ai_model, processed_at
orders         — id, session_id, plan_type, amount, payment_status, gateway_ref
```

---

## Funnel Conversion Points

```
Landing → Form fill       (drop: ~40%)
Form → Camera permit      (drop: ~25%)
Camera → Photos captured  (drop: ~15%)
Photos → Questionnaire    (drop: ~10%)
Results → Paywall         (drop: ~30%)
Paywall → Purchase        (target: 15–25% of paywall views)
```

---

## MVP Scope (Phase 1)

- [ ] Screens 1–14 (full funnel)
- [ ] WebRTC camera with oval guide (no AI alignment in v1 — manual capture)
- [ ] Claude vision analysis on 3 photos
- [ ] Results page with concern tags (no annotated photo overlay in v1)
- [ ] Razorpay payment for Prescription ONLY tier
- [ ] Supabase storage for photos (signed, private)
- [ ] Basic admin view: see submissions

**Cut from MVP:**
- Live doctor consultation scheduling
- Annotated face photo overlay
- MediaPipe real-time face alignment
- Medicine allergy cross-reference

---

## Percept Differentiators vs Dr.Skin

| Feature | Dr.Skin | Percept |
|---|---|---|
| Platform | Web (mobile) | PWA — installable |
| AI model | Proprietary | Claude vision (transparent) |
| Results unlock | Pay to see | Free preview → pay for full plan |
| Photo capture | AI auto-capture | v1: guided manual; v2: AI alignment |
| Branding | Clinical/medical | Warm, Gen-Z beauty-meets-science |
