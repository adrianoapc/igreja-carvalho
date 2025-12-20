# Diagrama de Fluxo — Módulo Notificações

Este diagrama representa o fluxo completo de **notificações automáticas** do sistema, desde o evento disparador até a entrega multi-canal.

## Fluxo Geral

```mermaid
flowchart TD
    Start([Evento Ocorre no Sistema]) --> CheckEvent{Evento<br/>Cadastrado?}
    
    CheckEvent -->|Não| End1([Ignora])
    CheckEvent -->|Sim| GetRules[Buscar Regras Ativas<br/>notificacao_regras]
    
    GetRules --> HasRules{Regras<br/>Encontradas?}
    
    HasRules -->|Não| End2([Nenhuma Notificação])
    HasRules -->|Sim| ResolveRecipients[Resolver Destinatários<br/>por Role ou User ID]
    
    ResolveRecipients --> FormatTemplate[Formatar Mensagem<br/>Substituir Variáveis]
    
    FormatTemplate --> DeliveryLoop{Para cada<br/>Destinatário}
    
    DeliveryLoop --> CheckChannels{Canais<br/>Ativos?}
    
    CheckChannels --> InApp{In-App<br/>Ativo?}
    InApp -->|Sim| InsertNotification[INSERT em<br/>notifications<br/>tabela]
    InsertNotification --> RealtimeSync[Realtime Sync<br/>Supabase]
    RealtimeSync --> UpdateBell[Atualizar Sininho<br/>no Frontend]
    
    CheckChannels --> Push{Push<br/>Ativo?}
    Push -->|Sim| SendPush[Enviar Push<br/>via Browser API]
    SendPush --> ShowBrowserNotif[Exibir Notificação<br/>no Navegador/Celular]
    
    CheckChannels --> WhatsApp{WhatsApp<br/>Ativo?}
    WhatsApp -->|Sim| CheckProvider{Provider?}
    CheckProvider -->|meta_direto| MetaAPI[Enviar via<br/>Meta API]
    CheckProvider -->|make| MakeWebhook[Enviar via<br/>Make Webhook]
    
    InApp -->|Não| SkipInApp[Pular In-App]
    Push -->|Não| SkipPush[Pular Push]
    WhatsApp -->|Não| SkipWhatsApp[Pular WhatsApp]
    
    UpdateBell --> NextRecipient
    ShowBrowserNotif --> NextRecipient
    MetaAPI --> NextRecipient
    MakeWebhook --> NextRecipient
    SkipInApp --> NextRecipient
    SkipPush --> NextRecipient
    SkipWhatsApp --> NextRecipient
    
    NextRecipient{Mais<br/>Destinatários?}
    NextRecipient -->|Sim| DeliveryLoop
    NextRecipient -->|Não| End3([Fim: Notificações Disparadas])
    
    style Start fill:#e1f5ff
    style End1 fill:#ffe1e1
    style End2 fill:#fff4e1
    style End3 fill:#e1ffe1
    style CheckEvent fill:#fff9e1
    style HasRules fill:#fff9e1
    style CheckChannels fill:#f0e1ff
    style InApp fill:#f0e1ff
    style Push fill:#f0e1ff
    style WhatsApp fill:#f0e1ff
    style CheckProvider fill:#f0e1ff
```

## Fluxo de Configuração (Admin)

```mermaid
flowchart TD
    AdminStart([Admin Acessa<br/>/admin/notificacoes]) --> LoadData[Carregar:<br/>- notificacao_eventos<br/>- notificacao_regras]
    
    LoadData --> DisplayCards[Exibir Cards<br/>por Evento]
    
    DisplayCards --> AdminAction{Ação do Admin}
    
    AdminAction -->|Adicionar Destinatário| OpenDialog[Abrir Dialog<br/>Selecionar Role]
    OpenDialog --> SelectRole[Admin Escolhe<br/>Role/Cargo]
    SelectRole --> CreateRule[INSERT em<br/>notificacao_regras<br/>canais padrão]
    CreateRule --> ReloadData
    
    AdminAction -->|Toggle Canal| UpdateChannel[UPDATE canais<br/>na regra específica]
    UpdateChannel --> ReloadData
    
    AdminAction -->|Remover Destinatário| ConfirmDelete{Confirmar<br/>Exclusão?}
    ConfirmDelete -->|Sim| DeleteRule[DELETE regra]
    DeleteRule --> ReloadData
    ConfirmDelete -->|Não| DisplayCards
    
    ReloadData[Recarregar Dados] --> DisplayCards
    
    style AdminStart fill:#e1f5ff
    style LoadData fill:#fff4e1
    style DisplayCards fill:#e1ffe1
    style AdminAction fill:#fff9e1
    style CreateRule fill:#ffe1f5
    style UpdateChannel fill:#ffe1f5
    style DeleteRule fill:#ffe1e1
```

## Fluxo de Consumo (Usuário Final)

```mermaid
flowchart TD
    UserStart([Usuário Logado<br/>no Sistema]) --> SubscribeRealtime[useNotifications Hook<br/>Subscreve Realtime]
    
    SubscribeRealtime --> WaitEvent{Nova Notificação<br/>Inserida?}
    
    WaitEvent -->|Sim| ReceiveNotif[Recebe via<br/>Realtime Channel]
    ReceiveNotif --> UpdateState[Atualiza Estado<br/>notifications array]
    UpdateState --> UpdateBadge[Atualiza Badge<br/>unreadCount++]
    UpdateBadge --> CheckPushPref{Push<br/>Habilitado?}
    
    CheckPushPref -->|Sim| ShowPush[Exibir Push<br/>no Navegador]
    CheckPushPref -->|Não| SkipPush[Apenas In-App]
    
    ShowPush --> WaitEvent
    SkipPush --> WaitEvent
    
    WaitEvent -->|Usuário Clica Sininho| OpenPopover[Abrir Popover<br/>Lista de Notificações]
    
    OpenPopover --> UserInteraction{Interação}
    
    UserInteraction -->|Clica Notificação| MarkRead[UPDATE read = true]
    MarkRead --> Redirect[Redirecionar<br/>Deep Link]
    Redirect --> WaitEvent
    
    UserInteraction -->|Clica 'Limpar'| MarkAllRead[UPDATE all<br/>read = true]
    MarkAllRead --> ClearBadge[unreadCount = 0]
    ClearBadge --> WaitEvent
    
    UserInteraction -->|Clica Lixeira| DeleteNotif[DELETE notificação]
    DeleteNotif --> WaitEvent
    
    style UserStart fill:#e1f5ff
    style SubscribeRealtime fill:#fff4e1
    style WaitEvent fill:#fff9e1
    style MarkRead fill:#e1ffe1
    style MarkAllRead fill:#e1ffe1
    style DeleteNotif fill:#ffe1e1
```

## Fluxo: Notificações Gabinete Digital (Atendimentos Pastorais)

> **Novo (ADR-014)**: Notificações de atendimentos pastorais com integração ao Gabinete Digital.

```mermaid
flowchart TD
    EventStart([Novo Atendimento em<br/>atendimentos_pastorais]) --> DetectGravidade{Gravidade?}
    
    DetectGravidade -->|CRÍTICA| CriticalPath["Dispatch Imediato:<br/>1. WhatsApp Pastor<br/>2. Notificação In-App<br/>3. Badge Urgente"]
    DetectGravidade -->|MEDIA/ALTA| PassivePath["Dispatch Passivo:<br/>1. Notificação In-App<br/>2. Aparece no Gabinete<br/>3. Badge Normal"]
    DetectGravidade -->|BAIXA| LowPath["Apenas Visibilidade<br/>no Gabinete"]
    
    CriticalPath --> SendWhatsApp["Meta API / Make<br/>→ Pastor via WhatsApp"]
    SendWhatsApp --> InsertGabinetNotif["INSERT em notifications<br/>tipo=atendimento_pastoral<br/>related_id=atendimento_id"]
    
    PassivePath --> InsertGabinetNotif
    LowPath --> UpdateGabinetOnly["Update atendimentos_pastorais<br/>notificado=false"]
    
    InsertGabinetNotif --> SyncRealtime["Realtime Sync<br/>para Pastor"]
    SyncRealtime --> UpdateGabineteDashboard["Atualiza Gabinete Dashboard:<br/>1. Novo Card no Kanban<br/>2. Badge contador<br/>3. Status=PENDENTE"]
    
    UpdateGabinetOnly --> UpdateGabineteDashboard
    
    UpdateGabineteDashboard --> PastorReceives["Pastor Visualiza<br/>no Gabinete"]
    PastorReceives --> PastorAction{Ação}
    
    PastorAction -->|Clica Card| OpenProntuario["Abre Prontuário<br/>5 Tabs: Geral/Histórico/Notas/Agendamento/IA"]
    OpenProntuario --> UpdateStatus["Marca como<br/>EM_ACOMPANHAMENTO"]
    
    PastorAction -->|Agenda Atendimento| BookSchedule["Cria evento em<br/>view_agenda_secretaria"]
    BookSchedule --> ChangeStatus2["Status → AGENDADO"]
    
    PastorAction -->|Finaliza| ChangeStatus3["Status → CONCLUÍDO<br/>Arquiva Prontuário"]
    
    UpdateStatus --> MarkNotifRead["UPDATE notifications<br/>read=true"]
    BookSchedule --> MarkNotifRead
    ChangeStatus3 --> MarkNotifRead
    
    MarkNotifRead --> End([Fim: Atendimento Processado])
    
    style EventStart fill:#ffe1e1
    style DetectGravidade fill:#ffe1e1
    style CriticalPath fill:#f8d7da
    style PassivePath fill:#fff3cd
    style LowPath fill:#e2e3e5
    style SendWhatsApp fill:#f8d7da
    style InsertGabinetNotif fill:#d1ecf1
    style UpdateGabineteDashboard fill:#d4edda
    style PastorReceives fill:#d4edda
    style End fill:#e2e3e5
```

## Observações

### Componentes Principais
- **Edge Function**: `disparar-alerta` (função central de disparo)
- **Frontend**: `NotificationBell.tsx`, `useNotifications.tsx`
- **Admin**: `Notificacoes.tsx` (configuração de regras)
- **Tabelas**: `notifications`, `notificacao_eventos`, `notificacao_regras`

### Decisões Importantes
- **Disparo Imediato**: notificações não têm fila ou agendamento; são disparadas imediatamente ao evento
- **Multi-Canal**: sistema suporta 3 canais simultâneos (in-app, push, WhatsApp) configuráveis por regra
- **Resolução de Destinatários**: baseado em `role` (cargo) via `user_roles` table ou `user_id_especifico`
- **Templates Automáticos**: mensagens são geradas via substituição de variáveis `{{chave}}` no template do evento
- **Sem Estados Intermediários**: notificações são sempre finais (criadas → lidas/não lidas → excluídas)

### Integrações Externas
- **Meta API**: WhatsApp via Meta Business API (provider = `meta_direto`)
- **Make/n8n**: WhatsApp via webhooks (provider = `make`)
- **Browser API**: Push notifications via `Notification` API do navegador

### Referências
- **Produto**: [docs/produto/README_PRODUTO.MD](../produto/README_PRODUTO.MD#notificações-visão-de-produto)
- **Manual**: [docs/manual-usuario.md](../manual-usuario.md#10-notificações)
- **Funcionalidades**: [docs/funcionalidades.md](../funcionalidades.md#módulo-notificações)
- **Gabinete Digital**: [docs/funcionalidades.md#4-gabinete-digital-e-cuidado-pastoral](../funcionalidades.md#4-gabinete-digital-e-cuidado-pastoral)
- **Fluxo Gabinete**: [fluxo-gabinete-pastoral.md](fluxo-gabinete-pastoral.md)
- **ADR-014**: [docs/adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md](../adr/ADR-014-gabinete-digital-e-roteamento-pastoral.md)
- **Sequência**: [sequencia-notificacoes.md](sequencia-notificacoes.md)
