import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const FILIAL_OVERRIDE_KEY = "lovable_filial_override";

const extractUUID = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

interface FilialData {
  filialId: string | null;
  igrejaId: string | null;
}

export function useFilialId() {
  const [data, setData] = useState<FilialData>({ filialId: null, igrejaId: null });
  const [loading, setLoading] = useState(true);

  const extractFromSession = useCallback((session: any): FilialData => {
    const filialId =
      extractUUID(session?.user?.app_metadata?.filial_id) ??
      extractUUID(session?.user?.user_metadata?.filial_id);
    const igrejaId =
      extractUUID(session?.user?.app_metadata?.igreja_id) ??
      extractUUID(session?.user?.user_metadata?.igreja_id);
    return { filialId, igrejaId };
  }, []);

  const getOverrideFromStorage = (): string | null => {
    try {
      const stored = localStorage.getItem(FILIAL_OVERRIDE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.id || null;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;

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
        if (override) {
          extracted.filialId = override;
        }

        if (isMounted) {
          setData(extracted);
        }
      } catch (err) {
        // Em caso de erro, não travar a aplicação em loading infinito
        if (isMounted) {
          setData({ filialId: null, igrejaId: null });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    resolveSession();

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
        if (override) {
          extracted.filialId = override;
        }

        if (isMounted) {
          setData(extracted);
        }
      } catch {
        if (isMounted) {
          setData({ filialId: null, igrejaId: null });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [extractFromSession]);

  return { 
    filialId: data.filialId, 
    igrejaId: data.igrejaId,
    loading 
  };
}
