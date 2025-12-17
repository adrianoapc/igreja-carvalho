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
	- Intercessão — funcionalidades: [`funcionalidades.md#4-intercessão-oração-e-testemunhos`](funcionalidades.md#4-intercessão-oração-e-testemunhos)
	- Intercessão — próximos passos: [`PROXIMOS_PASSOS_INTERCESSAO.md`](PROXIMOS_PASSOS_INTERCESSAO.md)
 - Telas & Segurança
	- Catálogo de Telas: [`telas/catalogo-telas.md`](telas/catalogo-telas.md)
	- Matriz de Permissões (ACL): [`telas/matriz-permissoes.md`](telas/matriz-permissoes.md)
- Banco de Dados
	- Esquema SQL: [`database-schema.sql`](database-schema.sql)
	- Diagrama ER: [`database-er-diagram.md`](database-er-diagram.md)
	- Diagramas: [`diagramas/`](diagramas/)
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
 	- Diagrama — Fluxo Intercessão: [`diagramas/fluxo-intercessao.md`](diagramas/fluxo-intercessao.md)
	- Diagrama — Sequência Intercessão: [`diagramas/sequencia-intercessao.md`](diagramas/sequencia-intercessao.md)
- ADRs
	- Lista de ADRs: [`adr/README.MD`](adr/README.MD)
	- ADR-001 (Fato Gerador vs Caixa vs DRE): [`adr/ADR-001-separacao-fato-gerador-caixa-dre.md`](adr/ADR-001-separacao-fato-gerador-caixa-dre.md)
	- ADR-002 (Autenticação Supabase): [`adr/ADR-002-autenticacao-supabase.md`](adr/ADR-002-autenticacao-supabase.md)
	- ADR-003 (RLS e modelo de permissões): [`adr/ADR-003-rls-e-modelo-permissoes.md`](adr/ADR-003-rls-e-modelo-permissoes.md)
	- ADR-006 (Separação Comunicação e Notificações): [`adr/ADR-006-separacao-comunicacao-notificacoes.md`](adr/ADR-006-separacao-comunicacao-notificacoes.md)
	- ADR-007 (Estratégia de Entrega de Notificações): [`adr/ADR-007-estrategia-entrega-notificacoes.md`](adr/ADR-007-estrategia-entrega-notificacoes.md)
	- ADR-008 (Uso de Eventos de Domínio): [`adr/ADR-008-eventos-dominio.md`](adr/ADR-008-eventos-dominio.md)
	- ADR-010 (Intercessão: Redirecionamento Inteligente vs Automação): [`adr/ADR-010-intercessao-redirecionamento-inteligente.md`](adr/ADR-010-intercessao-redirecionamento-inteligente.md)

## Como navegar
- Use os links acima para chegar diretamente ao tópico.
- Diagramas estão em Mermaid e podem ser visualizados aqui ou importados no Notion.
- Decisões técnicas referenciam os ADRs correspondentes.
