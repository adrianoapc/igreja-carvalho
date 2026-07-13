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
  /**
   * profiles.id do ator humano. Opcional apenas para ingestão de extratos por
   * canal 'integracao' (edges autônomas getnet/pix/santander — D-F5.2); as RPCs
   * de escrita financeira continuam exigindo ator.
   */
  ator_profile_id?: string;
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

// ─── Ingestão de extratos (F5) ──────────────────────────────────────────────

export interface ExtratoItemInput {
  /** Data da transação em ISO (yyyy-mm-dd). */
  data_transacao: string;
  /** Valor bruto; a RPC normaliza para ABS (direção fica em `tipo`). */
  valor: number;
  tipo: "credito" | "debito";
  descricao: string;
  /** ID do provedor (FITID/transactionId); se ausente, a RPC gera determinístico. */
  external_id?: string;
  numero_documento?: string | null;
  saldo?: number | null;
}

/**
 * Porta única de ingestão de extratos (fin_ingerir_extratos). Para edges
 * autônomas (getnet/pix/santander em service role), use
 * `contexto = { igreja_id, filial_id?, canal: "integracao" }` sem
 * `ator_profile_id` (D-F5.2).
 */
export function ingerirExtratos(
  supabase: SupabaseClientAny,
  contaId: string,
  origem: string,
  itens: ExtratoItemInput[],
  contexto: FinContexto,
): Promise<FinResultado> {
  return chamarRpc(supabase, "fin_ingerir_extratos", {
    p_conta_id: contaId,
    p_origem: origem,
    p_itens: itens,
    p_contexto: contexto,
  });
}

// ─── Ingestão de PIX (F5 fatia 2) ────────────────────────────────────────────
// Diferente de Getnet/Santander, PIX não tem hoje uma conta bancária resolvível
// automaticamente (pix_webhook_temp só carrega igreja_id). Reaproveita o mesmo
// mecanismo do Getnet: `integracoes_financeiras.config.conta_id`, uma conta
// bancária fixa por integração (várias chaves PIX apontam para a mesma conta).
// Se a integração não existir/estiver ambígua ou sem conta_id configurado,
// NÃO ingere e NÃO lança — o fluxo de registro do PIX (pix_webhook_temp/cob_pix)
// continua funcionando como hoje; só o espelho em extratos_bancarios é pulado.

export interface PixExtratoInput {
  igreja_id: string;
  /** ID da transação PIX no provedor — vira o external_id do extrato. */
  pix_id: string;
  valor: number;
  /** Data/hora do PIX (ISO); só a parte de data é usada. */
  data_pix: string;
  descricao: string;
  /**
   * Conta já conhecida pelo chamador (ex.: `cob_pix.conta_id` de uma cobrança
   * vinculada por txid) — maior precedência: um PIX de cobrança pode ter conta
   * diferente do default da integração.
   */
  conta_id?: string | null;
  /**
   * Integração já conhecida pelo chamador (ex.: `integracao_id` do polling) —
   * 2ª precedência. Evita o fallback por igreja, que falha com
   * `multiplas_integracoes` em igrejas com integração por filial.
   */
  integracao_id?: string | null;
}

export interface PixExtratoResultado {
  ingerido: boolean;
  motivo?:
    | "integracao_nao_encontrada"
    | "multiplas_integracoes"
    | "conta_id_nao_configurado"
    | "erro_ingestao";
  detalhe?: string;
}

/**
 * Resolve a conta bancária do PIX na ordem de precisão disponível ao chamador:
 * 1) `input.conta_id` explícito (ex.: `cob_pix.conta_id` de uma cobrança);
 * 2) `input.integracao_id` explícito (ex.: polling já sabe qual integração);
 * 3) fallback: única integração Santander ativa da igreja (`config.conta_id`).
 * O fallback por igreja só entra quando o chamador não tem fonte mais precisa
 * — e falha (sem ingerir) se houver mais de uma integração, em vez de
 * adivinhar a conta errada.
 */
async function resolverContaPix(
  supabase: SupabaseClientAny,
  input: PixExtratoInput,
): Promise<{ contaId: string; filialId: string | null } | PixExtratoResultado> {
  if (input.conta_id) {
    return { contaId: input.conta_id, filialId: null };
  }

  if (input.integracao_id) {
    const { data: integracao, error } = await supabase
      .from("integracoes_financeiras")
      .select("filial_id, config")
      .eq("id", input.integracao_id)
      .maybeSingle();
    if (error || !integracao) {
      return { ingerido: false, motivo: "integracao_nao_encontrada", detalhe: error?.message };
    }
    const contaId = (integracao.config as Record<string, unknown> | null)?.conta_id as
      | string
      | undefined;
    if (!contaId) {
      return { ingerido: false, motivo: "conta_id_nao_configurado" };
    }
    return { contaId, filialId: integracao.filial_id ?? null };
  }

  const { data: integracoes, error: integError } = await supabase
    .from("integracoes_financeiras")
    .select("filial_id, config")
    .eq("igreja_id", input.igreja_id)
    .eq("provedor", "santander")
    .eq("status", "ativo");

  if (integError || !integracoes || integracoes.length === 0) {
    return { ingerido: false, motivo: "integracao_nao_encontrada", detalhe: integError?.message };
  }
  if (integracoes.length > 1) {
    return { ingerido: false, motivo: "multiplas_integracoes" };
  }

  const integracao = integracoes[0];
  const contaId = (integracao.config as Record<string, unknown> | null)?.conta_id as
    | string
    | undefined;
  if (!contaId) {
    return { ingerido: false, motivo: "conta_id_nao_configurado" };
  }
  return { contaId, filialId: integracao.filial_id ?? null };
}

export async function ingerirExtratoPix(
  supabase: SupabaseClientAny,
  input: PixExtratoInput,
): Promise<PixExtratoResultado> {
  const resolved = await resolverContaPix(supabase, input);
  if ("ingerido" in resolved) {
    return resolved;
  }

  const item: ExtratoItemInput = {
    data_transacao: input.data_pix.slice(0, 10),
    valor: input.valor,
    tipo: "credito",
    descricao: input.descricao,
    external_id: `pix:${input.pix_id}`,
  };

  try {
    await ingerirExtratos(supabase, resolved.contaId, "pix", [item], {
      igreja_id: input.igreja_id,
      filial_id: resolved.filialId,
      canal: "integracao",
    });
    return { ingerido: true };
  } catch (err) {
    return {
      ingerido: false,
      motivo: "erro_ingestao",
      detalhe: err instanceof Error ? err.message : String(err),
    };
  }
}
