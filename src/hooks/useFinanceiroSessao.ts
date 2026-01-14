import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export type SessaoContagem = {
  id: string;
  igreja_id: string;
  filial_id: string | null;
  data_culto: string;
  periodo: string;
  status: string;
};

export async function openSessaoContagem(
  igrejaId: string,
  filialId: string | null,
  dataCulto: Date,
  periodo: string
): Promise<SessaoContagem | null> {
  try {
    const { data, error } = await supabase.rpc("open_sessao_contagem", {
      p_igreja_id: igrejaId,
      p_filial_id: filialId,
      p_data_culto: format(dataCulto, "yyyy-MM-dd"),
      p_periodo: periodo,
    });

    if (error) {
      console.error("Erro ao chamar open_sessao_contagem:", {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw error;
    }

    return (data as SessaoContagem) ?? null;
  } catch (e) {
    console.error("Exceção ao abrir sessão:", e);
    throw e;
  }
}

export async function confrontarContagens(
  sessaoId: string
): Promise<{
  status: string;
  variance_value: number | null;
  variance_by_tipo: any | null;
} | null> {
  const { data, error } = await supabase.rpc("confrontar_contagens", {
    p_sessao_id: sessaoId,
  });
  if (error) throw error;
  return (data as any)?.[0] ?? null;
}
