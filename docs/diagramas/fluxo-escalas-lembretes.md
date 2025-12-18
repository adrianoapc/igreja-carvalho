# Fluxo — Lembretes Automáticos de Escalas

Este diagrama representa o fluxo completo de **lembretes automáticos para escalas de voluntários**, desde a execução do cron até o envio via WhatsApp.

## Fluxo Principal

```mermaid
flowchart TD
    Start([Cron Job<br/>09:00 diário]) --> CallEdge[Chama Edge Function<br/>verificar-escalas-pendentes]
    
    CallEdge --> CheckWhatsApp{WhatsApp<br/>Habilitado?}
    
    CheckWhatsApp -->|Não| End1([Fim: WhatsApp Desativado])
    CheckWhatsApp -->|Sim| CalcWindow[Calcular Janela:<br/>24h a 48h no futuro]
    
    CalcWindow --> QueryPending[Query escalas_culto<br/>WHERE status = 'pendente'<br/>AND culto 24-48h]
    
    QueryPending --> HasPending{Escalas<br/>Pendentes?}
    
    HasPending -->|Não| End2([Fim: Nada a Enviar])
    HasPending -->|Sim| FilterAntiSpam[Filtrar Anti-Spam:<br/>ultimo_aviso_em > 24h<br/>OU NULL]
    
    FilterAntiSpam --> HasEligible{Escalas<br/>Elegíveis?}
    
    HasEligible -->|Não| End3([Fim: Já Avisados])
    HasEligible -->|Sim| LoopStart{Para cada<br/>Escala Elegível}
    
    LoopStart --> BuildMessage[Montar Mensagem:<br/>Nome, Culto, Data,<br/>Time, Posição]
    
    BuildMessage --> CallDispararAlerta[Invoke<br/>disparar-alerta]
    
    CallDispararAlerta --> SendResult{Envio<br/>OK?}
    
    SendResult -->|Sim| UpdateTimestamp[UPDATE escalas_culto<br/>ultimo_aviso_em = NOW]
    SendResult -->|Erro| LogError[Log Erro]
    
    UpdateTimestamp --> NextLoop{Mais<br/>Escalas?}
    LogError --> NextLoop
    
    NextLoop -->|Sim| LoopStart
    NextLoop -->|Não| End4([Fim: Lembretes Enviados])
    
    style Start fill:#e1f5ff
    style End1 fill:#ffe1e1
    style End2 fill:#fff4e1
    style End3 fill:#fff4e1
    style End4 fill:#e1ffe1
    style FilterAntiSpam fill:#f5e1ff
    style CallDispararAlerta fill:#fff9e1
```

## Fluxo de Disparo Manual (Admin)

```mermaid
flowchart TD
    AdminStart([Admin Clica<br/>'Notificar Escala']) --> CallDispararEscala[Chama Edge Function<br/>disparar-escala]
    
    CallDispararEscala --> FetchCulto[Buscar Dados do Culto<br/>+ Escalas Vinculadas]
    
    FetchCulto --> FormatData[Formatar:<br/>Data, Horário, Local]
    
    FormatData --> LoopVoluntarios{Para cada<br/>Voluntário Escalado}
    
    LoopVoluntarios --> FormatPhone[Limpar Telefone<br/>Remover formatação]
    
    FormatPhone --> BuildPayload[Montar Payload:<br/>nome, telefone,<br/>time, posição, data]
    
    BuildPayload --> SendWebhook[POST para<br/>MAKE_WEBHOOK_ESCALAS]
    
    SendWebhook --> UpdateAviso[UPDATE escalas_culto<br/>ultimo_aviso_em = NOW]
    
    UpdateAviso --> NextVol{Mais<br/>Voluntários?}
    
    NextVol -->|Sim| LoopVoluntarios
    NextVol -->|Não| End([Fim: Escala Notificada])
    
    style AdminStart fill:#e1f5ff
    style End fill:#e1ffe1
    style SendWebhook fill:#fff9e1
```

## Lógica Anti-Spam

```mermaid
flowchart LR
    Input[Escala Pendente] --> Check{ultimo_aviso_em?}
    
    Check -->|NULL| Eligible[✅ Elegível<br/>Nunca avisado]
    Check -->|< 24h atrás| Skip[❌ Skip<br/>Já avisado recentemente]
    Check -->|> 24h atrás| Eligible
    
    style Eligible fill:#e1ffe1
    style Skip fill:#ffe1e1
```

## Janela de Tempo

```mermaid
timeline
    title Janela de Lembretes Automáticos
    section Hoje
        09:00 : Cron executa
    section +24h
        Início da Janela : Cultos a partir daqui são notificados
    section +48h
        Fim da Janela : Cultos até aqui são notificados
    section +49h
        Fora da Janela : Não notificados pelo cron
```

## Componentes

| Componente | Tipo | Path |
|------------|------|------|
| Edge Function (Auto) | Backend | `supabase/functions/verificar-escalas-pendentes/index.ts` |
| Edge Function (Manual) | Backend | `supabase/functions/disparar-escala/index.ts` |
| Cron Job | Database | `pg_cron` via `pg_net` |
| Tabela | Database | `escalas_culto` |

## Campos Relevantes

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status_confirmacao` | TEXT | pendente, confirmado, recusado, troca_solicitada |
| `ultimo_aviso_em` | TIMESTAMPTZ | Último envio de lembrete (anti-spam) |
| `data_confirmacao` | TIMESTAMPTZ | Quando voluntário confirmou |
| `motivo_recusa` | TEXT | Justificativa se recusou |

## Configuração do Cron

```sql
-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar execução diária às 09:00
SELECT cron.schedule(
  'verificar-escalas-pendentes',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mcomwaelbwvyotvudnzt.supabase.co/functions/v1/verificar-escalas-pendentes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Referências

- [Fluxo de Cultos](fluxo-cultos.md)
- [Manual do Usuário - Escalas](../manual-usuario.md#5-escalas)
- [Funcionalidades - Escalas](../funcionalidades.md#escalas)
