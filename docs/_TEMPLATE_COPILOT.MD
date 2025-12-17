
---

# 3) Prompt único do Copilot para “fechar doc do módulo” (do jeito certo)

> Use com o arquivo do módulo aberto **ou** no Copilot Chat do repo.

## ✅ PROMPT ÚNICO — gerar doc + diagrams + links (módulo X)
```text
Aplicar o padrão de documentação do repositório para o módulo: <NOME_DO_MODULO>.

Guard-rails:
- Não mover/renomear/apagar arquivos existentes em /docs
- Apenas complementar docs existentes
- Não inventar telas/funcionalidades/integrações: se não houver evidência no código ou docs, marcar (a confirmar)
- Diagramas sempre em Mermaid e ficam em docs/diagramas/
- Não misturar Comunicação e Notificações (se o módulo envolver isso, manter escopo estrito)

Passo 1 — Descoberta (obrigatório):
Liste evidências no repo para o módulo <NOME_DO_MODULO>:
- rotas/páginas em src/pages/<modulo>/
- componentes em src/components/<modulo>/
- integrações relevantes em src/integrations/
- quaisquer docs existentes relevantes em /docs
Não inferir, apenas listar paths encontrados.

Passo 2 — Atualizar docs textuais (complemento, sem reescrever tudo):
- docs/funcionalidades.md: adicionar/atualizar seção do módulo
- docs/manual-usuario.md: adicionar/atualizar seção passo a passo do módulo
- docs/produto/README_PRODUTO.MD: adicionar visão de produto do módulo (linguagem não técnica)
- docs/01-Arquitetura/01-arquitetura-geral.MD: adicionar subseção técnica do módulo (curta)
- docs/database-er-diagram.md: adicionar subseção do módulo com tabelas existentes (base exclusiva em docs/database-schema.sql)

Passo 3 — Diagramas obrigatórios:
Criar ou atualizar:
- docs/diagramas/fluxo-<modulo>.md (flowchart)
- docs/diagramas/sequencia-<modulo>.md (sequenceDiagram)
Os diagramas devem refletir o fluxo real evidenciado no código/docs. Se algo não estiver claro, rotular (a confirmar).

Passo 4 — ADR:
Criar ADR em docs/adr/ SOMENTE se houver decisão (trade-off) clara no módulo.
Se não houver, não criar.

Passo 5 — Conectar tudo:
- Adicionar links relativos entre as seções criadas (manual ↔ funcionalidades ↔ diagramas ↔ produto ↔ arquitetura)
- Atualizar docs/README.MD adicionando links do módulo (sem duplicar ou reestruturar)
Saída pronta para commit.
