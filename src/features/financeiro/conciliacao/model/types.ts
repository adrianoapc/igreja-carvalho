/**
 * Tipos compartilhados por ConciliacaoManual e DashboardConciliacao (F7 sub-
 * frente 2/5) — mesmo domínio (motor único F4), formas de extrato/transação
 * praticamente idênticas entre as duas telas antes da decomposição.
 *
 * Não reaproveita os tipos locais de `hooks/useConciliacaoInteligente.ts`
 * de propósito: aquela tela busca colunas adicionais (valor_liquido, taxas,
 * juros...) que Manual/Dashboard não usam — unificar criaria uma dependência
 * artificial entre módulos com propósitos de tela diferentes.
 */

export interface ExtratoItem {
  id: string;
  conta_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  reconciliado: boolean;
  transacao_vinculada_id?: string | null;
  origem?: string | null;
  contas?: { nome: string } | null;
}

export interface TransacaoConciliacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string | null;
  data_vencimento?: string | null;
  status?: string | null;
  conciliacao_status?: string | null;
  categorias_financeiras?: { nome: string } | null;
  conta_id?: string | null;
  origem_registro?: string | null;
  contas?: { nome: string } | null;
}

export interface ContaConciliacao {
  id: string;
  nome: string;
  tipo?: string;
}
