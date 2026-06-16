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

---

## Guard-rails adicionais (fundido de COPILOT_PROMPTS.MD)

> Original em `docs/_archive/_fundidos/COPILOT_PROMPTS.MD`.

### Guard-rails gerais do repo

- Não mover, renomear ou apagar arquivos/pastas existentes em /docs sem aprovação
- Apenas COMPLEMENTAR docs existentes; não duplicar conteúdo — prefira links relativos
- Diagramas sempre em Mermaid (`docs/diagramas/`)
- ADR só quando houver decisão com trade-off claro
- **Nunca inventar** funcionalidades/telas/integrações sem evidência no código — marcar `(a confirmar)`
- Saída final pronta para commit

### Separação Comunicação × Notificações (regra-chave)

**Comunicação** (`/comunicados`, `/publicacao`):
- Criação manual de comunicados/avisos; conteúdo editorial; visibilidade definida manualmente
- PROIBIDO: triggers automáticos, retries, logs de envio, eventos de sistema

**Notificações**:
- Disparo automático baseado em evento; destinatários automáticos; templates padronizados
- PROIBIDO: editor de conteúdo, rascunho/publicação, público manual

Se existir integração, escrever explicitamente:
> "Comunicação pode gerar evento para Notificações" — sem misturar responsabilidades.

### Antes de documentar qualquer módulo

1. Listar evidências no repo (paths em `src/pages`, `src/components`, `src/integrations`)
2. Só então documentar com base nessas evidências
3. Se algo não estiver provado, marcar `(a confirmar)` — não inventar
