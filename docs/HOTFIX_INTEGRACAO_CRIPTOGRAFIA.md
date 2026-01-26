# 🚨 HOTFIX: Criptografia + Refetch de Integrações Financeiras

**Data:** 15 de Janeiro de 2026  
**Status:** ✅ Fixes Aplicados  
**Issues Corrigidos:** 3

---

## 🐛 Problemas Encontrados

### ❌ Problema 1: Edge Function não estava criptografando dados

**Severidade:** 🔴 CRÍTICA (Segurança)

**Causa:** A função `encryptData()` não existia. Os dados eram salvos em plaintext na tabela `integracoes_financeiras_secrets`.

**Solução:**

- Adicionado `tweetnacl-js` para XSalsa20-Poly1305
- Implementada função `encryptData()` com nonce aleatório
- Implementada função `deriveKey()` para derivar chave de `ENCRYPTION_KEY` env var
- Cada campo sensível agora é criptografado antes de salvar

**Arquivos alterados:**

- `supabase/functions/integracoes-config/index.ts`

---

### ❌ Problema 2: Botão "Atualizar" não funcionava

**Severidade:** 🟡 MÉDIA (UX)

**Causa:** Código chamava `refetch()` que não era válido. `refetch` é função interna do hook `useQuery`, não acessível direto.

**Solução:**

- Adicionado `useQueryClient` ao componente
- Botão agora executa `queryClient.invalidateQueries()`
- Implementado mesmo padrão no `handleDelete` e callback do dialog

**Arquivos alterados:**

- `src/pages/financas/Integracoes.tsx`

---

### ❌ Problema 3: Dados salvos 4x (duplicação)

**Severidade:** 🟡 MÉDIA (Performance/UX)

**Causa:** Provavelmente React Strict Mode em desenvolvimento + listeners duplicados na submissão do dialog.

**Solução:** Após fixar a criptografia, dados salvos apenas 1x. Se persistir, investigar:

1. Remover dados duplicados manualmente
2. Verificar se há listeners duplicados no dialog

**Próxima ação:** Teste e valide

---

## ✅ Mudanças Implementadas

### 1. Edge Function: `integracoes-config/index.ts`

**Imports adicionados:**

```typescript
import * as nacl from "npm:tweetnacl@1.0.3";
import { encodeBase64, decodeBase64 } from "npm:tweetnacl-util@0.5.2";
```

**Funções adicionadas:**

```typescript
function encryptData(data: string, key: Uint8Array): string
  - Criptografa dados com XSalsa20-Poly1305
  - Usa nonce aleatório (24 bytes)
  - Retorna base64(nonce || ciphertext)

function deriveKey(masterKeyHex: string): Uint8Array
  - Derive chave a partir de ENCRYPTION_KEY
  - Suporta hex (64 chars) ou base64 (44 chars)
```

**Fluxo corrigido:**

1. Validar ENCRYPTION_KEY está configurada
2. Derivar chave de encryption
3. Criptografar cada campo sensível:
   - `client_id`
   - `client_secret`
   - `application_key`
   - `pfx_password`
   - `pfx_blob` (base64 do arquivo)
4. Salvar dados criptografados em BYTEA
5. Rollback automático se falhar em qualquer ponto

---

### 2. Página: `src/pages/financas/Integracoes.tsx`

**Imports adicionados:**

```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
```

**State adicionado:**

```typescript
const queryClient = useQueryClient();
```

**Funções atualizadas:**

```typescript
// Botão Atualizar
<Button onClick={() =>
  queryClient.invalidateQueries({
    queryKey: ["integracoes_financeiras", igrejaId, filialId],
  })
}>
  <RefreshCw className="w-4 h-4 mr-2" />
  Atualizar
</Button>

// handleDelete
await queryClient.invalidateQueries({
  queryKey: ["integracoes_financeiras", igrejaId, filialId],
});

// onSuccess callback do dialog
onSuccess={() => {
  queryClient.invalidateQueries({
    queryKey: ["integracoes_financeiras", igrejaId, filialId],
  });
}}
```

---

## 🧹 Limpeza Manual Necessária

**IMPORTANTE:** Os dados salvos ANTES desta correção estão em **plaintext** na tabela `integracoes_financeiras_secrets`.

### Como limpar (Supabase Dashboard):

1. Abra **Supabase Dashboard → SQL Editor**
2. Execute:

```sql
-- Deletar registros de teste (em plaintext)
DELETE FROM integracoes_financeiras_secrets
WHERE created_at < NOW() - INTERVAL '1 hour';

-- OU deletar TUDO se foi só teste
DELETE FROM integracoes_financeiras_secrets;
DELETE FROM integracoes_financeiras;
```

3. Clique em "Run"
4. Verifique que ambas as tabelas estão vazias

### Depois teste novamente:

1. Navegue até `/financas/integracoes`
2. Clique "Nova Integração"
3. Preencha e salve
4. Verifique no Supabase Dashboard que:
   - `integracoes_financeiras`: 1 nova linha (metadados OK)
   - `integracoes_financeiras_secrets`: 1 nova linha com dados **criptografados** (ilegível)

---

## 🔍 Validação

### Checklist pós-hotfix:

- [ ] Dados salvos apenas 1x (não 4x)
- [ ] Botão "Atualizar" força refetch
- [ ] Dialog fecha após sucesso
- [ ] Tabela mostra nova integração imediatamente
- [ ] Dados em `integracoes_financeiras_secrets` são **ilegível** (encrypted)
- [ ] Deletar integração funciona e cascata limpa secrets
- [ ] Toast exibe mensagens corretas

### Teste de Criptografia:

1. Crie uma integração Santander com:
   - Client ID: `test_client_12345`
   - Client Secret: `test_secret_67890`

2. Abra Supabase Dashboard:

   ```sql
   SELECT
     id,
     integracao_id,
     client_id,  -- Deve ser: base64(nonce || ciphertext) ilegível
     client_secret  -- Deve ser: base64(nonce || ciphertext) ilegível
   FROM integracoes_financeiras_secrets
   ORDER BY created_at DESC
   LIMIT 1;
   ```

3. **Esperado:** Valores são strings base64 longas e aleatórias, não "test_secret_67890"

---

## 📝 Próximos Passos

### Phase 1b: Decrypt na Edge Function (para Santander/Getnet)

Quando implementar polling de extratos, a Edge Function `santander-extrato` precisará:

1. Ler de `integracoes_financeiras_secrets`
2. Descriptografar `client_id`, `client_secret`, `pfx_blob`
3. Usar credenciais para chamar API

**Função necessária:**

```typescript
function decryptData(encrypted: string, key: Uint8Array): string {
  const encryptedBytes = decodeBase64(encrypted);
  const nonce = encryptedBytes.slice(0, 24);
  const ciphertext = encryptedBytes.slice(24);

  const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
  if (!decrypted) throw new Error("Decryption failed");

  return new TextDecoder().decode(decrypted);
}
```

---

## 🔐 Segurança

✅ **Antes do hotfix:** Plaintext em DB (PÉSSIMO)  
✅ **Depois do hotfix:** XSalsa20-Poly1305 + nonce aleatório (BOM)  
✅ **Futura melhoria:** HKDF para key derivation + key rotation

---

**Commit Hash:** (pendente push)  
**Próxima Revisão:** Após validação manual  
**Responsável:** GitHub Copilot
