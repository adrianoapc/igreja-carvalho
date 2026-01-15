# Tela: Integrações Financeiras

**Localização:** `/financas/integracoes`  
**Permissão Requerida:** `financeiro.admin`  
**Status:** ✅ Implementada (Phase 1)  
**Componentes Relacionados:**
- `IntegracaoCriarDialog.tsx` (Modal de criação)
- `Integracoes.tsx` (Página principal)

---

## Features

### 📋 Listagem
- **Tabela** com todas as integrações da igreja
- **Colunas:**
  - Provedor (Santander, Getnet, API Genérica)
  - CNPJ (normalizado)
  - Status (Ativo/Inativo/Erro)
  - Filial (Específica/Geral)
  - Data de criação
  - Ações (Edit/Delete)

### ➕ Criar Integração
- **Dialog Modal** com form agnóstico
- **Campos:**
  - Seletor de provedor (dropdown)
  - CNPJ (text input)
  - Client ID (text input)
  - Client Secret (password input)
  - Application Key (password input, apenas Getnet)
  - Upload PFX (file input, .pfx validation)
  - Senha do PFX (password input)
  - Toggle Ativo/Inativo
- **Ações:**
  - "Cancelar" - fecha sem salvar
  - "Salvar Integração" - envia para Edge Function

### 🗑️ Deletar
- Confirmação em AlertDialog
- Cascata: deleta também secrets criptografados

### 🔄 Atualizar
- Botão de refresh para forçar refetch da query

---

## Fluxo de Dados

```
Component Tree:
├── Integracoes (página)
│   ├── useQuery("integracoes_financeiras") → SELECT from DB
│   ├── Button "Nova Integração"
│   ├── Table (map integracoes)
│   │   └── Row (Edit, Delete buttons)
│   ├── IntegracaoCriarDialog (dialog modal)
│   │   ├── Form fields
│   │   ├── FileReader (PFX → base64)
│   │   └── supabase.functions.invoke("integracoes-config")
│   └── AlertDialog (confirmação delete)

Data Flow:
1. User → Integracoes.tsx (list)
2. User clicks "Nova Integração" → IntegracaoCriarDialog opens
3. User fills form → validates côs-cliente
4. User uploads PFX → FileReader → base64
5. User clicks "Salvar" → invoke Edge Function
6. Edge Function encrypts + saves to DB
7. Success → invalidate cache → refetch list
8. Table updates com nova integração
```

---

## API Integration

### Edge Function: `integracoes-config`
**Endpoint:** POST `/functions/v1/integracoes-config`

**Request Payload:**
```json
{
  "action": "create_integracao",
  "provedor": "santander",
  "cnpj": "00.000.000/0000-00",
  "client_id": "abc123",
  "client_secret": "def456",
  "application_key": null,
  "pfx_blob": "base64_encoded_string",
  "pfx_password": "cert_password",
  "ativo": true,
  "igreja_id": "uuid",
  "filial_id": "uuid"
}
```

**Response Success (201):**
```json
{
  "success": true,
  "integracao_id": "uuid",
  "message": "Integration created successfully"
}
```

**Response Error (4xx/5xx):**
```json
{
  "error": "Error message"
}
```

---

## Database Schema

### Table: `integracoes_financeiras`
| Column | Type | Null | Key | Default |
|--------|------|------|-----|---------|
| id | UUID | NO | PK | gen_random_uuid() |
| igreja_id | UUID | NO | FK | - |
| filial_id | UUID | YES | FK | NULL |
| cnpj | TEXT | NO | - | - |
| provedor | TEXT | NO | - | - |
| status | TEXT | NO | - | 'ativo' |
| config | JSONB | NO | - | '{}' |
| created_at | TIMESTAMPTZ | NO | - | NOW() |
| updated_at | TIMESTAMPTZ | NO | - | NOW() |

**Indexes:**
- `idx_integracoes_financeiras_igreja` (igreja_id)
- `idx_integracoes_financeiras_filial` (filial_id)
- `idx_integracoes_financeiras_provedor` (provedor)

### Table: `integracoes_financeiras_secrets`
| Column | Type | Null | Key | Default |
|--------|------|------|-----|---------|
| id | UUID | NO | PK | gen_random_uuid() |
| integracao_id | UUID | NO | FK | - |
| pfx_blob | BYTEA | YES | - | NULL |
| pfx_password | TEXT | YES | - | NULL |
| client_id | TEXT | YES | - | NULL |
| client_secret | TEXT | YES | - | NULL |
| application_key | TEXT | YES | - | NULL |
| created_at | TIMESTAMPTZ | NO | - | NOW() |

**Indexes:**
- `idx_integracoes_financeiras_secrets_integracao` (integracao_id)

**RLS Policies:**
- SELECT: `false` (blocked)
- INSERT: `false` (blocked)
- UPDATE: `false` (blocked)
- DELETE: `false` (blocked)

⚠️ **Note:** Access via Edge Functions only (service_role)

---

## Validations

### Frontend Validations
- ✅ CNPJ required
- ✅ Client ID required
- ✅ Client Secret required
- ✅ PFX file required (`.pfx` extension)
- ✅ PFX password required
- ✅ Application Key required (only if provedor === 'getnet')
- ✅ Igreja ID required (from session)

### Backend Validations
- ✅ Bearer token present
- ✅ User permissions (admin/tesoureiro)
- ✅ CNPJ format: `/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/`
- ✅ All fields present (falsy check)
- ✅ Base64 decoding successful

---

## Error Handling

| Scenario | UI Behavior |
|----------|-------------|
| CNPJ missing | Toast: "CNPJ é obrigatório" |
| Client ID missing | Toast: "Client ID é obrigatório" |
| Client Secret missing | Toast: "Client Secret é obrigatório" |
| PFX file invalid | Toast: "Por favor, selecione um arquivo .pfx válido" |
| PFX password missing | Toast: "Senha do PFX é obrigatória" |
| App Key missing (Getnet) | Toast: "Application Key é obrigatória para Getnet" |
| Edge Function error | Toast: `error?.message \|\| "Erro ao salvar integração"` |
| Delete error | Toast: "Erro ao deletar integração" |
| Success | Toast: "Integração criada com sucesso!" |

---

## Screenshots / UX Notes

### Estado Vazio
- Mensagem: "Nenhuma integração configurada ainda"
- CTA Button: "Criar primeira integração"

### Estado Carregando
- Spinner: "Carregando integrações..."

### Dialog Modal
- Header com título + descrição
- Form com campos organizados verticalmente
- Footer com botões "Cancelar" e "Salvar Integração"
- File input com feedback visual (✓ filename)

### Tabela
- Header com colunas
- Rows com dados formatados
- Ações à direita (Edit/Delete buttons)
- Status badge com cores (green=ativo, gray=inativo, red=erro)

---

## Testing Checklist

- [ ] Criar integração Santander
- [ ] Criar integração Getnet (valida Application Key)
- [ ] Criar integração API Genérica
- [ ] Listar integrações (verificar tabela)
- [ ] Filtrar por filial (se selecionada)
- [ ] Deletar integração (confirma, deleta, refetch)
- [ ] Erro de permissão (não admin/tesoureiro)
- [ ] Erro de CNPJ inválido
- [ ] Erro de PFX inválido
- [ ] Validar dados criptografados em `integracoes_financeiras_secrets`

---

## Related Features

**Phase 2 - Sincronização:**
- Polling de extratos Santander via Edge Function
- Polling de extratos Getnet via Edge Function
- Lê credenciais de `integracoes_financeiras_secrets` (decrypt)

**Phase 3 - Reconciliação:**
- Matching entre `transacoes` + `extratos_bancarios`
- Dashboard com cobertura e divergências

**Phase 4 - Edição:**
- Update status (ativo/inativo)
- Renovar credenciais/PFX
- Button "Edit" na tabela

---

**Last Updated:** 15/01/2026  
**Responsible:** GitHub Copilot  
**Status:** ✅ Complete Phase 1
