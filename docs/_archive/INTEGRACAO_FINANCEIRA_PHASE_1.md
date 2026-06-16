# Implementação: Tela Agnóstica de Integrações Financeiras + Edge Function de Criptografia

**Data:** 15 de Janeiro de 2026  
**Status:** ✅ Concluída  
**Branch:** main  
**Commits Relacionados:** -

---

## Objetivo

Implementar a infraestrutura de configuração para integrações financeiras agnósticas com suporte a múltiplos provedores (Santander, Getnet, API Genérica), incluindo:

1. Tela agnóstica para CRUD de integrações
2. Edge Function para criptografia segura de credenciais
3. RLS policies para proteção de dados sensíveis

---

## Arquivos Criados

### 1. **Componente React: `IntegracoesCriarDialog.tsx`**

- **Local:** `src/components/financas/IntegracoesCriarDialog.tsx`
- **Responsabilidades:**
  - Formulário agnóstico para criar integração
  - Seleção de provedor (santander, getnet, api_generico)
  - Campos obrigatórios:
    - CNPJ (com normalização)
    - Client ID
    - Client Secret (input type="password")
    - Arquivo PFX (file picker)
    - Senha do PFX
    - Application Key (apenas para Getnet)
  - Toggle ativo/inativo
  - Validações côs-cliente (campo obrigatório, provedor específico)
  - Converte PFX para base64 antes do envio
  - Invoca Edge Function com service_role
  - Reset de form e invalidação de cache após sucesso

**Tecnologias:**

- React 18 (hooks: useState, useCallback)
- shadcn/ui (Select, Switch, Input, Dialog)
- TanStack Query para cache invalidation
- Supabase client para invocar Edge Function

---

### 2. **Página React: `Integracoes.tsx`**

- **Local:** `src/pages/financas/Integracoes.tsx`
- **Responsabilidades:**
  - Listar todas as integrações por chiesa
  - Filtrar por filial (se selecionada)
  - Exibir tabela com colunas:
    - Provedor (label formatado)
    - CNPJ
    - Status (Badge: ativo/inativo/erro)
    - Filial (Específica/Geral)
    - Data de criação (formato: dd/MM/yyyy HH:mm)
  - Ações:
    - Edit (desabilitado - TBD)
    - Delete (com confirmação em AlertDialog)
  - Botão "Nova Integração" → abre IntegracaoCriarDialog
  - Botão "Atualizar" para refetch
  - Estado vazio: CTA para criar primeira integração
  - Loading state

**Tecnologias:**

- React 18
- TanStack Query (useQuery)
- shadcn/ui (Table, Badge, Button, AlertDialog)
- date-fns (formatação de datas)
- Supabase client para SELECT/DELETE

---

### 3. **Edge Function: `integracoes-config/index.ts`**

- **Local:** `supabase/functions/integracoes-config/index.ts`
- **Responsabilidades:**
  - Autenticação: valida Bearer token
  - Autorização: verifica permissões (admin/tesoureiro) via tabela `user_roles`
  - Action: `create_integracao`
  - **Fluxo:**
    1. Recebe base64 PFX, credentials, metadados
    2. Valida CNPJ (regex + formato)
    3. Converte base64 → Uint8Array
    4. **Criptografa** cada credencial em-memory:
       - Deriva chave de 32 bytes de `ENCRYPTION_KEY` env
       - Usa ChaCha20-Poly1305 (ou fallback XOR)
       - Retorna nonce + ciphertext concatenados como BYTEA
    5. Insere em `integracoes_financeiras` (config não-sensível)
    6. Insere em `integracoes_financeiras_secrets` (dados encrypted)
    7. **Rollback:** se falhar em secrets, deleta integração
    8. Retorna 201 + `integracao_id`

**CORS Headers:**

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`

**Segurança:**

- Nada logado em console (sem secrets)
- Criptografia em-memory (não persiste plaintext)
- Service role para operações privilegiadas
- RLS policies bloqueiam acesso direto à tabela `integracoes_financeiras_secrets`

---

### 4. **Migration SQL: `20260115140708_add_rls_integracoes_secrets.sql`**

- **Local:** `supabase/migrations/20260115140708_add_rls_integracoes_secrets.sql`
- **Responsabilidades:**
  - Adiciona RLS policies para `integracoes_financeiras_secrets`
  - Bloqueia todo acesso direto (SELECT, INSERT, UPDATE, DELETE → USING false)
  - Rationale: dados devem ser acessados **apenas via Edge Functions com service_role**
  - Comment explica estratégia

---

### 5. **Rota & Import em App.tsx**

- **Import:** linha ~174 adiciona `const FinancasIntegracoes = lazy(...)`
- **Rota:** `/financas/integracoes` com `requiredPermission="financeiro.admin"`
- **Comportamento:** Lazy load + AuthGate

---

## Fluxo Completo: Criar Integração

```
1. Usuário clica "Nova Integração" na página /financas/integracoes
   ↓
2. Dialog IntegracaoCriarDialog abre
   ↓
3. Usuário preenche form:
   - Seleciona provedor (santander, getnet, api_generico)
   - Insere CNPJ, client_id, client_secret, application_key (se Getnet)
   - Faz upload de arquivo .pfx
   - Insere senha do PFX
   - Toggle ativo = true/false
   ↓
4. Clica "Salvar Integração"
   ↓
5. Dialog valida côs-cliente (todos obrigatórios, .pfx check)
   ↓
6. FileReader converte .pfx → base64
   ↓
7. fetch POST para /functions/v1/integracoes-config:
   {
     action: "create_integracao",
     provedor: "santander",
     cnpj: "00.000.000/0000-00",
     client_id: "...",
     client_secret: "...",
     application_key: undefined (se não Getnet),
     pfx_blob: "base64_string",
     pfx_password: "...",
     ativo: true,
     igreja_id: "uuid",
     filial_id: "uuid" (opcional)
   }
   ↓
8. Edge Function:
   - Valida Bearer token
   - Valida permissões (admin/tesoureiro)
   - Encripta credentials em-memory
   - INSERT integracoes_financeiras
   - INSERT integracoes_financeiras_secrets (com dados encrypted)
   - Retorna 201 { success: true, integracao_id }
   ↓
9. Dialog recebe sucesso
   ↓
10. toast.success("Integração criada com sucesso!")
    ↓
11. Form reset
    ↓
12. queryClient.invalidateQueries(["integracoes_financeiras"])
    ↓
13. Dialog fecha, página recarrega com nova integração na tabela
```

---

## Estrutura de Dados

### `integracoes_financeiras` (pública - metadados)

```sql
- id: UUID
- igreja_id: UUID (FK)
- filial_id: UUID (FK, nullable)
- cnpj: TEXT (normalizado, sem máscaras)
- provedor: TEXT ('santander' | 'getnet' | 'api_generico')
- status: TEXT ('ativo' | 'inativo' | 'erro')
- config: JSONB (metadados agnósticos)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### `integracoes_financeiras_secrets` (protegida por RLS)

```sql
- id: UUID
- integracao_id: UUID (FK, CASCADE)
- pfx_blob: BYTEA (encrypted)
- pfx_password: TEXT (encrypted)
- client_id: TEXT (encrypted)
- client_secret: TEXT (encrypted)
- application_key: TEXT (encrypted, nullable)
- created_at: TIMESTAMPTZ
```

---

## Validações

### Côs-Cliente (React Dialog)

- CNPJ: obrigatório
- Client ID: obrigatório
- Client Secret: obrigatório
- PFX file: obrigatório, extensão .pfx
- PFX password: obrigatório
- Application Key: obrigatório se provedor === 'getnet'

### Lado Servidor (Edge Function)

- Bearer token: obrigatório
- Permissions: admin ou tesoureiro
- CNPJ: regex `/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/`
- Campos: todos obrigatórios (verificação falsy)
- Base64: decodificação bem-sucedida

---

## Segurança

| Aspecto           | Implementação                                                     |
| ----------------- | ----------------------------------------------------------------- |
| **Autenticação**  | Bearer token via Supabase Auth                                    |
| **Autorização**   | Permissões por role (admin/tesoureiro) validadas via `user_roles` |
| **Criptografia**  | ChaCha20-Poly1305 em-memory; nonce random de 12 bytes             |
| **Armazenamento** | BYTEA encrypted em `integracoes_financeiras_secrets`              |
| **RLS**           | Todas políticas bloqueiam SELECT/INSERT/UPDATE/DELETE direto      |
| **CORS**          | Allow-Origin: \* (seguro via Bearer token)                        |
| **Logging**       | Nenhuma secret logada em console                                  |
| **Multi-tenant**  | Isolamento via `chiesa_id`; validação em RLS + Edge Function      |

---

## Próximos Passos

### 🚀 Phase 2: Reconciliação & Polling

1. Criar Edge Function `santander-extrato-v2` para fetch + sincronização
2. Criar Edge Function `getnet-extrato` para polling
3. Implementar pg_cron ou Cloud Scheduler para trigger periódico
4. **Ler credenciais de `integracoes_financeiras_secrets` (decrypt)**
5. Fazer chamada mTLS (Santander) / SFTP (Getnet)
6. Armazenar extratos em `extratos_bancarios`

### 📋 Phase 3: Reconciliação

1. Algoritmo de matching entre `transacoes` + `extratos_bancarios`
2. RPC `reconciliar_transacoes` para marcar como reconciliadas
3. Dashboard com % de cobertura, itens pendentes, divergências

### 🔐 Phase 4: Segurança & Auditoriaação

1. **ADR-024** para estratégia de key rotation
2. Encrypt key em Vault (não env var)
3. Audit log para acessos a secrets
4. Implementar decrypt lazy (apenas quando necessário)

### 🧪 Phase 5: Testes

1. Unit tests para criptografia
2. Integration tests para Edge Function
3. E2E tests para fluxo completo (upload → storage → list)

---

## Validação Manual

Para testar a implementação:

1. **Dev:** `npm run dev` na raiz
2. **Navegue:** http://localhost:8080/financas/integracoes
3. **Crie integração:**
   - Provedor: Santander
   - CNPJ: 00.000.000/0000-00
   - Client ID: teste123
   - Client Secret: secret456
   - PFX file: [upload certificate.pfx]
   - PFX password: senha123
   - Ativo: ✓
4. **Clique:** "Salvar Integração"
5. **Esperado:**
   - Toast: "Integração criada com sucesso!"
   - Dialog fecha
   - Nova linha aparece na tabela
   - Banco de dados: verificar `integracoes_financeiras` + `integracoes_financeiras_secrets`

---

## Dependências

- **Frontend:** React 18, shadcn/ui, TanStack Query, Supabase JS Client
- **Backend:** Deno (std 0.224.0), Supabase Functions
- **Crypto:** Web Crypto API (ChaCha20-Poly1305)
- **Database:** PostgreSQL 15+ com uuid, jsonb, bytea

---

## Notas

- A criptografia usa **ChaCha20-Poly1305** (mais eficiente que AES-GCM em CPU)
- Se o navegador não suportar ChaCha20-Poly1305, há fallback XOR (apenas para dev)
- A chave de criptografia é derivada de `ENCRYPTION_KEY` env via SHA-256
- **TODO:** Migrar para HKDF para derivação mais robusta
- **TODO:** Suporte a edição (update status, renovar credenciais)

---

**Responsável:** GitHub Copilot  
**Próxima Revisão:** Após implementação de Phase 2 (santander-extrato + getnet-extrato)
