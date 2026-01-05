import { useEffect, useState, useCallback, useRef } from "react";
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
  const metadataSynced = useRef(false);
  const lastUserId = useRef<string | null>(null);

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

  const syncSessionMetadata = async (
    session: Session | null,
    igrejaId: string | null,
    filialId: string | null,
    isAllFiliais: boolean
  ): Promise<Session | null> => {
    if (session?.user?.id !== lastUserId.current) {
      metadataSynced.current = false;
      lastUserId.current = session?.user?.id ?? null;
    }
    if (!session?.user?.id || !igrejaId) return session;
    if (metadataSynced.current) return session;

    const metaIgreja =
      extractUUID(session.user.app_metadata?.igreja_id) ??
      extractUUID(session.user.user_metadata?.igreja_id);
    const metaFilial =
      extractUUID(session.user.app_metadata?.filial_id) ??
      extractUUID(session.user.user_metadata?.filial_id);

    const targetFilial = isAllFiliais ? null : filialId;
    const needsSync =
      (igrejaId && metaIgreja !== igrejaId) ||
      (targetFilial !== undefined && metaFilial !== targetFilial);

    if (!needsSync) return session;

    metadataSynced.current = true;
    try {
      await supabase.auth.updateUser({
        data: {
          igreja_id: igrejaId,
          filial_id: targetFilial,
        },
      });

      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session ?? session;
    } catch (error) {
      console.error("Erro ao sincronizar metadata de filial:", error);
      metadataSynced.current = false; // permitir nova tentativa se falhar
      return session;
    }
  };

  const canUseAllFiliais = async (
    userId?: string | null,
    igrejaId?: string | null
  ) => {
    if (!userId || !igrejaId) return false;

    try {
      // Primeiro verificar se tem restrições explícitas em user_filial_access
      const { data: restrictionsData } = await supabase
        .from("user_filial_access")
        .select("id")
        .eq("user_id", userId)
        .eq("igreja_id", igrejaId)
        .limit(1);

      // Se tem restrições explícitas, NÃO pode ver todas as filiais
      if (restrictionsData && restrictionsData.length > 0) {
        return false;
      }

      const queryPromise = supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("igreja_id", igrejaId);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), 3000)
      );

      const result = await Promise.race([queryPromise, timeoutPromise]);

      if ("error" in result && result.error) {
        console.error("Erro ao validar permissões de filial:", result.error);
        return false;
      }

      // Só admins SEM restrições podem ver todas as filiais
      return (result.data || []).some((r: { role: string }) =>
        ["admin", "admin_igreja", "super_admin"].includes(r.role)
      );
    } catch (err) {
      console.warn("Timeout ou erro ao validar permissões de filial:", err);
      return false;
    }
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
        let profileFilialId: string | null = null;

        // Se não tiver filial_id no JWT, buscar do profile
        if (!extracted.filialId && sessionData.session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("filial_id, igreja_id")
            .eq("user_id", sessionData.session.user.id)
            .single();

          if (!error && profile) {
            profileFilialId = profile.filial_id;
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

        const syncedSession = await syncSessionMetadata(
          sessionData.session,
          extracted.igrejaId,
          extracted.filialId ?? profileFilialId,
          extracted.isAllFiliais ?? false
        );

        if (syncedSession && syncedSession !== sessionData.session) {
          const reExtracted = extractFromSession(syncedSession);
          extracted.filialId = reExtracted.filialId ?? extracted.filialId;
          extracted.igrejaId = reExtracted.igrejaId ?? extracted.igrejaId;
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
        let profileFilialId: string | null = null;

        // Se não tiver filial_id no JWT, buscar do profile
        if (!extracted.filialId && session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("filial_id, igreja_id")
            .eq("user_id", session.user.id)
            .single();

          if (!error && profile) {
            profileFilialId = profile.filial_id;
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

        const syncedSession = await syncSessionMetadata(
          session,
          extracted.igrejaId,
          extracted.filialId ?? profileFilialId,
          extracted.isAllFiliais ?? false
        );

        if (syncedSession && syncedSession !== session) {
          const reExtracted = extractFromSession(syncedSession);
          extracted.filialId = reExtracted.filialId ?? extracted.filialId;
          extracted.igrejaId = reExtracted.igrejaId ?? extracted.igrejaId;
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
  }, [extractFromSession, loading]);

  return {
    filialId: data.filialId,
    igrejaId: data.igrejaId,
    isAllFiliais: data.isAllFiliais,
    loading,
  };
}
