# Percept — User Flow & Feature Spec

> Status doc: how the flow **should** work, what exists today, and the gaps.
> Last reviewed: 13 Jul 2026

---

## 1. Target User Flow

### A. First-time visitor (acquisition funnel)

```
/start (landing)
   → /onboard        Profile: name, gender, age, phone
   → /concerns       Multi-select skin problems
   → /photo-prep     Prep carousel + camera permission
   → /capture        Guided capture (front, left, right [+ smile, crown, eye])
   → /details        Post-photo questionnaire: skin type, duration,
                     treatments, medicines, allergies
   → /processing     Upload photos → create session + report row →
                     call /api/analyse (Claude vision)
   → /results        TEASER: skin score + hero visible,
                     rest blurred behind "Create free account" gate
   → /auth/signup    Email signup (anonymous session upgraded)
   → /results        FULL report unlocked:
                       1. Skin Report (score, 6 parameters, conditions, advice)
                       2. Colour Analysis (season, palettes, draping) ← auto-run, persisted
                       3. Frame Try-On
   → /plan           Paywall: Prescription ₹200 / Consultation ₹500
   → [payment]       Razorpay checkout → webhook → unlock treatment plan
```

### B. Returning user (retention loop)

```
/auth/login → /dashboard
   Dashboard shows:
     • Latest skin score + trend vs previous scan
     • "New Analysis" → Myself (keeps profile, straight to photo-prep)
                      → Someone else (full reset → onboard)
     • Recent sessions → EACH row opens ITS OWN report (/my-reports/[id])
     • My Reports / My Profile
```

### C. Colour Analysis feature (target — from reference screenshots)

Report section "Personal Colour" should produce:

1. **Season classification** — 12 sub-seasons (e.g. "Dark Winter"), undertone,
   contrast level. One Claude vision call. **Run automatically during
   /processing, persisted with the report** — not a manual button.
2. **Palette circles sheet** — user's face cropped into circles ringed with
   each palette colour + names. Pure canvas compositing, zero API cost.
3. **Colour draping grid** — selfie with lower third filled by each palette
   colour (fabric-texture overlay), hex + one-line caption per colour.
   Deterministic canvas (free tier).
4. **Hero drapes (premium)** — 3 "best colour" photorealistic drapes via
   generative image edit (Gemini image / nanobanana).
5. **Hairstyle recommendations (premium)** — generative edits of user photo.
6. Shareable/downloadable report page styled like the reference
   (serif headings, cream background).

---

## 2. What Exists Today (implemented)

| Piece | Status |
|---|---|
| Full funnel screens /start → /results | ✅ built |
| 6-angle capture (front/left/right/smile/crown/eye) | ✅ built |
| Supabase: anonymous auth, sessions, photos, reports tables, storage | ✅ built |
| /api/analyse — Claude vision, personalised via questionnaire | ✅ built |
| /api/colour-analysis — Claude vision, 4-season output | ✅ built (manual trigger) |
| Results teaser → signup gate | ✅ built |
| Dashboard, My Reports, report detail, profile | ✅ built |
| Print/download report | ✅ basic |

---

## 3. Gaps (ranked by severity)

### 🔴 Flow-breaking

1. **Session "View" buttons all open the same report.** Dashboard recent
   sessions and report rows route to `/results`, which renders whatever is in
   the Zustand store (the latest scan). Old sessions show the wrong data.
   → Route each row to `/my-reports/[session_id]`.
2. **Colour analysis is throwaway.** Generated on-demand in the results page,
   held in component state only. Refresh = gone; every click = new API spend;
   never saved to the report row; `initialAnalysis` is always `null`;
   report-detail page can't show it.
   → Run once in /processing (or on first unlock), persist into `reports`.
3. **Two competing colour systems.** `/api/analyse` returns
   `seasonalColour/colourPalette` (4 seasons); `/api/colour-analysis` returns a
   richer 4-season object. Target needs **12 sub-seasons**. Consolidate into
   one schema, one source of truth.
4. **Silent mock results.** If the AI call fails, `MOCK_FALLBACK` (fake score
   71, fake conditions) is shown as if real — user can buy a plan based on
   fabricated data. → Show an honest "analysis failed, retry" state.
5. **Upload errors invisible.** `/processing` sets `uploadError` but never
   renders it; the animation plays over a dead upload.
6. **Paywall dead-end.** `/plan` exists but there is no payment route/webhook
   (no Razorpay integration in `app/api`). CTA leads nowhere.

### 🟡 Degraded experience

7. **Report detail (`/my-reports/[id]`) is a downgraded report** — no photos,
   no colour section, no try-on, different layout from `/results`. Should be
   the same report component fed by session id.
8. **Photos expire after 7 days** (signed URLs stored client-side). Old
   reports lose their images. → Re-sign from `storage_path` on load.
9. **`getNextFunnelStep` requires all 6 photos** including smile/crown/eye to
   count capture as complete; if capture flow treats 3 as enough, resume logic
   strands users at /details vs /capture inconsistently.
10. **"Analyse Myself" skips /concerns** but concerns may have changed;
    offer a quick "update concerns?" step or keep-previous confirmation.
11. **No skin-score trend** on dashboard despite having historical reports.

### 🟢 Missing target features (colour report)

12. No 12-sub-season classification.
13. No palette-circles visual, no draping grid, no hero drapes, no hairstyle
    section, no styled shareable report page.

---

## 4. Design / UI issues (dashboard & buttons)

- Dashboard hand-rolls every button inline: 4 different heights (4.8/4.0/3.4rem),
  3 font weights, zero hover/focus states, mixed border treatments.
- `PrimaryButton` exists but the dashboard never uses it.
- Logout rendered as the heaviest (solid dark) button on the page — wrong
  hierarchy for a destructive/rare action.
- "Begin →" toggling an inline accordion feels broken; choice cards use raw
  emoji (🙋/👤) as icons.
- No hover elevation/transition on cards; stat chips look disabled.

**Fix direction:** one button system (PrimaryButton with hover/focus states,
`sm/md/lg`, `primary/outline/ghost`), consistent card component, clear
hierarchy: New Analysis (primary) → View Report (outline) → utility links (ghost).

---

## 5. Build Order

1. Fix routing bug (#1), surface upload/AI errors (#4, #5).
2. Consolidate colour schema → 12 sub-seasons, auto-run + persist (#2, #3).
3. Palette circles + draping grid (canvas, free tier).
4. Unified report component for /results and /my-reports/[id] (#7, #8).
5. Razorpay integration (#6).
6. Premium generative tier: hero drapes + hairstyles.
7. Dashboard trend chart (#11).
