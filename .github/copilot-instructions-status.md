## Resumo e Próximos Passos

- Objetivo: Operacionalizar o módulo Financeiro com wizard configurável, separação físico/digital, mapeamento de categorias e contas digitais, validações (valor zero) e consolidação de documentação.
- Contexto: Frontend React + Vite + Tailwind + shadcn-ui; Backend Supabase Postgres com RLS, RPCs e funções Edge.

## Requisitos do Projeto (Financeiro)

- Configuração: `financeiro_config` controla `periodos`, `formas_fisicas_ids`, `formas_digitais_ids`, `tipos_permitidos_fisico/digital`, `valor_zero_policy`.
- Formas de pagamento: `gera_pago=false` (físico), `gera_pago=true` (digital); mapeamento para contas por `forma_pagamento_contas`.
- Categorias: usar `categorias_financeiras` (tipo=entrada) para tipos permitidos e materialização por `categoria_id`.
- Sessões: integração com RPCs `open_sessao_contagem`, `confrontar_contagens` para conferência cega.
- Documentos: ver `docs/FINANCEIRO_CONFIG_SPEC.md` e `docs/DOCOPS_REVIEW_2026-01-12.md`.

## Scaffold do Projeto

- Stack: React 18, TypeScript, Vite, Tailwind, shadcn-ui.
- Status: OK, projeto compila e roda com sucesso.

## Customizações Implementadas

- Wizard 4 passos com períodos dinâmicos a partir de `financeiro_config`.
- Passo Físico: confirmação explícita para total zero; tipos dinâmicos a partir de categorias/config.
- Passo Digital: separação de formas, coluna "Conta" com mapeamento padrão e seleção manual; itens de API mantidos como somente leitura.
- Materialização: uso de `categoria_id` permitido e `contaId` em digitais.
- Pendências: UI de conciliação (pendente/conciliado), pareamento de itens, ações supervisoras da conferência cega, tolerâncias por sessão, validações adicionais de RBAC/RLS.

## Extensões Recomendadas (VS Code)

- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)
- Supabase (`supabase.supabase`)
- PostCSS Language Support (`csstools.postcss`)
- EditorConfig (`EditorConfig.EditorConfig`)

## Build, Task e Lançamento

- Build: `npm run build` — status atual: sucesso.
- Task de Dev: `Dev: Vite` — inicia servidor local.
- Acesso local: `http://localhost:5173`.

## Documentação

- Revisar `README.md` e docs em `docs/` para consistência.
- Este arquivo complementa `copilot-instructions.md` com status e referências rápidas de execução.
- Atualizado: `docs/DOCOPS_REVIEW_2026-01-12.md` com itens implementados (tipo único com categorias, máscara de moeda, categoria por linha no Digital) e ajuste de pendências.
- Atualizado: `docs/PLANEJAMENTO_GESTAO_OFERTAS.md` com seção "6.1 Estado da Implementação — 2026-01-13" detalhando concluídos vs. pendentes.
