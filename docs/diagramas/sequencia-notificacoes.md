# Diagrama de Sequência — Módulo Notificações

Este diagrama mostra a interação temporal entre os componentes do sistema de notificações, desde o disparo do evento até a entrega multi-canal.

## Fluxo Principal: Disparo de Notificação

```mermaid
sequenceDiagram
    participant Origem as Sistema Origem<br/>(Frontend/Backend)
    participant EdgeFunc as Edge Function<br/>disparar-alerta
    participant DB as Supabase DB
    participant Realtime as Supabase Realtime
    participant Frontend as Frontend<br/>useNotifications
    participant Bell as NotificationBell<br/>Component
    participant Browser as Browser<br/>Notification API
    participant WhatsApp as WhatsApp<br/>(Meta/Make)
    
    Note over Origem: Evento ocorre (ex: kids_checkin)
    
    Origem->>+EdgeFunc: POST /disparar-alerta<br/>{evento: "kids_checkin", dados: {...}}
    
    EdgeFunc->>+DB: SELECT * FROM notificacao_eventos<br/>WHERE slug = 'kids_checkin'
    DB-->>-EdgeFunc: Retorna evento config
    
    EdgeFunc->>+DB: SELECT * FROM notificacao_regras<br/>WHERE evento_slug = 'kids_checkin'<br/>AND ativo = true
    DB-->>-EdgeFunc: Retorna regras ativas
    
    Note over EdgeFunc: Resolver destinatários<br/>por role (ex: admin)
    
    EdgeFunc->>+DB: SELECT * FROM user_roles<br/>WHERE role = 'admin'
    DB-->>-EdgeFunc: Lista de user_ids
    
    EdgeFunc->>+DB: SELECT * FROM profiles<br/>WHERE id IN (...)
    DB-->>-EdgeFunc: Dados dos destinatários<br/>(nome, email, telefone)
    
    Note over EdgeFunc: Formatar template<br/>substituir {{variáveis}}
    
    loop Para cada destinatário
        
        alt Canal In-App Ativo
            EdgeFunc->>+DB: INSERT INTO notifications<br/>(user_id, title, message, type, read)
            DB-->>-EdgeFunc: Notificação criada
            
            DB->>+Realtime: Novo registro em notifications
            Realtime->>+Frontend: Realtime event (INSERT)
            Frontend->>Frontend: Adiciona ao estado local
            Frontend->>Bell: Atualiza unreadCount
            Bell->>Bell: Exibe badge vermelho
        end
        
        alt Canal Push Ativo
            EdgeFunc->>Frontend: (Via Realtime metadata)
            Frontend->>+Browser: new Notification(title, body)
            Browser-->>-Frontend: Notificação exibida
        end
        
        alt Canal WhatsApp Ativo
            alt Provider: meta_direto
                EdgeFunc->>+WhatsApp: POST Meta API<br/>{to: phone, message: text}
                WhatsApp-->>-EdgeFunc: Success/Error
            else Provider: make
                EdgeFunc->>+WhatsApp: POST Make Webhook<br/>{phone, message}
                WhatsApp-->>-EdgeFunc: Success/Error
            end
        end
        
    end
    
    EdgeFunc-->>-Origem: Response {success: true, enviadas: N}
    
    Note over Bell: Notificação visível no sininho
```

## Fluxo de Configuração: Admin Gerencia Regras

```mermaid
sequenceDiagram
    participant Admin as Admin User
    participant Page as Notificacoes.tsx
    participant Supabase as Supabase Client
    participant DB as Supabase DB
    
    Admin->>+Page: Acessa /admin/notificacoes
    
    Page->>+Supabase: SELECT * FROM notificacao_eventos
    Supabase->>+DB: Query eventos
    DB-->>-Supabase: Lista de eventos
    Supabase-->>-Page: Dados eventos
    
    Page->>+Supabase: SELECT * FROM notificacao_regras
    Supabase->>+DB: Query regras
    DB-->>-Supabase: Lista de regras
    Supabase-->>-Page: Dados regras
    
    Page->>Page: Renderiza cards agrupados<br/>por evento/categoria
    
    Note over Admin: Admin clica "+ Add" em um evento
    
    Admin->>+Page: Abrir dialog de criação
    Page->>Admin: Exibe dropdown de roles
    
    Admin->>Page: Seleciona role "tesoureiro"
    Admin->>Page: Clica "Criar"
    
    Page->>+Supabase: INSERT INTO notificacao_regras<br/>{evento_slug, role_alvo, canais, ativo}
    Supabase->>+DB: INSERT regra
    DB-->>-Supabase: Regra criada {id: uuid}
    Supabase-->>-Page: Sucesso
    
    Page->>Page: Atualiza estado local<br/>fecha dialog
    Page->>Admin: Toast: "Regra criada"
    
    Note over Admin: Admin alterna switch de canal (ex: Push)
    
    Admin->>+Page: Toggle canal "push"
    
    Page->>Page: Optimistic update<br/>inverte valor local
    
    Page->>+Supabase: UPDATE notificacao_regras<br/>SET canais = {..., push: true}<br/>WHERE id = regra_id
    Supabase->>+DB: UPDATE regra
    DB-->>-Supabase: Regra atualizada
    Supabase-->>-Page: Sucesso
    
    Page->>Admin: Toast: "Canal atualizado"
    
    Note over Admin: Admin clica na lixeira de uma regra
    
    Admin->>+Page: Confirmar exclusão
    Page->>Admin: Exibe toast de confirmação (a confirmar)
    
    Admin->>Page: Confirma
    
    Page->>+Supabase: DELETE FROM notificacao_regras<br/>WHERE id = regra_id
    Supabase->>+DB: DELETE regra
    DB-->>-Supabase: Regra removida
    Supabase-->>-Page: Sucesso
    
    Page->>Page: Remove do estado local
    Page->>Admin: Toast: "Regra excluída"
```

## Fluxo de Consumo: Usuário Visualiza e Interage

```mermaid
sequenceDiagram
    participant User as Usuário Logado
    participant Bell as NotificationBell
    participant Hook as useNotifications
    participant Supabase as Supabase Client
    participant DB as Supabase DB
    participant Realtime as Supabase Realtime
    participant Router as React Router
    
    Note over User: Usuário está navegando no app
    
    User->>+Hook: Hook inicializa ao login
    
    Hook->>+Supabase: SELECT * FROM notifications<br/>WHERE user_id = auth.uid()<br/>ORDER BY created_at DESC<br/>LIMIT 50
    Supabase->>+DB: Query notificações
    DB-->>-Supabase: Lista de notificações
    Supabase-->>-Hook: Dados iniciais
    
    Hook->>Hook: Atualiza estado:<br/>notifications array,<br/>unreadCount
    
    Hook->>+Realtime: Channel subscribe<br/>notifications:user_id=eq.{uid}
    Realtime-->>-Hook: Subscrição ativa
    
    Hook->>Bell: Passa notifications + unreadCount
    Bell->>Bell: Exibe badge se unreadCount > 0
    
    Note over DB: Nova notificação inserida<br/>por Edge Function
    
    DB->>+Realtime: INSERT event<br/>notifications table
    Realtime->>+Hook: Evento realtime (INSERT)
    Hook->>Hook: Adiciona ao estado local<br/>unreadCount++
    Hook->>Bell: Atualiza props
    Bell->>Bell: Badge vermelho pisca<br/>(animate-in zoom-in)
    
    Note over User: Usuário clica no sininho
    
    User->>+Bell: onClick sininho
    Bell->>Bell: Abre Popover<br/>renderiza lista
    
    Bell->>User: Exibe notificações<br/>(não lidas no topo)
    
    Note over User: Usuário clica em uma notificação
    
    User->>+Bell: onClick notificação
    
    Bell->>+Hook: markAsRead(notification.id)
    Hook->>+Supabase: UPDATE notifications<br/>SET read = true<br/>WHERE id = notification.id
    Supabase->>+DB: UPDATE registro
    DB-->>-Supabase: Registro atualizado
    Supabase-->>-Hook: Sucesso
    
    Hook->>Hook: Atualiza estado local<br/>unreadCount--
    Hook->>Bell: Atualiza props
    Bell->>Bell: Remove bolinha azul<br/>acinzenta notificação
    
    Bell->>+Router: navigate(deepLink)<br/>ex: /kids/dashboard
    Router-->>-Bell: Navegação realizada
    
    Bell->>User: Tela de destino exibida
    
    Note over User: Usuário clica "Limpar"
    
    User->>+Bell: onClick "Limpar"
    Bell->>+Hook: markAllAsRead()
    
    Hook->>+Supabase: UPDATE notifications<br/>SET read = true<br/>WHERE user_id = auth.uid()<br/>AND read = false
    Supabase->>+DB: UPDATE múltiplos registros
    DB-->>-Supabase: Registros atualizados
    Supabase-->>-Hook: Sucesso
    
    Hook->>Hook: Atualiza estado local<br/>unreadCount = 0
    Hook->>Bell: Atualiza props
    Bell->>Bell: Remove badge<br/>acinzenta todas
    
    Note over User: Usuário clica lixeira em notificação
    
    User->>+Bell: onClick lixeira
    Bell->>+Hook: deleteNotification(id)
    
    Hook->>+Supabase: DELETE FROM notifications<br/>WHERE id = notification.id
    Supabase->>+DB: DELETE registro
    DB-->>-Supabase: Registro removido
    Supabase-->>-Hook: Sucesso
    
    Hook->>Hook: Remove do estado local
    Hook->>Bell: Atualiza props
    Bell->>Bell: Remove da lista visual
    
    Bell-->>-User: Notificação desaparece
```

## Observações

### Componentes e Atores
- **Sistema Origem**: qualquer parte do sistema que detecta evento (frontend ao criar visitante, backend ao inserir conta a pagar, etc.)
- **Edge Function `disparar-alerta`**: orquestrador central de disparo de notificações
- **Supabase DB**: armazena eventos, regras e notificações enviadas
- **Supabase Realtime**: propaga notificações em tempo real via WebSocket
- **useNotifications Hook**: gerencia estado local, subscrição realtime e interações
- **NotificationBell Component**: UI do sininho e popover de notificações
- **Browser Notification API**: API nativa do navegador para push notifications
- **WhatsApp (Meta/Make)**: integrações externas para WhatsApp

### Decisões Arquiteturais
- **Sincronização**: operações síncronas (INSERT → Realtime → Frontend), sem filas ou workers
- **Optimistic Update**: frontend atualiza estado antes de confirmar UPDATE (melhor UX)
- **Realtime Subscription**: um único canal por usuário (`notifications:user_id=eq.{uid}`)
- **Deep Linking**: cada tipo de notificação tem rota de destino mapeada no `NotificationBell`
- **RLS**: todas operações respeitam Row Level Security (usuários só veem/atualizam suas notificações)

### Integrações Externas
- **Meta API**: WhatsApp Business API (autenticação via token, POST direto)
- **Make Webhook**: disparo via HTTP POST para workflow n8n/Make (processa envio WhatsApp)
- **Browser API**: `new Notification(title, options)` requer permissão do usuário (`Notification.requestPermission()`)

### Referências
- **Arquitetura**: [docs/01-Arquitetura/01-arquitetura-geral.MD](../01-Arquitetura/01-arquitetura-geral.MD)
- **Fluxo**: [fluxo-notificacoes.md](fluxo-notificacoes.md)
- **Funcionalidades**: [docs/funcionalidades.md](../funcionalidades.md#módulo-notificações)
- **Database**: [docs/database-er-diagram.md](../database-er-diagram.md)
