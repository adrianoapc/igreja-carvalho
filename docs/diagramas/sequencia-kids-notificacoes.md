# Sequência – Notificações do Ministério Kids

Este diagrama descreve a sequência de eventos que gera e entrega notificações do Kids para os responsáveis, cobrindo os dois cenários implementados: registro de diário e confirmação de check-out. Baseado em `docs/NOTIFICACOES_KIDS.md` e no código (`useNotifications.tsx`, `NotificationBell.tsx`, triggers SQL mencionadas no guia).

```mermaid
sequenceDiagram
    actor Usuario as Usuário
    participant Frontend as Frontend (App/PWA)
    participant Supabase as Supabase (Realtime/API)
    participant DB as Banco (Postgres)
    participant Push as Notifications API (Browser)

    rect rgb(250,250,250)
    Note over Usuario,DB: Cenário 1 – Diário do Kids
    Usuario->>Frontend: Registrar diário (humor/observações)
    Frontend->>Supabase: INSERT em kids_diario
    Supabase->>DB: Executa INSERT
    DB-->>DB: Trigger notify_kids_diario() cria registro em notifications
    DB-->>Supabase: Nova linha em notifications
    Supabase-->>Frontend: Evento Realtime (INSERT em notifications)
    Frontend->>Push: Exibe push "Diário do Kids atualizado"
    Push-->>Usuario: Notificação com deep link (abre diário)
    end

    rect rgb(250,250,250)
    Note over Usuario,DB: Cenário 2 – Check-out do Kids
    Usuario->>Frontend: Confirmar check-out da criança
    Frontend->>Supabase: UPDATE em kids_checkins (checkout_at definido)
    Supabase->>DB: Executa UPDATE
    DB-->>DB: Trigger notify_kids_checkout() cria registro em notifications
    DB-->>Supabase: Nova linha em notifications
    Supabase-->>Frontend: Evento Realtime (INSERT em notifications)
    Frontend->>Push: Exibe push "Check-out confirmado"
    Push-->>Usuario: Notificação com deep link (abre checkout)
    end

    Note over Frontend: Frontend assina Realtime e usa Notifications API
```

Referência detalhada: [../NOTIFICACOES_KIDS.md](../NOTIFICACOES_KIDS.md)

Se algum componente intermediário adicional vier a ser adotado (ex.: serviço dedicado de push), ele poderá ser representado no diagrama como “Serviço de Notificações (a confirmar)”.