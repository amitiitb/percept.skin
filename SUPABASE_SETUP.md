# Supabase Setup — Glowmetry

## 1. Create project
Go to supabase.com → New project → choose region closest to India (ap-south-1).

## 2. Run schema
In Supabase Dashboard → SQL Editor → paste and run:
`../skincare-us/supabase/schema.sql`

This creates: `profiles`, `sessions`, `photos`, `reports` tables + RLS + storage bucket + trigger.

## 3. Enable Anonymous Auth
Dashboard → Authentication → Providers → Anonymous → Enable.

## 4. Add env vars
Create `glowmetry/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
Keys found in: Dashboard → Settings → API.

## 5. Storage bucket
The schema creates the `photos` bucket automatically.
Verify in: Dashboard → Storage → photos (private, 10 MB limit).

## Data flow
```
User completes /allergies
  → /processing loads
  → signInAnonymously() if no session
  → INSERT sessions row (status: uploading)
  → Upload 3 photos to storage: {userId}/{sessionId}/{angle}.jpg
  → INSERT photos rows
  → INSERT reports row (status: pending)
  → UPDATE sessions (status: analyzing)
  → Mock analysis result set in Zustand store
  → Navigate to /results
```

## Next: wire real AI analysis
Replace the mock in `/app/processing/page.tsx` with:
1. POST to `/api/analyse` with sessionId
2. Server-side: fetch photos from storage → send to Claude vision API → update report row
3. Client polls `reports` table until `status = complete`
4. Pull `conditions` from `reports.scores` and display in results
