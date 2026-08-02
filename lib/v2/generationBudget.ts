import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How many times a single generated image may be produced for one scan.
 *
 * One is the automatic generation the user gets on first opening the report;
 * the other two are redos they can ask for if they dislike the result. Every
 * generation is a real billed Vertex call, so this is a spend ceiling, not a
 * UX preference — it has to hold even if the client is bypassed, which is why
 * it is checked in the route rather than by hiding a button.
 *
 * Note this is per image *kind* per scan: hairstyle, colour, and frame grids
 * each get their own budget of 3.
 */
export const MAX_GENERATIONS = 3;

type GridTable = "hairstyle_generations_v2" | "frame_generations_v2";

/**
 * Counts generations already produced for a scan.
 *
 * Both grid tables insert one row per generation (they do not upsert), so the
 * row count is the usage count. Rows are filtered by the fixed label the grid
 * routes write, so per-style generations in the same table are not counted
 * against the grid's budget.
 */
export async function gridGenerationsUsed(
  supabase: SupabaseClient,
  table: GridTable,
  labelColumn: "style_name" | "frame_name",
  label: string,
  userId: string,
  sessionId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq(labelColumn, label);

  // A failed count must not hand out unlimited generations, so treat an error
  // as "budget exhausted" and let the caller refuse.
  if (error) return MAX_GENERATIONS;
  return count ?? 0;
}

/** Shared copy so all three routes refuse in the same words. */
export function budgetExhaustedMessage(kind: string): string {
  return `You have used all ${MAX_GENERATIONS} ${kind} previews for this scan. Run a new scan to generate more.`;
}
