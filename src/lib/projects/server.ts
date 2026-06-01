import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectRow } from "@/lib/supabase/types.gen";

/** Whether Supabase env is configured (the app runs without it for the demo). */
function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** The signed-in user, or null. */
export async function getCurrentUser() {
  if (!configured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The current user's projects, newest first. */
export async function listProjects(): Promise<ProjectRow[]> {
  if (!configured()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  return data ?? [];
}
