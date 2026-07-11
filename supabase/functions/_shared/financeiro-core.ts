/**
 * financeiro-core — shim Deno para as RPCs canônicas fin_* (ADR-029)
 *
 * Único caminho de escrita financeira para edge functions (chatbot-financeiro,
 * pix-webhook, getnet-sftp, santander-extrato, finance-sync...). Nenhuma edge
 * deve fazer INSERT/UPDATE/DELETE direto em transacoes_financeiras,
 * transferencias_contas ou tabelas de conciliação (regra de ouro do ADR-029).
 *
 * Toda chamada exige o contexto do tenant/ator — as RPCs validam que o ator
 * pertence ao tenant e, para canal "bot", as flags autorizado_* de profiles.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;

export interface FinContexto {
  igreja_id: string;
  filial_id?: string | null;
  /** profiles.id do ator humano em nome de quem a operação é feita */
  ator_profile_id: string;
  canal: "bot" | "edge" | "integracao";
}

export interface FinResultado {
  ok: boolean;
  id?: string;
  ids?: string[];
  warnings?: string[];
  [key: string]: unknown;
}

async function chamarRpc(
  supabase: SupabaseClientAny,
  fn: string,
  params: Record<string, unknown>,
): Promise<FinResultado> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) {
    console.error(`[financeiro-core] ${fn} falhou:`, error.message, error.details);
    throw new Error(`${fn}: ${error.message}`);
  }
  return data as FinResultado;
}

export interface CriarLancamentoInput {
  tipo: "entrada" | "saida";
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  conta_id: string;
  descricao: string;
  categoria_id?: string | null;
  extras?: Record<string, unknown>;
}

export function criarLancamento(
  supabase: SupabaseClientAny,
  input: CriarLancamentoInput,
  contexto: FinContexto,
): Promise<FinResultado> {
  return chamarRpc(supabase, "fin_criar_lancamento", {
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_data_vencimento: input.data_vencimento,
    p_conta_id: input.conta_id,
    p_descricao: input.descricao,
    p_categoria_id: input.categoria_id ?? null,
    p_extras: input.extras ?? {},
    p_contexto: contexto,
  });
}

export function alterarStatusLancamento(
  supabase: SupabaseClientAny,
  id: string,
  novoStatus: "pendente" | "pago" | "cancelado",
  dados: Record<string, unknown>,
  contexto: FinContexto,
): Promise<FinResultado> {
  return chamarRpc(supabase, "fin_alterar_status_lancamento", {
    p_id: id,
    p_novo_status: novoStatus,
    p_dados: dados,
    p_contexto: contexto,
  });
}

export interface CriarTransferenciaInput {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  data: string; // YYYY-MM-DD
  extras?: Record<string, unknown>;
}

export function criarTransferencia(
  supabase: SupabaseClientAny,
  input: CriarTransferenciaInput,
  contexto: FinContexto,
): Promise<FinResultado> {
  return chamarRpc(supabase, "fin_criar_transferencia", {
    p_conta_origem_id: input.conta_origem_id,
    p_conta_destino_id: input.conta_destino_id,
    p_valor: input.valor,
    p_data: input.data,
    p_extras: input.extras ?? {},
    p_contexto: contexto,
  });
}

export function pagarReembolso(
  supabase: SupabaseClientAny,
  solicitacaoId: string,
  contaId: string,
  dados: Record<string, unknown>,
  contexto: FinContexto,
): Promise<FinResultado> {
  return chamarRpc(supabase, "fin_pagar_reembolso", {
    p_solicitacao_id: solicitacaoId,
    p_conta_id: contaId,
    p_dados: dados,
    p_contexto: contexto,
  });
}

export interface LancarSessaoItem {
  forma_pagamento_id: string;
  valor: number;
  conta_id?: string | null;
  categoria_id?: string | null;
  descricao?: string | null;
  pessoa_id?: string | null;
  origem_registro?: string | null;
  observacoes?: string | null;
  status?: "pendente" | "pago";
  taxas_administrativas?: number | null;
  data_pagamento?: string | null;
}

export function lancarSessao(
  supabase: SupabaseClientAny,
  sessaoId: string,
  itens: LancarSessaoItem[],
  finalizar: boolean,
  contexto: FinContexto,
): Promise<FinResultado> {
  return chamarRpc(supabase, "fin_lancar_sessao", {
    p_sessao_id: sessaoId,
    p_itens: itens,
    p_finalizar: finalizar,
    p_contexto: contexto,
  });
}
