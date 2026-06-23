import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EventoPublico } from "@/components/public/EventoCard";

interface UseEventosPublicosOptions {
  limit?: number;
}

interface UseEventosPublicosResult {
  eventos: EventoPublico[];
  loading: boolean;
  error: string | null;
}

export function useEventosPublicos({
  limit,
}: UseEventosPublicosOptions = {}): UseEventosPublicosResult {
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("eventos_publicos")
        .select(
          "id, titulo, descricao, data_evento, local, endereco, tipo, status, " +
          "requer_inscricao, valor_inscricao, vagas_limite, banner_url"
        )
        .order("data_evento", { ascending: true });

      if (limit) query = query.limit(limit);

      const { data, error: err } = await query;

      if (cancelled) return;

      if (err) {
        setError("Não foi possível carregar os eventos.");
        console.error("[useEventosPublicos]", err);
      } else {
        setEventos((data as EventoPublico[]) ?? []);
      }
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, [limit]);

  return { eventos, loading, error };
}
