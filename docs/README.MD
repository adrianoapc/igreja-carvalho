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
- Produto
	- Guia de produto: [`produto/README_PRODUTO.MD`](produto/README_PRODUTO.MD)
	- Manual do usuário: [`manual-usuario.md`](manual-usuario.md)
	- Funcionalidades: [`funcionalidades.md`](funcionalidades.md)
 	- Kids — Inclusão e necessidades: [`KIDS_INCLUSION.md`](KIDS_INCLUSION.md)
 	- Kids — Responsáveis autorizados (guardians): [`AUTHORIZED_GUARDIANS.md`](AUTHORIZED_GUARDIANS.md)
 	- Kids — Notificações: [`NOTIFICACOES_KIDS.md`](NOTIFICACOES_KIDS.md)
 	- Manual — Ministério Infantil (Kids): [`manual-usuario.md`](manual-usuario.md)
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
- ADRs
	- Lista de ADRs: [`adr/README.MD`](adr/README.MD)
	- ADR-001 (Fato Gerador vs Caixa vs DRE): [`adr/ADR-001-separacao-fato-gerador-caixa-dre.md`](adr/ADR-001-separacao-fato-gerador-caixa-dre.md)
	- ADR-002 (Autenticação Supabase): [`adr/ADR-002-autenticacao-supabase.md`](adr/ADR-002-autenticacao-supabase.md)
	- ADR-003 (RLS e modelo de permissões): [`adr/ADR-003-rls-e-modelo-permissoes.md`](adr/ADR-003-rls-e-modelo-permissoes.md)

## Como navegar
- Use os links acima para chegar diretamente ao tópico.
- Diagramas estão em Mermaid e podem ser visualizados aqui ou importados no Notion.
- Decisões técnicas referenciam os ADRs correspondentes.
