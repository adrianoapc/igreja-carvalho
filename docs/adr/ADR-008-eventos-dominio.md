# ADR-008 — Uso de Eventos de Domínio no Sistema

## Status
Aceito (em implementação parcial)

## Contexto

O sistema possui múltiplos módulos com responsabilidades distintas
(Financeiro, Pessoas, Kids, Comunicação, Notificações, etc.).

Algumas ações em um módulo:
- geram efeitos observáveis em outros módulos
- não devem criar acoplamento direto entre módulos
- precisam ser observáveis e auditáveis
- podem futuramente disparar workflows complexos

Era necessário decidir entre:
1. **Chamadas diretas** entre módulos: `Financeiro.criar()` → chamada direta para `Notificacoes.disparar()`
2. **Padrão de Eventos de Domínio**: `FatoFinanceiroCriado` → publicado em canal global, consumido de forma independente

## Decisão

Adotar **Eventos de Domínio** como mecanismo **principal (futuro)** de integração entre módulos,
com implementação **parcial atual** via chamadas diretas à Edge Function.

### Definição de Evento de Domínio

Um evento de domínio representa **algo relevante que aconteceu no sistema**,
descrevendo um **fato passado imutável**. Exemplos:

| Módulo | Evento | Payload |
|--------|--------|---------|
| Pessoas | `PessoaCadastrada` | `{pessoa_id, nome, status, timestamp}` |
| Pessoas | `VisitanteCadastrado` | `{pessoa_id, nome, telefone, timestamp}` |
| Financeiro | `FatoFinanceiroCriado` | `{fato_id, tipo, valor, vencimento, timestamp}` |
| Financeiro | `ContaVencendo` | `{fato_id, valor, data_vencimento, dias_restantes}` |
| Kids | `CriancaCadastrada` | `{crianca_id, nome, responsavel_id, timestamp}` |
| Kids | `CheckinRealizado` | `{crianca_id, sala_id, horario, responsavel_id}` |
| Kids | `OcorrenciaRegistrada` | `{crianca_id, motivo, severidade, timestamp}` |
| Comunicacao | `ComunicadoPublicado` | `{comunicado_id, titulo, canais, timestamp}` |
| Intercessao | `PedidoOracaoCriado` | `{pedido_id, titulo, categoria, timestamp}` |

### Padrão de Nomes

Convenção: **`<Entidade><Fato Passado>`**
- ✅ `PessoaCadastrada`, `VisitanteCriado`, `FatoFinanceiroCriado`
- ❌ `CadastrarPessoa` (é um comando, não um evento)
- ❌ `PessoaCadastrar` (grammaticamente incorreto)

### Regras de Uso

1. **Eventos representam fatos imutáveis**:
   - Nunca são cancelados ou modificados
   - Uma vez publicado, é verdade no sistema
   - Timestamp é imutável

2. **O módulo publicador não conhece consumidores**:
   - `Financeiro` publica `ContaVencendo`
   - `Notificacoes` consome `ContaVencendo`, mas Financeiro **não sabe disso**
   - Novos consumidores podem ser adicionados sem modificar Financeiro

3. **Módulos reagem de forma independente**:
   - `Notificacoes` recebe `ContaVencendo` → dispara alerta para tesoureiro
   - `Auditoria` recebe `ContaVencendo` → registra em log
   - Ambos funcionam em paralelo, sem sincronização

4. **Não há chamadas de volta**:
   - Consumidor **nunca** dispara evento do publicador
   - Evita ciclos de dependência

### Status Quo (Implementação Atual)

#### ✅ Onde já usamos eventos (informalmente):

1. **Notificações são disparadas por eventos**:
   - `novo_visitante` → Edge Function `disparar-alerta` é invocada
   - `financeiro_conta_vencer` → cron job `notificar-aniversarios` dispara
   - ✅ Padrão correto, mas **sem formalização**

2. **Cron jobs geram eventos implícitos**:
   - `notificar-aniversarios`: detecta aniversários → gera evento `aniversarios`
   - `notificar-sentimentos-diario`: gera evento `sentimentos_diario`
   - ✅ Funciona, mas **sem documentação explícita**

#### ❌ Onde NÃO temos eventos:

1. **Comunicação não publica eventos**:
   - Publicar comunicado → deveria disparar `ComunicadoPublicado`
   - Atualmente: sem efeitos cascata documentados
   - Futuro: poderia disparar notificação para admins/líderes

2. **Sem integração de Financeiro com Pessoas**:
   - Novo visitante → deveria triggerar `VisitanteCadastrado`
   - Atualmente: sem efeitos cascata
   - Futuro: poderia disparar boas-vindas automáticas

3. **Sem padrão formal de publicação**:
   - Alguns eventos vão para fila (Supabase Realtime?)
   - Alguns via Edge Function
   - Alguns via cron job manual
   - **Inconsistência**: sem único canal de publicação

### Mecanismo de Publicação (A Definir)

Opções:

| Mecanismo | Pros | Contras | Status |
|-----------|------|---------|--------|
| **Supabase Realtime** | Nativo, já em uso | Baixa latência, não persistente | ⚠️ Parcial |
| **Tabela `events`** | Persistente, auditável | Overhead de IO | 📋 Débito técnico |
| **Edge Function Hook** | Flexível, escalável | Novo aprendizado | 📋 Débito técnico |
| **Message Queue (Redis/Bull)** | Resiliente, escalável | Complexidade, custo | 📋 Futuro |

**Decisão**: usar **combinação de Realtime (imediato) + Tabela `events` (auditoria)** (ver ADR-007.1)

## Débitos Técnicos

### 1. Formalizar Catálogo de Eventos
**Quando**: próxima sprint  
**O quê**: documento central `docs/EVENTOS_DOMINIO.md` listando:
- Todos os eventos do sistema
- Módulo publicador
- Consumidores (quando conhecidos)
- Payload esperado
- Timestamp de criação

**Exemplo:**
```markdown
## evento: VisitanteCadastrado
- **Publicador**: módulo Pessoas (ao salvar pessoa com status='visitante')
- **Consumidores**: Notificacoes (alertar líderes), Auditoria (log)
- **Payload**:
  {
    "pessoa_id": "uuid",
    "nome": "João Silva",
    "telefone": "+5511987654321",
    "timestamp": "2025-12-16T10:30:00Z"
  }
```

### 2. Criar Tabela `events` (Persistência de Auditoria)
**Quando**: ADR-007.1 (próxima sprint)  
**O quê**:
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(100), -- ex: 'VisitanteCadastrado'
  module_source VARCHAR(50), -- ex: 'pessoas'
  payload JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  consumed_by TEXT[] DEFAULT ARRAY[]::TEXT[] -- módulos que consumiram
);
```

**Por quê**: auditoria, replay de eventos, troubleshooting

### 3. Criar Hook de Publicação
**Quando**: Q1 2026  
**O quê**: abstração para publicar eventos:
```typescript
// Em cada módulo
async function publicarEvento(tipo: string, payload: any) {
  // Insert em 'events'
  // Publish via Realtime
  // Notificar consumidores (via Edge Function dispatcher)
}
```

**Por quê**: único ponto de entrada, consistência

### 4. Documentar Consumidores
**Quando**: durante desenvolvimento de novos eventos  
**O quê**: para cada novo evento, listar:
- Qual módulo consome
- Como reage (que ação dispara)
- Idempotência (se receber 2x, é safe?)

**Por quê**: visibilidade, facilita manutenção

## Consequências

### Positivas
✅ **Redução de acoplamento**: Notificações não precisa conhecer Financeiro  
✅ **Evolução independente**: novo consumidor sem modificar publicador  
✅ **Rastreabilidade**: auditoria completa de todos os eventos  
✅ **Testabilidade**: fácil testar módulos em isolamento  
✅ **Escalabilidade**: permite adicionar novos workflows sem impacto  
✅ **Observabilidade**: histórico completo do que aconteceu no sistema

### Negativas
⚠️ **Aumento de complexidade**: novo padrão, novo aprendizado  
⚠️ **Eventual consistency**: eventos levam tempo para propagar (não imediato)  
⚠️ **Debugging mais difícil**: cadeia de eventos pode ser não-óbvia  
⚠️ **Overhead de IO**: tabela `events` precisa de índices, cleanup periódico

## Matriz de Integração (Status Quo + Futuro)

| Publicador | Evento | Consumidor Atual | Consumidor Futuro | Status |
|------------|--------|------------------|-------------------|--------|
| **Pessoas** | `VisitanteCadastrado` | Notificações (manual) | Auditoria, CRM | ⚠️ Informal |
| **Financeiro** | `ContaVencendo` | Notificações (cron) | Relatórios, Dashboard | ⚠️ Parcial |
| **Financeiro** | `FatoFinanceiroCriado` | Nenhum | Auditoria, DRE automático | ❌ Não existe |
| **Kids** | `CriancaCadastrada` | Notificações (manual) | Comunicação (boas-vindas) | ⚠️ Manual |
| **Kids** | `CheckinRealizado` | Notificações (manual) | Dashboard, Analytics | ⚠️ Manual |
| **Kids** | `OcorrenciaRegistrada` | Notificações (manual) | Alertas pais, Auditoria | ⚠️ Manual |
| **Comunicacao** | `ComunicadoPublicado` | Nenhum | Notificações (optional) | ❌ Não existe |
| **Intercessao** | `PedidoOracaoCriado` | Notificações (manual) | Comunicação (divulgar) | ⚠️ Manual |

## Documentação relacionada

- [ADR-006 — Separação entre Comunicação e Notificações](./ADR-006-separacao-comunicacao-notificacoes.md)
- [ADR-007 — Estratégia de Entrega de Notificações](./ADR-007-estrategia-entrega-notificacoes.md)
- [Funcionalidades — Módulo Notificações](../funcionalidades.md#módulo-notificações)
- [Arquitetura Geral](../01-Arquitetura/01-arquitetura-geral.MD)

## Próximos Passos

1. **Curto prazo** (próximas 2 sprints):
   - [ ] Criar documento `docs/EVENTOS_DOMINIO.md` com catálogo de eventos
   - [ ] Formalizar payload de cada evento existente
   - [ ] Documentar consumidores atuais

2. **Médio prazo** (próximo trimestre):
   - [ ] Implementar tabela `events` para auditoria (ADR-007.1)
   - [ ] Atualizar `disparar-alerta` para ler de `events` table
   - [ ] Criar função utilitária `publicarEvento()` em cada módulo

3. **Longo prazo** (próximos 6 meses):
   - [ ] Adicionar novos eventos: `ComunicadoPublicado`, `FatoFinanceiroCriado`, etc.
   - [ ] Implementar novo consumidor: `Auditoria` (consome todos os eventos)
   - [ ] Considerar message queue (Redis) para resiliência
