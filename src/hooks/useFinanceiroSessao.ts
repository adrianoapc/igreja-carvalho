import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export type SessaoContagem = {
  id: string;
  igreja_id: string;
  filial_id: string | null;
  data_culto: string;
  periodo: string;
  status: string;
  evento_id?: string | null;
  data_fechamento?: string | null;
};

export async function openSessaoContagem(
  igrejaId: string,
  filialId: string | null,
  dataCulto: Date,
  periodo: string,
  eventoId?: string | null
): Promise<SessaoContagem | null> {
  try {
    const params: Record<string, unknown> = {
      p_igreja_id: igrejaId,
      p_filial_id: filialId,
      p_data_culto: format(dataCulto, "yyyy-MM-dd"),
      p_periodo: periodo,
    };
    if (eventoId) params.p_evento_id = eventoId;

    const { data, error } = await supabase.rpc("open_sessao_contagem", params as any);

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

/**
 * Busca a última sessão finalizada para determinar o início da janela de sincronização
 */
export async function getUltimaSessaoFinalizada(
  igrejaId: string,
  filialId: string | null
): Promise<{ data_fechamento: string } | null> {
  try {
    let query = supabase
      .from("sessoes_contagem")
      .select("data_fechamento")
      .eq("igreja_id", igrejaId)
      .eq("status", "finalizado")
      .not("data_fechamento", "is", null)
      .order("data_fechamento", { ascending: false })
      .limit(1);

    if (filialId) {
      query = query.eq("filial_id", filialId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return data;
  } catch (e) {
    console.error("Erro ao buscar última sessão finalizada:", e);
    return null;
  }
}

/**
 * Calcula a janela de tempo para sincronização bancária
 */
export async function calcularJanelaSincronizacao(
  igrejaId: string,
  filialId: string | null
): Promise<{ inicio: Date; fim: Date }> {
  const fim = new Date();
  
  const ultimaSessao = await getUltimaSessaoFinalizada(igrejaId, filialId);
  
  let inicio: Date;
  if (ultimaSessao?.data_fechamento) {
    // Usar 1 segundo após o fechamento da última sessão
    inicio = new Date(ultimaSessao.data_fechamento);
    inicio.setSeconds(inicio.getSeconds() + 1);
  } else {
    // Fallback: últimos 7 dias
    inicio = subDays(fim, 7);
  }
  
  return { inicio, fim };
}

/**
 * Marca uma sessão como finalizada
 */
export async function finalizarSessao(sessaoId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("sessoes_contagem")
      .update({
        status: "finalizado",
        data_fechamento: new Date().toISOString(),
      })
      .eq("id", sessaoId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Erro ao finalizar sessão:", e);
    return false;
  }
}
