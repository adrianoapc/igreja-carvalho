Guard-rails (Repo):

- Não mover, renomear ou apagar arquivos/pastas existentes em /docs
- Apenas COMPLEMENTAR documentação existente
- Não duplicar conteúdo: prefira linkar para documentos já existentes
- Diagramas sempre em Mermaid
- ADR só quando houver decisão (trade-off) clara
- Não inventar funcionalidades/canais/integrations: se não houver evidência no código ou docs, marcar como "(a confirmar)"
- Sempre usar links relativos entre docs
- Saída final deve estar pronta para commit



Guard-rails (Separação Comunicação x Notificações):

Comunicação e Notificações são módulos DIFERENTES.

Comunicação:
- criação manual de mensagens/comunicados
- conteúdo editorial/administrativo
- público definido manualmente
PROIBIDO falar de: eventos automáticos, retry, logs de envio, triggers

Notificações:
- disparo automático por evento do sistema
- templates padrão
- destinatários automáticos
PROIBIDO falar de: editor de mensagens, rascunho/publicação, público manual

Se existir integração, escrever explicitamente:
"Comunicação pode disparar Notificações", sem misturar responsabilidades.


Regra: antes de escrever documentação, faça uma varredura e liste evidências no repositório.
Somente depois disso, documente. Se não encontrar evidência, marcar "(a confirmar)".
Não inferir nomes de telas, tabelas, rotas ou integrações.
