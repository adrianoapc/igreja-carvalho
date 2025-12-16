# ADR-001 — Separacao entre Fato Gerador, Fluxo de Caixa e DRE

**Status:** Aceito  
**Data:** 2025-03-08  
**Decisores:** Tesouraria, Tecnologia, Governanca  
**Contexto:** Sistema Financeiro / Reembolsos / Contabilidade  

---

## 📌 Contexto

O sistema financeiro precisa lidar com reembolsos e pagamentos que:

- Possuem multiplos itens contabeis (notas fiscais, categorias, fornecedores)
- Podem ser pagos de formas diferentes (a vista, parcelado, agrupado)
- Precisam gerar relatorios confiaveis de DRE

Misturar pagamento com classificacao contabil gera:
- DRE incorreto
- Dificuldade de conciliacao bancaria
- Perda do vinculo com o fato gerador real

---

## ❗ Problema

Como garantir que:

- O DRE represente a natureza real do gasto
- O fluxo de caixa represente apenas como e quando o dinheiro saiu
- A conciliacao bancaria seja simples
- A forma de pagamento nao impacte o DRE

---

## ✅ Decisao

Adotamos separacao explicita em camadas:

### 1. Fato Gerador (Competencia)
- Cada nota fiscal gera itens independentes
- Contem categoria, fornecedor e valor
- Persistido em `itens_reembolso`

### 2. Fluxo de Caixa (Pagamento)
- Pagamentos sao eventos financeiros independentes
- Podem ser unicos, parcelados ou agrupados
- Persistidos em `transacoes_financeiras`

### 3. Conciliacao Bancaria
- O banco confirma, nao define a verdade
- Sistema cruza previsto x realizado

### 4. Inteligencia Contabil (DRE)
- DRE nao le banco diretamente
- Nasce de uma view que cruza:
  - Categoria (itens)
  - Valor pago (transacoes)

---

## 🔁 Diagramas Relacionados

- [Fluxo Financeiro](../diagramas/fluxo-financeiro.md) — Fluxo completo (Fato Gerador → Caixa → Conciliação → DRE)
- [Sequencia do Processo](../diagramas/sequencia-financeira.md) — Ordem temporal dos eventos
- [DRE](../diagramas/dre.md) — Composição do DRE a partir da view unificada

## 📚 Documentação Relacionada

- [Funcionalidades do Módulo Financeiro](../funcionalidades.md#2-módulo-financeiro)
- [Manual do Usuário - Financeiro](../manual-usuario.md#4-módulo-financeiro)
- [Arquitetura Técnica - Módulo Financeiro](../01-Arquitetura/01-arquitetura-geral.MD#módulo-financeiro-visão-técnica)
- [Modelo de Dados - Financeiro](../database-er-diagram.md#financeiro--entidades-e-relações)

---

## 📊 Impacto no DRE

- DRE reflete o que foi gasto
- Independe de parcelamento ou forma de pagamento
- Permite auditoria clara

---

## 👍 Consequencias Positivas

- DRE correto
- Conciliacao simples
- Modelo flexivel
- Base solida para BI

---

## ⚠️ Trade-offs

- Mais tabelas
- Necessidade de view contabil
- Mais joins em relatorios

---

## 🧩 Alternativas Rejeitadas

### Registrar categoria na transacao
- Simples
- Rejeitado por quebrar parcelamentos

### Usar apenas extrato bancario
- Simples
- Rejeitado por falta de contexto contabil

---

## 🏁 Conclusao

Essa decisao garante integridade contabil, governanca e escalabilidade para o sistema financeiro.
