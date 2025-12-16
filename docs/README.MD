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
- Banco de Dados
	- Esquema SQL: [`database-schema.sql`](database-schema.sql)
	- Diagrama ER: [`database-er-diagram.md`](database-er-diagram.md)
	- Diagramas: [`diagramas/`](diagramas/)
- ADRs
	- Lista de ADRs: [`adr/README.MD`](adr/README.MD)
	- ADR-001 (Fato Gerador vs Caixa vs DRE): [`adr/ADR-001-separacao-fato-gerador-caixa-dre.md`](adr/ADR-001-separacao-fato-gerador-caixa-dre.md)
	- ADR-002 (Autenticação Supabase): [`adr/ADR-002-autenticacao-supabase.md`](adr/ADR-002-autenticacao-supabase.md)
	- ADR-003 (RLS e modelo de permissões): [`adr/ADR-003-rls-e-modelo-permissoes.md`](adr/ADR-003-rls-e-modelo-permissoes.md)

## Como navegar
- Use os links acima para chegar diretamente ao tópico.
- Diagramas estão em Mermaid e podem ser visualizados aqui ou importados no Notion.
- Decisões técnicas referenciam os ADRs correspondentes.
