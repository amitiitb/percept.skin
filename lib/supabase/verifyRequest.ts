import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the caller has a valid Supabase session (anonymous or full).
 * AI routes cost real money per call — without this check anyone on the
 * internet could hit them directly.
 */
export async function verifySupabaseUser(req: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id };
}
