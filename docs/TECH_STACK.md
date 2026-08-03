# Percept — Tech Stack

Status: reflects `package.json` and actual usage in the codebase as of 2026-07-28.

## Frontend

| Piece | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router) | Deployed with auto-deploy on every push to `main` |
| UI library | React 19.2.4 | |
| Language | TypeScript 5 | |
| Styling | Inline `style={{}}` + CSS custom properties in `app/globals.css` | No component CSS framework in active use — Tailwind is installed (`^4`) but unused in practice |
| Design tokens | `--primary`, `--rose` (teal accent), `--canvas`, `--surface`, `--wash`, `--line`, `--secondary`, `--muted`; local `GOLD`/`CORAL` consts on the landing page | |
| Typography | "Satoshi" via Fontshare CDN (display), "Basis Grotesque Pro" self-hosted `.woff2` (body) | |
| Animation | Framer Motion 12 | `whileInView` scroll reveals, `layoutId` shared-layout transitions (e.g. the sliding purchase-plan pill), `useMotionValue`/`animate` count-ups — all respect `prefers-reduced-motion` |
| Smooth scroll | Lenis | |
| State | Zustand 5 (`store/funnelV2.ts`) | Persists capture-funnel progress to localStorage so a mid-flow tab close resumes where the user left off |
| Forms | react-hook-form + `@hookform/resolvers` + Zod | |
| On-device computer vision | `@mediapipe/tasks-vision` (FaceLandmarker) | Runs entirely client-side: live face mesh overlay during capture, plus the no-face/multiple-faces/too-dark/too-blurry quality gate before a photo is accepted |

## Backend

| Piece | Choice | Notes |
|---|---|---|
| API | Next.js Route Handlers (`app/api/**/route.ts`) | Serverless, one file per endpoint |
| Database | Supabase Postgres | 12 tables, all suffixed `_v2`, all with row-level security |
| Auth | Supabase Auth | Shared `auth.users` table; JWT verified per-request via `verifySupabaseUser` |
| File storage | Supabase Storage, `photos_v2` bucket | Path convention `{user_id}/{session_id}/{photo_type}.jpg`, RLS enforced on the storage objects themselves (not just the DB) |
| Client patterns | Two Supabase client shapes used deliberately: a **scoped client** (anon key + the caller's JWT, so RLS applies as that user) for anything the user should only touch their own rows in; a **service-role client** for the handful of writes an ordinary user must never make directly (subscription/purchase/consultation status flips, error/rate-limit logging) | |

## AI providers

| Piece | Choice | Notes |
|---|---|---|
| Vision analysis | Claude (`claude-sonnet-4-6`), Anthropic Messages API | Real provider behind `lib/v2/aiProvider.ts`'s `AnalysisProvider` interface; returns the full skin/face/hair schema, Zod-validated before anything renders it |
| Image generation | Gemini `gemini-2.5-flash-image` | Image-to-image editing for AI hairstyle previews and AI frame try-on previews; needs Google Cloud billing enabled (image generation isn't covered by Gemini's free tier the way text-only calls are) |

## Payments & email

| Piece | Choice | Notes |
|---|---|---|
| Payments | PayPal REST Orders v2 API, plain `fetch` (no SDK) | **Sandbox credentials/endpoint only** (`lib/v2/paypal.ts` — `PAYPAL_API_BASE` is the sandbox host, explicitly TODO'd for production swap). Server always re-verifies the order with PayPal before writing any purchase/subscription row — never trusts a client-side "payment succeeded" callback alone |
| Webhook verification | PayPal's `/v1/notifications/verify-webhook-signature` endpoint | Code is real and fails closed (returns false with no `PAYPAL_WEBHOOK_ID` configured), but no webhook subscription is registered yet — dormant until production PayPal setup |
| Transactional email | Resend | Welcome email on signup, "your report is ready" email on purchase capture (mentions the doctor-consultation upsell) — both fire-and-forget, never block the API response |

## Ops / hardening (added 2026-07-28)

| Piece | Choice | Notes |
|---|---|---|
| Rate limiting | Postgres-backed fixed-window counter, own tables (`rate_limits_v2`), atomic via a `security definer` RPC (`increment_rate_limit_v2`) | No external service (Upstash etc) — reuses the Supabase project already provisioned. Guards the AI analyse route and all 3 PayPal capture routes |
| Error tracking | `error_logs_v2` table, written from `lib/v2/log.ts` alongside the existing console logging | Interim measure until a real APM (Sentry or similar) is wired up — needs an account/DSN this environment doesn't have |
| Testing | Vitest | First tests added 2026-07-28: bundle-pricing logic, the em-dash sanitizer |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Build + test gate on every push/PR to `main`; lint runs but is non-blocking against 18 pre-existing errors (2 were real bugs, fixed; the rest are unused-var/exhaustive-deps warnings) |

## Dev tooling

- ESLint 9 + `eslint-config-next` 16 — includes React Compiler purity rules (`react-hooks/purity`, `react-hooks/set-state-in-effect`), stricter than typical `exhaustive-deps`-only setups: e.g. `useMemo` is **not** an accepted place for a one-time impure call (`Math.random()`, etc) under these rules — only a `useState` lazy initializer is.
- TypeScript 5, strict-ish config via `tsconfig.json`.
- No Tailwind usage in practice despite being installed; do not introduce Tailwind classes into new components without checking with the team, since the existing codebase is 100% inline-style + CSS-vars.
