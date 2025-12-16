# ADR-006 — Separação entre Comunicação e Notificações

## Status
Aceito

## Contexto

O sistema possui funcionalidades relacionadas a envio de informações aos usuários, que podem ser interpretadas de duas formas distintas:

- **Mensagens criadas manualmente por usuários** (avisos, comunicados, conteúdos editoriais)
- **Alertas automáticos disparados pelo sistema** em resposta a eventos

Durante a evolução da documentação e do sistema, ficou evidente o risco de confundir esses dois conceitos, tanto em nível de produto quanto de arquitetura, o que poderia gerar:

- Documentação ambígua e imprecisa
- Sobreposição de responsabilidades técnicas
- Decisões incorretas sobre canais, persistência e autorização
- Dificuldade de manutenção e evolução futura
- Confusão em diagramas e fluxos de usuário

## Decisão

Foi definida a **separação formal entre dois módulos distintos**:

### 1. Comunicação

Responsável exclusivamente por **conteúdo criado manualmente por usuários**.

**Características:**
- Mensagens editoriais ou administrativas criadas por liderança/secretaria
- Conteúdo intencional, revisado e editorial
- Criação, edição, publicação e exclusão manual via interface do usuário
- Público definido pelo usuário via flags de canal (`exibir_app`, `exibir_telao`, `exibir_site`)
- Agendamento manual de período de exibição (`data_inicio`, `data_fim`)
- Pode existir indefinidamente sem gerar qualquer notificação automática
- Suporta vínculo opcional com cultos ou mídias da biblioteca

**Exemplos de uso:**
- Publicar aviso sobre mudança de horário de culto
- Exibir banner de comunicado especial no telão
- Avisar sobre evento da igreja via app

**Não faz:**
- Disparo automático de notificações push ou WhatsApp
- Envio de e-mails ou mensagens automáticas
- Segmentação por perfil de usuário (é público por canal)

### 2. Notificações

Responsável exclusivamente por **disparos automáticos do sistema**.

**Características:**
- Disparo imediato baseado em eventos do sistema (novo visitante, conta a pagar, check-in kids, etc.)
- Conteúdo padronizado ou template com substituição de variáveis
- Destinatários definidos automaticamente por cargo/role via `notificacao_regras`
- Não possui editor manual de mensagens ou conteúdo
- Não envolve rascunho, aprovação ou publicação manual
- Entrega multi-canal configurável (in-app, push, WhatsApp)
- Sincronização em tempo real via Supabase Realtime
- Histórico de envio e status (lido/não lido)

**Exemplos de uso:**
- Notificar admin quando novo visitante é cadastrado
- Alertar tesoureiro sobre conta a pagar vencendo
- Avisar líderes sobre check-in ou ocorrência no Kids
- Perguntar ao membro sobre seu sentimento diário

**Não faz:**
- Criação manual de mensagens
- Edição de conteúdo da notificação (templates são fixos)
- Segmentação arbitrária ou campanhas de marketing
- Workflow de aprovação ou estados intermediários (rascunho/revisão)

## Relação entre os módulos

### Independência
- O módulo **Comunicação** pode **opcionalmente atuar como origem de eventos** para o módulo Notificações.
  - *Exemplo:* publicação de um comunicado importante poderia gerar uma notificação automática para admins ou líderes.
- O módulo **Notificações não depende da existência** do módulo Comunicação — ambos funcionam de forma completamente independente.

### Integração
- Os módulos **não compartilham responsabilidades**, apenas se integram por eventos.
- Cada módulo mantém sua própria persistência (`comunicados` vs. `notifications`), regras de autorização (RLS) e ciclo de vida.
- A separação permite evolução independente sem impacto cruzado.

## Consequências

### Positivas
✅ **Clareza conceitual** entre produto (o que comunica vs. o que notifica) e arquitetura  
✅ **Documentação mais precisa** e auditável (guias de usuário, diagramas, funcionalidades)  
✅ **Redução de acoplamento** entre módulos — cada um com seu próprio propósito claro  
✅ **Facilidade de evolução independente** — mudanças em um não afetam o outro  
✅ **Prevenção de confusão** em diagramas, RLS policies e decisões futuras  
✅ **Modelos de dados separados** — `comunicados` e `notifications` com estruturas apropriadas  
✅ **Canais de entrega distintos** — Comunicação (app/telão/site) vs. Notificações (in-app/push/WhatsApp)

### Negativas
⚠️ **Necessidade de documentação separada** para cada módulo  
⚠️ **Maior cuidado ao modelar integrações** entre módulos (quando um dispara eventos do outro)  
⚠️ **Educação do usuário** sobre qual módulo usar em cada situação

## Documentação relacionada

- [Documentação de Produto — Comunicação](../produto/README_PRODUTO.MD#comunicação-visão-de-produto)
- [Documentação de Produto — Notificações](../produto/README_PRODUTO.MD#notificações-visão-de-produto)
- [Manual do Usuário — Comunicação (seção 9)](../manual-usuario.md#9-comunicação)
- [Manual do Usuário — Notificações (seção 10)](../manual-usuario.md#10-notificações)
- [Funcionalidades — Módulo Comunicação](../funcionalidades.md#módulo-comunicação)
- [Funcionalidades — Módulo Notificações](../funcionalidades.md#módulo-notificações)
- [Arquitetura — Módulo Comunicação](../01-Arquitetura/01-arquitetura-geral.MD#módulo-comunicação-visão-técnica)
- [Arquitetura — Módulo Notificações](../01-Arquitetura/01-arquitetura-geral.MD#módulo-notificações-visão-técnica)
- [Database ER Diagram — Comunicação](../database-er-diagram.md#comunicação--entidades-e-relações)
- [Database ER Diagram — Notificações](../database-er-diagram.md#notificações--entidades-e-relações)
- [Diagrama de Fluxo — Comunicação](../diagramas/fluxo-comunicacao.md)
- [Diagrama de Sequência — Comunicação](../diagramas/sequencia-comunicacao.md)
- [Diagrama de Fluxo — Notificações](../diagramas/fluxo-notificacoes.md)
- [Diagrama de Sequência — Notificações](../diagramas/sequencia-notificacoes.md)

## Relação com ADRs anteriores

- **ADR-001** ([Separação Fato Gerador vs. Caixa vs. DRE](./ADR-001-separacao-fato-gerador-caixa-dre.md)): Similar em conceito — separação clara entre conceitos diferentes (fato gerador, caixa, relatório) para evitar confusão. ADR-006 aplica o mesmo padrão para Comunicação e Notificações.
- **ADR-003** ([RLS e Modelo de Permissões](./ADR-003-rls-e-modelo-permissoes.md)): Complementa com RLS policies específicas para `comunicados` (admin/secretaria) e `notifications` (por usuário).
- **ADR-005** ([Responsáveis Autorizados na Família](./ADR-005-responsaveis-autorizados-familia.md)): Padrão de separação de conceitos — assim como Comunicação ≠ Notificações, Responsável Legal ≠ Autorizado.
