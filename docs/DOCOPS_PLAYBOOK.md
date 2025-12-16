# DocOps Playbook

## Regras
- Não mover/renomear arquivos em `docs/`
- Complementar docs existentes
- Diagramas sempre em Mermaid
- ADR somente quando houver decisão (trade-off)

## Checklist por módulo
1. Produto: `docs/produto/README_PRODUTO.MD`
2. Funcionalidades: `docs/funcionalidades.md`
3. Manual do usuário: `docs/manual-usuario.md`
4. Diagramas: `docs/diagramas/*.md`
5. Arquitetura: `docs/01-Arquitetura/01-arquitetura-geral.MD`
6. Banco: `docs/database-er-diagram.md` + `docs/database-schema.sql`
7. ADR: `docs/adr/`

## Separação conceitual
- Comunicação = criação manual de mensagens
- Notificações = disparo automático por evento
