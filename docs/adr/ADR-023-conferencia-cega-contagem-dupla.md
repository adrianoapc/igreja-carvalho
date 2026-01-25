# ADR-023 — Conferência Cega com Contagem Dupla e Tolerância Parametrizada

**Status:** Aceito  
**Data:** 2026-01-14  
**Decisores:** Tesouraria, Liderança Financeira, Tecnologia  
**Contexto:** Módulo Financeiro / Conferência de Ofertas / Controle de Risco

---

## 📌 Contexto

A conferência de ofertas (dinheiro físico e digital) em igrejas é crítica para:

- Integridade e transparência financeira
- Conformidade com governança e auditoria
- Detecção de erros de contagem ou fraude

Conferências manuais sem controle apresentam riscos:

- Erros individuais (contagem errada, erro de digitação)
- Falta de rastreabilidade
- Dificuldade de reconciliação posterior
- Sem parametrização clara de aceitação/rejeição

---

## ❗ Problema

Como garantir que:

- **Duas contagens independentes** (por pessoas diferentes) validem o resultado final?
- **Tolerância de discrepância** seja clara e configurável (ex.: ±2% ou R$ 50)?
- **Ofertas digitais e físicas** possam ser conferidas separadamente (blind count mode)?
- **Snapshot da sessão** permanece imutável para auditoria?
- **Configuração é parametrizada** (não hardcoded)?

---

## ✅ Decisão

Adotamos **modelo de Contagem Dupla com Sessão + Configuração**:

### 1. Estrutura de Sessão (`sessoes_contagem`)

Cada conferência é uma **sessão isolada** com metadados:

| Campo           | Tipo                                   | Descrição                                                 |
| --------------- | -------------------------------------- | --------------------------------------------------------- |
| `id`            | UUID                                   | PK                                                        |
| `evento_id`     | FK → eventos                           | Culto/evento associado                                    |
| `status`        | ENUM (aberta, confrontada, finalizada) | Estado da sessão                                          |
| `data_abertura` | TIMESTAMP                              | Quando a sessão foi criada                                |
| `snapshot_json` | JSONB                                  | Cópia do estado do evento antes da conferência (imutável) |
| `criada_por`    | FK → profiles                          | Admin que abriu a sessão                                  |

**Por quê snapshot?**

- Audit trail: prova do estado original antes da contagem
- Integridade: não pode ser alterado retroativamente
- Rastreabilidade: quem abriu, quando, sob quais dados

### 2. Registros de Contagem (`sessoes_itens_draft`)

Cada pessoa registra sua contagem **independentemente**:

| Campo                | Tipo                  | Descrição                                     |
| -------------------- | --------------------- | --------------------------------------------- |
| `id`                 | UUID                  | PK                                            |
| `sessao_id`          | FK → sessoes_contagem | Referência à sessão                           |
| `numero_contagem`    | INT                   | 1ª contagem, 2ª contagem, etc.                |
| `pessoa_id`          | FK → profiles         | Quem contou                                   |
| `forma_pagamento_id` | FK → formas_pagamento | PIX / Cartão / Dinheiro / ...                 |
| `valor_total`        | DECIMAL(10,2)         | Valor total contado por essa pessoa           |
| `data_lancamento`    | TIMESTAMP             | Quando foi registrado                         |
| `observacoes`        | TEXT                  | Notas (ex.: "Moeda faltando", "Nota rasgada") |

**Por quê por forma_pagamento?**

- Cada meio tem características diferentes (físico/digital)
- Blind count (opcional): esconder digital enquanto conta físico
- Rastreabilidade: saber exatamente qual meio teve discrepância

### 3. Configuração Financeira (`financeiro_config`)

Parametriza regras de aceitação/rejeição:

| Campo                  | Tipo          | Valores                        | Descrição                                      |
| ---------------------- | ------------- | ------------------------------ | ---------------------------------------------- |
| `blind_count_mode`     | ENUM          | `off`, `optional`, `required`  | Se ativa/força blind count                     |
| `tolerance_percentage` | DECIMAL(5,2)  | 0-100                          | % máxima de diferença tolerada                 |
| `tolerance_fixed`      | DECIMAL(10,2) | 0-9999.99                      | Valor fixo de tolerância (ex.: R$ 50)          |
| `use_either_tolerance` | BOOLEAN       | true/false                     | Aceita se alguma tolerância (%) ou (R$) passar |
| `require_two_counts`   | BOOLEAN       | true/false                     | Exigir 2ª contagem?                            |
| `sync_strategy`        | ENUM          | `off`, `pix`, `api`, `webhook` | Integração com provedores                      |

**Exemplo prático:**

- `blind_count_mode = required` → admin contará físico 1º, depois digital (separado)
- `tolerance_percentage = 2` → diferença até 2% é aceita
- `tolerance_fixed = 50` → diferença até R$ 50 é aceita
- `use_either_tolerance = true` → se 2% **ou** R$ 50 passar, valida

### 4. Fluxo de Confrontação RPC (`confrontar_contagens`)

Automatiza a comparação e decisão:

```sql
-- Pseudocodigo
SELECT
  sessao_id,
  forma_pagamento_id,
  COUNT(DISTINCT numero_contagem) as contagens_registradas,
  MAX(CASE WHEN numero_contagem=1 THEN valor_total END) as valor_contagem_1,
  MAX(CASE WHEN numero_contagem=2 THEN valor_total END) as valor_contagem_2,
  ABS(MAX(CASE WHEN numero_contagem=2 THEN valor_total END)
      - MAX(CASE WHEN numero_contagem=1 THEN valor_total END)) as diferenca_absoluta,
  (ABS(...) / MAX(valor_total)) * 100 as diferenca_percentual
FROM sessoes_itens_draft
GROUP BY sessao_id, forma_pagamento_id
HAVING contagens_registradas = 2
```

**Decisão:**

- Se diferença ≤ tolerância: marca como **ACEITA** (usa média ou contagem_1)
- Se diferença > tolerância: marca como **PENDENTE** (requer supervisão)
- Se apenas 1 contagem: marca como **INCOMPLETA** (aguarda 2ª)

### 5. Estados da Sessão

```
[ABERTA] → (admin registra 1ª contagem)
         → (2º contador registra)
         → (RPC confronta) → [CONFRONTADA_ACEITA | CONFRONTADA_PENDENTE]
         → (supervisor aprova) → [FINALIZADA]
```

### 6. Integração com Provedores Externos (`finance-sync`)

Via `financeiro_config.sync_strategy`:

- `off` → nenhuma sincronização (manual)
- `pix` → puxa dados de Banco do Brasil / Vindi
- `api` → integração customizada
- `webhook` → aguarda callback de terceiro

**Fluxo:**

1. Sessão finalizada
2. `finance-sync` Edge Function busca transações do período
3. Compara com `sessoes_itens_draft`
4. Registra reconciliação automática (a implementar)

---

## 🎯 Trade-offs

| Aspecto                       | Escolha           | Por quê                                            | Custo                             |
| ----------------------------- | ----------------- | -------------------------------------------------- | --------------------------------- |
| **Snapshot vs. Referência**   | Snapshot (JSONB)  | Audit trail completo, não sofre retroatividade     | +storage, +complexidade de query  |
| **Por forma_pagamento**       | Sim               | Blind count, rastreabilidade granular              | +registros, +UI mais complexa     |
| **Tolerância dupla (% e R$)** | Ambas, com OR     | Flexibilidade (pequenas diferenças% vs grandes R$) | Ligeira confusão no UX            |
| **2ª contagem obrigatória**   | Config (opcional) | Escalabilidade (pequenas igrejas podem pular)      | +flexibilidade, -segurança padrão |

---

## 📊 Impacto

**Positivo:**

- ✅ Integridade auditável (snapshot imutável)
- ✅ Detecção de anomalias (blind count, tolerância)
- ✅ Rastreabilidade (quem, quando, qual forma)
- ✅ Conformidade (parametrizável para diferentes iglesias)
- ✅ Base para futura automação (sync com provedores)

**Negativo:**

- ❌ Mais complexidade operacional (requer treinamento)
- ❌ Mais registros no banco (audit trail overhead)
- ❌ UI mais elaborada (wizards, validações)

**Neutro:**

- Não impacta DRE (apenas ofertas, não despesas)
- Não quebra fluxo anterior (nova sessão, isolada)

---

## 🔗 Referências

- **Migrations**: `20260112183749_*.sql` (RPCs), `20260113134425_*.sql` (config), `20260114_*.sql` (session/items)
- **Frontend**: `src/pages/financas/RelatorioOferta.tsx`, `SessoesContagem.tsx`, `ConfigFinanceiro.tsx`
- **Documentação**: [`PLANEJAMENTO_GESTAO_OFERTAS.md`](../PLANEJAMENTO_GESTAO_OFERTAS.md), [`FK_CONSTRAINTS_FIX.md`](../FK_CONSTRAINTS_FIX.md)
- **ADRs relacionadas**: [ADR-001](ADR-001-separacao-fato-gerador-caixa-dre.md) (DRE), [ADR-003](ADR-003-rls-e-modelo-permissoes.md) (segurança)

---

## ✅ Validação

- [x] Revisado por Tesouraria (parametrização)
- [ ] Implementado em produção (a confirmar)
- [ ] Testes de contagem dupla (a confirmar)
- [ ] Treinamento de usuários (próximo passo)
