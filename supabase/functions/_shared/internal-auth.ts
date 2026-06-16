// Auth helpers for internal/cron-style edge functions.
// Accepts either a valid JWT (any authenticated user) or a shared INTERNAL_FUNCTION_SECRET
// passed via the `x-internal-secret` header. Returns null on success, or a Response on failure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireInternalCaller(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  const providedSecret = req.headers.get("x-internal-secret");

  if (internalSecret && providedSecret && providedSecret === internalSecret) {
    return null;
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
      );
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        return null;
      }
    } catch (_e) {
      // fall through to 401
    }
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
