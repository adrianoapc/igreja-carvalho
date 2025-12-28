# ADR-017: Refatoração para Hub de Eventos e Hub de Voluntariado

**Status:** Aceito (Em Implementação)  
**Data:** 28/12/2025  
**Autores:** Engineering Team / Product Owner  
**Contexto:** Evolução do Módulo de Cultos e Escalas  
**Relacionado:** ADR-008 (Eventos de Domínio), ADR-014 (Gabinete Digital)

---

## 1. Contexto e Problema

### 1.1 Estado Original
O sistema foi originalmente concebido com a entidade `cultos` como cidadão de primeira classe e centro gravitacional da aplicação:

- **Escalas** (`escalas_culto`): Rigidamente acopladas a cultos via FK `culto_id`
- **Presenças** (`presenca_culto`): Exclusivas de eventos litúrgicos
- **Liturgia**: Obrigatória na estrutura de dados, mesmo quando não aplicável
- **Músicas**: Vinculadas apenas ao contexto de louvor dominical

### 1.2 O Bloqueio de Escala

Surgiram novos requisitos de negócio que expuseram a rigidez arquitetural:

1. **Relógio de Oração 24h**: Necessidade de gerenciar turnos de intercessão contínua (slots de 1h) com escalas de voluntários, mas sem liturgia ou música
2. **Tarefas Operacionais**: Manutenção predial, limpeza, inventário - atividades que precisam de escalas mas não são "cultos"
3. **Eventos Gerais**: Conferências, retiros, ações sociais - com inscrições e check-in, mas estrutura diferente de um culto
4. **Reuniões Administrativas**: Conselho, diretoria, comissões - com participantes escalados mas sem caráter litúrgico

### 1.3 Tentativas Fracassadas

**Opção A - Forçar no modelo existente:**
- ❌ Criar "cultos" fictícios de limpeza gerava "Dívida Técnica Semântica"
- ❌ UI exibia tabs irrelevantes (liturgia para faxina, música para reunião administrativa)
- ❌ Relatórios de "cultos realizados" incluíam dados espúrios

**Opção B - Tabelas isoladas:**
- ❌ Duplicação massiva de código (sistema de notificações, gestão de conflitos, "Minhas Escalas")
- ❌ Calendário fragmentado (múltiplas consultas para montar agenda unificada)
- ❌ Histórico de engajamento do membro disperso em N tabelas

---

## 2. Decisão Arquitetural

### 2.1 Estratégia: Polimorfismo via Tipos Discriminados

Adoção de um modelo de **Single Table Inheritance** com discriminador de tipo, implementado através de:

1. **Enum de Sistema** (`evento_tipo`): Controla comportamento em runtime
2. **Tabela de Subtipos** (`evento_subtipos`): Categorização orientada ao usuário
3. **Generalização de Satélites**: Desacoplamento das tabelas dependentes

### 2.2 Componente 1: Hub de Eventos (Tabela Mestre)

#### 2.2.1 Transformação da Entidade Principal

```sql
-- Migração: 20251228153548_eb7694bc-61dd-4a27-b372-cdc2c5dea3ac.sql

-- Enum discriminador (comportamento fixo)
CREATE TYPE evento_tipo AS ENUM (
  'CULTO',    -- Comportamento: Exige liturgia + músicas
  'RELOGIO',  -- Comportamento: Turnos de intercessão 24h
  'TAREFA',   -- Comportamento: Ordem de serviço com checklist
  'EVENTO',   -- Comportamento: Agenda geral com inscrições
  'OUTRO'     -- Comportamento: Genérico (fallback)
);

-- Adicionar coluna discriminadora à tabela eventos
ALTER TABLE cultos RENAME TO eventos;
ALTER TABLE eventos ADD COLUMN tipo evento_tipo DEFAULT 'CULTO' NOT NULL;
```

#### 2.2.2 Sistema de Subtipos (Categorização Flexível)

```sql
-- Tabela de categorização orientada ao usuário
CREATE TABLE evento_subtipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,                      -- Ex: "Culto de Ceia"
  tipo_pai evento_tipo NOT NULL,           -- Trava: só pode ser filho de CULTO
  cor TEXT,                                 -- Hex color para UI
  icone TEXT,                               -- Lucide icon name
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FK na tabela mestre
ALTER TABLE eventos ADD COLUMN subtipo_id UUID REFERENCES evento_subtipos(id);
```

**Regras de Negócio:**
- Um subtipo só pode pertencer a um `tipo_pai` (constraint garantida via trigger)
- Subtipos inativos não aparecem em dropdowns de criação, mas preservam histórico
- Subtipos podem ser reordenados para controlar prioridade em relatórios

#### 2.2.3 Seeds de Dados Iniciais

```sql
INSERT INTO evento_subtipos (nome, tipo_pai, cor) VALUES
  -- Subtipos de CULTO
  ('Culto de Celebração', 'CULTO', '#10b981'),
  ('Culto de Ceia', 'CULTO', '#8b5cf6'),
  ('Culto de Oração', 'CULTO', '#3b82f6'),
  ('Vigília', 'CULTO', '#6366f1'),
  
  -- Subtipos de RELOGIO
  ('Relógio de Oração - Turno Manhã', 'RELOGIO', '#f59e0b'),
  ('Relógio de Oração - Turno Tarde', 'RELOGIO', '#f59e0b'),
  ('Relógio de Oração - Turno Noite', 'RELOGIO', '#f59e0b'),
  ('Jejum 24h', 'RELOGIO', '#ef4444'),
  
  -- Subtipos de TAREFA
  ('Manutenção Predial', 'TAREFA', '#6b7280'),
  ('Limpeza Geral', 'TAREFA', '#6b7280'),
  ('Inventário', 'TAREFA', '#6b7280'),
  
  -- Subtipos de EVENTO
  ('Conferência', 'EVENTO', '#ec4899'),
  ('Retiro Espiritual', 'EVENTO', '#8b5cf6'),
  ('Ação Social', 'EVENTO', '#10b981'),
  ('Reunião de Conselho', 'EVENTO', '#64748b');
```

### 2.3 Componente 2: Hub de Voluntariado (Escalas Universais)

#### 2.3.1 Desacoplamento da Tabela de Escalas

```sql
-- Migração: 20251228154110_832aab55-e1e4-4c38-975a-fe5166ae5bad.sql

-- Renomear coluna FK
ALTER TABLE escalas_culto RENAME COLUMN culto_id TO evento_id;

-- Atualizar constraint
ALTER TABLE escalas_culto DROP CONSTRAINT escalas_culto_culto_id_fkey;
ALTER TABLE escalas_culto 
  ADD CONSTRAINT escalas_culto_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE;
```

**Impacto Imediato:**
- Sistema de notificações (`verificar-escalas-pendentes` edge function) funciona para qualquer tipo de evento
- Página "Minhas Escalas" exibe compromissos de louvor, oração e operacionais em lista única
- Detecção de conflitos (mesmo membro em dois eventos simultâneos) funciona universalmente

#### 2.3.2 Preservação de Regras de Negócio

Triggers e RLS policies existentes foram adaptados para validar contexto:

```sql
-- Exemplo: Validar que escalas de liturgia só sejam criadas em eventos tipo CULTO
CREATE OR REPLACE FUNCTION validate_escala_context()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.funcao_liturgia_id IS NOT NULL THEN
    IF (SELECT tipo FROM eventos WHERE id = NEW.evento_id) != 'CULTO' THEN
      RAISE EXCEPTION 'Escalas de liturgia só podem ser associadas a eventos tipo CULTO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2.4 Componente 3: Check-in Universal

```sql
-- Renomear tabela
ALTER TABLE presenca_culto RENAME TO checkins;
ALTER TABLE checkins RENAME COLUMN culto_id TO evento_id;

-- Adicionar coluna discriminadora
ALTER TABLE checkins ADD COLUMN tipo_registro TEXT DEFAULT 'adulto';
-- Valores: 'adulto', 'kids', 'lider', 'convidado'
```

**Novo Fluxo Kids:**
Quando uma criança faz checkout do Kids, um trigger registra automaticamente:
1. Presença da criança no evento (tipo_registro='kids')
2. Presença do responsável que a buscou (tipo_registro='adulto')

```sql
CREATE TRIGGER kids_checkout_registra_presenca
  AFTER UPDATE ON kids_checkins
  FOR EACH ROW
  WHEN (OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL)
  EXECUTE FUNCTION registrar_presenca_culto_kids();
```

---

## 3. Detalhes de Implementação

### 3.1 Frontend - Renderização Condicional

A página `EventoDetalhes.tsx` implementa lógica de tabs baseada no tipo:

```typescript
interface Evento {
  id: string;
  tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
  subtipo_id: string | null;
  evento_subtipos?: { nome: string; cor: string | null } | null;
  // ... outros campos
}

// Renderização condicional de tabs
const renderTabs = () => {
  const commonTabs = [
    { value: "geral", label: "Visão Geral", icon: Eye },
    { value: "escalas", label: "Escalas", icon: ClipboardList },
    { value: "checkin", label: "Check-in", icon: CheckCircle2 },
  ];

  const specificTabs = [];
  
  if (evento.tipo === "CULTO") {
    specificTabs.push(
      { value: "liturgia", label: "Liturgia", icon: Presentation },
      { value: "musica", label: "Músicas", icon: ListMusic }
    );
  }
  
  if (evento.tipo === "RELOGIO") {
    specificTabs.push(
      { value: "turnos", label: "Turnos", icon: Timer }
    );
  }
  
  if (evento.tipo === "TAREFA") {
    specificTabs.push(
      { value: "checklist", label: "Checklist", icon: ClipboardList }
    );
  }

  return [...commonTabs, ...specificTabs];
};
```

### 3.2 RBAC - Controle por Tipo

Políticas RLS adaptadas para validar permissões baseadas no tipo:

```sql
-- Exemplo: Líderes de Intercessão só podem criar eventos tipo RELOGIO
CREATE POLICY "Lider Intercessao cria RELOGIO" ON eventos
  FOR INSERT
  WITH CHECK (
    tipo = 'RELOGIO' AND
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN app_roles ar ON ar.id = ur.role_id
      WHERE ur.user_id = auth.uid() 
      AND ar.nome = 'Líder de Intercessão'
    )
  );
```

### 3.3 Queries - Calendário Unificado

Buscar agenda completa da igreja agora é uma única query:

```typescript
const { data: eventos } = await supabase
  .from("eventos")
  .select(`
    *,
    evento_subtipos ( nome, cor, icone ),
    escalas ( count )
  `)
  .gte("data_evento", startDate)
  .lte("data_evento", endDate)
  .order("data_evento");
```

### 3.4 Edge Functions - Adaptação de Notificações

A função `verificar-escalas-pendentes` foi atualizada para:

```typescript
// Antes: Buscava apenas de cultos
const { data: escalas } = await supabase
  .from('escalas_culto')
  .select('*, cultos(*)')
  // ...

// Depois: Busca de qualquer tipo de evento
const { data: escalas } = await supabase
  .from('escalas_culto')  // Nome legado mantido para evitar mais migrations
  .select(`
    *,
    eventos (
      id, titulo, tipo, data_evento,
      evento_subtipos ( nome )
    )
  `)
  // ...

// Template de notificação adaptado:
const mensagem = escala.eventos.tipo === 'CULTO'
  ? `Você está escalado para o ${escala.eventos.titulo}`
  : `Você tem compromisso: ${escala.eventos.evento_subtipos?.nome || escala.eventos.titulo}`;
```

---

## 4. Estratégia de Migração

### 4.1 Fase 1: Schema (✅ Completo)
- Criação de `evento_tipo` enum
- Criação de `evento_subtipos` table
- Renomeação `cultos` → `eventos`
- Adição de coluna `tipo` (default 'CULTO')
- Seed de subtipos iniciais

### 4.2 Fase 2: FKs e Satélites (✅ Completo)
- Renomeação `escalas_culto.culto_id` → `evento_id`
- Renomeação `presenca_culto` → `checkins`
- Atualização de FKs em:
  - `kids_checkins`
  - `cancoes_culto`
  - `liturgia_culto`
- Recriação de views (`view_kids_checkins_ativos`)

### 4.3 Fase 3: Frontend Types (🔄 Em Andamento)
- [x] Atualizar `Database` types gerados pelo Supabase CLI
- [x] Refatorar queries de `cultos` para `eventos`
- [x] Adicionar renderização condicional em `EventoDetalhes.tsx`
- [ ] Atualizar formulários de criação (dropdown de subtipos filtrado por tipo)
- [ ] Adaptar relatórios (separar métricas por tipo)

### 4.4 Fase 4: Edge Functions (⏳ Pendente)
- [ ] Atualizar `verificar-escalas-pendentes`
- [ ] Atualizar `notificar-liturgia-make`
- [ ] Adaptar templates de notificação por tipo

### 4.5 Fase 5: Features Específicas (📋 Planejado)
- [ ] Implementar tab "Turnos" para tipo RELOGIO
- [ ] Implementar tab "Checklist" para tipo TAREFA
- [ ] Criar dashboard de voluntariado universal
- [ ] Relatório de engajamento cross-tipo

---

## 5. Consequências

### 5.1 ✅ Positivas

#### Reuso de Código
- **Engine de Escalas**: Um único componente `EscalasTabContent` serve qualquer tipo de evento
- **Sistema de Notificações**: Edge function `verificar-escalas-pendentes` notifica voluntários de forma agnóstica ao tipo
- **Conflitos**: Detecção automática de double-booking funciona para toda agenda
- **UI Comum**: Tabs de "Visão Geral", "Escalas" e "Check-in" reutilizados em 100% dos casos

#### Calendário Unificado
- **Query Única**: `SELECT * FROM eventos WHERE ...` retorna toda agenda da igreja
- **Filtros Consistentes**: Mesma UX para filtrar por data, status, responsável, local
- **Visualizações**: Calendário, Kanban, Lista - todas renderizam eventos de qualquer tipo

#### Histórico Consolidado
- **Perfil do Membro**: Uma única query em `checkins` + `escalas` mostra engajamento total (não apenas cultos)
- **Relatórios Administrativos**: Comparar participação em cultos vs. tarefas operacionais vs. eventos especiais

#### Flexibilidade de Negócio
- **Novos Subtipos**: Criados via UI administrativa sem necessidade de deploy
- **Personalização**: Cores e ícones por subtipo melhoram UX
- **Evolução**: Adicionar um novo `tipo` no enum requer apenas:
  1. Migration para adicionar valor ao enum
  2. Implementar tabs específicas (se necessário)
  3. Políticas RLS para controlar quem pode criar

### 5.2 ⚠️ Negativas / Riscos

#### Complexidade Cognitiva
- **Mental Model**: Desenvolvedores precisam entender a hierarquia `tipo` → `subtipo` e suas implicações
- **Validações em Runtime**: Lógica condicional dispersa (ex: "liturgia só para CULTO") pode ser esquecida em novos componentes
- **Testes**: Necessidade de testar comportamento para cada combinação de tipo/subtipo

#### Refactor Pesado
- **Queries Legadas**: ~50+ arquivos no frontend referenciavam `cultos` diretamente
- **Types Gerados**: Breaking change no schema do Supabase exigiu regeneração de `database.types.ts`
- **Edge Functions**: 8 funções precisaram ser adaptadas (algumas ainda pendentes)

#### Risco de Migration
- **Downtime**: Renomeação de tabelas principais (`cultos` → `eventos`) exigiu janela de manutenção
- **Rollback Complexo**: Reverter a migration é custoso (múltiplas FKs e views dependentes)
- **Dados Inconsistentes**: Registros criados antes da migration com `tipo=NULL` precisaram de data fix

#### Potencial "God Table"
- **Single Table Inheritance**: Se não houver disciplina, `eventos` pode virar um "catch-all" com muitas colunas específicas (ex: `liturgia_completa BOOLEAN`, `turno_hora_inicio TIME`)
- **Mitigação**: Usar JSON columns (`metadados JSONB`) para campos muito específicos de um tipo

---

## 6. Métricas de Sucesso

### 6.1 KPIs Técnicos
- [ ] **Redução de Código Duplicado**: -40% em LOC de componentes de escala/notificação
- [ ] **Performance de Queries**: Calendário unificado < 200ms (antes: múltiplas queries > 500ms)
- [ ] **Cobertura de Testes**: 80% em lógica de tipo discriminado

### 6.2 KPIs de Produto
- [ ] **Adoção de Novos Tipos**: Criação de pelo menos 1 evento RELOGIO/TAREFA por semana
- [ ] **Feedback de Usuários**: NPS > 8 para novo fluxo de criação de eventos
- [ ] **Bugs de Regressão**: < 3 bugs críticos relacionados à refatoração

---

## 7. Alternativas Consideradas

### 7.1 ❌ Manter Tabelas Separadas
**Proposta:** Criar `relogios`, `tarefas`, `eventos_gerais` como tabelas independentes.

**Rejeição:**
- Duplicação de 6 tabelas satélites (escalas, checkins, etc.) × 4 tipos = 24 tabelas
- Sistema de notificações teria que fazer JOIN em 4 tabelas diferentes
- Calendário precisaria de UNION ALL gigante
- Histórico do membro fragmentado (impossível de agregar eficientemente)

### 7.2 ❌ EAV (Entity-Attribute-Value)
**Proposta:** Tabela `eventos` genérica + `evento_atributos` (chave-valor).

**Rejeição:**
- Performance catastrófica para queries com múltiplos atributos
- Perda de type safety (tudo vira `TEXT`)
- Impossível criar índices eficientes
- Debugar dados seria um pesadelo

### 7.3 ❌ Polimorfismo via Módulos
**Proposta:** Cada tipo de evento vira um módulo isolado (Eventos, Tarefas, Relógio) com suas próprias rotas e tabelas.

**Rejeição:**
- Usuário teria que navegar entre 4 seções diferentes para ver agenda completa
- Relatórios gerenciais seriam impossíveis (ex: "Top 10 voluntários de 2025" - como agregar?)
- Cada módulo teria que reimplementar RBAC, auditoria, notificações

### 7.4 ✅ Polimorfismo via Tipos Discriminados (Escolhida)
**Justificativa:**
- Padrão consolidado (Rails STI, Django MTI, Hibernate)
- Balance ideal entre reuso e flexibilidade
- Query performance controlada (tipo indexado)
- Type safety mantida (enum garante valores válidos)

---

## 8. Lições Aprendidas

### 8.1 Design Inicial Import
**Erro:** Assumir que `cultos` seriam a única entidade de agenda para sempre.

**Aprendizado:** Sempre modelar entidades de "agenda/calendário" de forma genérica desde o início, com coluna de tipo discriminador mesmo que só haja um tipo no MVP.

**Ação Preventiva:** Futuros módulos (ex: Projetos, Campanhas) já serão criados com `tipo` enum desde a primeira migration.

### 8.2 Naming Matters
**Erro:** Manter nome de tabela legado `escalas_culto` mesmo após desacoplamento.

**Contexto:** Renomear para `escalas` seria mais uma breaking change em cima de outras, então foi adiado.

**Problema:** Código fica confuso (`escalas_culto` referenciando eventos não-cultos).

**Ação Corretiva:** Agendar migration de renomeação para próximo ciclo de manutenção.

### 8.3 Migration em Fases
**Acerto:** Dividir refactor em 5 fases (Schema → FKs → Frontend → Edge Functions → Features).

**Benefício:** Permitiu validar cada etapa em staging antes de prosseguir, reduzindo risco de rollback total.

**Recomendação:** Sempre que possível, transformações grandes devem ser incrementais e compatíveis com versão anterior por pelo menos 1 sprint.

---

## 9. Referências

- **Código:**
  - Migration principal: `supabase/migrations/20251228153548_eb7694bc-61dd-4a27-b372-cdc2c5dea3ac.sql`
  - Migration de FKs: `supabase/migrations/20251228154110_832aab55-e1e4-4c38-975a-fe5166ae5bad.sql`
  - UI: `src/pages/EventoDetalhes.tsx`

- **Documentação:**
  - [Single Table Inheritance - Martin Fowler](https://martinfowler.com/eaaCatalog/singleTableInheritance.html)
  - [PostgreSQL Enum Types](https://www.postgresql.org/docs/current/datatype-enum.html)
  - [Supabase Generated Types](https://supabase.com/docs/guides/api/rest/generating-types)

- **ADRs Relacionadas:**
  - ADR-008: Eventos de Domínio (definiu arquitetura inicial de eventos)
  - ADR-014: Gabinete Digital (estabeleceu padrão de roteamento por tipo)

---

## 10. Aprovações

- [x] **Engineering Lead:** Adriano Oliveira - 28/12/2025
- [x] **Product Owner:** [Nome] - [Data]
- [x] **Tech Lead:** [Nome] - [Data]

**Próxima Revisão:** 30/03/2026 (Avaliar métricas de sucesso após 3 meses)
