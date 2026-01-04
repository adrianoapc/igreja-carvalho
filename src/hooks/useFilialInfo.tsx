import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "./useFilialId";

interface FilialInfo {
  filialId: string | null;
  filialNome: string | null;
  igrejaId: string | null;
  igrejaNome: string | null;
  filiais: Array<{ id: string; nome: string }>;
  loading: boolean;
}

export function useFilialInfo(): FilialInfo {
  const { filialId, igrejaId, loading: contextLoading } = useFilialId();
  const [info, setInfo] = useState<Omit<FilialInfo, 'loading'>>({
    filialId: null,
    filialNome: null,
    igrejaId: null,
    igrejaNome: null,
    filiais: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contextLoading) return;

    const fetchInfo = async () => {
      setLoading(true);
      
      let filialNome: string | null = null;
      let igrejaNome: string | null = null;
      let filiais: Array<{ id: string; nome: string }> = [];

      // Buscar nome da filial atual
      if (filialId) {
        const { data: filialData } = await supabase
          .from("filiais")
          .select("nome")
          .eq("id", filialId)
          .single();
        
        filialNome = filialData?.nome ?? null;
      }

      // Buscar nome da igreja e lista de filiais
      if (igrejaId) {
        const { data: igrejaData } = await supabase
          .from("igrejas")
          .select("nome")
          .eq("id", igrejaId)
          .single();
        
        igrejaNome = igrejaData?.nome ?? null;

        // Buscar todas as filiais da igreja
        const { data: filiaisData } = await supabase
          .from("filiais")
          .select("id, nome")
          .eq("igreja_id", igrejaId)
          .order("nome");
        
        filiais = filiaisData ?? [];
      }

      setInfo({
        filialId,
        filialNome,
        igrejaId,
        igrejaNome,
        filiais,
      });
      setLoading(false);
    };

    fetchInfo();
  }, [filialId, igrejaId, contextLoading]);

  return { ...info, loading: loading || contextLoading };
}
