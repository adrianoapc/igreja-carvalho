
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



✍️ PADRÃO DE DOCUMENTAÇÃO PARA CORREÇÃO (simples e poderoso)
📄 Em docs/funcionalidades.md
> 🔧 **Correção (Jan/2026)**  
> Ajustada validação de <X> para evitar <problema>.  
> Não houve mudança de uso para o usuário final.

📄 Em diagrama (se necessário)
> Nota: condição de validação ajustada para evitar duplicidade.

📄 Em ADR (quando aplicável)
## Revisão
Este ADR foi revisado para corrigir comportamento inconsistente identificado em produção.

🤖 PROMPT COPILOT — CORREÇÃO (ANTI-BUROCRACIA)

Use este prompt quando a PR for só correção:

Esta alteração é uma CORREÇÃO (bugfix).

Atualizar documentação de forma MÍNIMA e OBJETIVA:
- Registrar a correção em um documento existente do módulo
- Não criar novos diagramas ou seções grandes
- Não alterar manual do usuário, salvo se o uso mudou
- Se a correção revelar uma decisão errada, criar ou atualizar ADR

Usar linguagem curta, factual e rastreável.


