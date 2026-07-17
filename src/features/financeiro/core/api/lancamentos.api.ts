import { callFinRpc, type FinResultado } from "./finRpc";

/**
 * Wrappers tipados das RPCs de lançamento (ADR-029).
 * Único lugar do domínio financeiro que escreve em transacoes_financeiras.
 *
 * Chamadas do frontend usam o JWT do usuário: o tenant é resolvido no banco
 * (get_current_user_igreja_id) e a permissão exige admin ou tesoureiro.
 */

export type TipoLancamento = "entrada" | "saida";

export interface LancamentoExtras {
  subcategoria_id?: string | null;
  centro_custo_id?: string | null;
  base_ministerial_id?: string | null;
  fornecedor_id?: string | null;
  forma_pagamento?: string | null;
  data_competencia?: string | null;
  data_pagamento?: string | null;
  status?: "pendente" | "pago";
  juros?: number;
  multas?: number;
  desconto?: number;
  taxas_administrativas?: number;
  valor_liquido?: number;
  observacoes?: string | null;
  anexo_url?: string | null;
  pessoa_id?: string | null;
  sessao_id?: string | null;
  solicitacao_reembolso_id?: string | null;
  origem_registro?: string;
  tipo_lancamento?: "unico" | "parcelado" | "recorrente";
  total_parcelas?: number;
  recorrencia?: string | null;
  data_fim_recorrencia?: string | null;
  lancado_por?: string | null;
  filial_id?: string | null;
}

export interface CriarLancamentoInput {
  tipo: TipoLancamento;
  valor: number;
  data_vencimento: string; // YYYY-MM-DD
  conta_id: string;
  descricao: string;
  categoria_id?: string | null;
  extras?: LancamentoExtras;
}

export function criarLancamento(input: CriarLancamentoInput): Promise<FinResultado> {
  return callFinRpc("fin_criar_lancamento", {
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_data_vencimento: input.data_vencimento,
    p_conta_id: input.conta_id,
    p_descricao: input.descricao,
    p_categoria_id: input.categoria_id ?? null,
    p_extras: input.extras ?? {},
  });
}

/** Patch parcial: apenas os campos presentes são aplicados. */
export function atualizarLancamento(
  id: string,
  patch: Partial<LancamentoExtras> & {
    tipo?: TipoLancamento;
    descricao?: string;
    valor?: number;
    data_vencimento?: string;
    conta_id?: string;
    categoria_id?: string | null;
    status?: "pendente" | "pago" | "cancelado";
  },
): Promise<FinResultado> {
  return callFinRpc("fin_atualizar_lancamento", { p_id: id, p_patch: patch });
}

export interface DadosPagamento {
  data_pagamento?: string;
  juros?: number;
  multas?: number;
  desconto?: number;
  taxas_administrativas?: number;
}

export function alterarStatusLancamento(
  id: string,
  novoStatus: "pendente" | "pago" | "cancelado",
  dados: DadosPagamento = {},
): Promise<FinResultado> {
  return callFinRpc("fin_alterar_status_lancamento", {
    p_id: id,
    p_novo_status: novoStatus,
    p_dados: dados,
  });
}

export function excluirLancamento(
  id: string,
  escopo: "somente_este" | "este_e_futuras" = "somente_este",
): Promise<FinResultado> {
  return callFinRpc("fin_excluir_lancamento", {
    p_id: id,
    p_extras: { escopo },
  });
}

/**
 * Alterna conferido_manual + conciliacao_status (nao_conciliado<->
 * conciliado_manual) de um lançamento sem extrato correspondente (F7).
 * Sincroniza a perna irmã de transferência; bloqueia se já conciliado via
 * extrato/bot (D4).
 */
export function alternarConferenciaManual(
  id: string,
  conferido: boolean,
): Promise<FinResultado> {
  return callFinRpc("fin_alternar_conferencia_manual", {
    p_id: id,
    p_conferido: conferido,
  });
}
