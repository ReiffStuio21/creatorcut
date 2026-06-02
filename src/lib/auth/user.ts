import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Whether Supabase auth is wired up (gating only applies when it is). */
export function authConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** The signed-in user from the request cookies, or null. */
export async function getOptionalUser() {
  if (!authConfigured()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
