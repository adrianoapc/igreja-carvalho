import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    let isMounted = true;

    const resolveSession = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const extracted = extractFromSession(sessionData.session);

      // Se não tiver filial_id no JWT, buscar do profile
      if (!extracted.filialId && sessionData.session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("filial_id, igreja_id")
          .eq("user_id", sessionData.session.user.id)
          .single();
        
        if (profile) {
          extracted.filialId = profile.filial_id;
          extracted.igrejaId = profile.igreja_id ?? extracted.igrejaId;
        }
      }

      if (isMounted) {
        setData(extracted);
        setLoading(false);
      }
    };

    resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const extracted = extractFromSession(session);

      // Se não tiver filial_id no JWT, buscar do profile
      if (!extracted.filialId && session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("filial_id, igreja_id")
          .eq("user_id", session.user.id)
          .single();
        
        if (profile) {
          extracted.filialId = profile.filial_id;
          extracted.igrejaId = profile.igreja_id ?? extracted.igrejaId;
        }
      }

      if (isMounted) {
        setData(extracted);
        setLoading(false);
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
