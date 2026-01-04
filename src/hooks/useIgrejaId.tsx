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

    const resolveSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const igrejaIdFromMetadata =
        extractIgrejaId(session?.user?.app_metadata?.igreja_id) ??
        extractIgrejaId(session?.user?.user_metadata?.igreja_id);

      if (isMounted) {
        setIgrejaId(igrejaIdFromMetadata);
        setLoading(false);
      }
    };

    resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const igrejaIdFromMetadata =
        extractIgrejaId(session?.user?.app_metadata?.igreja_id) ??
        extractIgrejaId(session?.user?.user_metadata?.igreja_id);

      if (isMounted) {
        setIgrejaId(igrejaIdFromMetadata);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { igrejaId, loading };
}
