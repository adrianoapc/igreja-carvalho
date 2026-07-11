# ADR-030 — Conciliação Transacional e Motor Único de Score

**Status:** Aceito  
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
4. **Getnet (decisão D5 aprovada; adendo jul/2026 — duas pernas ligadas)**:
   previsto e realizado são pernas ligadas (fato-gerador × caixa do ADR-001
   aplicado ao adquirente). O **tipo 1 (RV previsto)** concilia o lançamento
   interno, que nasce `pendente`/sem `data_pagamento` (recebível a receber);
   o **tipo 5** (`getnet_financeiro_resumo`, dinheiro real) **dá baixa**
   (marca `pago`, com data e valor líquido efetivos). Débito e afins podem
   vir **já liquidados** num único evento (lançamento criado/baixado num
   passo, sem segunda perna). O tipo 5 segue como verdade do dinheiro, para
   novos períodos (`origem='getnet_sftp_tipo5'`), sem reprocessar histórico
   — corrige a leitura anterior de que o tipo 1 seria só analítico. Detalhe
   em `docs/arquitetura-financeiro.md` §8 ponto 4.
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

## 🔗 Relacionados

ADR-022 (importação de extratos), ADR-024 (PIX webhook), ADR-028
(sincronização por eventos), ADR-029 (camada canônica `fin_*`),
`docs/arquitetura-financeiro.md` (seções 3, 8 e roadmap).
