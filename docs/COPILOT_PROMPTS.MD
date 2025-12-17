Guard-rails (Repo):

- Não mover, renomear ou apagar arquivos/pastas existentes em /docs
- Apenas COMPLEMENTAR docs existentes
- Não duplicar conteúdo: prefira linkar para documentos já existentes
- Diagramas sempre em Mermaid (em docs/diagramas/)
- ADR só quando houver decisão (trade-off) clara
- Não inventar funcionalidades/telas/integrações: se não houver evidência no código/docs, marque "(a confirmar)"
- Sempre usar links relativos
- Saída final pronta para commit


Guard-rails (Separação Comunicação x Notificações):

Comunicação (comunicados/publicacao) e Notificações são coisas diferentes.

Comunicação:
- criação manual de comunicados/avisos/publicações
- conteúdo editorial/administrativo
- público/visibilidade definida manualmente (se existir)
PROIBIDO: triggers automáticos, retries, logs de envio, eventos de sistema

Notificações:
- disparo automático baseado em evento do sistema
- destinatários automáticos
- templates padronizados (se existirem)
PROIBIDO: editor de conteúdo, rascunho/publicação, público manual

Se existir integração, escrever explicitamente:
"Comunicação pode gerar evento para Notificações", sem misturar responsabilidades.


Antes de escrever qualquer doc do módulo:
1) Liste evidências no repo (paths em src/pages e src/components, e se houver em src/integrations)
2) Só então documente com base nessas evidências.
Se algo não estiver provado, marque "(a confirmar)" e não invente.

