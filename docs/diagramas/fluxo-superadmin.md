# Fluxo — Super Admin Portal

Este documento descreve os fluxos principais do portal Super Admin (SaaS), que gerencia múltiplas igrejas (tenants) no sistema.

## Visão Geral da Arquitetura

```mermaid
flowchart TD
    subgraph "Portal Super Admin"
        SA[Super Admin User]
        ContextSelect[Tela de Seleção<br/>/context-select]
        
        subgraph "Painel SaaS /superadmin"
            Dashboard[Dashboard<br/>KPIs Globais]
            Igrejas[Gerenciar Igrejas]
            Metricas[Métricas por Tenant]
            Billing[Faturamento]
            Config[Configurações]
        end
        
        subgraph "Aplicativo Igreja /"
            AppIgreja[App Normal<br/>como Membro]
        end
    end
    
    SA --> |Login| ContextSelect
    ContextSelect --> |Escolhe SaaS| Dashboard
    ContextSelect --> |Escolhe App| AppIgreja
    
    Dashboard --> Igrejas
    Dashboard --> Metricas
    Dashboard --> Billing
    Dashboard --> Config
    
    style ContextSelect fill:#e1f5ff
    style Dashboard fill:#f5e1ff
    style AppIgreja fill:#e1ffe1
```

## Fluxo de Login e Seleção de Contexto

```mermaid
flowchart TD
    Start([Usuário Faz Login]) --> CheckRole{É Super Admin?}
    
    CheckRole -->|Não| GoToApp([Redireciona para /])
    CheckRole -->|Sim| CheckPreference{Tem Preferência<br/>Salva em localStorage?}
    
    CheckPreference -->|Sim| GetPreference[Lê preferred_context]
    CheckPreference -->|Não| ShowSelect[Exibe /context-select]
    
    GetPreference --> |superadmin| GoToSuperAdmin([Redireciona para /superadmin])
    GetPreference --> |app| GoToApp
    
    ShowSelect --> UserChoice{Usuário Escolhe}
    
    UserChoice --> |Painel SaaS| CheckRemember1{Lembrar Escolha?}
    UserChoice --> |Aplicativo Igreja| CheckRemember2{Lembrar Escolha?}
    
    CheckRemember1 -->|Sim| SavePref1[Salva 'superadmin'<br/>em localStorage]
    CheckRemember1 -->|Não| GoToSuperAdmin
    SavePref1 --> GoToSuperAdmin
    
    CheckRemember2 -->|Sim| SavePref2[Salva 'app'<br/>em localStorage]
    CheckRemember2 -->|Não| GoToApp
    SavePref2 --> GoToApp
    
    style Start fill:#e1f5ff
    style ShowSelect fill:#fff4e1
    style GoToSuperAdmin fill:#f5e1ff
    style GoToApp fill:#e1ffe1
```

## Fluxo de Gestão de Igrejas

```mermaid
flowchart TD
    Start([Super Admin Acessa<br/>/superadmin/igrejas]) --> LoadIgrejas[Carrega Lista de Igrejas<br/>SELECT * FROM igrejas]
    
    LoadIgrejas --> FilterSearch{Buscar ou<br/>Filtrar?}
    
    FilterSearch -->|Sim| ApplyFilter[Aplica Filtros<br/>nome, status, etc.]
    FilterSearch -->|Não| ShowList[Exibe Lista]
    ApplyFilter --> ShowList
    
    ShowList --> Action{Ação?}
    
    Action -->|Ver Detalhes| ExpandRow[Expande Row<br/>Mostra Filiais]
    Action -->|Alterar Status| UpdateStatus[UPDATE igrejas<br/>SET status = ?]
    Action -->|Ver Métricas| GoToMetricas[Navega para<br/>/superadmin/metricas?igreja=id]
    
    ExpandRow --> ManageFiliais{Gerenciar Filiais?}
    ManageFiliais -->|Adicionar| AddFilial[INSERT filiais<br/>igreja_id = ?]
    ManageFiliais -->|Editar| EditFilial[UPDATE filiais<br/>SET nome = ?]
    ManageFiliais -->|Excluir| CheckMatriz{É Matriz?}
    
    CheckMatriz -->|Sim| Error([Erro: Não pode<br/>excluir Matriz])
    CheckMatriz -->|Não| DeleteFilial[DELETE filiais<br/>WHERE id = ?]
    
    UpdateStatus --> ShowList
    AddFilial --> ShowList
    EditFilial --> ShowList
    DeleteFilial --> ShowList
    
    style Start fill:#e1f5ff
    style Error fill:#ffe1e1
    style ShowList fill:#e1ffe1
```

## Fluxo de Métricas por Tenant

```mermaid
flowchart TD
    Start([Super Admin Acessa<br/>/superadmin/metricas]) --> SelectIgreja[Seleciona Igreja<br/>do Dropdown]
    
    SelectIgreja --> LoadMetrics[Carrega Métricas<br/>WHERE igreja_id = ?]
    
    LoadMetrics --> ShowCards[Exibe Cards de KPIs]
    
    subgraph "KPIs Exibidos"
        TotalMembros[Total de Membros]
        TotalEventos[Eventos Realizados]
        TotalCheckins[Check-ins]
        TotalFinanceiro[Movimentação Financeira]
    end
    
    ShowCards --> TotalMembros
    ShowCards --> TotalEventos
    ShowCards --> TotalCheckins
    ShowCards --> TotalFinanceiro
    
    ShowCards --> RecalcAction{Recalcular?}
    
    RecalcAction -->|Sim| CallRPC[Chama RPC<br/>recalcular_metricas_igreja]
    RecalcAction -->|Não| End([Fim])
    
    CallRPC --> UpdateMetrics[Atualiza metricas_igreja<br/>com novos valores]
    UpdateMetrics --> LoadMetrics
    
    style Start fill:#e1f5ff
    style ShowCards fill:#e1ffe1
    style CallRPC fill:#f5e1ff
```

## Navegação entre Contextos

```mermaid
flowchart LR
    subgraph "Super Admin Layout"
        Header1[Header com Shield Icon]
        Nav1[Dashboard | Igrejas | Métricas | Billing | Config]
        BtnApp[Botão: Ir para App Igreja]
    end
    
    subgraph "Main Layout (App)"
        Header2[Header Normal]
        Nav2[Dashboard | Módulos...]
        IndicatorSA[Shield Icon<br/>para Super Admins]
    end
    
    BtnApp --> |Click| Header2
    IndicatorSA --> |Click| Header1
    
    style Header1 fill:#f5e1ff
    style Header2 fill:#e1ffe1
    style BtnApp fill:#fff4e1
    style IndicatorSA fill:#fff4e1
```

## Componentes Principais

| Componente | Caminho | Descrição |
|------------|---------|-----------|
| `SuperAdminLayout` | `src/components/layout/SuperAdminLayout.tsx` | Layout dedicado para rotas /superadmin/* |
| `SuperAdminGate` | `src/components/auth/SuperAdminGate.tsx` | Gate de proteção que verifica role super_admin |
| `ContextSelect` | `src/pages/ContextSelect.tsx` | Tela de seleção de contexto pós-login |
| `SuperAdminIndicator` | `src/components/layout/SuperAdminIndicator.tsx` | Indicador no MainLayout para super admins |
| `FilialManager` | `src/components/shared/FilialManager.tsx` | Componente reutilizável para CRUD de filiais |

## Permissões e Segurança

```mermaid
flowchart TD
    Request([Request para /superadmin/*]) --> CheckAuth{Usuário<br/>Autenticado?}
    
    CheckAuth -->|Não| RedirectLogin([Redireciona /auth])
    CheckAuth -->|Sim| CheckRole{Tem Role<br/>super_admin?}
    
    CheckRole -->|Não| RedirectHome([Redireciona /])
    CheckRole -->|Sim| RenderPage[Renderiza Página<br/>Super Admin]
    
    subgraph "Validação de Role"
        Query[SELECT * FROM user_roles<br/>WHERE user_id = ?<br/>AND role = 'super_admin']
    end
    
    CheckRole --> Query
    
    style Request fill:#e1f5ff
    style RedirectLogin fill:#ffe1e1
    style RedirectHome fill:#ffe1e1
    style RenderPage fill:#e1ffe1
```

## RLS Policies

O Super Admin tem acesso global via políticas RLS específicas:

```sql
-- Exemplo: Política para filiais
CREATE POLICY "Super admin has full access to filiais"
ON filiais FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);
```

---

**Última atualização:** 2026-01-04
