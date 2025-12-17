import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConfigEnsinoFinanceiro {
  categoriaId: string | null;
  baseMinisterialId: string | null;
  contaId: string | null;
}

export function useConfiguracaoFinanceiraEnsino() {
  const [config, setConfig] = useState<ConfigEnsinoFinanceiro>({
    categoriaId: null,
    baseMinisterialId: null,
    contaId: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: cat } = await supabase
          .from("categorias_financeiras")
          .select("id,nome")
          .eq("tipo", "entrada")
          .in("nome", ["Plano de Assinaturas", "Cursos", "Cursos e Treinamentos"])
          .limit(1);
        const categoriaId = cat?.[0]?.id || (import.meta as any).env?.VITE_FIN_CATEGORIA_CURSOS_ID || null;

        const { data: base } = await supabase
          .from("bases_ministeriais")
          .select("id,titulo")
          .eq("ativo", true)
          .ilike("titulo", "%ensino%")
          .limit(1);
        const baseMinisterialId = base?.[0]?.id || (import.meta as any).env?.VITE_BASE_MINISTERIAL_ENSINO_ID || null;

        const { data: conta } = await supabase
          .from("contas")
          .select("id,nome")
          .eq("ativo", true)
          .order("created_at")
          .limit(1);
        const contaId = conta?.[0]?.id || (import.meta as any).env?.VITE_CONTA_PADRAO_ENTRADAS_ID || null;

        setConfig({ categoriaId, baseMinisterialId, contaId });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { ...config, loading };
}
