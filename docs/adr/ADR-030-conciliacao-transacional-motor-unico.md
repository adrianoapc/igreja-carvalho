# ADR-030 — Conciliação Transacional e Motor Único de Score

**Status:** Aceito — F3 (confirmação transacional) implementada em 2026-07-11
(migration `20260711140000`; `fin_confirmar_conciliacao`/`fin_desconciliar`;
notas em `docs/arquitetura-financeiro.md` §9.2). Motor único de score (F4),
pipeline de ingestão (F5) e Getnet duas pernas (F6, ver §8 ponto 4 do doc de
arquitetura) permanecem pendentes.  
**Data:** 2026-07-10  
**Decisores:** Produto, Tecnologia  
**Contexto:** Sistema Financeiro / Conciliação Bancária / Getnet / ML  

---

## 📌 Contexto

A conciliação bancária hoje (mapeamento em `docs/arquitetura-financeiro.md`,
seções 3 e 8):

- **Três motores de score concorrentes**: RPC `gerar_candidatos_conciliacao`
  (pesos 0.4/0.3/0.2/0.1), RPC legada `reconciliar_transacoes` +
  `aplicar_conciliacao` (score 50-100, acionada pelo DashboardConciliacao) e
  um scoring client-side em `ConciliacaoInteligente.tsx:381-391`.
- **Confirmação multi-tabela NO FRONTEND** (`confirmarConciliacao`,
  `ConciliacaoInteligente.tsx:421-703`): ~6 updates sequenciais sem
  transação — extrato, vínculo (1:1/lote/divisão), transação
  (pendente→pago), irmã de transferência, feedback ML. Falha no meio deixa
  estado inconsistente.
- **Ingestão fragmentada**: OFX/CSV client-side, getnet-sftp, santander-api
  (inclusive via botão Ver Extrato em Contas), pix-webhook — cada um insere
  em `extratos_bancarios` por conta própria.

---

## ❗ Problema

Como eliminar a janela de inconsistência da confirmação, unificar os
critérios de sugestão e padronizar a entrada de extratos, sem big-bang?

---

## ✅ Decisão

1. **Motor único de score**: `gerar_candidatos_conciliacao` evolui para
   `fin_gerar_candidatos_conciliacao`, com pesos/corte parametrizáveis por
   igreja (default 0.6). A dupla legada `reconciliar_transacoes` +
   `aplicar_conciliacao` e o scoring client-side são **deprecados** (remoção
   na F4; ModoABToggle serve de instrumento de validação na transição).
2. **Confirmação transacional**: `fin_confirmar_conciliacao(p_vinculo jsonb,
   p_contexto)` com
   `p_vinculo = {extrato_ids[], transacao_ids[], divisoes?, sugestao_id?,
   score?}` cobre os três formatos (1:1, N:1 lote, 1:N divisão) em UMA
   transação: lock/validação → vínculo → flags extrato+transação →
   pendente→pago (trigger de saldo) → propagação para irmã de transferência
   → `reconciliacao_audit_logs` + `conciliacao_ml_feedback`.
   `fin_desconciliar` é o inverso exato (evolução da `desconciliar_transacao`).
3. **Pipeline comum de ingestão**: contrato
   `ExtratoItem {data, valor, tipo, descricao, external_id, meta}` + `origem`
   fixa por fonte; adaptadores fazem parse/fetch e TODOS persistem via
   `fin_ingerir_extratos` (dedupe `(conta_id, external_id)`, auditoria e
   gancho pós-ingestão que dispara geração de candidatos — ADR-028).
4. **Getnet (decisão D5 aprovada)**: o espelho no extrato passa a nascer do
   **tipo 5** (`getnet_financeiro_resumo`, dinheiro real) para novos períodos
   (`origem='getnet_sftp_tipo5'`), mantendo o tipo 1 como analítico.
   Histórico não é reprocessado.
5. **Modelo de vínculo (decisão D3 aprovada)**: as 3 estruturas atuais são
   mantidas, escritas somente via RPC; modelo único N:M fica como evolução
   posterior. FK física em `transacao_vinculada_id` após saneamento de
   órfãos.

---

## 🔁 Consequências

- `ConciliacaoInteligente`, `ConciliacaoManual`, `DividirExtratoDialog`,
  `ConciliacaoLoteDialog` e `sync-transferencias-conciliacao` passam a
  chamar apenas `fin_confirmar_conciliacao`/`fin_desconciliar`.
- Reclassificação passa a bloquear/alertar transação conciliada (hoje há
  TODO explícito em `reclass-transacoes/index.ts:324`).
- Feature flag de rollback por 1-2 releases na F3; divergências monitoradas
  via audit log.
- Ordem de migração da ingestão (F5): manual → pix → santander → getnet.

## ✅ Status de implementação

- **F3 (jul/2026, migration `20260711140000`)**: confirmação transacional
  (`fin_confirmar_conciliacao`/`fin_desconciliar`) entregue. Ver
  `arquitetura-financeiro.md §9.2`.
- **F4 (jul/2026, migration `20260711150000`)**: **motor único de score**
  entregue. `fin_gerar_candidatos_conciliacao` (score 0..1, formatos 1:1 e
  1:N) é o único gerador de candidatos; tenant/ator via `fin_resolver_contexto`;
  corte parametrizável por igreja em `financeiro_config.conciliacao_score_minimo`
  (default 0.6). `ConciliacaoManual`, `DashboardConciliacao` e
  `ConciliacaoInteligente` migrados ao motor único + `fin_confirmar_conciliacao`.
  As legadas `reconciliar_transacoes`, `aplicar_conciliacao` e
  `gerar_candidatos_conciliacao` ficam **deprecadas** (`COMMENT`); o `DROP`
  fica para a F7, após migrar a edge `gerar-sugestoes-ml`. O score
  client-side de `ConciliacaoInteligente` e o `ModoABToggle` (código morto)
  foram removidos. `reclass-transacoes` passou a **recusar** (HTTP 409) job
  sobre transação conciliada, fechando o TODO de imutabilidade. Detalhes em
  `arquitetura-financeiro.md §9.3`.

## 🔗 Relacionados

ADR-022 (importação de extratos), ADR-024 (PIX webhook), ADR-028
(sincronização por eventos), ADR-029 (camada canônica `fin_*`),
`docs/arquitetura-financeiro.md` (seções 3, 8 e roadmap).
