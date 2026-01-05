import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

const FILIAL_OVERRIDE_KEY = "lovable_filial_override";

const extractUUID = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

interface FilialData {
  filialId: string | null;
  igrejaId: string | null;
  isAllFiliais: boolean;
}

export function useFilialId() {
  const [data, setData] = useState<FilialData>({
    filialId: null,
    igrejaId: null,
    isAllFiliais: false,
  });
  const [loading, setLoading] = useState(true);

  const extractFromSession = useCallback((session: Session): FilialData => {
    const filialId =
      extractUUID(session?.user?.app_metadata?.filial_id) ??
      extractUUID(session?.user?.user_metadata?.filial_id);
    const igrejaId =
      extractUUID(session?.user?.app_metadata?.igreja_id) ??
      extractUUID(session?.user?.user_metadata?.igreja_id);
    return { filialId, igrejaId, isAllFiliais: false };
  }, []);

  const getOverrideFromStorage = (): {
    id: string | null;
    isAll: boolean;
  } | null => {
    try {
      const stored = localStorage.getItem(FILIAL_OVERRIDE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          id: parsed.id || null,
          isAll: Boolean(parsed.isAll),
        };
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  };

  const canUseAllFiliais = async (
    userId?: string | null,
    igrejaId?: string | null
  ) => {
    if (!userId || !igrejaId) return false;
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("igreja_id", igrejaId);

    if (error) {
      console.error("Erro ao validar permissões de filial:", error);
      return false;
    }

    return (roles || []).some((r) =>
      ["admin", "admin_igreja", "super_admin"].includes(r.role)
    );
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let resolved = false;

    const finish = (next: FilialData) => {
      if (!isMounted || resolved) return;
      resolved = true;
      setData(next);
      setLoading(false);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    const resolveSession = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const extracted = extractFromSession(sessionData.session);

        // Se não tiver filial_id no JWT, buscar do profile
        if (!extracted.filialId && sessionData.session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("filial_id, igreja_id")
            .eq("user_id", sessionData.session.user.id)
            .single();

          if (!error && profile) {
            extracted.filialId = profile.filial_id;
            extracted.igrejaId = profile.igreja_id ?? extracted.igrejaId;
          }
        }

        // Verificar override do localStorage (para admins que trocaram filial)
        const override = getOverrideFromStorage();
        if (override?.isAll) {
          const allowed = await canUseAllFiliais(
            sessionData.session?.user?.id,
            extracted.igrejaId
          );
          if (allowed) {
            extracted.filialId = null;
            extracted.isAllFiliais = true;
          } else {
            localStorage.removeItem(FILIAL_OVERRIDE_KEY);
          }
        } else if (override?.id) {
          extracted.filialId = override.id;
        }

        finish({
          filialId: extracted.filialId,
          igrejaId: extracted.igrejaId,
          isAllFiliais: extracted.isAllFiliais ?? false,
        });
      } catch (err) {
        // Em caso de erro, não travar a aplicação em loading infinito
        finish({ filialId: null, igrejaId: null, isAllFiliais: false });
      }
    };

    resolveSession();

    // Fallback para evitar loading infinito
    timeoutId = setTimeout(() => {
      if (isMounted && !resolved) {
        console.warn("useFilialId: Timeout reached, forcing neutral context");
        finish({ filialId: null, igrejaId: null, isAllFiliais: false });
      }
    }, 6000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const extracted = extractFromSession(session);

        // Se não tiver filial_id no JWT, buscar do profile
        if (!extracted.filialId && session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("filial_id, igreja_id")
            .eq("user_id", session.user.id)
            .single();

          if (!error && profile) {
            extracted.filialId = profile.filial_id;
            extracted.igrejaId = profile.igreja_id ?? extracted.igrejaId;
          }
        }

        // Verificar override do localStorage (para admins que trocaram filial)
        const override = getOverrideFromStorage();
        if (override?.isAll) {
          const allowed = await canUseAllFiliais(
            session?.user?.id,
            extracted.igrejaId
          );
          if (allowed) {
            extracted.filialId = null;
            extracted.isAllFiliais = true;
          } else {
            localStorage.removeItem(FILIAL_OVERRIDE_KEY);
          }
        } else if (override?.id) {
          extracted.filialId = override.id;
        }

        finish({
          filialId: extracted.filialId,
          igrejaId: extracted.igrejaId,
          isAllFiliais: extracted.isAllFiliais ?? false,
        });
      } catch {
        finish({ filialId: null, igrejaId: null, isAllFiliais: false });
      }
    });

    return () => {
      isMounted = false;
      resolved = true;
      subscription.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [extractFromSession]);

  return {
    filialId: data.filialId,
    igrejaId: data.igrejaId,
    isAllFiliais: data.isAllFiliais,
    loading,
  };
}
