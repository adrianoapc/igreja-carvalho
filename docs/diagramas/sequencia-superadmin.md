# Sequência — Super Admin

Diagramas de sequência para as principais interações do portal Super Admin.

## Login e Seleção de Contexto

```mermaid
sequenceDiagram
    actor User as Super Admin
    participant Auth as Auth.tsx
    participant Helper as checkSuperAdminRole.ts
    participant Supabase as Supabase
    participant Storage as localStorage
    participant Router as React Router

    User->>Auth: Submete credenciais
    Auth->>Supabase: signInWithPassword()
    Supabase-->>Auth: Session + User
    
    Auth->>Helper: checkIsSuperAdmin(userId)
    Helper->>Supabase: SELECT FROM user_roles<br/>WHERE role = 'super_admin'
    Supabase-->>Helper: { data: role } ou null
    Helper-->>Auth: true/false
    
    alt Não é Super Admin
        Auth->>Router: navigate('/')
    else É Super Admin
        Auth->>Helper: getPreferredContext()
        Helper->>Storage: getItem('preferred_context')
        Storage-->>Helper: 'superadmin' | 'app' | null
        
        alt Tem preferência salva
            Helper-->>Auth: context
            Auth->>Router: navigate(context === 'superadmin' ? '/superadmin' : '/')
        else Sem preferência
            Auth->>Router: navigate('/context-select')
        end
    end
```

## Seleção de Contexto

```mermaid
sequenceDiagram
    actor User as Super Admin
    participant Page as ContextSelect.tsx
    participant Storage as localStorage
    participant Router as React Router

    User->>Page: Visualiza opções
    
    alt Escolhe Painel SaaS
        User->>Page: Click "Painel SaaS"
        
        alt Marca "Lembrar escolha"
            Page->>Storage: setItem('preferred_context', 'superadmin')
        end
        
        Page->>Router: navigate('/superadmin')
    else Escolhe Aplicativo Igreja
        User->>Page: Click "Aplicativo Igreja"
        
        alt Marca "Lembrar escolha"
            Page->>Storage: setItem('preferred_context', 'app')
        end
        
        Page->>Router: navigate('/')
    end
```

## Gerenciamento de Igrejas

```mermaid
sequenceDiagram
    actor Admin as Super Admin
    participant Page as Igrejas.tsx
    participant Supabase as Supabase
    participant RLS as RLS Policies

    Admin->>Page: Acessa /superadmin/igrejas
    Page->>Supabase: SELECT * FROM igrejas
    Supabase->>RLS: Verifica super_admin role
    RLS-->>Supabase: Acesso permitido (global)
    Supabase-->>Page: Lista de igrejas
    Page-->>Admin: Exibe tabela

    Admin->>Page: Busca por nome
    Page->>Supabase: SELECT WHERE nome ILIKE '%termo%'
    Supabase-->>Page: Resultados filtrados
    
    Admin->>Page: Altera status da igreja
    Page->>Supabase: UPDATE igrejas SET status = 'ativo'
    Supabase-->>Page: Confirmação
    Page-->>Admin: Toast de sucesso
```

## Gerenciamento de Filiais

```mermaid
sequenceDiagram
    actor Admin as Super Admin
    participant Page as Igrejas.tsx
    participant Manager as FilialManager.tsx
    participant Supabase as Supabase

    Admin->>Page: Expande row da igreja
    Page->>Manager: Renderiza com igreja_id
    Manager->>Supabase: SELECT FROM filiais<br/>WHERE igreja_id = ?
    Supabase-->>Manager: Lista de filiais
    
    alt Adicionar Filial
        Admin->>Manager: Click "Adicionar"
        Manager->>Manager: Abre Dialog
        Admin->>Manager: Preenche nome
        Manager->>Supabase: INSERT INTO filiais<br/>(nome, igreja_id)
        Supabase-->>Manager: Nova filial
        Manager-->>Admin: Toast sucesso + Refresh
    end
    
    alt Excluir Filial
        Admin->>Manager: Click "Excluir"
        Manager->>Manager: Verifica se é "Matriz"
        
        alt É Matriz
            Manager-->>Admin: Toast erro: "Não pode excluir Matriz"
        else Não é Matriz
            Manager->>Supabase: DELETE FROM filiais WHERE id = ?
            Supabase-->>Manager: Confirmação
            Manager-->>Admin: Toast sucesso + Refresh
        end
    end
```

## Consulta de Métricas

```mermaid
sequenceDiagram
    actor Admin as Super Admin
    participant Page as Metricas.tsx
    participant Supabase as Supabase
    participant RPC as RPC Function

    Admin->>Page: Acessa /superadmin/metricas
    Page->>Supabase: SELECT * FROM igrejas
    Supabase-->>Page: Lista para dropdown
    
    Admin->>Page: Seleciona igreja
    Page->>Supabase: SELECT FROM metricas_igreja<br/>WHERE igreja_id = ?
    Supabase-->>Page: Dados de métricas
    Page-->>Admin: Exibe KPIs em cards
    
    opt Recalcular Métricas
        Admin->>Page: Click "Recalcular"
        Page->>RPC: rpc('recalcular_metricas_igreja', { igreja_id })
        RPC->>Supabase: Executa contagens e agregações
        Supabase-->>RPC: Métricas atualizadas
        RPC-->>Page: Sucesso
        Page->>Supabase: SELECT FROM metricas_igreja
        Supabase-->>Page: Dados atualizados
        Page-->>Admin: Refresh dos KPIs
    end
```

## Troca de Contexto

```mermaid
sequenceDiagram
    actor Admin as Super Admin
    participant SALayout as SuperAdminLayout
    participant MainLayout as MainLayout
    participant Indicator as SuperAdminIndicator
    participant Router as React Router

    Note over Admin,Router: Do Portal SaaS para o App
    
    Admin->>SALayout: Visualiza header
    SALayout-->>Admin: Mostra botão "Ir para App Igreja"
    Admin->>SALayout: Click no botão
    SALayout->>Router: navigate('/')
    Router-->>MainLayout: Renderiza App normal
    
    Note over Admin,Router: Do App para o Portal SaaS
    
    MainLayout->>Indicator: Renderiza (se super_admin)
    Indicator-->>Admin: Mostra Shield icon
    Admin->>Indicator: Click no ícone
    Indicator->>Router: navigate('/superadmin')
    Router-->>SALayout: Renderiza Portal SaaS
```

---

**Última atualização:** 2026-01-04
