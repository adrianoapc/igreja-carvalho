# ADR-019: Relógio de Oração 24h com Timeline Visual e Conteúdo Inteligente

**Status**: Aceito  
**Data**: 30 de Dezembro de 2025  
**Contexto**: Expansão do Hub de Eventos para suportar Relógios de Oração (eventos de 24h+) com gerenciamento visual de turnos e conteúdo dinâmico agregado por IA.

---

## Problema

Relógios de Oração são eventos únicos que diferem de cultos tradicionais:

1. **Duração estendida**: 24h, 48h, 7 dias (não apenas 2-3 horas)
2. **Múltiplos turnos**: Voluntários em horários específicos (ex: 14h-16h)
3. **Conteúdo vivo**: Slides são preenchidos em tempo real com dados da igreja (testemunhos, sentimentos, visitantes, pedidos)
4. **Interface imersiva**: Full-screen escuro para projeção em telas grandes
5. **Gerenciamento visual**: Grid de 24h muito mais claro que lista de escalas tradicional

**Desafio**: Como suportar esses requisitos sem duplicar lógica e mantendo a arquitetura polimórfica de eventos?

---

## Solução Adotada

### 1. Tipo de Evento Polimórfico

- Adicionar `tipo = 'RELOGIO'` como enum existente (`CULTO | RELOGIO | TAREFA | EVENTO | OUTRO`)
- Tabs condicionais: Quando tipo = RELOGIO, exibir Timeline em lugar de EscalasTabContent
- Reutilizar table `escalas` (já com `evento_id`)

### 2. Componentes Específicos para RELOGIO

#### EscalaTimeline.tsx

- Grid visual de 24 horas
- Cards com voluntários coloridos (verde=confirmado, amarelo=pendente, cinza=vazio, azul=hora atual)
- DatePicker para navegar dias
- Menu dropdown com ações (Editar, Duplicar, Remover)

#### AdicionarVoluntarioSheet.tsx

- Sheet (não dialog) com:
  - Busca de voluntário (combobox autocomplete)
  - Seleção de horário
  - **Recorrência**: 4 tipos (None/Daily/Weekly/Custom)
  - Detecção de conflitos automática
  - Batch insert de múltiplas escalas

#### Player.tsx (/oracao/player/:escalaId)

- Interface full-screen para projeção
- 8 tipos de slides (VERSICULO, VIDEO, AVISO, TIMER, PEDIDOS, CUSTOM_TESTEMUNHO, CUSTOM_SENTIMENTO, CUSTOM_VISITANTES)
- Botão "Orei" para marcar intercessão (persiste em `pedidos_oracao`)
- Carregamento de histórico de pedidos orados

### 3. Conteúdo Inteligente (Edge Function)

#### playlist-oracao/index.ts

Quando `evento_id` é fornecido, Edge Function:

1. Busca liturgia (itens manuais: VERSICULO, VIDEO, etc.)
2. Agrega dados inteligentes:
   - **Testemunhos**: Últimos 3 públicos
   - **Alerta Espiritual**: Análise de sentimentos (crítico se 3+ negativos)
   - **Visitantes**: Últimas 7 dias
   - **Pedidos Broadcast**: Prioritários
   - **Pedidos Pessoais**: Individuais
3. Monta array de slides combinando manuais + inteligentes
4. Retorna `slides` prontos para renderização

**Impacto**: Player não precisa fazer múltiplas queries; Edge Function centraliza lógica de agregação.

### 4. Blocos Inteligentes na Liturgia

`LiturgiaItemDialog.tsx` agora aceita tipos:

- Manuais: VIDEO, VERSICULO, AVISO, TIMER, IMAGEM, PEDIDOS, QUIZ, AUDIO, TEXTO
- Inteligentes: BLOCO_TESTEMUNHO, BLOCO_SENTIMENTO, BLOCO_VISITANTE, BLOCO_PEDIDOS

Constraint de banco expandida para 14 tipos (migration `20251230000000_add_blocos_inteligentes.sql`).

### 5. Hook useLiturgiaInteligente

```typescript
const { slides, loading, error } = useLiturgiaInteligente(eventoId);
```

- Chama Edge Function `playlist-oracao` com `evento_id`
- Retorna `slides` prontos
- Player consome `slides` e renderiza automaticamente

---

## Decisões Arquiteturais

### D1: Por que Recorrência é Calculada no Frontend?

**Alternativa 1** (Frontend): Calcula array de datas, valida conflitos, faz 1 INSERT batch  
**Alternativa 2** (Backend): RPC que calcula datas + valida + insere

**Escolha**: Frontend ✅

- **Vantagem**: UX rápida (preview imediato de conflitos)
- **Vantagem**: Usuário controla/ajusta antes de persistir
- **Desvantagem**: Lógica de cálculo duplicada (mitigado por função reutilizável)

### D2: Por que Blocos Inteligentes são Separados?

**Alternativa 1**: Tudo em 1 tipo `DINAMICO` com subtipo  
**Alternativa 2**: Tipos separados (BLOCO_TESTEMUNHO, BLOCO_SENTIMENTO, etc.)

**Escolha**: Tipos separados ✅

- **Vantagem**: Clareza na UI (badges diferentes por bloco)
- **Vantagem**: RLS policies mais simples
- **Desvantagem**: Mais linhas no constraint

### D3: Por que Edge Function Retorna Slides Completos?

**Alternativa 1**: Player faz queries separadas (testemunhos, visitantes, etc.)  
**Alternativa 2**: Edge Function agrega tudo e retorna `slides` prontos

**Escolha**: Edge Function centralizada ✅

- **Vantagem**: Player fica dumb (só renderiza)
- **Vantagem**: Lógica de agregação em 1 lugar
- **Vantagem**: Menos latência (1 request vs 5+)

### D4: Por que Recorrência Não Suporta Edição em Massa?

**Alternativa 1**: Usuário edita 1 slot, opção "Aplicar a toda série"  
**Alternativa 2**: Edição é sempre individual

**Escolha**: Individual por enquanto ✅

- **Vantagem**: Simples de implementar
- **Vantagem**: Evita operações destrutivas
- **Desvantagem**: Usuário precisa remover/re-adicionar se quiser mudar padrão
- **Futuro**: Considerar bulk edit com confirmação (ADR-020?)

---

## Trade-offs

### Pros ✅

1. **Reutiliza infraestrutura de eventos** (tipo polimórfico já existe)
2. **UX visual clara** (grid de 24h > lista tradicional)
3. **Conteúdo dinâmico** (IA preenche slides automaticamente)
4. **Escalabilidade**: Suporta Relógios de 7+ dias
5. **Recorrência poderosa**: Daily/Weekly/Custom sem duplicação manual

### Contras ⚠️

1. **Migração de constraint** necessária (14 tipos é limite SQL)
2. **Cálculo de datas frontend** pode ter bugs de fuso horário
3. **Detecção de conflito é O(n×m)** (poderia otimizar com índice)
4. **Sem edição em massa** de recorrências (workaround: remover + re-adicionar)
5. **Edge Function complexa** (5 queries agregadas)

### Mitigação

- ✅ Migration com índice `idx_liturgias_evento_tipo`
- ✅ Usar `toISOString()` para datas (UTC)
- ✅ Query com AND optimizado (futuro: índice composto)
- ✅ Documentar workaround em manual do usuário
- ✅ Logs detalhados na Edge Function para debug

---

## Impacto

### Código

- **Novos componentes**: `EscalaTimeline.tsx` (374 linhas), `AdicionarVoluntarioSheet.tsx` (504 linhas), `Player.tsx` (406 linhas)
- **Novos hooks**: `useLiturgiaInteligente.ts`, `useRelogioAgora.ts`
- **Expansão Edge Function**: `playlist-oracao/index.ts` (+156 linhas originais, +100 expandidas)
- **Migrations**: 1 migration de constraint + índice
- **Total**: ~1,500 linhas de código novo

### Base de Dados

- Coluna `tipo_conteudo` em `liturgias` agora aceita 14 valores (vs 7 antes)
- Novo índice: `idx_liturgias_evento_tipo` (evento_id, tipo_conteudo)
- Sem mudanças em schema (apenas constraint)

### Performance

- **Timeline renderização**: O(24 × n_voluntarios) = rápido em JS
- **Detecção de conflitos**: O(n × m) onde n = datas, m = escalas existentes. Mitigado com índice.
- **Edge Function**: 5 queries em paralelo (via Promise.all). ~500ms esperado.

### Compatibilidade

- ✅ CULTO: Sem mudanças (tabs diferentes, Timeline não renderiza)
- ✅ TAREFA/EVENTO: Sem mudanças (tipos novos opcionais)
- ✅ RELOGIO: Novo, exclusivo deste tipo

---

## Relacionamentos com Outras ADRs

- **ADR-017**: "Refatoração Hub de Eventos" (tipo polimórfico base) ← depende
- **ADR-018**: "Estratégia de Migração cultos → eventos" (rename schema) ← depende
- **ADR-014**: "Gabinete Digital e Roteamento Pastoral" (análise de sentimentos) ← usa
- **ADR-011**: "Evolução Ministério Intercessão" (intercessores como grupo) ← usa

---

## Alternativas Consideradas e Rejeitadas

### ❌ Usar Coluna `tipo = 'VIGILIA'` em Vez de `'RELOGIO'`

- **Razão**: VIGILIA é subtipo (pode ter subtipo "Vigília 24h" ou "Vigília 48h"). RELOGIO é tipo principal.

### ❌ Criar Tabela Separada `relogios_oracoes`

- **Razão**: Viola princípio de polimorfismo; duplicaria constraints, RLS policies, triggers
- **Melhor**: Reutilizar `eventos` com `tipo = RELOGIO`

### ❌ Armazenar Datas de Recorrência Calculadas

- **Razão**: Espaço desperdiçado; difícil editar se padrão muda
- **Melhor**: Calcular no frontend quando necessário

### ❌ Hard-code Blocos Inteligentes em código

- **Razão**: Impossível customizar; quebra encapsulamento
- **Melhor**: Tipos no banco permitindo seleção via UI

---

## Próximos Passos (Futuros)

1. **ADR-020**: Edição em massa de recorrências (bulk update com confirmação)
2. **Otimização de conflitos**: Índice multi-coluna + prepared statement
3. **Suporte a fuso horário**: Persistir timezone do evento para cálculos corretos
4. **Analytics**: Rastrear "horas de oração" por voluntário/turno
5. **Exportação**: Download de roteiro com slides para impressão/offline

---

## Referências

- Funcionalidades: `docs/funcionalidades.md#funcionalidades-do-relógio-de-oração`
- Manual Usuário: `docs/manual-usuario.md#relógio-de-oração`
- Diagrama de Fluxo: `docs/diagramas/fluxo-escalas-recorrencia.md`
- CHANGELOG: `docs/CHANGELOG.md` (entrada 30 de Dez)
- Edge Function: `supabase/functions/playlist-oracao/index.ts`
- Componentes: `src/components/escalas/`, `src/pages/oracao/`, `src/hooks/`

---

## Aprovação

- **Arquiteto**: (a confirmar)
- **Data de Implementação**: 29-30 de Dezembro de 2025
- **Status Produção**: Beta (feature-flagged para usuários específicos) _(a confirmar)_
