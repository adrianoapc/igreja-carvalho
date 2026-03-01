

# Plano: Documento de Permissoes Contextuais por Time (Corrigido + Integracao com Frontend)

## Objetivo

Criar `docs/planos/permissoes-contextuais-times.md` documentando como as permissoes contextuais por time se integram com o controle de permissoes **ja existente** no frontend (AuthGate, Sidebar, usePermissions).

## Descoberta: Duas Camadas de Controle

O sistema atual possui duas camadas distintas que precisam coexistir:

### Camada 1: Acesso a Rota (ja existe, nao muda)
- **AuthGate**: Bloqueia rotas inteiras via `requiredPermission` (ex: `ministerio.view`)
- **Sidebar**: Esconde itens do menu via `usePermissions.checkPermission()`
- **Quem ve "Escalas" no menu**: quem tem role `admin`, `pastor` ou `lider` (permission `ministerio.view`)
- **Quem ve "Eventos" no menu**: quem tem `eventos.view`

### Camada 2: Filtragem de Dados (nova, a ser implementada)
- **Dentro da tela**: filtra quais times, membros e escalas o usuario ve
- Exemplo: Lider entra em `/escalas` (Camada 1 permite), mas so ve os times que lidera (Camada 2 filtra)

## Conteudo do Documento

O arquivo `docs/planos/permissoes-contextuais-times.md` incluira:

### 1. Situacao Atual
- RBAC global (app_roles, app_permissions, role_permissions, user_app_roles)
- AuthGate bloqueia rotas por permission key
- Sidebar filtra menu por permission key
- Dentro das telas, nao existe filtragem por vinculo ao time

### 2. Modelo Corrigido de Hierarquia

```text
Camada 1 - Acesso a Rota (AuthGate/Sidebar):
  Permission key (ministerio.view, escalas.view, etc.)
  Se nao tem --> rota bloqueada, menu escondido

Camada 2 - Filtragem de Dados (dentro da tela):
  admin/tecnico --> bypass, ve tudo
  qualquer outro role:
    lider_id/sublider_id --> gerencia SEU time
    membro ativo --> ve SEU time (leitura)
    sem vinculo --> time nao aparece na lista
```

### 3. Tabela de Integracao por Tela

| Tela | Rota | Camada 1 (AuthGate) | Camada 2 (Dados) |
|------|------|---------------------|-------------------|
| Escalas | `/escalas` | `ministerio.view` | Dropdown filtrado por vinculo |
| Times | `/eventos/times` | `eventos.view` | Lista filtrada por vinculo |
| Eventos Gestao | `/eventos` | `eventos.view` | Sem mudanca (evento nao eh time) |
| Minhas Escalas | `/minhas-escalas` | Nenhuma (aberto) | Ja filtra por pessoa_id |
| Voluntariado | `/voluntariado` | Nenhuma (aberto) | Sem mudanca |
| Sidebar menu | N/A | `ministerio.view` | Sem mudanca |

### 4. Cenarios Reais Documentados

**Joao** (role global: `pastor`):
- Camada 1: ve menu Escalas, Eventos, Gabinete (tem ministerio.view, gabinete.view)
- Camada 2 em `/escalas`: so ve Time Evangelismo (eh lider_id) e Time Pastoral (eh membro)
- Nao ve Time Louvor (sem vinculo)

**Maria** (role global: `lider`):
- Camada 1: ve menu Escalas (tem ministerio.view)
- Camada 2 em `/escalas`: so ve Time Louvor (eh lider_id)

**Carlos** (role global: `membro`):
- Camada 1: NAO ve menu Escalas (nao tem ministerio.view)
- Camada 2: nunca chega, rota bloqueada
- Acessa apenas `/minhas-escalas` (rota aberta)

**Ana** (role global: `admin`):
- Camada 1: ve tudo
- Camada 2: bypass, ve todos os times

### 5. Onde o codigo muda vs onde NAO muda

**NAO muda (Camada 1)**:
- `AuthGate.tsx` - continua igual
- `usePermissions.ts` - continua igual
- `Sidebar.tsx` - continua igual (mesmos permission keys)
- `MobileNavbar.tsx` - continua igual

**Muda (Camada 2 - novo)**:
- Criar `useTimePermission(timeId?)` - hook que retorna vinculos do usuario
- `Escalas.tsx` - filtrar dropdown de times
- `EscalasTabContent.tsx` - restringir acoes por vinculo
- `Times.tsx` (eventos) - filtrar lista de times
- `VidaIgrejaEnvolvimento.tsx` - filtrar times visiveis por quem consulta
- RLS policies no banco para times, membros_time, escalas

### 6. Hierarquia Corrigida (pastor nao eh bypass)
- Apenas `admin` e `tecnico` tem bypass global na Camada 2
- `pastor` segue regras de vinculo para times/escalas
- `pastor` mantem acesso global a modulos pastorais (gabinete, aconselhamento)

### 7. Fases de Execucao
1. Criar RPC `get_user_time_role` no banco
2. Ajustar RLS em times, membros_time, escalas
3. Criar hook `useTimePermission`
4. Atualizar telas (Escalas, Times, etc.)
5. Adicionar badges visuais (Meu Time, Lider, Membro)

## Arquivo a Criar

| Arquivo | Acao |
|---------|------|
| `docs/planos/permissoes-contextuais-times.md` | Criar documento completo |

Nenhum codigo sera alterado. Apenas documentacao.

