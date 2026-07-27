import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleId } from "./reportModules";

// Colour/hairstyle/frame generation routes cost real money per call (Claude
// or Gemini). Without this check, any authenticated user could call them
// directly with any sessionId and get free, unlimited generations — auth
// alone isn't a payment gate.
export async function hasPurchasedModule(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  moduleId: ModuleId
): Promise<boolean> {
  const { data } = await supabase
    .from("report_purchases_v2")
    .select("modules")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();
  return Array.isArray(data?.modules) && data.modules.includes(moduleId);
}
