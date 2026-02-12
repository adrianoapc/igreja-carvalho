# Copilot Instructions — Igreja Carvalho

## Visão Geral

Este projeto é uma aplicação web multi-tenant para gestão de igrejas, baseada em React (Vite, TypeScript, Tailwind, shadcn-ui) e Supabase (Postgres, Auth, Edge Functions, Storage). Toda mudança relevante exige documentação e diagrama atualizado em `docs/`.

## Arquitetura e Fluxos

- **Frontend:** React + Vite, hooks customizados, padrão de rotas em `src/pages`.
- **Backend:** Supabase (Postgres, Auth, Edge Functions em Deno/TS, policies RLS).
- **Comunicação:** Frontend acessa Supabase via `@supabase/supabase-js` (queries, RPC, storage). Preferir RPC para regras de negócio.
- **Segurança:** RLS ativo em todas as tabelas sensíveis, claims de papel/igreja no JWT.
- **Edge Functions:** Localizadas em `supabase/functions/`, usadas para integrações, automações e lógica avançada.
- **Documentação:** Sempre complementar docs existentes em `docs/`, diagramas em Mermaid, ADRs para decisões arquiteturais.

## Workflows Essenciais

- **Desenvolvimento local:**
  - `npm i` para instalar dependências
  - `npm run dev` ou VS Code Task `Dev: Vite` para rodar localmente (`http://localhost:8080`)
  - Build: `npm run build`
- **Lint:** `npm run lint` (ESLint + Prettier)
- **Edge Functions:** Deploy via CLI Supabase (`supabase functions deploy <nome>`)
- **Banco:** Migrations SQL em `supabase/migrations/`, políticas RLS obrigatórias
- **Testes:** Testes manuais guiados por docs e scripts de integração (ver `docs/automacoes/`)

## Padrões e Convenções

- **Nunca mover/renomear/apagar arquivos em `docs/`** — apenas complementar
- **Diagramas sempre em Mermaid** (`docs/diagramas/`)
- **ADRs apenas para decisões reais** (`docs/adr/`)
- **Não inventar funcionalidades/telas/integracões** — só documentar o que existe
- **Separação clara:** Comunicação (manual/editorial) ≠ Notificações (automáticas/eventos)
- **Multi-tenancy:** Toda entidade principal tem `igreja_id`; use hooks de contexto (`useIgrejaId`, `useFilialId`)
- **Permissões:** Controle por RLS e claims JWT; roles: `admin`, `tecnico`, `lider`, `membro`
- **ResponsiveDialog Pattern:** Use o componente unificado para modais/drawers mobile/desktop

## Integrações e Pontos Críticos

- **Supabase:** Use sempre policies RLS e claims JWT; preferir RPC para lógica de negócio
- **Edge Functions:** Deno/TS, headers CORS padrão, variáveis de ambiente via Deno.env
- **Notificações:** Use sistema existente (tabela `notifications`, RPC `notify_admins`)
- **Chatbots/IA:** Configuração em `/admin/chatbots`, prompts e fluxos em Edge Functions
- **Automação:** Rotinas periódicas via cron em `supabase/config.toml`

## Exemplos de Arquivos-Chave

- `src/pages/admin/RevisaoDuplicatas.tsx` — UI de revisão de duplicatas
- `src/hooks/useDuplicatasSuspeitas.ts` — hook React Query para suspeitas
- `supabase/functions/automacao-duplicidade-pessoas/index.ts` — automação e notificação
- `docs/01-Arquitetura/01-arquitetura-geral.MD` — visão macro do sistema
- `docs/funcionalidades.md` — detalhamento de módulos e regras
- `docs/COPILOT_PROMPTS.MD` — guardrails para agentes AI

## Guardrails para Agentes AI

- Não duplique docs, sempre linke ou complemente
- Não altere estrutura de `docs/` sem evidência
- Marque como "(a confirmar)" qualquer funcionalidade não comprovada
- Saída sempre pronta para commit

Consulte sempre os docs e ADRs antes de propor mudanças estruturais.
