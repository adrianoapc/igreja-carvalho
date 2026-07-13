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
// PIX não tem hoje uma conta bancária resolvível automaticamente
// (pix_webhook_temp só carrega igreja_id). A ideia original desta porta era
// reaproveitar `integracoes_financeiras.config.conta_id` — mas isso NUNCA é
// gravado para Santander: o formulário de integração só grava algo em
// `config` quando `tipo_auth === 'sftp'` (`IntegracoesCriarDialog.tsx`), e
// Santander é sempre forçado a `tipo_auth = 'token'`. Esse caminho está morto
// para PIX/Santander (só existe para o modo SFTP do Getnet).
//
// Reaproveita em vez disso o mecanismo REAL já usado em produção para achar
// "a conta do Santander": `contas.cnpj_banco` casando com o CNPJ do banco
// (mesma lógica de `src/pages/financas/Contas.tsx`, botão "Testar"). Se a
// conta não existir/estiver ambígua, NÃO ingere e NÃO lança — o fluxo de
// registro do PIX (pix_webhook_temp/cob_pix) continua funcionando como hoje;
// só o espelho em extratos_bancarios é pulado.

/** CNPJ do Santander usado para identificar a conta bancária (mesmo valor de Contas.tsx). */
const SANTANDER_CNPJ = "90400888000142";

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
   * diferente da conta Santander default da igreja/filial.
   */
  conta_id?: string | null;
  /**
   * Integração já conhecida pelo chamador (ex.: `integracao_id` do polling) —
   * usada só para restringir a busca de conta à mesma filial da integração,
   * quando ela tiver uma.
   */
  integracao_id?: string | null;
}

export interface PixExtratoResultado {
  ingerido: boolean;
  motivo?:
    | "conta_santander_nao_encontrada"
    | "multiplas_contas_santander"
    | "erro_ingestao";
  detalhe?: string;
}

/**
 * Resolve a conta bancária do PIX na ordem de precisão disponível ao chamador:
 * 1) `input.conta_id` explícito (ex.: `cob_pix.conta_id` de uma cobrança);
 * 2) fallback: conta(s) da igreja com `cnpj_banco = SANTANDER_CNPJ`, restrito
 *    à filial da integração quando `input.integracao_id` for conhecido. Falha
 *    (sem ingerir) se não achar nenhuma ou achar mais de uma, em vez de
 *    adivinhar a conta errada.
 */
async function resolverContaPix(
  supabase: SupabaseClientAny,
  input: PixExtratoInput,
): Promise<{ contaId: string; filialId: string | null } | PixExtratoResultado> {
  if (input.conta_id) {
    return { contaId: input.conta_id, filialId: null };
  }

  let filialConhecida: string | null = null;
  if (input.integracao_id) {
    const { data: integracao } = await supabase
      .from("integracoes_financeiras")
      .select("filial_id")
      .eq("id", input.integracao_id)
      .maybeSingle();
    filialConhecida = integracao?.filial_id ?? null;
  }

  const { data: contasSantander, error } = await supabase
    .from("contas")
    .select("id, filial_id")
    .eq("igreja_id", input.igreja_id)
    .eq("cnpj_banco", SANTANDER_CNPJ);

  if (error) {
    return { ingerido: false, motivo: "conta_santander_nao_encontrada", detalhe: error.message };
  }
  const todas = (contasSantander ?? []) as Array<{ id: string; filial_id: string | null }>;

  // Conta específica da filial da integração tem prioridade sobre a conta de
  // nível-igreja (filial_id NULL) — mesmo padrão filial > igreja usado em
  // financeiro_config.conciliacao_score_minimo (F4). Só cai para a
  // igreja-level quando não há conta específica da filial conhecida.
  const daFilial = filialConhecida
    ? todas.filter((c: { filial_id: string | null }) => c.filial_id === filialConhecida)
    : [];
  const candidatas = daFilial.length > 0
    ? daFilial
    : todas.filter((c: { filial_id: string | null }) => !c.filial_id);

  if (candidatas.length === 0) {
    return { ingerido: false, motivo: "conta_santander_nao_encontrada" };
  }
  if (candidatas.length > 1) {
    return { ingerido: false, motivo: "multiplas_contas_santander" };
  }

  const conta = candidatas[0];
  return { contaId: conta.id, filialId: conta.filial_id ?? null };
}

export async function ingerirExtratoPix(
  supabase: SupabaseClientAny,
  input: PixExtratoInput,
): Promise<PixExtratoResultado> {
  const resolved = await resolverContaPix(supabase, input);
  if ("ingerido" in resolved) {
    return resolved;
  }

  const externalId = `pix:${input.pix_id}`;

  // Já espelhado: não chama a RPC. fin_ingerir_extratos cria 1 job +
  // 1 fin_audit_log por chamada ANTES do dedupe por item — sem este check,
  // todo polling (chamado de novo para PIX antigos já dentro do
  // pix_webhook_temp, incluindo os já espelhados com sucesso) acumularia um
  // job/audit por PIX antigo a cada execução, mesmo sem nada novo a inserir.
  const { data: existente } = await supabase
    .from("extratos_bancarios")
    .select("id")
    .eq("conta_id", resolved.contaId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (existente) {
    return { ingerido: true };
  }

  const item: ExtratoItemInput = {
    data_transacao: input.data_pix.slice(0, 10),
    valor: input.valor,
    tipo: "credito",
    descricao: input.descricao,
    external_id: externalId,
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
