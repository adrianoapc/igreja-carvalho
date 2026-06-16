# Módulo Kids

> Fundido de: AUTHORIZED_GUARDIANS.md, BIDIRECTIONAL_RELATIONSHIPS.md,
> KIDS_INCLUSION.md, NOTIFICACOES_KIDS.md (dez/2025).
> Originais em `docs/_archive/_fundidos/`.

## Rotas

| Rota | Componente | Acesso |
|---|---|---|
| `/kids` | `Kids.tsx` | Líderes Kids |
| `/kids/dashboard` | `kids/Dashboard.tsx` | Líderes |
| `/kids/criancas` | `kids/Criancas.tsx` | Líderes |
| `/kids/scanner` | `kids/Scanner.tsx` | Líderes (check-in) |
| `/kids/turma-ativa` | `kids/TurmaAtiva.tsx` | Líderes |
| `/kids/config` | `kids/Config.tsx` | Admin Kids |
| `/recepcao/infantil` | `recepcao/Infantil.tsx` | Recepcionistas |

---

## Estrutura de dados (tabela `familias`)

```sql
familias (
  pessoa_id   uuid → profiles,  -- responsável principal (ex: Pai/Mãe)
  familiar_id uuid → profiles,  -- criança ou autorizado
  tipo_parentesco text,          -- pai | mãe | filho | filha | avó | tio | ...
  PRIMARY KEY (pessoa_id, familiar_id)
)
```

Busca sempre **bidirecional**:
```sql
SELECT * FROM familias WHERE pessoa_id = :id OR familiar_id = :id
```

Dependentes (crianças < 13 anos) também registram `necessidades_especiais` e `alergias`
no campo correspondente do perfil.

---

## Guardians / Responsáveis autorizados (`AUTHORIZED_GUARDIANS.md`)

Permite que um responsável principal autorize terceiros (avó, tio, irmão adulto, etc.)
a visualizar e fazer check-in das crianças.

### Componente: `VincularResponsavelDialog` (`src/components/familia/VincularResponsavelDialog.tsx`)

Fluxo:
1. Buscar por e-mail ou telefone (tempo real, ≥ 2 chars)
2. Selecionar tipo de parentesco (Avó/Avô paterno/materno, Tio/Tia, Padrasto/Madrasta, Prima/Primo, Irmã/Irmão adulto, Outro)
3. Selecionar crianças (< 13 anos) que essa pessoa pode buscar
4. "Vincular" → insere em `familias` (`pessoa_id = autorizado, familiar_id = criança`)

Seção **"Quem Pode Buscar"**: lista autorizados com nome, parentesco, contato e opção de remover acesso.

---

## Relacionamentos bidirecionais (`BIDIRECTIONAL_RELATIONSHIPS.md`)

### Problema resolvido
Antes: se João adicionava Maria como "filha", Maria não via João em sua lista de familiares.

### Solução: `getDisplayRole()`

Localizado em: `src/pages/FamilyWallet.tsx:115`, `src/pages/Perfil.tsx:122`,
`src/components/pessoas/FamiliaresSection.tsx:70`.

| Papel armazenado | Fluxo normal | Fluxo reverso (isReverse=true) |
|---|---|---|
| `pai` | Pai | Filho (M) / Filha (F) |
| `mãe` | Mãe | Filho (M) / Filha (F) |
| `filho` / `filha` | Filho/Filha | Responsável |
| `marido` / `esposa` | Marido/Esposa | Cônjuge |
| Outros | [como está] | Familiar |

---

## Inclusão / Necessidades especiais (`KIDS_INCLUSION.md`)

Campo `necessidades_especiais` nos formulários de dependentes:

| Componente | Campo | Ícone |
|---|---|---|
| `AdicionarDependenteDrawer.tsx` | Textarea opcional | `HeartHandshake` (azul) |
| `EditarDependenteDrawer.tsx` | Textarea opcional | `HeartHandshake` (azul) |
| `KidCard.tsx` | Badge "Inclusão" + seção expandida | `HeartHandshake` (azul) |

Tipos: deficiência visual, auditiva, motora, TDAH, TEA, outros.

**Status:** Implementado (dez/2025, confirmado em `src/integrations/supabase/types.ts`).

---

## Notificações push para responsáveis (`NOTIFICACOES_KIDS.md`)

### Triggers SQL

#### `notify_kids_diario()` (`supabase/migrations/20251209_kids_notifications.sql`)
- **Disparo**: AFTER INSERT em `kids_diario`
- **Destinatário**: responsável da criança
- **Mensagem**: "Notícia do Kids! 🎨 — O diário de [Nome] foi atualizado..."
- **Ação**: abre diário da criança na data do culto

#### `notify_kids_checkout()`
- **Disparo**: AFTER UPDATE em `kids_checkins` quando `checkout_at` NULL → timestamp
- **Destinatário**: responsável
- **Mensagem**: "Saída Confirmada ✅ — O check-out de [Nome] foi realizado..."

### Hooks / Componentes

- `useNotifications.tsx` — hook central (`notifications`, `pushEnabled`, `requestPushPermission`)
- `NotificationBell.tsx`, `NotificationSettings.tsx` — existem em `src/components/`

### Presença em tempo real

- Trigger: `registrar_presenca_entrada_kids()` em `kids_checkins`
  (`supabase/migrations/20251209_kids_presence_on_checkin.sql`)

---

## Edge functions relacionadas

| Função | Propósito |
|---|---|
| `checkin-whatsapp-geo` | Check-in geo por WhatsApp (a confirmar — Kids ou Recepcao?) |
