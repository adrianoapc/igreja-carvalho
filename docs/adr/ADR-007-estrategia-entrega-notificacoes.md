# ADR-007 — Estratégia de Entrega de Notificações

## Status
Aceito (com débitos técnicos)

## Contexto

O módulo de Notificações dispara alertas automáticos baseado em eventos do sistema.
Essas notificações são entregues via múltiplos canais (in-app, push, WhatsApp).

Era necessário definir uma estratégia para:
- **Quando disparar**: sincronamente ou assincronamente?
- **Como registrar**: garantir auditoria?
- **Como tratar falhas**: estratégia de resiliência?
- **Como evitar duplicidade**: garantir idempotência?

## Decisão

Adotar uma estratégia baseada nos seguintes princípios:

### Disparo Assíncrono
- Notificações são disparadas via **Edge Function** (`disparar-alerta`)
- A função é **assíncrona por design**: não bloqueia o fluxo principal do usuário
- A ação que dispara a notificação (ex: criar visitante, salvar fato financeiro) **não depende do sucesso da notificação**
- Falhas de entrega **não retornam erro** ao usuário que realizou a ação

### Entrega Multi-Canal
- Sistema suporta 3 canais:
  - **In-App**: INSERT em tabela `notifications` (sempre síncrono)
  - **WhatsApp**: POST para Meta API (direct) ou Make webhook (com fallback)
  - **Push**: placeholder para futuro (OneSignal/Expo/Firebase)
- Cada canal é independente: falha em um não afeta outros

### Registro Atual (Status Quo)
- ✅ Logs via `console.log()` na Edge Function
- ✅ Persistência parcial: in-app notificações salvas em `notifications` table
- ❌ Não há tabela `notification_logs` para auditoria completa
- ❌ Não há registro de tentativas WhatsApp/Push (falhas, sucessos, timestamp)

### Resiliência Atual (Status Quo)
- ✅ Try-catch geral na função
- ✅ Error handling por canal (não falha função se WhatsApp falhar)
- ❌ Não há retry automático
- ❌ Não há deadletter queue para falhas críticas
- ❌ Não há exponential backoff

### Idempotência Atual (Status Quo)
- ✅ In-app: Edge Function gera novo UUID a cada INSERT (sem deduplicação)
- ❌ WhatsApp/Push: sem mecanismo para detectar duplicatas
- ⚠️ Se `disparar-alerta` for chamada 2x com mesmo payload, gerará 2 notificações

## Débitos Técnicos (Roadmap Futuro)

### 1. Tabela de Auditoria (`notification_logs`)
**Quando implementar:** próxima sprint  
**O quê:**
```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY,
  notificacao_id UUID,
  event_slug TEXT,
  user_id UUID,
  canal VARCHAR(50), -- 'inapp', 'whatsapp', 'push'
  status VARCHAR(20), -- 'enviado', 'falha', 'pendente'
  erro_mensagem TEXT,
  tentativa_numero INT DEFAULT 1,
  proxima_tentativa TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Por quê:** auditoria completa, troubleshooting, analytics

### 2. Retry Strategy com Exponential Backoff
**Quando implementar:** Q2 2026  
**O quê:** 
- Guardar tentativas falhadas em `notification_logs`
- Cron job que reprocessa falhas com delay exponencial (1s, 2s, 4s, 8s...)
- Limite de 5 tentativas por notificação

**Por quê:** aumentar taxa de entrega, especialmente para WhatsApp/Push

### 3. Deduplicação Inteligente
**Quando implementar:** Q2 2026  
**O quê:**
- Gerar hash da notificação: `sha256(evento_slug + user_id + timestamp_minuto)`
- Antes de INSERT, verificar se hash existe em últimos 5 minutos
- Previne duplicatas de chamadas simultâneas à Edge Function

**Por quê:** évitar notificações duplicadas em caso de retry manual ou erro de network

### 4. Observabilidade (Monitoring)
**Quando implementar:** Q1 2026  
**O quê:**
- Dashboard com métricas: total disparadas, taxa de sucesso por canal, erros frequentes
- Alertas para taxa de falha > 10%

**Por quê:** visibilidade operacional, detecção rápida de problemas

## Consequências

### Positivas
✅ **Experiência do usuário não bloqueada**: ações completam mesmo se notificação falhar  
✅ **Arquitetura escalável**: Edge Function pode processar múltiplos canais em paralelo  
✅ **Flexibilidade de canais**: fácil adicionar novos (SMS, email, etc.)  
✅ **Resiliência básica**: erros em um canal não cascata para outros

### Negativas
⚠️ **Sem garantia de entrega**: notificações perdidas se função falhar  
⚠️ **Sem auditoria completa**: difícil debugar por quê uma notificação falhou  
⚠️ **Risco de duplicatas**: chamadas simultâneas podem gerar múltiplas notificações  
⚠️ **Sem retry automático**: dependências externas (Meta API) não são toleradas a curto prazo

## Mitigação dos Negativos

| Risco | Mitigação Curto Prazo | Solução Futuro |
|-------|----------------------|-----------------|
| Sem garantia de entrega | Monitorar logs; retry manual | ADR-007.2: Retry automático |
| Sem auditoria | Console logs; testes manuais | ADR-007.1: Tabela `notification_logs` |
| Risco de duplicatas | Validar no frontend antes de chamar | ADR-007.3: Deduplicação por hash |
| Sem observabilidade | Alertas ad-hoc via logs | ADR-007.4: Dashboard de métricas |

## Documentação relacionada

- [ADR-006 — Separação entre Comunicação e Notificações](./ADR-006-separacao-comunicacao-notificacoes.md)
- [Funcionalidades — Módulo Notificações](../funcionalidades.md#módulo-notificações)
- [Arquitetura — Módulo Notificações](../01-Arquitetura/01-arquitetura-geral.MD#módulo-notificações-visão-técnica)
- Edge Function `disparar-alerta`: `supabase/functions/disparar-alerta/index.ts`

### Escopo e Fronteira com Comunicação
- Mensagens operacionais sobre **pagamentos/financeiro** (ex.: cobrança ou confirmação de pagamento de cursos) devem seguir o módulo de **Comunicação** ou o fluxo financeiro, conforme ADR-006; o módulo de Notificações não deve ser usado para avisos editoriais ou institucionais.
- Caso seja necessário futuramente disparar alerta automático de pagamento, registrar nova ADR especificando canal, template e critérios de disparo (a confirmar).

## Próximos Passos

1. **Curto prazo** (próximas 2 sprints):
   - [ ] Criar tabela `notification_logs` (ADR-007.1)
   - [ ] Atualizar `disparar-alerta` para registrar tentativas
   - [ ] Criar dashboard básico de métricas

2. **Médio prazo** (próximo trimestre):
   - [ ] Implementar retry com exponential backoff (ADR-007.2)
   - [ ] Implementar deduplicação por hash (ADR-007.3)
   - [ ] Integrar OneSignal/Firebase para push notifications

3. **Longo prazo** (próximos 6 meses):
   - [ ] Full observability stack (alertas, traçabilidade)
   - [ ] Dead letter queue para notificações críticas
   - [ ] Suporte a SMS e email
