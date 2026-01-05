import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const extractIgrejaId = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

export function useIgrejaId() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const resolveSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        // Se não há sessão válida, definir como null e parar loading
        if (!session?.user?.id) {
          if (isMounted) {
            setIgrejaId(null);
            setLoading(false);
          }
          return;
        }

        let igrejaIdFromMetadata =
          extractIgrejaId(session?.user?.app_metadata?.igreja_id) ??
          extractIgrejaId(session?.user?.user_metadata?.igreja_id);

        // Se não encontrou nos metadados JWT, buscar do perfil do usuário
        if (!igrejaIdFromMetadata && session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("igreja_id")
            .eq("user_id", session.user.id)
            .single();

          if (!error && profile?.igreja_id) {
            igrejaIdFromMetadata = profile.igreja_id;
          }
        }

        if (isMounted) {
          setIgrejaId(igrejaIdFromMetadata);
          setLoading(false);
          // Limpar timeout se conseguiu resolver
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } catch (error) {
        console.error('Erro ao resolver igrejaId:', error);
        if (isMounted) {
          setIgrejaId(null);
          setLoading(false);
        }
      }
    };

    resolveSession();

    // Timeout fallback para evitar loop infinito
    timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('useIgrejaId: Timeout reached, setting igrejaId to null');
        setIgrejaId(null);
        setLoading(false);
      }
    }, 5000); // 5 segundos timeout

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        // Se não há sessão válida, definir como null e parar loading
        if (!session?.user?.id) {
          if (isMounted) {
            setIgrejaId(null);
            setLoading(false);
          }
          return;
        }

        let igrejaIdFromMetadata =
          extractIgrejaId(session?.user?.app_metadata?.igreja_id) ??
          extractIgrejaId(session?.user?.user_metadata?.igreja_id);

        // Se não encontrou nos metadados JWT, buscar do perfil do usuário
        if (!igrejaIdFromMetadata && session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("igreja_id")
            .eq("user_id", session.user.id)
            .single();

          if (!error && profile?.igreja_id) {
            igrejaIdFromMetadata = profile.igreja_id;
          }
        }

        if (isMounted) {
          setIgrejaId(igrejaIdFromMetadata);
          setLoading(false);
          // Limpar timeout se conseguiu resolver
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }
      } catch (error) {
        console.error('Erro ao resolver igrejaId no auth change:', error);
        if (isMounted) {
          setIgrejaId(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return { igrejaId, loading };
}
