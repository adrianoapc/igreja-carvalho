# Controle de Isolamento Multi-Tenant

## Objetivo
Registrar tabelas auditadas e políticas RLS atualizadas para garantir isolamento de dados por igreja (tenant).

## Data da Auditoria
2026-01-04

## Referências
- ADR-021: Multi-Tenant Arquitetura
- docs/01-Arquitetura/04-rls-e-seguranca.MD

---

## Classificação de Tabelas

### ✅ Tabelas com Isolamento Completo (igreja_id + RLS)

| Tabela | igreja_id | filial_id | FK igrejas | Índice | RLS |
|--------|-----------|-----------|------------|--------|-----|
| profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| alteracoes_perfil_pendentes | ✅ | ✅ | ✅ | ✅ | ✅ |
| familias | ✅ | ✅ | ✅ | ✅ | ✅ |
| sentimentos_membros | ✅ | ✅ | ✅ | ✅ | ✅ |
| notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| tags_midias | ✅ | ✅ | ✅ | ✅ | ✅ |
| midias | ✅ | ✅ | ✅ | ✅ | ✅ |
| midia_tags | ✅ | ✅ | ✅ | ✅ | ✅ |
| liturgias | ✅ | ✅ | ✅ | ✅ | ✅ |
| categorias_financeiras | ✅ | ✅ | ✅ | ✅ | ✅ |
| subcategorias_financeiras | ✅ | ✅ | ✅ | ✅ | ✅ |
| formas_pagamento | ✅ | ✅ | ✅ | ✅ | ✅ |
| contas | ✅ | ✅ | ✅ | ✅ | ✅ |
| transacoes_financeiras | ✅ | ✅ | ✅ | ✅ | ✅ |
| bases_ministeriais | ✅ | ✅ | ✅ | ✅ | ✅ |
| centros_custo | ✅ | ✅ | ✅ | ✅ | ✅ |
| fornecedores | ✅ | ✅ | ✅ | ✅ | ✅ |
| onboarding_requests | ✅ | ❌ | ✅ | ✅ | ✅ |
| user_roles | ✅ | ❌ | ✅ | ✅ | ✅ |

### 🌐 Tabelas Globais (Sem igreja_id - Design Intencional)

| Tabela | Motivo | RLS |
|--------|--------|-----|
| app_config | Configuração global do sistema | ✅ (admin/tecnico) |
| app_permissions | Permissões globais do sistema | ✅ (leitura pública, escrita admin) |
| app_roles | Definição de papéis globais | ✅ (leitura pública, escrita admin) |
| role_permissions | Mapeamento role→permission global | ✅ (admin only) |
| role_permissions_audit | Auditoria de alterações | ✅ (admin only) |
| edge_function_config | Configuração de edge functions | ✅ (admin only) |
| igrejas | Tabela raiz de tenants | ✅ (super_admin) |
| filiais | Subdivisões de igrejas | ✅ (admin_igreja) |

### ❓ Tabela Não Encontrada

| Tabela | Status |
|--------|--------|
| transaction_attachments | Não existe - usar storage bucket |

---

## Políticas RLS Atualizadas

### user_roles (Atualizada em 2026-01-04)

```sql
-- Adicionada coluna igreja_id UUID REFERENCES igrejas(id)
-- Índices: idx_user_roles_igreja_id, idx_user_roles_igreja_user
-- Constraint: user_roles_user_id_role_igreja_key UNIQUE (user_id, role, igreja_id)

-- Políticas:
-- user_roles_select_own_or_admin: Usuário vê próprios papéis OU admin da igreja
-- user_roles_insert_admin: Admin pode criar papéis na mesma igreja
-- user_roles_update_admin: Admin pode alterar papéis na mesma igreja
-- user_roles_delete_admin: Admin pode remover papéis na mesma igreja
```

### Funções de Segurança

| Função | Escopo Igreja | Descrição |
|--------|---------------|-----------|
| `has_role(uuid, app_role)` | ❌ Global | Verifica papel do usuário (compatibilidade) |
| `has_role_in_igreja(uuid, app_role, uuid)` | ✅ | Verifica papel em igreja específica |
| `has_filial_access(uuid, uuid)` | ✅ | Valida acesso a filial via JWT |
| `get_current_user_igreja_id()` | ✅ | Retorna igreja_id do usuário atual |
| `get_jwt_igreja_id()` | ✅ | Extrai igreja_id do JWT |

---

## Storage Buckets

### Buckets com Isolamento por Tenant

| Bucket | Isolamento | Política |
|--------|------------|----------|
| igreja-logo | ✅ path: `{igreja_id}/logo.png` | Upload por admin_igreja |
| midias | ✅ path: `{igreja_id}/{filial_id}/...` | RLS via metadata |
| transaction-attachments | ✅ path: `{igreja_id}/{transacao_id}/...` | Vinculado a transação |
| avatars | ✅ path: `{user_id}/avatar.png` | Owner-based |

---

## Próximos Passos

1. [ ] Validar edge functions usam `igreja_id` do contexto JWT
2. [ ] Revisar queries no frontend que buscam user_roles
3. [ ] Testar fluxo de atribuição de papéis por admin_igreja
4. [ ] Migrar dados legados sem igreja_id (se existirem)

---

## Histórico de Alterações

| Data | Tabela | Alteração |
|------|--------|-----------|
| 2026-01-04 | user_roles | Adicionado igreja_id, FK, índices, RLS atualizada |
