import { supabase } from "@/integrations/supabase/client";

export interface PixCobrancaResponse {
  id?: string;
  txid: string;
  qr_location?: string | null;
  qr_brcode?: string | null;
  valor: number;
  status: string;
  expira_em?: string | null;
}

export async function getSantanderIntegracaoId(igrejaId: string) {
  const { data, error } = await supabase
    .from("integracoes_financeiras")
    .select("id")
    .eq("igreja_id", igrejaId)
    .eq("provedor", "santander")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id || null;
}

export async function criarCobrancaPix({
  integracaoId,
  igrejaId,
  filialId,
  contaId,
  sessaoItemId,
  valor,
  descricao,
  expiracao,
  infoAdicionais,
}: {
  integracaoId: string;
  igrejaId: string;
  filialId?: string | null;
  contaId?: string | null;
  sessaoItemId?: string | null;
  valor: number;
  descricao?: string;
  expiracao?: number;
  infoAdicionais?: Array<{ nome: string; valor: string }>;
}) {
  const { data, error } = await supabase.functions.invoke("santander-api", {
    body: {
      action: "criar_cobranca",
      integracao_id: integracaoId,
      igreja_id: igrejaId,
      filial_id: filialId ?? null,
      conta_id: contaId ?? null,
      sessao_item_id: sessaoItemId ?? null,
      valor,
      descricao,
      expiracao,
      info_adicionais: infoAdicionais,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Falha ao criar cobrança PIX");
  }

  return data.cobranca as PixCobrancaResponse;
}

export async function buscarPixRecebidos({
  integracaoId,
  igrejaId,
  dataInicio,
  dataFim,
}: {
  integracaoId: string;
  igrejaId: string;
  dataInicio: string;
  dataFim: string;
}) {
  const { data, error } = await supabase.functions.invoke("santander-api", {
    body: {
      action: "buscar_pix",
      integracao_id: integracaoId,
      igreja_id: igrejaId,
      data_inicio: dataInicio,
      data_fim: dataFim,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.success) {
    throw new Error(data?.error || "Falha ao buscar PIX");
  }

  return data;
}
