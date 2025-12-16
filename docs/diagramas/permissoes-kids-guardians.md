# Permissões – Kids (Guardians)

```mermaid
flowchart TD
  A[Usuário autenticado] --> B{Ação desejada}
  B -->|Visualizar check-ins ativos| VSEL[SELECT em view_kids_checkins_ativos]
  B -->|Fazer check-out| VUPD[UPDATE em kids_checkins]
  B -->|Gerenciar check-in/out geral| VALL[ALL em kids_checkins]

  %% Visualização
  VSEL --> C{Tem role admin/lider/secretario?}
  C -- Sim --> C1[PERMITIR\nPolicy: "View kids checkins ativos readable"\nhas_role(admin|lider|secretario)]
  C -- Não --> C2{É responsável na linha?\nresponsavel_id = seu profile.id}
  C2 -- Sim --> C3[PERMITIR\nPolicy: "View kids checkins ativos readable"\nFiltro por responsavel_id]
  C2 -- Não --> C4[NEGAR]

  %% Checkout
  VUPD --> D{Tem role admin/lider/secretario?}
  D -- Sim --> D1[PERMITIR\nPolicy: "Lideres gerenciam kids checkins"\n(ALL sobre kids_checkins)]
  D -- Não --> D2{RLS pais: \nresponsavel_id = seu profile.id\ne checkout_at IS NULL}
  D2 -- Sim --> D3[PERMITIR\nPolicy: "Pais podem fazer checkout dos filhos"\n(UPDATE)]
  D2 -- Não --> D4[NEGAR]

  %% Gestão geral (líderes)
  VALL --> E{Tem role admin/lider/secretario?}
  E -- Sim --> E1[PERMITIR\nPolicy: "Lideres gerenciam kids checkins"\n(ALL)]
  E -- Não --> E2[NEGAR]

  %% Autorização (camada de aplicação)
  subgraph AUT[Configurar Responsáveis Autorizados]
    F[FamilyWallet: Vincular Responsável Autorizado] --> F1[Buscar pessoa]
    F1 --> F2[Confirmar parentesco]
    F2 --> F3[Selecionar crianças]
    F3 --> F4[Salvar vínculo\nTabela: familias]
  end

  %% Efeito do vínculo
  F4 --> G[App permite que a pessoa autorizada\nseja usada como responsavel_id no Kids]
  G -.-> VSEL
  G -.-> VUPD

  %% Observações
  subgraph OBS[Observações]
    O1[Autorização (guardians) é modelada em 'familias' e usada pelo app para definir quem pode ser responsável.] 
    O2[RLS que efetivamente controla acesso/ações está em 'kids_checkins' e na view 'view_kids_checkins_ativos'.]
  end
```

Baseado em:
- Autorização de responsáveis (guardians): [../AUTHORIZED_GUARDIANS.md](../AUTHORIZED_GUARDIANS.md)
- Políticas RLS e tabelas: `supabase/migrations/20251208_kids_checkins_table.sql` (policies: "Lideres gerenciam kids checkins", "Pais veem checkins dos filhos", "Pais podem fazer checkout dos filhos") e `supabase/migrations/20251130021706_7f358c6c-dd97-49ab-b8ce-243957143610.sql` (RLS de `familias`).