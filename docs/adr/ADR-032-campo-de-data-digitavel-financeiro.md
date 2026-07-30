# ADR-032 — Campo de data digitável (dd/mm/aaaa) nos dialogs do financeiro

**Status:** Aceito
**Data:** 2026-07-29
**Decisores:** Tesouraria, Tecnologia
**Contexto:** Sistema Financeiro / Dialogs de transação, ajuste de saldo, confirmação de pagamento, importação Getnet, relatório de oferta

---

## 📌 Contexto

Todo campo de data única do financeiro (Vencimento, Competência, Data de
Pagamento, Data do Ajuste, Data de Referência do Getnet, Data do Culto)
usava o mesmo padrão: um `Popover` com `Button` de gatilho que só abre um
`Calendar` (react-day-picker) — sem input de texto, sem pular ano
rapidamente. Corrigir uma data distante do mês atual (ex: competência de
meses atrás) exigia clicar em "mês anterior" repetidamente.

## ❗ Problema

Como permitir digitar uma data diretamente, sem perder o calendário como
atalho visual, sem quebrar a conversão Date↔string já existente em cada
dialog (`parseLocalDate`/`formatLocalDate`, `format()` puro do date-fns, e
o truque `+"T12:00:00"` usado no fluxo de importação de NF-e — 3
estratégias coexistindo, cada uma correta no seu contexto)?

## ✅ Decisão

Novo componente `DateFieldPicker` (`src/components/financas/`): input
digitável com máscara `dd/mm/aaaa` via `MaskedInput`/`react-imask` (lib já
usada em telefone/CPF no resto do app, nenhuma dependência nova) + ícone de
calendário que abre o mesmo `Popover`+`Calendar` de antes como atalho
opcional. Contrato só em termos de `Date | undefined` — nunca toca strings
— então cada dialog manteve sua própria conversão Date↔string exatamente
como estava; só a interação de seleção mudou.

Suporta `disabledDate?: (date: Date) => boolean` (repassado ao `Calendar`
e também valida a digitação) — necessário pro `GetnetImportDialog`, que
não permite data futura.

### Validação de data digitada inválida (achado de review)

Digitar uma data completa mas inválida (`31/02/2026`) ou barrada por
`disabledDate` mantinha o texto visível sem nunca atualizar o valor do
formulário — o dialog continuava habilitado a salvar, silenciosamente
usando a data anterior enquanto exibia a rejeitada. Corrigido: campo marca
erro visualmente (borda destructive) enquanto a data digitada não for
aceita, e reverte pro último valor válido ao perder foco se ainda inválida
— texto exibido e valor salvo nunca ficam dessincronizados além do tempo
em que o usuário está digitando.

## 🧩 Alternativas rejeitadas

### Input nativo do navegador (`type="date"`)
Sempre digitável, sem dependência nova. Rejeitado por perder o estilo
visual consistente com o resto do app (calendário nativo do SO/navegador,
fora do controle de tema claro/escuro).

### Manter o Popover-calendário, só adicionar dropdown de mês/ano
Menor mudança de componente. Rejeitado — não resolve o caso motivador
(digitar uma data específica direto), só reduz o número de cliques pra
navegar até ela.

## 👍 Consequências

- Mesmo componente aplicado nos 8 campos de data única identificados no
  financeiro — interação consistente em todo o módulo.
- `TransacaoDialog`, `AjusteSaldoDialog`, `ConfirmarPagamentoDialog`,
  `GetnetImportDialog`, `RelatorioOferta` perderam ~15-25 linhas de JSX de
  Popover/Calendar cada, substituídas por uma única tag.

## ⚠️ Trade-offs

- Novo componente compartilhado a manter — mudança de comportamento futura
  (ex: outro formato de máscara) precisa ser feita num lugar só, mas
  qualquer bug afeta os 8 pontos de uso simultaneamente.
- `MaskedInput` já existia no projeto (telefone/CPF), mas nunca tinha sido
  usado pra data — validação de calendário real (dias por mês, ano
  bissexto) fica por conta de `date-fns` (`parse`+`isValid`), a máscara em
  si só garante o formato `99/99/9999`.

## 🔁 Diagramas Relacionados

- [Campo de Data do Financeiro](../diagramas/campo-data-financeiro.md)

## 📚 Documentação Relacionada

- `docs/funcionalidades.md` §2.2
- [ADR-031](ADR-031-tipo-de-data-filtro-e-regime-caixa.md) — decisão
  irmã da mesma sessão, sobre qual coluna de data cada filtro usa (tema
  relacionado mas ortogonal: ADR-031 é sobre *qual* data filtrar,
  este ADR é sobre *como digitar* uma data)

## 🏁 Status de implementação

Entregue em jul/2026 (PR #66). 1 achado de review automático (Codex, P1 —
data inválida/rejeitada não sincronizava com o valor salvo) corrigido na
mesma PR.
