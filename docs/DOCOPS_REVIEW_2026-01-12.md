# DOCOPS Review — 2026-01-12

## Resumo

Revisão de documentação focada no módulo Financeiro (Relatório de Ofertas) e Conferência Cega, alinhando o que já foi implementado no front-end com o plano em `docs/PLANEJAMENTO_GESTAO_OFERTAS.md` e identificando lacunas para completar o ciclo (backend, UX supervisão, reconciliação digital e garantias RLS).

## Coberto (Implementado/Integrado)

- Wizard 4 passos: Abertura → Cofre/Físico → Digital → Fechamento.
- Abertura com `periodo` e data; sessão via RPC `open_sessao_contagem`.
- Grid Físico: colunas Membro (via `PessoaCombobox`), Tipo, Forma, Conta, Valor; preview inclui Membro.
- Grid Digital: Sync via Edge Function placeholder `finance-sync` (mock) + inclusão manual.
- Fechamento: totais físico/digital/geral; chamada `confrontar_contagens` exibindo variância total e por tipo; materialização em `transacoes_financeiras` incluindo `pessoa_id` e `origem_registro`.
- Autocomplete de membros (cmdk) integrado.
- Físico: Select de Tipo lista todas as categorias permitidas; seleção única; persiste `tipo` + `categoria_id` por linha.
- Físico/Digital: Inputs de Valor com máscara numérica pt-BR (formato "0,00"), aceitando apenas dígitos.
- Digital: "Categoria" por linha com Select e persistência (`categoria_id`); default conforme `financeiro_config`; linhas oriundas de API são somente leitura.
- Schema confirmado: `pessoa_id` e `origem_registro` em `transacoes_financeiras` (migr. `20260112181724_*`), com índices; RLS/policies multi-tenant por `igreja_id/filial_id` ativas.

## Pendências (Lacunas)

- Provider real (Digital): integrar Edge Function com segredo e provedor de `financeiro_config`; retornar itens reais com janela de reconciliação, status "conciliado"/"pendente" e timestamps.
- Regras de read-only e reconciliação: bloquear edição de linhas oriundas de API; marcação "conciliado" por seleção/pareamento; validações forma→conta para digitais.
- Conferência cega: bloquear `blind_lock_totals` em sessão; fluxo de recontagem/aprovação (ações supervisoras), incluindo tolerância dinâmica por sessão/filial; UI para contagens registradas e histórico.
- Back-end (documentação): detalhar cenários de auditoria/roles e logs de lançamentos/encerramentos, agora que `pessoa_id`/RLS estão confirmados.
- Testes: casos e2e (sessão, contagens, reconciliação digital, lançamento final); testes de RLS e permissões por papel.
- Documentação de erros: estados de falha de sync, conflitos de reconciliação, divergências fora de tolerância, passos de resolução.

## Ações Recomendadas

1. Documentar contrato da Edge Function `finance-sync` (input/output, provedores, segurança) e mapear fontes digitais (Pix/Cartão) por `financeiro_config`.
2. Especificar o modelo de reconciliação (pareamento transação↔item API, estados, indicadores visuais) e atualizar o wizard (Step 3) com as regras definitivas.
3. Detalhar política da Conferência Cega (parâmetros, bloqueios, quem pode aprovar/recontar, trilha de auditoria) e telas auxiliares.
4. Consolidar esquema `transacoes_financeiras` (campos necessários, origens, vínculos `pessoa_id`) e escrever casos RLS/roles.
5. Adicionar plano de testes e métricas de sucesso (tempo de reconciliação, divergências por período, taxa de aprovação).

## Referências

- `docs/PLANEJAMENTO_GESTAO_OFERTAS.md`
- RPCs: `open_sessao_contagem`, `confrontar_contagens`
- Front-end: `src/pages/financas/RelatorioOferta.tsx`, `src/hooks/useFinanceiroSessao.ts`, `src/components/pessoas/PessoaCombobox.tsx`
- Edge Function: `supabase/functions/finance-sync/index.ts`
