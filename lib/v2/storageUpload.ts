import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Writes a generated image to photos_v2, replacing any existing object at the
 * same path.
 *
 * Why not just `upsert: true`: overwriting an existing object is an UPDATE on
 * storage.objects, and the photos_v2 bucket only has select, insert and delete
 * policies (see 20260722000000_v2_schema.sql). So an upsert succeeded the first
 * time and failed with "new row violates row-level security policy" on every
 * regeneration, which is exactly what a user hits when they rerun a preview.
 *
 * Deleting first and then inserting stays inside the policies that do exist, so
 * this needs no migration and no policy change.
 */
export async function replaceImage(
  supabase: SupabaseClient,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ error: Error | null }> {
  // Ignore the delete result: "not found" is the normal first-run case, and a
  // genuine permission problem will surface on the upload below anyway.
  await supabase.storage.from("photos_v2").remove([path]);

  const { error } = await supabase.storage.from("photos_v2").upload(path, bytes, { contentType });
  return { error: error ? new Error(error.message) : null };
}
