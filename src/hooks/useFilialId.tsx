import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const extractFilialId = (value: unknown): string | null => {
  return typeof value === "string" && value.length > 0 ? value : null;
};

export function useFilialId() {
  const [filialId, setFilialId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resolveSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const filialIdFromMetadata =
        extractFilialId(session?.user?.app_metadata?.filial_id) ??
        extractFilialId(session?.user?.user_metadata?.filial_id);

      if (isMounted) {
        setFilialId(filialIdFromMetadata);
        setLoading(false);
      }
    };

    resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const filialIdFromMetadata =
        extractFilialId(session?.user?.app_metadata?.filial_id) ??
        extractFilialId(session?.user?.user_metadata?.filial_id);

      if (isMounted) {
        setFilialId(filialIdFromMetadata);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { filialId, loading };
}
