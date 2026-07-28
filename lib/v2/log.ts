// Structured logging for v2 API routes — Eng review Section 8 (Observability).
// Enables reconstructing "user paid but not premium" style incidents from logs alone.
type LogFields = Record<string, string | number | boolean | null | undefined>;

// Interim error tracking until a real service (Sentry, etc) is wired up —
// persists to Supabase (already provisioned) so warn/error survive past the
// serverless invocation instead of only living in ephemeral console output.
// logV2 is also imported from a client component (capture page), so the
// Supabase import is dynamic and gated on `typeof window === "undefined"` —
// otherwise the service-role path (unused, always null in the browser) would
// still get bundled into client JS for no reason.
let persistClientPromise: Promise<import("@supabase/supabase-js").SupabaseClient | null> | null = null;
function getPersistClient() {
  if (typeof window !== "undefined") return null;
  if (persistClientPromise) return persistClientPromise;
  persistClientPromise = (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, key);
  })();
  return persistClientPromise;
}

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  console[level](JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));

  if (level === "info") return;
  const clientPromise = getPersistClient();
  if (!clientPromise) return;
  clientPromise.then((client) => {
    if (!client) return;
    return client.from("error_logs_v2").insert({ level, event, fields: fields ?? {} });
  }).catch(() => {});
}

export const logV2 = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
