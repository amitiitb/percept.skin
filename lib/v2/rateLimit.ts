import { SupabaseClient } from "@supabase/supabase-js";
import { logV2 } from "@/lib/v2/log";

// Fixed-window rate limit backed by the Supabase project already in use —
// no external service (Upstash/etc) needed. Fails OPEN on infra errors: a
// rate-limiter outage should not take down paid AI calls or payment capture.
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  route: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();

  const { data, error } = await supabase.rpc("increment_rate_limit_v2", {
    p_user_id: userId,
    p_route: route,
    p_window_start: windowStart,
  });

  if (error) {
    logV2.error("v2_rate_limit_check_failed", { user_id: userId, route, message: error.message });
    return true;
  }

  return (data as number) <= limit;
}
