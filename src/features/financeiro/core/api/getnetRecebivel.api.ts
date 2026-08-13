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
 * Wrappers da Fase B / Fase 5 (lote de antecipação). Confirmação do vínculo
 * continua manual — a Fase 5 só sugere candidatos via SECURITY DEFINER.
 */

/** Candidato de crédito pra lote — fin_gerar_candidatos_lote_antecipacao_getnet. */
export interface CandidatoLoteAntecipacaoGetnet {
  extrato_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  /** 0..100 (texto / data / valor), compatível com badges da UI. */
  score: number;
  features: Record<string, unknown>;
}

/**
 * → fin_gerar_candidatos_lote_antecipacao_getnet (Fase 5, só leitura).
 * Sugere créditos livres (não em outro lote, Hop 1 ou reconciliado).
 * Não auto-seleciona — UI confirma via fin_vincular_lote_antecipacao.
 */
export async function gerarCandidatosLoteAntecipacaoGetnet(params: {
  loteId: string;
  busca?: string | null;
  limite?: number;
}): Promise<CandidatoLoteAntecipacaoGetnet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "fin_gerar_candidatos_lote_antecipacao_getnet",
    {
      p_lote_id: params.loteId,
      p_busca: params.busca ?? null,
      p_limite: params.limite ?? 100,
    },
  );
  if (error) throw error;
  return (data ?? []) as CandidatoLoteAntecipacaoGetnet[];
}

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
  /** Σ créditos com vínculo Hop 1 ou lote de antecipação (não todo o extrato). */
  banco_creditado: number;
  /** Σ líquido das linhas Hop 1 vinculadas no período (transparência). */
  liquido_vinculado?: number;
  diferenca_nao_explicada: number;
}

/**
 * → fin_conferencia_totais_getnet (Fase 4). Só leitura — Oferta bruto −
 * MDR − deságio = esperado; compara contra créditos com vínculo Getnet
 * real (Hop 1 / lote), nunca todo crédito da conta. Não decide a causa
 * da diferença, só a torna visível.
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

/** Shape recorrente das RPCs Getnet escopadas por integração+período+filial. */
export interface GetnetPeriodoFilialParams {
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
 * nao_conciliadas. UI: aba Conciliação Cartão (Fase 6).
 */
export async function gerarCandidatosOfertaVendaGetnet(
  params: GetnetPeriodoFilialParams,
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
 * converte a oferta em 1/N e cria irmãs 2..N. UI: Conciliação Cartão (Fase 6).
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

/** Candidato Hop 1 (Venda ↔ Banco) — fin_gerar_candidatos_venda_banco_getnet. */
export interface CandidatoVendaBancoGetnet {
  data_vencimento: string;
  filial_id: string | null;
  valor_liquido: number;
  recebivel_ids: string[];
  extrato_id: string;
  score: number;
  features: Record<string, unknown>;
}

export interface CandidatosVendaBancoGetnetParams extends GetnetPeriodoFilialParams {
  contaId: string;
}

/**
 * → fin_gerar_candidatos_venda_banco_getnet (Fase 3, só leitura).
 * Agrupa recebíveis sem antecipação (contrato_registradora IS NULL) por
 * data_vencimento+filial, soma líquido, casa contra créditos não
 * reconciliados da conta. UI: Conciliação Cartão (Fase 6).
 */
export async function gerarCandidatosVendaBancoGetnet(
  params: CandidatosVendaBancoGetnetParams,
): Promise<CandidatoVendaBancoGetnet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "fin_gerar_candidatos_venda_banco_getnet",
    {
      p_conta_id: params.contaId,
      p_integracao_id: params.integracaoId,
      p_periodo_inicio: params.periodoInicio,
      p_periodo_fim: params.periodoFim,
      p_filial_id: params.filialId ?? null,
    },
  );
  if (error) throw error;
  return (data ?? []) as CandidatoVendaBancoGetnet[];
}

/** Resultado de fin_vincular_venda_banco_getnet (Hop 1 confirmação). */
export interface VincularVendaBancoGetnetResultado extends FinResultado {
  id?: string;
  recebivel_ids?: string[];
  valor_liquido?: number;
  valor_extrato?: number;
  delta_valor?: number;
  warnings?: string[];
}

/**
 * → fin_vincular_venda_banco_getnet (Fase 3).
 * Vincula recebíveis ao crédito bancário: grava extrato_bancario_id,
 * marca reconciliado=true. Discrepância de valor vira warning (não
 * bloqueia). UI: Conciliação Cartão (Fase 6).
 */
export function vincularVendaBancoGetnet(
  extratoBancarioId: string,
  recebivelIds: string[],
): Promise<VincularVendaBancoGetnetResultado> {
  return callFinRpc("fin_vincular_venda_banco_getnet", {
    p_extrato_bancario_id: extratoBancarioId,
    p_recebivel_ids: recebivelIds,
  }) as Promise<VincularVendaBancoGetnetResultado>;
}

/**
 * Wrappers da Fase 7a — ledger unificado de Conciliação Cartão Getnet
 * (só leitura). UI: ConciliacaoCartaoLedger (Fase 7b).
 */

export interface LedgerCartaoResumo {
  fechados: number;
  aguardando_banco: number;
  sem_hop2: number;
  divergencia: number;
}

/** hop1_status por parcela — `antecipada` só existe neste escopo, nunca vira status de linha. */
export type LedgerCartaoHop1Status = "fechado" | "antecipada" | "aguardando";

export interface LedgerCartaoParcela {
  numero_parcela: number;
  total_parcelas: number;
  nsu: string | null;
  valor_liquido: number | null;
  data_vencimento_real: string | null;
  hop1_status: LedgerCartaoHop1Status;
  extrato_bancario_id: string | null;
  lote_id: string | null;
}

export interface LedgerCartaoSugestao {
  recebivel_ids: string[];
  score: number;
  features: Record<string, unknown>;
}

/**
 * Status do LANÇAMENTO — deliberadamente diferente do enum de
 * `getnet_antecipacao_lotes.status` (pendente_vinculo/vinculado/
 * lancamento_criado). A UI pode exibir "Pendente vínculo" pra `sem_hop2`
 * (só o rótulo — a chave interna não usa a mesma palavra do status de lote).
 */
export type LedgerCartaoStatusLancamento =
  | "sem_hop2"
  | "aguardando_banco"
  | "fechado"
  | "divergencia";

export interface LedgerCartaoLancamento {
  grupo_id: string;
  descricao: string;
  data_vencimento: string;
  filial_id: string | null;
  valor_bruto: number;
  parcelado: boolean;
  total_parcelas: number;
  status: LedgerCartaoStatusLancamento;
  parcelas: LedgerCartaoParcela[];
  sugestao: LedgerCartaoSugestao | null;
}

export interface LedgerCartaoVendaOrigem {
  nsu: string | null;
  valor_parcela_liquido: number | null;
  numero_parcela: number;
  total_parcelas: number;
  oferta_lancamento_id: string | null;
  oferta_descricao: string | null;
  oferta_data_vencimento: string | null;
}

/** Enum real de `getnet_antecipacao_lotes.status` — não confundir com `LedgerCartaoStatusLancamento`. */
export type LedgerCartaoStatusLote = "pendente_vinculo" | "vinculado" | "lancamento_criado";

export interface LedgerCartaoLote {
  lote_id: string;
  contrato_registradora: string;
  status: LedgerCartaoStatusLote;
  filial_id: string | null;
  valor_contrato: number | null;
  desagio: number | null;
  credito_banco: number | null;
  data_liquidacao: string | null;
  /** Transação da saída "Deságio de antecipação Getnet" — null se ainda não lançada. Usado pra reverter direto nesta tela (fin_alterar_status_lancamento). */
  lancamento_desagio_id: string | null;
  vendas_origem: LedgerCartaoVendaOrigem[];
}

export interface LedgerConciliacaoCartao {
  resumo: LedgerCartaoResumo;
  lancamentos: LedgerCartaoLancamento[];
  lotes: LedgerCartaoLote[];
}

export interface ListarLedgerConciliacaoCartaoParams extends GetnetPeriodoFilialParams {
  contaId: string;
}

/**
 * → fin_listar_ledger_conciliacao_cartao (Fase 7a, só leitura).
 * Monta o ledger unificado Oferta→Venda→Banco + lotes de antecipação por
 * período — substitui a agregação client-side das 3 queries antigas
 * (Hop 2 + Hop 1 + tabela de lotes). UI: ConciliacaoCartaoLedger (Fase 7b).
 */
export async function listarLedgerConciliacaoCartao(
  params: ListarLedgerConciliacaoCartaoParams,
): Promise<LedgerConciliacaoCartao> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("fin_listar_ledger_conciliacao_cartao", {
    p_integracao_id: params.integracaoId,
    p_conta_id: params.contaId,
    p_periodo_inicio: params.periodoInicio,
    p_periodo_fim: params.periodoFim,
    p_filial_id: params.filialId ?? null,
  });
  if (error) throw error;
  return data as LedgerConciliacaoCartao;
}

/** Candidato de busca manual pra oferta — fin_buscar_recebiveis_getnet_oferta. */
export interface CandidatoBuscaRecebivelOferta {
  recebivel_id: string;
  nsu: string | null;
  data_venda: string | null;
  valor_venda: number;
  bandeira_modalidade: string | null;
  /** 0..100, mesmo corte 60/30 da família lote de antecipação. */
  score: number;
  features: Record<string, unknown>;
}

export interface BuscarRecebiveisGetnetOfertaParams {
  transacaoId: string;
  integracaoId: string;
  busca?: string | null;
  limite?: number;
}

/**
 * → fin_buscar_recebiveis_getnet_oferta (Fase 7a, só leitura).
 * Busca manual de recebíveis Getnet livres pra vincular a uma oferta
 * específica — fecha o botão "Buscar manualmente" da linha "Pendente
 * vínculo" do ledger. Confirmação continua via
 * fin_vincular_venda_getnet_oferta (já existente, inalterado).
 */
export async function buscarRecebiveisGetnetOferta(
  params: BuscarRecebiveisGetnetOfertaParams,
): Promise<CandidatoBuscaRecebivelOferta[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("fin_buscar_recebiveis_getnet_oferta", {
    p_transacao_id: params.transacaoId,
    p_integracao_id: params.integracaoId,
    p_busca: params.busca ?? null,
    p_limite: params.limite ?? 100,
  });
  if (error) throw error;
  return (data ?? []) as CandidatoBuscaRecebivelOferta[];
}

/**
 * Ajustes Getnet + linhas CI (Ciclo 2, C2-4) — read-only. Tabela II do
 * manual (motivo_ajuste, 22 códigos) e indicador_tipo_pagamento=CI de
 * getnet_resumo eram gravados desde sempre e nunca lidos por nenhuma tela.
 */

export interface AjusteGetnet {
  ajuste_id: string;
  arquivo_nome: string;
  rv_ajustado: string;
  data_rv: string | null;
  data_pagamento_rv: string | null;
  motivo_codigo: string | null;
  motivo_descricao: string;
  sinal: string | null;
  valor_ajuste: number | null;
  cartao_truncado: string | null;
  rv_original: string | null;
  nsu_cv: string | null;
  numero_terminal: string | null;
  data_transacao_original: string | null;
}

export type ListarAjustesGetnetParams = GetnetPeriodoFilialParams;

/**
 * → fin_listar_ajustes_getnet.
 *
 * ATENÇÃO (achado do code-review): diferente de todo outro `p_filial_id`
 * deste arquivo (que filtra linhas de verdade — ver `listarResumoCiGetnet`
 * abaixo), aqui `filialId` só VALIDA acesso do chamador — `getnet_ajustes`
 * não tem coluna `filial_id`, então o retorno inclui toda linha da
 * integração, mesmo pra integração compartilhada entre filiais. Não
 * confiar neste parâmetro pra escopo de dado por filial nesta RPC
 * específica (ver comentário completo na migration
 * `20260811110000_fin_listar_ajustes_getnet.sql`).
 */
export async function listarAjustesGetnet(
  params: ListarAjustesGetnetParams,
): Promise<AjusteGetnet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("fin_listar_ajustes_getnet", {
    p_integracao_id: params.integracaoId,
    p_periodo_inicio: params.periodoInicio,
    p_periodo_fim: params.periodoFim,
    p_filial_id: params.filialId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as AjusteGetnet[];
}

export interface ResumoCiGetnet {
  resumo_id: string;
  arquivo_nome: string;
  rv: string;
  data_rv: string;
  data_pagamento_rv: string | null;
  valor_bruto: number;
  valor_liquido: number;
  valor_liquido_cobranca: number | null;
  id_baixa_cobranca_servico: string | null;
  sinal: string | null;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
}

export type ListarResumoCiGetnetParams = GetnetPeriodoFilialParams;

/** → fin_listar_resumo_ci_getnet. */
export async function listarResumoCiGetnet(
  params: ListarResumoCiGetnetParams,
): Promise<ResumoCiGetnet[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("fin_listar_resumo_ci_getnet", {
    p_integracao_id: params.integracaoId,
    p_periodo_inicio: params.periodoInicio,
    p_periodo_fim: params.periodoFim,
    p_filial_id: params.filialId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ResumoCiGetnet[];
}
