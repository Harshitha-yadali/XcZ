import { createClient } from "npm:@supabase/supabase-js@2";

export interface Caller {
  isService: boolean;
  isAdmin: boolean;
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null;
}

/**
 * Identifies who is calling an edge function. The anon key is public, so a
 * valid JWT alone proves nothing — callers are either the service role
 * (cron / other functions), or a real signed-in user. Admin comes from
 * user_profiles.role, which users cannot change (see the
 * lock_down_user_writable_rls migration) — never from user_metadata.
 */
export async function getCaller(req: Request): Promise<Caller> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!token) return { isService: false, isAdmin: false, user: null };
  if (token === serviceKey) return { isService: true, isAdmin: true, user: null };

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return { isService: false, isAdmin: false, user: null };

  const { data: profile } = await supabase
    .from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  // The owner account is admin app-wide (authService); its email is verified by Supabase Auth.
  const isOwner = user.email?.toLowerCase() === "primoboostai@gmail.com";
  return { isService: false, isAdmin: profile?.role === "admin" || isOwner, user };
}

export function denied(message: string, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Returns an error Response unless the caller is the service role or an admin. */
export async function denyUnlessServiceOrAdmin(req: Request, headers: Record<string, string>) {
  const caller = await getCaller(req);
  return caller.isAdmin ? null : denied("Admin access required.", 403, headers);
}
