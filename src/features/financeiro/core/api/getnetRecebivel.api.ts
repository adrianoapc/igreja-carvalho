import { callFinRpc, type FinResultado } from "./finRpc";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper da porta única de importação do Recebível Extrato Detalhado
 * (portal Getnet, ADR-029). Fase A: só importa e agrupa por Contrato
 * Registradora — vínculo com extrato bancário e lançamento de deságio são
 * Fase B.
 */

export interface RecebivelGetnetLinha {
  data_vencimento?: string | null;
  bandeira_modalidade?: string | null;
  tipo_lancamento?: string | null;
  lancamento?: string | null;
  valor_liquido?: number | null;
  valor_liquidado?: number | null;
  numero_cartao?: string | null;
  autorizacao?: string | null;
  nsu?: string | null;
  terminal_logico?: string | null;
  data_venda?: string | null;
  hora_venda?: string | null;
  valor_venda?: number | null;
  /** Formato bruto do portal, ex. "1 de 7" (parcela atual de N) — não normalizado. */
  parcelas?: string | null;
  valor_parcela?: number | null;
  descontos?: number | null;
  valor_liquido_parcela?: number | null;
  data_contratacao_contrato?: string | null;
  instituicao_negociadora?: string | null;
  contrato_registradora?: string | null;
  valor_atual_contrato?: number | null;
  valor_liquidado_contrato?: number | null;
  valor_a_liquidar_contrato?: number | null;
}

/** → fin_importar_recebivel_getnet. Retorna { job_id, inseridos, duplicados, subtotal_ignoradas, total }. */
export function importarRecebivelGetnet(
  integracaoId: string,
  linhas: RecebivelGetnetLinha[],
): Promise<FinResultado> {
  return callFinRpc("fin_importar_recebivel_getnet", {
    p_integracao_id: integracaoId,
    p_linhas: linhas,
  });
}

/**
 * Wrappers da Fase B (vínculo manual com extrato bancário + lançamento do
 * deságio de antecipação). Sem match/conciliação automática — a escolha de
 * qual linha do extrato corresponde ao lote é sempre manual.
 */

/** → fin_vincular_lote_antecipacao. Retorna { desagio, extrato_valor, extrato_data }. */
export function vincularLoteAntecipacao(
  loteId: string,
  extratoBancarioId: string,
): Promise<FinResultado> {
  return callFinRpc("fin_vincular_lote_antecipacao", {
    p_lote_id: loteId,
    p_extrato_bancario_id: extratoBancarioId,
  });
}

/** → fin_lancar_desagio_antecipacao. Retorna { lancamento_id, desagio }. Recusa se já lançado. */
export function lancarDesagioAntecipacao(
  loteId: string,
  categoriaId: string,
  contaId: string,
): Promise<FinResultado> {
  return callFinRpc("fin_lancar_desagio_antecipacao", {
    p_lote_id: loteId,
    p_categoria_id: categoriaId,
    p_conta_id: contaId,
  });
}

export interface ConferenciaTotaisGetnet {
  oferta_bruto: number;
  taxa_mdr: number;
  desagio_lancado: number;
  esperado_banco: number;
  banco_creditado: number;
  diferenca_nao_explicada: number;
}

/**
 * → fin_conferencia_totais_getnet. Só leitura — soma Oferta bruto (cartão) −
 * MDR − deságio lançado, compara contra o banco creditado no período. Não
 * decide a causa da diferença, só a torna visível.
 */
export async function conferenciaTotaisGetnet(
  contaId: string,
  dataInicio: string,
  dataFim: string,
): Promise<ConferenciaTotaisGetnet> {
  const res = await callFinRpc("fin_conferencia_totais_getnet", {
    p_conta_id: contaId,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
  });
  return res as unknown as ConferenciaTotaisGetnet;
}

/** Candidato Hop 2 (Oferta ↔ Venda Getnet) — fin_gerar_candidatos_oferta_venda_getnet. */
export interface CandidatoOfertaVendaGetnet {
  data_venda: string;
  /** `credito` | `debito` — derivado de bandeira_modalidade / lançamento. */
  direcao: "credito" | "debito";
  filial_id: string | null;
  valor_bruto: number;
  recebivel_ids: string[];
  nsus: string[];
  transacao_id: string;
  score: number;
  features: Record<string, unknown>;
}

export interface CandidatosOfertaVendaGetnetParams {
  integracaoId: string;
  periodoInicio: string;
  periodoFim: string;
  /** `null`/omitido = todas as filiais no teto do usuário. */
  filialId?: string | null;
}

/**
 * → fin_gerar_candidatos_oferta_venda_getnet (Fase 1, só leitura).
 * Agrupa recebíveis por data_venda+direção+filial (valor_venda 1× por NSU —
 * CSV do portal repete o bruto em cada parcela) e casa contra ofertas cartão
 * nao_conciliadas. Sem UI nesta fase — wrapper pra harness/SQL e Fase 6.
 */
export async function gerarCandidatosOfertaVendaGetnet(
  params: CandidatosOfertaVendaGetnetParams,
): Promise<CandidatoOfertaVendaGetnet[]> {
  // fin_* ainda não está nos tipos gerados; cast único, como em conciliacao.api.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "fin_gerar_candidatos_oferta_venda_getnet",
    {
      p_integracao_id: params.integracaoId,
      p_periodo_inicio: params.periodoInicio,
      p_periodo_fim: params.periodoFim,
      p_filial_id: params.filialId ?? null,
    },
  );
  if (error) throw error;
  return (data ?? []) as CandidatoOfertaVendaGetnet[];
}

/** Resultado de fin_vincular_venda_getnet_oferta (Hop 2 confirmação). */
export interface VincularVendaGetnetOfertaResultado extends FinResultado {
  id?: string;
  recebivel_ids?: string[];
  parcelado?: boolean;
  filhas?: string[];
  taxas_administrativas?: number;
  valor_liquido?: number;
  warnings?: string[];
}

/**
 * → fin_vincular_venda_getnet_oferta (Fase 2 + 2b).
 * Vincula recebíveis à oferta: grava transacao_financeira_id, atualiza
 * taxa/líquido/data/status via fin_atualizar_lancamento, marca
 * conciliado_manual. Fase 2b: NSU com N>1 (conjunto 1..N completo)
 * converte a oferta em 1/N e cria irmãs 2..N. Sem UI nesta fase — Fase 6.
 */
export function vincularVendaGetnetOferta(
  transacaoId: string,
  recebivelIds: string[],
): Promise<VincularVendaGetnetOfertaResultado> {
  return callFinRpc("fin_vincular_venda_getnet_oferta", {
    p_transacao_id: transacaoId,
    p_recebivel_ids: recebivelIds,
  }) as Promise<VincularVendaGetnetOfertaResultado>;
}
