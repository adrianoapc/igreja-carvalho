# Documentação — Igreja Carvalho

Esta documentação descreve a arquitetura, fluxos, decisões técnicas (ADRs),
backend (Supabase), e o guia do usuário do sistema Igreja Carvalho.

## Estrutura

- 00-visao-geral
- 01-arquitetura
- 02-backend-supabase
- 03-guia-do-usuario
- 04-adrs
- 05-padroes-e-convencoes

## Índice Geral

- **Changelog**
  - Changelog completo: [`CHANGELOG.md`](CHANGELOG.md)
  - Hook de paginação: [`PAGINATED_QUERY_HOOK.md`](PAGINATED_QUERY_HOOK.md)
  - Multi-tenancy (Backlog): [`BACKLOG_MULTI_TENANCY.md`](BACKLOG_MULTI_TENANCY.md)
  - Controle Multi-Tenant: [`controle-multi-tenant.md`](controle-multi-tenant.md)
  - Guia de importação de extratos (arquivo/API): [`operacoes/importacao-extratos.md`](operacoes/importacao-extratos.md)
  - Replicação de cadastros entre filiais: [`operacoes/replicacao-cadastros-filiais.md`](operacoes/replicacao-cadastros-filiais.md)
  - Planejamento gestão de ofertas: [`PLANEJAMENTO_GESTAO_OFERTAS.md`](PLANEJAMENTO_GESTAO_OFERTAS.md)
  - Correções de FKs (perfis x contagens): [`FK_CONSTRAINTS_FIX.md`](FK_CONSTRAINTS_FIX.md)
  - Correção criação de usuários (Edge Function): [`USER_CREATION_FIX.md`](USER_CREATION_FIX.md)
  - Especificação Config Financeiro: [`FINANCEIRO_CONFIG_SPEC.md`](FINANCEIRO_CONFIG_SPEC.md)
  - Setup inicial Config Financeiro (SQL): [`FINANCEIRO_CONFIG_SETUP.sql`](FINANCEIRO_CONFIG_SETUP.sql)
  - DocOps Review 2026-01-12: [`DOCOPS_REVIEW_2026-01-12.md`](DOCOPS_REVIEW_2026-01-12.md)
- Arquitetura
  - Visão geral: [`01-Arquitetura/01-arquitetura-geral.MD`](01-Arquitetura/01-arquitetura-geral.MD)
  - Autenticação Supabase: [`01-Arquitetura/02-autenticacao-supabase.MD`](01-Arquitetura/02-autenticacao-supabase.MD)
  - Fluxo de dados FE → Supabase → DB: [`01-Arquitetura/03-fluxo-de-dados.MD`](01-Arquitetura/03-fluxo-de-dados.MD)
  - RLS e segurança: [`01-Arquitetura/04-rls-e-seguranca.MD`](01-Arquitetura/04-rls-e-seguranca.MD)
  - Módulo Cultos (visão técnica): [`01-Arquitetura/01-arquitetura-geral.MD#módulo-cultos-visão-técnica`](01-Arquitetura/01-arquitetura-geral.MD#módulo-cultos-visão-técnica)
  - Módulo Intercessão (visão técnica): [`01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica`](01-Arquitetura/01-arquitetura-geral.MD#módulo-intercessão-oração-e-testemunhos-visão-técnica)
- Produto
  - Guia de produto: [`produto/README_PRODUTO.MD`](produto/README_PRODUTO.MD)
  - Manual do usuário: [`manual-usuario.md`](manual-usuario.md)
  - Funcionalidades: [`funcionalidades.md`](funcionalidades.md)
  - Kids — Inclusão e necessidades: [`KIDS_INCLUSION.md`](KIDS_INCLUSION.md)
  - Kids — Responsáveis autorizados (guardians): [`AUTHORIZED_GUARDIANS.md`](AUTHORIZED_GUARDIANS.md)
  - Kids — Notificações: [`NOTIFICACOES_KIDS.md`](NOTIFICACOES_KIDS.md)
  - Manual — Ministério Infantil (Kids): [`manual-usuario.md`](manual-usuario.md)
  - Jornadas e Ensino — visão de produto: [`produto/README_PRODUTO.MD#jornadas-e-ensino-visão-de-produto`](produto/README_PRODUTO.MD#jornadas-e-ensino-visão-de-produto)
  - Jornadas e Ensino — manual do usuário: [`manual-usuario.md#7-jornadas-e-ensino`](manual-usuario.md#7-jornadas-e-ensino)
  - Jornadas e Ensino — funcionalidades: [`funcionalidades.md#5-jornadas-e-ensino`](funcionalidades.md#5-jornadas-e-ensino)
  - Cultos — visão de produto: [`produto/README_PRODUTO.MD#cultos-visão-de-produto`](produto/README_PRODUTO.MD#cultos-visão-de-produto)
  - Cultos — manual do usuário: [`manual-usuario.md#5-cultos-e-liturgia`](manual-usuario.md#5-cultos-e-liturgia)
  - Cultos — funcionalidades: [`funcionalidades.md#módulo-cultos`](funcionalidades.md#módulo-cultos)
  - Intercessão — visão de produto: [`produto/README_PRODUTO.MD#intercessão-oração-e-testemunhos-visão-de-produto`](produto/README_PRODUTO.MD#intercessão-oração-e-testemunhos-visão-de-produto)
  - Intercessão — manual do usuário: [`manual-usuario.md#6-intercessão`](manual-usuario.md#6-intercessão)
  - Intercessão — funcionalidades: [`funcionalidades.md#5-intercessão-oração-e-testemunhos`](funcionalidades.md#5-intercessão-oração-e-testemunhos)
  - Intercessão — próximos passos: [`PROXIMOS_PASSOS_INTERCESSAO.md`](PROXIMOS_PASSOS_INTERCESSAO.md)
  - Gabinete Digital — visão funcional: [`funcionalidades.md#4-gabinete-digital-e-cuidado-pastoral`](funcionalidades.md#4-gabinete-digital-e-cuidado-pastoral)
- Telas & Segurança
  - Catálogo de Telas: [`telas/catalogo-telas.md`](telas/catalogo-telas.md)
  - Matriz de Permissões (ACL): [`telas/matriz-permissoes.md`](telas/matriz-permissoes.md)
  - Telas fora da navegação: [`telas/telas-fora-navegacao.md`](telas/telas-fora-navegacao.md)
  - Índice de Telas: [`telas/README.md`](telas/README.md)
- Banco de Dados
  - Esquema SQL: [`database-schema.sql`](database-schema.sql)
  - Diagrama ER: [`database-er-diagram.md`](database-er-diagram.md)
  - Diagramas: [`diagramas/`](diagramas/)
  - Diagrama — Arquitetura Geral & Navegação: [`diagramas/arquitetura-geral.md`](diagramas/arquitetura-geral.md)
  - Diagrama — Fluxo Kids: [`diagramas/fluxo-kids.md`](diagramas/fluxo-kids.md)
  - Diagrama — Sequência de Notificações (Kids): [`diagramas/sequencia-kids-notificacoes.md`](diagramas/sequencia-kids-notificacoes.md)
  - Diagrama — Permissões (Guardians/Kids): [`diagramas/permissoes-kids-guardians.md`](diagramas/permissoes-kids-guardians.md)
  - Diagrama — Fluxo Comunicação: [`diagramas/fluxo-comunicacao.md`](diagramas/fluxo-comunicacao.md)
  - Diagrama — Sequência Comunicação: [`diagramas/sequencia-comunicacao.md`](diagramas/sequencia-comunicacao.md)
  - Diagrama — Fluxo Notificações: [`diagramas/fluxo-notificacoes.md`](diagramas/fluxo-notificacoes.md)
  - Diagrama — Sequência Notificações: [`diagramas/sequencia-notificacoes.md`](diagramas/sequencia-notificacoes.md)
  - Diagrama — Fluxo Ensino: [`diagramas/fluxo-ensino.md`](diagramas/fluxo-ensino.md)
  - Diagrama — Sequência Ensino: [`diagramas/sequencia-ensino.md`](diagramas/sequencia-ensino.md)
  - Diagrama — Cursos Pagos (Ensino): [`diagramas/fluxo-cursos-pagos.md`](diagramas/fluxo-cursos-pagos.md)
  - Diagrama — Fluxo Cultos: [`diagramas/fluxo-cultos.md`](diagramas/fluxo-cultos.md)
  - Diagrama — Sequência Cultos: [`diagramas/sequencia-cultos.md`](diagramas/sequencia-cultos.md)
  - Diagrama — Fluxo Liturgia ↔ Escalas: [`diagramas/fluxo-liturgia-escalas.md`](diagramas/fluxo-liturgia-escalas.md)
  - Diagrama — Fluxo Gabinete Digital: [`diagramas/fluxo-gabinete-pastoral.md`](diagramas/fluxo-gabinete-pastoral.md)
  - Diagrama — Fluxo Intercessão: [`diagramas/fluxo-intercessao.md`](diagramas/fluxo-intercessao.md)
  - Diagrama — Sequência Intercessão: [`diagramas/sequencia-intercessao.md`](diagramas/sequencia-intercessao.md)
  - Diagrama — Fluxo Sentimentos IA: [`diagramas/fluxo-sentimentos-ia.md`](diagramas/fluxo-sentimentos-ia.md)
  - Diagrama — Fluxo Escalas Lembretes: [`diagramas/fluxo-escalas-lembretes.md`](diagramas/fluxo-escalas-lembretes.md)
- ADRs
  - Lista de ADRs: [`adr/README.MD`](adr/README.MD)
  - ADR-001 (Fato Gerador vs Caixa vs DRE): [`adr/ADR-001-separacao-fato-gerador-caixa-dre.md`](adr/ADR-001-separacao-fato-gerador-caixa-dre.md)
  - ADR-023 (Conferência Cega — Contagem Dupla): [`adr/ADR-023-conferencia-cega-contagem-dupla.md`](adr/ADR-023-conferencia-cega-contagem-dupla.md)
  - ADR-002 (Autenticação Supabase): [`adr/ADR-002-autenticacao-supabase.md`](adr/ADR-002-autenticacao-supabase.md)
  - ADR-003 (RLS e modelo de permissões): [`adr/ADR-003-rls-e-modelo-permissoes.md`](adr/ADR-003-rls-e-modelo-permissoes.md)
  - ADR-006 (Separação Comunicação e Notificações): [`adr/ADR-006-separacao-comunicacao-notificacoes.md`](adr/ADR-006-separacao-comunicacao-notificacoes.md)
  - ADR-007 (Estratégia de Entrega de Notificações): [`adr/ADR-007-estrategia-entrega-notificacoes.md`](adr/ADR-007-estrategia-entrega-notificacoes.md)
  - ADR-008 (Uso de Eventos de Domínio): [`adr/ADR-008-eventos-dominio.md`](adr/ADR-008-eventos-dominio.md)
  - ADR-010 (Intercessão: Redirecionamento Inteligente vs Automação): [`adr/ADR-010-intercessao-redirecionamento-inteligente.md`](adr/ADR-010-intercessao-redirecionamento-inteligente.md)
  - ADR-012 (Intercessão V2, CRM de Evangelismo e Chatbot IA): [`adr/012-intercessao-v2-evangelismo.md`](adr/012-intercessao-v2-evangelismo.md)
  - ADR-014 (Gabinete Digital, Roteamento Pastoral e Unificação de Entradas): [`adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md`](adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md)
  - ADR-024 (Webhook PIX Santander com CORS aberto e health check): [`adr/ADR-024-pix-webhook-santander.md`](adr/ADR-024-pix-webhook-santander.md)

## Como navegar

- Use os links acima para chegar diretamente ao tópico.
- Diagramas estão em Mermaid e podem ser visualizados aqui ou importados no Notion.
- Decisões técnicas referenciam os ADRs correspondentes.
