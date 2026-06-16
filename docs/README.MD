# Documentação — Igreja Carvalho

Documentação de arquitetura, fluxos, decisões técnicas (ADRs), backend (Supabase) e guia do usuário.

## Estrutura

```
docs/
├── 01-Arquitetura/          # Visão geral, auth, fluxo de dados, RLS
├── adr/                     # Architecture Decision Records (28 ADRs)
├── automacoes/              # Catálogo de edge functions, crons, automações
├── diagramas/               # Diagramas Mermaid por módulo
├── modulos/                 # Docs vivos por módulo (nova estrutura)
│   ├── cuidado/
│   ├── financeiro/{core,integracoes-bancarias,ofertas-contagem,reembolsos,config}/
│   ├── intercessao/ · kids/ · pessoas/ · projetos/ · superadmin/ · voluntariado/
├── planos/ · produto/ · propostas/ · telas/
└── _archive/_fundidos/      # Histórico preservado (somente leitura)
```

## Índice por Área

### Arquitetura

- [Visão geral](01-Arquitetura/01-arquitetura-geral.MD)
- [Autenticação Supabase](01-Arquitetura/02-autenticacao-supabase.MD)
- [Fluxo de dados FE → Supabase → DB](01-Arquitetura/03-fluxo-de-dados.MD)
- [RLS e segurança (+ inventário multi-tenant)](01-Arquitetura/04-rls-e-seguranca.MD)

### Módulos (docs vivos)

- [Módulos — índice](modulos/README.md)
- [Kids](modulos/kids/kids.md)
- [Voluntariado](modulos/voluntariado/VOLUNTARIADO.md)
- [Cuidado — memorial](modulos/cuidado/memorial-sistema-cuidado.md)
- [Financeiro / core](modulos/financeiro/core/)
- [Financeiro / integrações bancárias](modulos/financeiro/integracoes-bancarias/)
- [Financeiro / ofertas e ML](modulos/financeiro/ofertas-contagem/)
- [Intercessão](modulos/intercessao/)
- [SuperAdmin — replicação de filiais](modulos/superadmin/replicacao-cadastros-filiais.md)
- [Pessoas — permissões contextuais](modulos/pessoas/permissoes-contextuais-times.md)
- [Projetos](modulos/projetos/README.md)

### Telas e Segurança

- [Catálogo de telas](telas/catalogo-telas.md)
- [Matriz de permissões (ACL)](telas/matriz-permissoes.md)
- [Telas fora da navegação](telas/telas-fora-navegacao.md)
- [Índice de telas](telas/README.md)

### Banco de Dados

- [Esquema SQL (TODO: regenerar)](database-schema.sql)
- [Diagrama ER (TODO: regenerar)](database-er-diagram.md)

### Diagramas Mermaid

- [Arquitetura geral e navegação](diagramas/arquitetura-geral.md)
- [Fluxo Kids](diagramas/fluxo-kids.md)
- [Sequência Kids — notificações](diagramas/sequencia-kids-notificacoes.md)
- [Permissões Kids — guardians](diagramas/permissoes-kids-guardians.md)
- [Fluxo Comunicação](diagramas/fluxo-comunicacao.md)
- [Sequência Comunicação](diagramas/sequencia-comunicacao.md)
- [Fluxo Notificações](diagramas/fluxo-notificacoes.md)
- [Sequência Notificações](diagramas/sequencia-notificacoes.md)
- [Fluxo Ensino (+ cursos pagos)](diagramas/fluxo-ensino.md)
- [Sequência Ensino](diagramas/sequencia-ensino.md)
- [Fluxo Cultos](diagramas/fluxo-cultos.md)
- [Sequência Cultos](diagramas/sequencia-cultos.md)
- [Fluxo Liturgia ↔ Escalas](diagramas/fluxo-liturgia-escalas.md)
- [Fluxo Escalas — lembretes](diagramas/fluxo-escalas-lembretes.md)
- [Fluxo Gabinete Digital](diagramas/fluxo-gabinete-pastoral.md)
- [Fluxo Intercessão](diagramas/fluxo-intercessao.md)
- [Sequência Intercessão](diagramas/sequencia-intercessao.md)
- [Fluxo Sentimentos IA](diagramas/fluxo-sentimentos-ia.md)
- [Fluxo Pessoas (+ RLS + cadastro público)](diagramas/fluxo-pessoas.md)

### Automações

- [Catálogo de automações / edge functions](automacoes/catalogo-automacoes.md)
- [Cron: buscar PIX + outros jobs agendados](automacoes/cron-buscar-pix.md)

### ADRs

- [Lista completa de ADRs (28)](adr/README.MD)

### Produto

- [Visão de produto (estratégia, wedges, posicionamento)](produto/visao-produto.md)
- [Guia de produto](produto/README_PRODUTO.MD)
- [Manual do usuário](manual-usuario.md)
- [Funcionalidades](funcionalidades.md)
- [Plano UX / mobile (+ diagnóstico responsivo)](plano-ux-roadmap.md)

### DocOps

- [DocOps Playbook (+ guard-rails Copilot)](DOCOPS_PLAYBOOK.md)
- [Changelog](CHANGELOG.md)

## Como navegar

- Use os links acima para chegar diretamente ao tópico.
- Diagramas estão em Mermaid — visualize no VS Code (extensão Mermaid Preview) ou importe no Notion.
- Decisões técnicas referenciam os ADRs correspondentes.
- Arquivos em `_archive/` são somente leitura — histórico preservado via `git mv`.
