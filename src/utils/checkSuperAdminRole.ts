import { supabase } from "@/integrations/supabase/client";

const CONTEXT_STORAGE_KEY = "preferred_context";

export async function checkIsSuperAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (error) {
      console.error("Error checking super admin role:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error checking super admin role:", error);
    return false;
  }
}

export function getPreferredContext(): "superadmin" | "app" | null {
  const stored = localStorage.getItem(CONTEXT_STORAGE_KEY);
  if (stored === "superadmin" || stored === "app") {
    return stored;
  }
  return null;
}

export function clearPreferredContext(): void {
  localStorage.removeItem(CONTEXT_STORAGE_KEY);
}
