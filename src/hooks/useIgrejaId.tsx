import { useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const extractIgrejaId = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

export function useIgrejaId() {
  const [igrejaId, setIgrejaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const metadataSynced = useRef(false);
  const lastUserId = useRef<string | null>(null);

  const syncSessionMetadata = async (
    session: Session | null,
    resolvedIgrejaId: string | null
  ): Promise<Session | null> => {
    if (session?.user?.id !== lastUserId.current) {
      metadataSynced.current = false;
      lastUserId.current = session?.user?.id ?? null;
    }
    if (!session?.user?.id || !resolvedIgrejaId) return session;
    if (metadataSynced.current) return session;

    const metaIgrejaId =
      extractIgrejaId(session.user.app_metadata?.igreja_id) ??
      extractIgrejaId(session.user.user_metadata?.igreja_id);

    if (metaIgrejaId === resolvedIgrejaId) {
      return session;
    }

    metadataSynced.current = true;
    try {
      await supabase.auth.updateUser({
        data: {
          igreja_id: resolvedIgrejaId,
        },
      });

      const { data: refreshed } = await supabase.auth.refreshSession();
      return refreshed.session ?? session;
    } catch (error) {
      console.error("Erro ao sincronizar metadata de igreja:", error);
      metadataSynced.current = false; // permitir nova tentativa em caso de falha
      return session;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let resolved = false;

    const finish = (value: string | null) => {
      if (!isMounted) return;
      resolved = true;
      setIgrejaId(value);
      setLoading(false);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };

    const resolveSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        // Se não há sessão válida, definir como null e parar loading
        if (!session?.user?.id) {
          finish(null);
          return;
        }

        let igrejaIdFromMetadata =
          extractIgrejaId(session?.user?.app_metadata?.igreja_id) ??
          extractIgrejaId(session?.user?.user_metadata?.igreja_id);
        let profileIgrejaId: string | null = null;

        // Se não encontrou nos metadados JWT, buscar do perfil do usuário
        if (!igrejaIdFromMetadata && session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("igreja_id")
            .eq("user_id", session.user.id)
            .single();

          if (!error && profile?.igreja_id) {
            profileIgrejaId = profile.igreja_id;
            igrejaIdFromMetadata = igrejaIdFromMetadata ?? profile.igreja_id;
          }
        }

        // Garantir que o JWT está atualizado com o contexto resolvido
        const syncedSession = await syncSessionMetadata(
          session,
          igrejaIdFromMetadata ?? profileIgrejaId ?? null
        );

        if (syncedSession && syncedSession !== session) {
          igrejaIdFromMetadata =
            extractIgrejaId(syncedSession.user?.app_metadata?.igreja_id) ??
            extractIgrejaId(syncedSession.user?.user_metadata?.igreja_id) ??
            igrejaIdFromMetadata;
        }

        finish(igrejaIdFromMetadata ?? null);
      } catch (error) {
        console.error("Erro ao resolver igrejaId:", error);
        finish(null);
      }
    };

    resolveSession();

    // Timeout fallback para evitar loop infinito
    timeoutId = setTimeout(() => {
      if (isMounted && !resolved) {
        console.warn("useIgrejaId: Timeout reached, setting igrejaId to null");
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
          finish(null);
          return;
        }

        let igrejaIdFromMetadata =
          extractIgrejaId(session?.user?.app_metadata?.igreja_id) ??
          extractIgrejaId(session?.user?.user_metadata?.igreja_id);
        let profileIgrejaId: string | null = null;

        // Se não encontrou nos metadados JWT, buscar do perfil do usuário
        if (!igrejaIdFromMetadata && session?.user?.id) {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("igreja_id")
            .eq("user_id", session.user.id)
            .single();

          if (!error && profile?.igreja_id) {
            profileIgrejaId = profile.igreja_id;
            igrejaIdFromMetadata = igrejaIdFromMetadata ?? profile.igreja_id;
          }
        }

        // Garantir que o JWT está atualizado com o contexto resolvido
        const syncedSession = await syncSessionMetadata(
          session,
          igrejaIdFromMetadata ?? profileIgrejaId ?? null
        );

        if (syncedSession && syncedSession !== session) {
          igrejaIdFromMetadata =
            extractIgrejaId(syncedSession.user?.app_metadata?.igreja_id) ??
            extractIgrejaId(syncedSession.user?.user_metadata?.igreja_id) ??
            igrejaIdFromMetadata;
        }

        finish(igrejaIdFromMetadata ?? null);
      } catch (error) {
        console.error("Erro ao resolver igrejaId no auth change:", error);
        finish(null);
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
  }, []);

  return { igrejaId, loading };
}
