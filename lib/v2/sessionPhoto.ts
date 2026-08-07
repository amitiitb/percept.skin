import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the generation source from the authenticated scan session itself.
 * Never trust a photo URL supplied by the browser: persisted client state can
 * outlive a scan and accidentally point a new report at an older subject.
 */
export async function signedFrontPhotoForSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<string> {
  const { data: rows, error } = await supabase
    .from("analysis_photos_v2")
    .select("photo_type, storage_path")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .in("photo_type", ["face_front", "face_detail"]);
  if (error) throw error;

  const source = ["face_front", "face_detail"]
    .map((type) => rows?.find((row) => row.photo_type === type))
    .find(Boolean);
  if (!source) throw new Error("No front-facing photo exists for this scan");

  const { data, error: signError } = await supabase.storage
    .from("photos_v2")
    .createSignedUrl(source.storage_path, 60 * 10);
  if (signError || !data?.signedUrl) {
    throw signError ?? new Error("Could not access this scan's front photo");
  }
  return data.signedUrl;
}
