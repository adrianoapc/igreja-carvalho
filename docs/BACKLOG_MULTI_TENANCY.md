# Backlog: Multi-Tenancy (Matriz/Filiais)

> **Modelo de Arquitetura:** Hierárquico com Herança de Configuração  
> **Padrão:** Templates Globais (Matriz) + Dados Operacionais (Filiais)  
> **Inspiração:** Planning Center, Breeze ChMS, InChurch, Ecclesia  
> **Última atualização:** 06/01/2026

---

## 🎯 Visão Geral do Modelo

### Conceito Central
Sistema multi-tenant onde a **Matriz governa estrutura e conteúdo**, enquanto **Filiais executam operação local** usando recursos globais + específicos.

```
┌─────────────────────────────────────────┐
│       MATRIZ (Governança)               │
│  • Estrutura ministerial                │
│  • Jornadas e cursos                    │
│  • Campanhas nacionais                  │
│  • Biblioteca de mídia                  │
│  • Templates e padrões                  │
└─────────────────────────────────────────┘
              ↓ HERDA
┌─────────────────────────────────────────┐
│      FILIAIS (Execução Local)           │
│  • Salas físicas próprias               │
│  • Membros e voluntários                │
│  • Check-ins e presenças                │
│  • Finanças transacionais               │
│  • Progresso individual                 │
└─────────────────────────────────────────┘
```

### Camadas de Dados

#### 🌐 **TIER 1: GLOBAIS** (Matriz define, Filiais herdam)
- Estrutura de times/ministérios
- Jornadas de discipulado
- Cursos e treinamentos
- Planos de leitura bíblica
- Templates de comunicados
- Biblioteca de mídia (imagens, vídeos)
- Banners institucionais
- Categorias financeiras (plano de contas)
- Políticas e workflows

#### 🏢 **TIER 2: LOCAIS** (Cada filial gerencia)
- Infraestrutura física (salas)
- Cadastro de membros/famílias
- Voluntários e escalas
- Check-ins Kids/Cultos
- Financeiro transacional
- Eventos exclusivamente locais
- Atendimentos e intercessões

#### 🔄 **TIER 3: HÍBRIDOS** (Global + Instância Local)
- **Eventos:** Matriz cria "Congresso Nacional" → Cada filial tem inscrições próprias
- **Cursos:** Matriz define conteúdo → Cada filial tem turmas e matrículas
- **Jornadas:** Matriz cria trilha → Cada filial acompanha progresso dos membros
- **Campanhas:** Meta global → Submetas e contribuições por filial
- **Comunicados:** Mensagem da Matriz → Visualizações/confirmações locais

---

## 📚 Benchmarking: Como o Mercado Trabalha

### 1. **Planning Center Online** (Líder ChMS Global)

**Modelo:** Organization → Campuses

```yaml
Global (Organization Level):
  Service Types:        # "Domingo 10h", "Quarta 20h" (herdados)
  Check-in Labels:      # "Primeira Vez", "Alérgico" (herdados)
  Position Types:       # "Vocal", "Baixo", "Bateria" (globais)
  Workflow Templates:   # Processos padronizados
  Form Templates:       # Formulários reutilizáveis
  
Per Campus (Local):
  Actual Services:      # Instâncias dos cultos
  Check-ins:            # Registros de presença
  Team Members:         # Voluntários locais
  Rooms:                # Salas físicas
  
Hybrid:
  Songs:                # Banco global, setlists locais
  People:               # Podem estar em múltiplos campus
  Groups:               # Podem ser cross-campus
```

**Funcionalidades chave:**
- ✅ Campus pode "override" configurações globais
- ✅ Relatórios consolidados automáticos
- ✅ Permissões granulares por campus
- ✅ "Campus Selector" na interface

---

### 2. **InChurch** (Brasil - Multi-Sede)

**Modelo:** Igreja → Congregações/Sedes

```yaml
Nível Igreja (Global):
  Estrutura Ministerial:  # Departamentos padronizados
  Cursos EBD:             # Conteúdo compartilhado
  Categorias Financeiras: # Plano de contas unificado
  Templates:              # Comunicados, relatórios
  Campanhas:              # Arrecadações nacionais
  
Nível Congregação (Local):
  Membros:                # Cadastro local
  Células:                # Grupos pequenos
  Dizimistas:             # Contribuições locais
  Eventos:                # Agenda local
  Patrimônio:             # Bens da sede
  
Dashboard:
  Visão Consolidada:      # Matriz vê todas as sedes
  Comparativos:           # Benchmarks entre sedes
  Metas:                  # Global com breakdown local
```

**Diferenciais:**
- ✅ **Financeiro consolidado** com drill-down
- ✅ **Transferência de membros** entre sedes
- ✅ **Relatórios comparativos** automáticos
- ✅ **App mobile** com seletor de sede

---

### 3. **Ecclesia ERP** (Brasil - Gestão Eclesiástica)

**Modelo:** Rede → Igrejas Locais

```yaml
Rede (Matriz):
  Estatuto:               # Documentos institucionais
  Organograma:            # Estrutura hierárquica
  Currículo Teológico:    # Conteúdo de ensino
  Regimento Interno:      # Normas e políticas
  Sistema de Dízimos:     # Regras de repartição
  
Igreja Local:
  Membros Ativos:         # Rol de membros
  Departamentos Locais:   # Adaptações locais
  Agenda:                 # Eventos e cultos
  Tesouraria:             # Caixa local
  Patrimônio:             # Bens e imóveis
  
Integrações:
  Contabilidade:          # Exportação para contador
  Financeiro Rede:        # Remessas para sede
  BI/Analytics:           # Dashboards executivos
```

**Pontos fortes:**
- ✅ **Gestão financeira robusta** (compliance contábil)
- ✅ **Workflow de aprovações** (hierárquico)
- ✅ **Auditoria completa** (rastreabilidade)
- ✅ **Módulo jurídico** (documentos oficiais)

---

### 4. **Breeze ChMS** (EUA - Simplicidade)

**Modelo:** Church → Campuses (Opcional)

```yaml
Church Settings (Global):
  Custom Fields:          # Campos personalizados
  Tags & Categories:      # Taxonomia global
  Email Templates:        # Comunicações
  Giving Categories:      # Categorias de doações
  
Campus Level (se habilitado):
  Events & Attendance:    # Específicos da unidade
  Small Groups:           # Grupos locais
  Contributions:          # Doações por campus
  Volunteers:             # Serviço local
  
Filosofia:
  "Simple by Design":     # Não overengineer
  Opt-in Complexity:      # Campus é opcional
  Mobile-first:           # App nativo robusto
```

**Lições:**
- ✅ **Multi-campus é opcional** (nem todas igrejas precisam)
- ✅ **Interface única** com toggle de campus
- ✅ **Relatórios simples mas eficazes**

---

### 5. **Elvanto** (Austrália - Escalas)

**Modelo:** Organisation → Venues

```yaml
Organisation:
  Service Types:          # Tipos de culto
  Volunteer Positions:    # Posições de serviço
  Rosters Templates:      # Templates de escalas
  
Venues (Locais):
  Specific Services:      # Cultos agendados
  Room Bookings:          # Reservas de espaços
  Local Teams:            # Times da unidade
  
Recurso Killer:
  "Roster" (Escalas):     # Sistema de revezamento
  Auto-fill:              # IA sugere voluntários
  Conflict Detection:     # Detecta conflitos
  SMS/Email Reminders:    # Lembretes automáticos
```

---

### 6. **ChurchTrac** (EUA - Budget-Friendly)

**Modelo:** Church → Locations

```yaml
Church-Wide:
  Member Database:        # Banco central
  Giving Setup:           # Configurações de doações
  Communication:          # Templates e envios
  
Locations:
  Attendance Tracking:    # Por unidade
  Check-In Kiosks:        # Kids específico
  Event Calendar:         # Agenda local
  
Destaque:
  Preço Acessível:        # Modelo freemium
  Mobile Check-In:        # App dedicado Kids
  Text-to-Give:           # Doações por SMS
```

---

## 🎯 Padrões Comuns Identificados

| Aspecto | Como mercado resolve |
|---------|---------------------|
| **Hierarquia** | 2-3 níveis (Org → Region → Campus/Venue) |
| **Configurações** | Globais por padrão, override local **permitido** |
| **Dados transacionais** | **Sempre locais**, agregação no superior |
| **Conteúdo/Assets** | Biblioteca compartilhada com **permissões** |
| **Relatórios** | Drill-down: consolidado → regional → unidade |
| **Permissões** | Role-based **+** Location-based |
| **UI/UX** | Toggle "Ver tudo" vs "Apenas minha unidade" |
| **Propagação** | **Push** (matriz envia) ou **Pull** (filial escolhe) |
| **Mobile** | Seletor de campus/sede persistente |
| **Financeiro** | Consolidação com **drill-down** |
| **Transferências** | Membros podem migrar entre unidades |
| **Check-in** | Labels/tags globais, registros locais |
| **Voluntários** | Posições globais, pessoas locais |

---

## Pendências Identificadas

### 1. Jornadas (Prioridade: Média)
**Status:** Pendente de análise e implementação

**Contexto:**
- Atualmente a tela de Jornadas não possui filtros de filial implementados
- Precisa definir estratégia: compartilhar jornadas entre filiais ou ter jornadas específicas por filial?

**Tarefas:**
- [ ] Analisar modelo de negócio: jornadas são compartilhadas ou específicas por filial?
- [ ] Adicionar `filial_id` à tabela `jornadas` (se necessário)
- [ ] Implementar filtros em `src/pages/Jornadas.tsx`
- [ ] Implementar filtros em componentes relacionados (criação, edição, listagem)
- [ ] Atualizar queries de progresso de jornadas
- [ ] Testar comportamento "Todas as Filiais" vs filial específica

**Arquivos afetados:**
- `src/pages/Jornadas.tsx`
- `src/pages/JornadaBoard.tsx`
- `supabase/migrations/` (nova migration se necessário)

---

### 2. Classificação de Dados por Camada

**Objetivo:** Definir claramente o que é Global, Local ou Híbrido

#### 📊 Matriz de Decisão

| Módulo/Dado | Camada | Justificativa | Ação Necessária |
|-------------|--------|---------------|-----------------|
| **Salas** | 🏢 Local | Infraestrutura física varia | ✅ Já implementado |
| **Times/Ministérios** | 🌐 Global | Estrutura ministerial padronizada | 🔴 Mudar para global |
| **Membros/Famílias** | 🏢 Local | Cadastro específico da unidade | ✅ Correto |
| **Check-ins Kids** | 🏢 Local | Presença em sala física local | ✅ Correto |
| **Voluntários (pessoas)** | 🏢 Local | Serviço na própria filial | ✅ Correto |
| **Escalas** | 🏢 Local | Voluntários locais em times locais | ✅ Correto |
| **Jornadas (trilha)** | 🌐 Global | Conteúdo de discipulado padrão | 🔴 Tornar global |
| **Jornadas (progresso)** | 🏢 Local | Acompanhamento individual | 🟡 Criar tabela N:N |
| **Cursos (conteúdo)** | 🌐 Global | Material educacional padrão | 🔴 Tornar global |
| **Cursos (matrículas)** | 🏢 Local | Alunos e turmas locais | 🟡 Criar tabela N:N |
| **Eventos (congresso)** | 🔄 Híbrido | Evento global, inscrições locais | 🟡 Criar tabela N:N |
| **Eventos (culto)** | 🏢 Local | Específico da unidade | ✅ Correto |
| **Comunicados (template)** | 🌐 Global | Mensagem institucional | 🔴 Tornar global |
| **Comunicados (leitura)** | 🏢 Local | Rastrear visualizações | 🟡 Criar tabela N:N |
| **Notificações (template/canais)** | 🌐 Global | Canais e padrões definidos pela Matriz | 🟡 Adicionar `eh_global`, `visivel_para_filiais` |
| **Notificações (disparos/logs)** | 🔄 Híbrido | Disparos herdam igreja_id e filial_id; alcance global/local | 🟡 Campos `alcance`, `filiais_destino[]`, filtro `.or(filial_id.eq,filial_id.is.null)` |
| **Mídia/Imagens** | 🌐 Global | Biblioteca compartilhada | 🔴 Adicionar flag `compartilhada` |
| **Banners** | 🌐 Global | Comunicação institucional | 🔴 Adicionar `visivel_para_filiais` |
| **Categorias Financeiras** | 🌐 Global | Plano de contas unificado | ✅ Implementado (com `origem_matriz_id`) |
| **Transações Financeiras** | 🏢 Local | Receitas/despesas da unidade | ✅ Correto |
| **Fornecedores** | 🔄 Híbrido | Nacionais (global) + Locais | 🟡 Adicionar flag `eh_nacional` |
| **Testemunhos** | 🏢 Local | Histórias da comunidade local | ✅ Correto (ou global se quiser compartilhar) |
| **Intercessões** | 🏢 Local | Pedidos específicos da unidade | ✅ Correto |
| **Planos Leitura** | 🌐 Global | Desafios bíblicos institucionais | 🔴 Tornar global |

---

### 2-A. Análise Completa de Telas - Revisão Final

**Objetivo:** Garantir que todas as telas respeitam o contexto e camada corretos

**Telas já implementadas:** ✅
- [x] Kids Dashboard (✅ filtros aplicados, ⚠️ precisa revisar eventos)
- [x] Kids Config/Salas (✅ correto - sempre local)
- [x] Voluntariado (⚠️ filtrado local, **deveria ser global**)
- [x] Candidatos Voluntário (✅ correto - dados locais)
- [x] Ensino/Salas (⚠️ filtrado local, **precisa incluir Matriz**)
- [x] NovaAulaDrawer (⚠️ filtrado local, **precisa incluir Matriz**)
- [x] Financeiro - Estrutura replicável (✅ correto com `origem_matriz_id`)

**Telas que precisam revisão:** 🔍

#### 2.1. Financeiro ✅ **Estrutura OK, Falta Consolidação**
- [x] Estrutura de cadastros replicável (IMPLEMENTADO)
- [x] Receitas/Despesas sempre locais (correto)
- [ ] Dashboard consolidado (visualização Matriz de todas filiais)
- [ ] Relatórios comparativos (benchmarks entre filiais)
- [ ] Drill-down: consolidado → filial → transação
- [ ] Metas financeiras por filial

**Modelo atual:** ✅ Correto
#### 2.3. Agenda/Eventos 🔴 **ALTA PRIORIDADE - HÍBRIDO**
**Modelo recomendado:** Evento global com inscrições/participações locais

- [ ] Adicionar `eh_global` à tabela `eventos`
- [ ] Criar tabela `eventos_inscricoes` (relacionamento N:N com filial_id)
- [ ] Matriz cria evento → Filiais veem e registram participações próprias
- [ ] Relatório consolidado: "Congresso Nacional" → 500 inscritos (200 Matriz + 150 Filial 01 + 150 Filial 02)
- [ ] Interface para escolher alcance: "Local", "Todas as Filiais", "Específicas"
- [ ] Escalas sempre locais (voluntários da própria filial)
- [ ] Cultos regulares: sempre locais (específicos de cada unidade)

**Casos de uso:**
- ✅ **Congresso/Retiro Nacional:** Evento global, cada filial gerencia inscrições
- ✅ **Culto Regular:** Sempre local (cada filial tem horário próprio)
- ✅ **Campanha de Jejum:** Global (todos participam), acompanhamento local

#### 2.2. Intercessão ⚠️ **PRECISA ANÁLISE**
- [ ] Pedidos de oração são por filial ou globais?
- [ ] Sala de Guerra compartilhada ou separada?

#### 2.3. Agenda/Eventos ⚠️ **PRIORIDADE**
- [ ] Eventos globais vs eventos por filial
- [ ] Escalas por filial
- [ ] Cultos/Eventos vinculados a filial?
- [ ] **Replicação automática:** eventos criados na Matriz podem ser propagados para filiais
- [ ] Interface para escolher: "Apenas Matriz", "Todas as Filiais", "Filiais Específicas"
- [ ] Sincronização de alterações: mudanças na Matriz refletem nas filiais?

#### 2.4. Pessoas/Membros
- [ ] Perfis vinculados a filial específica?
- [ ] Transferência entre filiais
- [ ] Visitantes por filial
### Fase 1: Definir Arquitetura de Dados (2-3 dias)
**Objetivo:** Classificar todos os módulos em Global/Local/Híbrido

- [ ] Revisar matriz de decisão acima
- [ ] Validar regras de negócio com stakeholders
- [ ] Documentar casos de uso específicos
- [ ] Definir permissões de edição (Matriz pode editar global, Filial só visualiza)

**Entregável:** Documento de arquitetura aprovado

---

### Fase 2: Database Schema Refactoring (3-5 dias)
**Objetivo:** Adicionar campos de herança e criar tabelas híbridas

#### 2.1 Migrations para Dados Globais
```sql
-- Campos padrão para todos os globais
ALTER TABLE times
  ADD COLUMN eh_global BOOLEAN DEFAULT false,
  ADD COLUMN origem_matriz_id UUID REFERENCES times(id),
  ADD COLUMN sincronizar_com_matriz BOOLEAN DEFAULT true,
  ADD COLUMN customizado_localmente BOOLEAN DEFAULT false,
  ADD COLUMN visivel_para_filiais BOOLEAN DEFAULT false;

-- Repetir para: jornadas, cursos, comunicados_templates, 
-- midias, banners, planos_leitura
```

#### 2.2 Tabelas de Relacionamento (Híbridos)
```sql
-- Jornadas (trilha global, progresso local)
CREATE TABLE jornadas_participantes (
  id UUID PRIMARY KEY,
  jornada_id UUID REFERENCES jornadas(id),
  pessoa_id UUID REFERENCES profiles(id),
  filial_id UUID REFERENCES filiais(id),
  etapa_atual INTEGER,
  progresso_percentual DECIMAL,
  data_inicio DATE,
  data_conclusao DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cursos (conteúdo global, matrículas locais)
CREATE TABLE cursos_matriculas (
  id UUID PRIMARY KEY,
  curso_id UUID REFERENCES cursos(id),
  pessoa_id UUID REFERENCES profiles(id),
  filial_id UUID REFERENCES filiais(id),
  turma_local VARCHAR,
  progresso DECIMAL,
  status VARCHAR CHECK (status IN ('ativo', 'concluido', 'cancelado')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Eventos (evento global, participações locais)
CREATE TABLE eventos_participantes (
  id UUID PRIMARY KEY,
  evento_id UUID REFERENCES eventos(id),
  pessoa_id UUID REFERENCES profiles(id),
  filial_id UUID REFERENCES filiais(id),
  status_inscricao VARCHAR,
  forma_pagamento VARCHAR,
  valor_pago DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Projetos (meta global, execução local)
CREATE TABLE projetos_filiais (
  id UUID PRIMARY KEY,
  projeto_id UUID REFERENCES projetos(id),
  filial_id UUID REFERENCES filiais(id),
  meta_local DECIMAL,
  arrecadado DECIMAL DEFAULT 0,
  voluntarios INTEGER DEFAULT 0,
  status VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Comunicados (template global, leituras locais)
CREATE TABLE comunicados_leituras (
  id UUID PRIMARY KEY,
  comunicado_id UUID REFERENCES comunicados(id),
  pessoa_id UUID REFERENCES profiles(id),
  filial_id UUID REFERENCES filiais(id),
  lido_em TIMESTAMP,
  confirmado BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.3 Constraints e Índices
```sql
-- Garantir mesma igreja
ALTER TABLE times
  ADD CONSTRAINT chk_origem_mesma_igreja
  CHECK (
    origem_matriz_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM times origem
      WHERE origem.id = origem_matriz_id
      AND origem.igreja_id = times.igreja_id
    )
  );

-- Índices de performance
CREATE INDEX idx_times_global ON times(eh_global) WHERE eh_global = true;
CREATE INDEX idx_times_origem ON times(origem_matriz_id) WHERE origem_matriz_id IS NOT NULL;
CREATE INDEX idx_jornadas_participantes ON jornadas_participantes(jornada_id, filial_id);
CREATE INDEX idx_cursos_matriculas ON cursos_matriculas(curso_id, filial_id);
CREATE INDEX idx_eventos_participantes ON eventos_participantes(evento_id, filial_id);
```

**Entregável:** Migrations testadas em staging

---

### Fase 3: Helpers e Utilitários (1-2 dias)
**Objetivo:** Criar funções reutilizáveis para queries

#### 3.1 Query Helper
```typescript
// src/lib/queryHelpers.ts
export function applyGlobalOrLocalFilter(
  query: any,
  filialId: string | null,
  isAllFiliais: boolean,
  opcoes?: {
    incluirGlobais?: boolean;
    campoFilial?: string;
    campoGlobal?: string;
  }
) {
  const { 
    incluirGlobais = true, 
    campoFilial = 'filial_id',
    campoGlobal = 'eh_global'
  } = opcoes || {};
  
  if (isAllFiliais) {
    return query; // Admin vê tudo
  }
  
  if (!filialId) {
    // Usuário da Matriz
    if (incluirGlobais) {
      return query.or(`${campoFilial}.is.null,${campoGlobal}.eq.true`);
    }
    return query.is(campoFilial, null);
  }
  
  if (incluirGlobais) {
    // Filial vê: próprios + globais + Matriz
    return query.or(
      `${campoFilial}.eq.${filialId},${campoGlobal}.eq.true,${campoFilial}.is.null`
    );
  }
  
  return query.eq(campoFilial, filialId);
}
```

#### 3.2 Hook Customizado
```typescript
// src/hooks/useGlobalData.ts
export function useGlobalData<T>(
  tabela: string,
  opcoes?: { incluirLocais?: boolean }
) {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  
  const query = useQuery({
    queryKey: [tabela, 'global', igrejaId, filialId],
    queryFn: async () => {
      let query = supabase
        .from(tabela)
        .select('*')
        .eq('ativo', true);
      
      if (igrejaId) query = query.eq('igreja_id', igrejaId);
      
      query = applyGlobalOrLocalFilter(
        query, 
        filialId, 
        isAllFiliais,
        { incluirGlobais: true }
      );
      
      const { data, error } = await query;
      if (error) throw error;
      return data as T[];
    }
  });
  
  return query;
}

// Uso:
const { data: jornadas } = useGlobalData<Jornada>('jornadas');
```

**Entregável:** Biblioteca de helpers documentada

---

### Fase 4: Implementação por Módulo (2-3 semanas)

#### Sprint 1: Dados Globais Básicos (1 semana)
- [ ] **Times/Ministérios:** Tornar global
  - Migração: Marcar times da Matriz como `eh_global = true`
  - UI: Badge "🌐 Global" nos cards
  - Query: Usar `applyGlobalOrLocalFilter`
  - Testes: Filial vê times da Matriz + próprios

- [ ] **Jornadas:** Conteúdo global + progresso local
  - Migração: Marcar jornadas como globais
  - Criar tabela `jornadas_participantes`
  - UI: Listagem mostra globais + locais, progresso é individual
  - Dashboard: "50 pessoas em jornadas" (soma todas filiais)

- [ ] **Categorias Financeiras:** Validar implementação atual
  - Review: Confirmar `origem_matriz_id` funcionando
  - Interface: Botão "Propagar para filiais" na Matriz
  - Sync: Atualização em batch das filiais

#### Sprint 2: Dados Híbridos (1 semana)
- [ ] **Eventos:** Global com participações locais
  - Migração: Adicionar `eh_global` à eventos
  - Criar tabela `eventos_participantes`
---

## 🚨 Correções Urgentes Identificadas

### **CRÍTICO: Filtros implementados hoje precisam revisão**

Durante a implementação de hoje (06/01/2026), aplicamos filtros que **isolam completamente** por filial. Isso **quebra o modelo de herança**.

#### Arquivos que precisam correção:

| Arquivo | Problema | Correção | Prioridade |
|---------|----------|----------|-----------|
| `src/pages/Kids.tsx` | Filiais não veem salas da Matriz | Usar `.or()` incluindo `NULL` | 🔴 Alta |
| `src/pages/Ensino.tsx` | Filiais não veem salas da Matriz | Usar `.or()` incluindo `NULL` | 🔴 Alta |
| `src/components/ensino/NovaAulaDrawer.tsx` | Não lista salas globais | Usar `.or()` incluindo `NULL` | 🔴 Alta |
| `src/pages/Voluntariado.tsx` | Times filtrados local (deveria ser global) | Remover filtro ou marcar como global | 🔴 Alta |

#### Correção padrão:
```typescript
// ANTES (implementado hoje - INCORRETO):
if (!isAllFiliais && filialId) {
  query = query.eq("filial_id", filialId);
}

// DEPOIS (CORRETO):
if (!isAllFiliais && filialId) {
  query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
  // Retorna: registros da filial OU globais da Matriz (NULL)
}
```

**Impacto:** 
- ⚠️ Filiais não conseguem usar recursos da Matriz
- ⚠️ Usuários reportarão "salas/times sumiram"
- ⚠️ Precisa correção antes de produção

**Tempo estimado:** 2-3 horas (já mapeado, simples de corrigir)

---

## 📊 Resumo Executivo

### O que temos hoje:
- ✅ Base multi-tenant sólida (`igreja_id` + `filial_id`)
- ✅ Hook `useFilialId` funcionando
- ✅ Filtros aplicados (mas precisam ajustes)
- ✅ Financeiro com replicação estrutural implementado

### O que falta:
- 🔴 **Flags de herança** (`eh_global`, `origem_matriz_id`, etc)
- 🔴 **Tabelas híbridas** (N:N para jornadas, cursos, eventos)
- 🔴 **Helpers para queries globais**
- 🔴 **Correção dos filtros implementados hoje**
- 🟡 **Interfaces de propagação** (Matriz → Filiais)
- 🟡 **Dashboards consolidados**
- 🟡 **Componentes de UX** (badges, seletores)

### Estimativa total:
- **Planejamento:** 2-3 dias
- **Database:** 3-5 dias
- **Helpers:** 1-2 dias
- **Implementação:** 2-3 semanas (4 sprints)
- **UI/UX:** 1 semana
- **Testes:** 1 semana
- **Docs:** 3 dias

**Total:** ~8-10 semanas (2-2.5 meses) para implementação completa

### Modelo de referência:
Seguir padrões de **Planning Center** (service types globais) + **InChurch** (consolidação financeira) + **Breeze** (simplicidade opt-in).

---

**Última atualização:** 06/01/2026  
**Revisão de mercado:** InChurch, Ecclesia, Planning Center, Breeze, Elvanto, ChurchTrac  
**Responsável:** Equipe de Desenvolvimento  
**Status:** 🟡 Em planejamentolocais
  - Migração: Marcar cursos como globais
  - Criar tabela `cursos_matriculas`
  - UI: Filial vê catálogo global, cria turma local
  - Relatório: "30 alunos no curso X nesta filial"

- [ ] **Projetos:** Meta global, execução local
  - Migração: Adicionar `eh_global`
  - Criar tabela `projetos_filiais`
  - UI: Dashboard com barra de progresso global + breakdown
  - Drill-down: Clicar na barra → ver por filial

#### Sprint 3: Comunicação e Mídia (3-5 dias)
- [ ] **Comunicados:** Template global, leituras locais
  - Migração: Flag `visivel_para_filiais`
  - Tabela `comunicados_leituras`
  - UI: Matriz envia → filiais veem e confirmam
  - Dashboard: Taxa de leitura por filial

- [ ] **Notificações:** Canais globais, disparos locais/global
  - Campos: `alcance` (`local`, `global`, `filiais_especificas`), `filiais_destino` (array)
  - Filtro padrão: `.or('filial_id.eq.${filialId},filial_id.is.null')` para herdar da Matriz
  - UI: Selector de alcance + multi-select de filiais
  - Logs: Guardar `igreja_id`, `filial_id`, `alcance`, `canal`

- [ ] **Mídia/Biblioteca:** Compartilhamento
  - Campo `compartilhada_matriz`
  - UI: Toggle "Compartilhar com filiais"
  - Interface: Aba "Da Matriz" + "Locais"
  - Permissões: Filiais read-only em mídia da Matriz

- [ ] **Banners:** Targeting por filial
  - Campo `filiais_visiveis` (array UUIDs)
  - UI: Multi-select de filiais ao criar banner
  - Exibição: Filial vê apenas banners direcionados + globais

#### Sprint 4: Correções de Filtros (2-3 dias)
- [ ] **Salas:** Incluir salas da Matriz nas queries de filiais
  - Ajustar `Kids.tsx`, `Ensino.tsx`, `NovaAulaDrawer.tsx`
  - Query: `.or('filial_id.eq.${filialId},filial_id.is.null')`
  - UI: Badge indicando "Da Matriz" vs "Local"

- [ ] **Voluntariado:** Times globais, membros locais
  - Query times: Incluir globais
  - Membros_time: Sempre local
  - Dashboard: "5 times disponíveis (3 globais + 2 locais)"

**Entregável por Sprint:** Features em produção, documentadas

---

### Fase 5: Interfaces e UX (1 semana)

#### 5.1 Componentes Reutilizáveis
```tsx
// AlcanceSelector
<AlcanceSelector
  value={alcance}
  onChange={setAlcance}
  options={['local', 'global', 'especificas']}
  onFiliaisSelect={setFiliais}
/>

// OrigemBadge
<OrigemBadge 
  tipo={item.eh_global ? 'global' : 'local'}
  customizado={item.customizado_localmente}
/>

// FilialFilter (header global)
<FilialFilter
  filiais={filiais}
  selected={filialAtual}
  onChange={setFilialAtual}
  showAllOption={isAdmin}
/>
```

#### 5.2 Dashboards Consolidados
- [ ] **Financeiro:** Drill-down de receitas/despesas
- [ ] **Eventos:** Mapa de calor de participação
- [ ] **Jornadas:** Funil de conversão por filial
- [ ] **Projetos:** Progress bars comparativos

**Entregável:** Design system com componentes multi-tenancy

---

### Fase 6: Testes e Validação (1 semana)
1. **Testes Unitários:** Helpers e funções
2. **Testes de Integração:** Fluxos completos
3. **Testes de Permissão:** 
   - ✅ Matriz cria global → Filiais veem
   - ✅ Filial cria local → Só ela vê
   - ✅ Admin "Todas Filiais" → Vê tudo
   - ❌ Filial NÃO edita global da Matriz
4. **Testes de Performance:** Queries com índices
5. **Testes de Regressão:** Features antigas funcionam

**Entregável:** Suite de testes automatizados

---

### Fase 7: Documentação e Treinamento (3 dias)
1. **Documentação Técnica:** Arquitetura, helpers, padrões
2. **Manual do Usuário:** Como usar recursos multi-filial
3. **Vídeos Tutorial:** Workflows principais
4. **FAQ:** Perguntas comuns

**Entregável:** Knowledge base completa
├─ Filial 01: Meta R$ 300.000 → Arrecadado R$ 250.000 (83%)
├─ Filial 02: Meta R$ 200.000 → Arrecadado R$ 200.000 (100%)
└─ Filial 03: Meta R$ 500.000 → Arrecadado R$ 400.000 (80%)
    Total: R$ 850.000 de R$ 1.000.000 (85%)
```
- [ ] Públicos (global) ou por filial?

#### 2.7. Projetos ⚠️ **PRIORIDADE**
- [ ] Projetos da igreja toda ou específicos por filial?
- [ ] **Replicação automática:** projetos sociais iniciados na Matriz podem ser estendidos para filiais
- [ ] Gestão de recursos por filial dentro do mesmo projeto
- [ ] Relatórios consolidados vs por filial
- [ ] Interface para escolher escopo: "Apenas Matriz", "Todas as Filiais", "Filiais Específicas"

#### 2.8. Mídia/Publicações ⚠️ **PRIORIDADE**
- [ ] Conteúdo compartilhado ou específico?
- [ ] **Biblioteca compartilhada:** mídias da Matriz disponíveis automaticamente para filiais
- [ ] Permissões de uso: filiais podem apenas visualizar ou também editar?
- [ ] Tags de origem: identificar se mídia é da Matriz ou de filial específica
- [ ] Publicações: compartilhar automaticamente ou exigir aprovação local?

#### 2.9. Admin/Configurações
- [ ] Permissões por filial
- [ ] Configurações globais vs específicas

---

## Estratégia de Implementação

### Fase 1: Análise (1-2 dias)
1. Reunir com stakeholders para definir regras de negócio
2. Mapear quais dados são globais vs específicos por filial
3. Priorizar telas por impacto/uso

### Fase 2: Database Schema (1 dia)
1. Criar migrations necessárias
2. Adicionar `filial_id` onde necessário
3. Definir constraints e índices

### Fase 3: Implementação por Módulo (1-2 semanas)
1. Aplicar `useFilialId` hook em todas as páginas
2. Adicionar filtros nas queries
3. Testar modo "Todas as Filiais"
4. Garantir que criação/edição salva `filial_id` correto

### Fase 4: Testes e Validação (2-3 dias)
1. Testar cada tela com usuário de filial específica
2. Testar com usuário admin (Todas as Filiais)
3. Validar transferências/compartilhamentos
4. Verificar performance das queries

---

## Padrão Estabelecido

### Hook de Contexto
```tsx
import { useFilialId } from "@/hooks/useFilialId";

const { igrejaId, filialId, isAllFiliais } = useFilialId();
```

### Padrão de Query
```tsx
let query = supabase
  .from("tabela")
  .select("*");

if (igrejaId) query = query.eq("igreja_id", igrejaId);
if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

const { data } = await query;
```

### Padrão de Insert/Update
```tsx
const data = {
  // ... outros campos
  igreja_id: igrejaId,
  filial_id: isAllFiliais ? null : filialId,
};
```

---

## Funcionalidade: Replicação Matriz → Filiais

### Conceito
Permitir que conteúdo criado na Matriz seja automaticamente ou seletivamente replicado para as filiais.

### Módulos Prioritários para Replicação

#### 1. **Eventos** 🎯
**Caso de uso:** Evento nacional/regional que todas as filiais participarão
- Criar evento na Matriz
- Opção: "Replicar para filiais"
- Selecionar: Todas ou específicas
- Cada filial recebe cópia do evento com `origem_matriz_id` (referência ao original)
- Alterações na Matriz podem ou não propagar (configurável)

**Implementação:**
- Campo `origem_matriz_id` na tabela `eventos`
- Campo `escopo` (enum: 'matriz', 'filial', 'replicado')
- Trigger ou função para replicação automática
- Interface de seleção de filiais

#### 2. **Comunicados** 📢
**Caso de uso:** Anúncio importante que precisa chegar a todas as unidades
- Criar comunicado na Matriz
- Opção: "Enviar para todas as filiais"
- Cada filial visualiza o comunicado como se fosse local
- Histórico de entrega/visualização por filial

**Implementação:**
- Tabela `comunicados_filiais` (relação N:N)
- Campo `criado_por_matriz` (boolean)
- Dashboard de alcance: quantas filiais visualizaram

#### 3. **Projetos Sociais** 🤝
**Caso de uso:** Campanha de arrecadação nacional com metas por filial
- Projeto criado na Matriz define meta global
- Cada filial tem submeta e gestão própria
- Relatório consolidado mostra progresso geral

**Implementação:**
- Campo `projeto_matriz_id` na tabela `projetos`
- Tabela `projetos_metas_filiais` (metas individuais)
- Agregação de resultados para dashboard consolidado

#### 4. **Mídia/Biblioteca** 🎬
**Caso de uso:** Material institucional, sermões, estudos disponíveis para todas
- Mídia marcada como "Compartilhada"
- Filiais têm acesso read-only ou download
- Catálogo unificado com filtro de origem

**Implementação:**
- Campo `compartilhada_matriz` (boolean)
- Campo `permissoes_filiais` (enum: 'visualizar', 'baixar', 'editar')
- Interface de biblioteca com aba "Da Matriz" e "Local"

---

## Decisões de Design Pendentes

### 1. Dados Compartilhados
**Questão:** Quais dados devem ser compartilhados entre todas as filiais?

**Candidatos para compartilhamento:**
- Jornadas de discipulado (conteúdo padrão)
- Cursos/Material de ensino
- Templates de comunicados
- Biblioteca de mídia

**Estratégia:** Usar `filial_id = null` para dados globais

### 2. Dados Específicos
**Questão:** Quais dados são sempre específicos de uma filial?

**Candidatos para separação:**
- Check-ins Kids
- Presenças em aulas
- Escalas de voluntários
- Financeiro local

### 3. Dados Híbridos
**Questão:** Quais dados podem ser tanto globais quanto específicos?

**Candidatos:**
- Eventos (alguns são da igreja toda, outros por filial)
- Comunicados (alguns gerais, outros segmentados)
- Projetos sociais
- **Mídia/Conteúdo (biblioteca compartilhada vs local)**

**Estratégia:** Permitir `filial_id` opcional + filtro "Todas as Filiais" + **campo `origem_matriz_id` para rastreabilidade**

### 4. Replicação e Sincronização ⚠️ **NOVO**
**Questão:** Como gerenciar conteúdo que parte da Matriz e vai para filiais?

**Opções de implementação:**
1. **Replicação por cópia:** Criar registros duplicados em cada filial
   - ✅ Cada filial tem autonomia para customizar
   - ❌ Mudanças na Matriz não refletem automaticamente
   
2. **Referência compartilhada:** Um registro com flag de compartilhamento
   - ✅ Economiza espaço, mudanças propagam automaticamente
   - ❌ Menos flexibilidade para customização local
   
3. **Modelo híbrido:** Referência + override local
   - ✅ Melhor dos dois mundos
   - ❌ Mais complexo de implementar

**Recomendação:** Modelo híbrido com campos:
- `origem_matriz_id` (UUID, nullable) - referência ao registro original da Matriz
- `customizado_localmente` (boolean) - indica se filial fez alterações
- `sincronizar_com_matriz` (boolean) - se deve receber atualizações da Matriz

---

## Notas de Implementação

### Observações Importantes
1. Sempre validar se `igrejaId` existe antes de fazer queries
2. Nunca assumir `filialId` - sempre verificar `isAllFiliais`
3. Em queries de agregação, considerar ambos os cenários
4. Considerar performance: adicionar índices compostos `(igreja_id, filial_id)`
5. RLS policies devem respeitar o contexto de filial

### Migrations Futuras
- Avaliar necessidade de `filial_id` em cada tabela
- Criar índices compostos para performance
- Adicionar constraints de integridade
- Considerar `ON DELETE CASCADE` ou `SET NULL` conforme regra de negócio
- **Adicionar campos de replicação:** `origem_matriz_id`, `customizado_localmente`, `sincronizar_com_matriz`
- **Criar tabelas de relacionamento** para replicação N:N (ex: `eventos_filiais`, `comunicados_filiais`)

---

## Componentes de Interface Necessários

### Seletor de Alcance (Scope Selector)
Componente reutilizável para escolher onde o conteúdo será aplicado:
```tsx
<AlcanceSelector
  options={['apenas_matriz', 'todas_filiais', 'filiais_especificas']}
  onFilialSelect={(filiais) => ...}
/>
```

### Indicador de Origem
Badge/Tag mostrando origem do conteúdo:
```tsx
<OrigemBadge tipo="matriz" /> // 🏢 Da Matriz
<OrigemBadge tipo="filial" /> // 📍 Local
<OrigemBadge tipo="replicado" customizado={true} /> // 🔄 Replicado (customizado)
```

### Dashboard de Propagação
Interface para acompanhar replicação:
- Quantas filiais receberam
- Quantas visualizaram/confirmaram
- Quais customizaram localmente

---

**Última atualização:** 06/01/2026
**Responsável:** Equipe de Desenvolvimento
