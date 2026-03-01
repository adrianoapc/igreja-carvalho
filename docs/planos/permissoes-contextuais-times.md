# Permissões Contextuais por Time

## 1. Situação Atual

O sistema possui um RBAC global baseado em tabelas dinâmicas:

- **app_roles**: Roles do sistema (admin, pastor, lider, tesoureiro, membro, visitante)
- **app_permissions**: Permissões granulares (ministerio.view, eventos.view, gabinete.admin, etc.)
- **role_permissions**: Ligação role → permissão
- **user_app_roles**: Ligação usuário → role

### Controle no Frontend (Camada 1)

| Componente | Função | Exemplo |
|------------|--------|---------|
| `AuthGate` | Bloqueia rotas inteiras via `requiredPermission` | `ministerio.view` para `/escalas` |
| `Sidebar` | Esconde itens do menu via `usePermissions.checkPermission()` | Esconde "Escalas" se não tem `ministerio.view` |
| `usePermissions` | Hook que consulta `has_permission` RPC | Retorna boolean por permission key |

### O que falta (Camada 2)

Dentro das telas, **não existe filtragem por vínculo ao time**. Quem acessa `/escalas` vê **todos** os times, independente de ser líder, membro ou não ter vínculo.

---

## 2. Modelo de Duas Camadas

```
┌─────────────────────────────────────────────────────────┐
│ Camada 1 — Acesso à Rota (já existe, NÃO muda)         │
│                                                         │
│ Permission key (ministerio.view, eventos.view, etc.)    │
│ Se não tem → rota bloqueada, menu escondido             │
│                                                         │
│ Componentes: AuthGate, Sidebar, usePermissions          │
└─────────────────────────┬───────────────────────────────┘
                          │ usuário passou
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Camada 2 — Filtragem de Dados (NOVA, a implementar)     │
│                                                         │
│ admin / tecnico → bypass, vê tudo                       │
│                                                         │
│ qualquer outro role (pastor, lider, membro...):         │
│   lider_id / sublider_id do time → CRUD no SEU time     │
│   membro ativo (membros_time) → leitura no SEU time     │
│   sem vínculo → time não aparece                        │
│                                                         │
│ Componentes: useTimePermission, RLS, RPC                │
└─────────────────────────────────────────────────────────┘
```

### Regra crítica: pastor NÃO é bypass

- **Bypass global (Camada 2)**: apenas `admin` e `tecnico`
- **Pastor**: segue regras de vínculo para times/escalas
- **Pastor mantém** acesso global a módulos pastorais (gabinete, aconselhamento, batismo) — esses são controlados pela Camada 1 com permission keys próprias

---

## 3. Tabela de Integração por Tela

| Tela | Rota | Camada 1 (AuthGate) | Camada 2 (Dados) |
|------|------|---------------------|-------------------|
| Escalas | `/escalas` | `ministerio.view` | Dropdown filtrado por vínculo |
| Times | `/eventos/times` | `eventos.view` | Lista filtrada por vínculo |
| Eventos Gestão | `/eventos` | `eventos.view` | Sem mudança (evento ≠ time) |
| Minhas Escalas | `/minhas-escalas` | Nenhuma (aberto) | Já filtra por pessoa_id |
| Voluntariado | `/voluntariado` | Nenhuma (aberto) | Sem mudança |
| Sidebar menu | N/A | `ministerio.view` | Sem mudança |

---

## 4. Cenários Reais

### João — role global: `pastor`

| Time | Vínculo | Acesso em `/escalas` |
|------|---------|----------------------|
| Evangelismo | `lider_id` | CRUD completo (gerencia membros, escalas, posições) |
| Pastoral | `membros_time` ativo | Somente leitura (vê dados, confirma própria escala) |
| Louvor | nenhum | **Não aparece** no dropdown |

- Camada 1: vê menu Escalas, Eventos, Gabinete (tem `ministerio.view`, `gabinete.view`)
- Camada 2: só vê 2 dos 3 times

### Maria — role global: `lider`

- Camada 1: vê menu Escalas (tem `ministerio.view`)
- Camada 2: só vê Time Louvor (é `lider_id`)

### Carlos — role global: `membro`

- Camada 1: **NÃO** vê menu Escalas (não tem `ministerio.view`)
- Camada 2: nunca chega, rota bloqueada
- Acessa apenas `/minhas-escalas` (rota aberta)

### Ana — role global: `admin`

- Camada 1: vê tudo
- Camada 2: bypass, vê todos os times

---

## 5. O que muda vs. o que NÃO muda

### NÃO muda (Camada 1)

| Arquivo | Motivo |
|---------|--------|
| `AuthGate.tsx` | Continua bloqueando rotas por permission key |
| `usePermissions.ts` | Continua consultando `has_permission` RPC |
| `Sidebar.tsx` | Mesmos permission keys para itens do menu |
| `MobileNavbar.tsx` | Idem |

### Muda (Camada 2 — novo)

| Arquivo / Recurso | Mudança |
|--------------------|---------|
| RPC `get_user_time_role` | Criar no banco — retorna o nível de acesso do usuário para um time |
| RLS em `times` | SELECT filtrado por vínculo (ou bypass admin/tecnico) |
| RLS em `membros_time` | SELECT filtrado por time_id com vínculo |
| RLS em `escalas` | SELECT/INSERT/UPDATE/DELETE conforme nível |
| `useTimePermission(timeId?)` | Novo hook — retorna `{ role, canEdit, canView, isAdmin }` |
| `Escalas.tsx` | Filtrar dropdown de times pelo hook |
| `EscalasTabContent.tsx` | Restringir ações (checkbox, delete) por vínculo |
| `Times.tsx` (eventos) | Filtrar lista de times |
| `VidaIgrejaEnvolvimento.tsx` | Filtrar times visíveis na ficha do membro |

---

## 6. Implementação Técnica

### 6.1 RPC: `get_user_time_role`

```sql
-- Retorna: 'admin' | 'lider' | 'sublider' | 'membro' | null
CREATE OR REPLACE FUNCTION public.get_user_time_role(
  p_pessoa_id UUID,
  p_time_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- 1. Verificar se é admin/tecnico (bypass)
  SELECT EXISTS(
    SELECT 1 FROM user_app_roles uar
    JOIN app_roles ar ON ar.id = uar.role_id
    WHERE uar.user_id = (SELECT user_id FROM profiles WHERE id = p_pessoa_id)
    AND ar.name IN ('admin', 'tecnico')
  ) INTO v_is_admin;

  IF v_is_admin THEN RETURN 'admin'; END IF;

  -- 2. Verificar se é líder do time
  SELECT 'lider' INTO v_role
  FROM times WHERE id = p_time_id AND lider_id = p_pessoa_id;
  IF v_role IS NOT NULL THEN RETURN v_role; END IF;

  -- 3. Verificar se é sublíder
  SELECT 'sublider' INTO v_role
  FROM times WHERE id = p_time_id AND sublider_id = p_pessoa_id;
  IF v_role IS NOT NULL THEN RETURN v_role; END IF;

  -- 4. Verificar se é membro ativo
  SELECT 'membro' INTO v_role
  FROM membros_time WHERE time_id = p_time_id AND pessoa_id = p_pessoa_id AND ativo = true;
  IF v_role IS NOT NULL THEN RETURN v_role; END IF;

  -- 5. Sem vínculo
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.2 Hook: `useTimePermission`

```typescript
// src/hooks/useTimePermission.ts
interface TimePermission {
  role: 'admin' | 'lider' | 'sublider' | 'membro' | null;
  canEdit: boolean;   // admin, lider, sublider
  canView: boolean;   // admin, lider, sublider, membro
  isAdmin: boolean;   // admin/tecnico bypass
  loading: boolean;
}
```

### 6.3 Filtro no dropdown de times (Escalas.tsx)

```typescript
// Antes: carrega todos os times
// Depois: se não é admin/tecnico, filtra por vínculo

const timesVisiveis = isAdmin
  ? times
  : times.filter(t =>
      t.lider_id === pessoaId ||
      t.sublider_id === pessoaId ||
      membrosDosTimeIds.includes(t.id)
    );
```

---

## 7. Fases de Execução

| Fase | Escopo | Dependência |
|------|--------|-------------|
| 1 | Criar RPC `get_user_time_role` no banco | Nenhuma |
| 2 | Ajustar RLS em `times`, `membros_time`, `escalas` | Fase 1 |
| 3 | Criar hook `useTimePermission` | Fase 1 |
| 4 | Atualizar `Escalas.tsx` — filtrar dropdown | Fase 3 |
| 5 | Atualizar `Times.tsx` — filtrar lista | Fase 3 |
| 6 | Adicionar badges visuais (Meu Time, Líder, Membro) | Fase 4-5 |
| 7 | Atualizar `VidaIgrejaEnvolvimento.tsx` | Fase 3 |

---

## 8. Módulos com Acesso Global do Pastor

Estes módulos continuam com acesso global para o role `pastor` (controlados pela Camada 1, sem filtragem por time):

| Módulo | Permission Key | Justificativa |
|--------|---------------|---------------|
| Gabinete Pastoral | `gabinete.view` / `gabinete.admin` | Função pastoral, não vinculada a time |
| Aconselhamento | `gabinete.view` | Atendimentos pastorais |
| Batismos | `ministerio.view` | Acompanhamento pastoral |
| Visitas | `gabinete.view` | Atividade pastoral |

Para **times e escalas**, pastor segue as mesmas regras de vínculo que qualquer outro role.
