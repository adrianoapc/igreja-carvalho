# 🧪 Teste da API Santander

Script para testar integração com API Santander usando credenciais já salvas no banco.

## Setup Rápido

### 1. Criar arquivo de configuração

```bash
cp .env.local.example .env.local
```

### 2. Editar `.env.local` com seus dados

```bash
# Coloque as URLs e chaves do seu Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=eyJ...

# Coloque o UUID da integração Santander que você criou
SANTANDER_INTEGRACAO_ID=d5be1965-b3dc-4b65-b847-xxxxx

# Coloque os dados da conta bancária para teste
SANTANDER_BANCO_ID=033
SANTANDER_AGENCIA=0001
SANTANDER_CONTA=1234567
```

### 3. Executar o teste

```bash
node test-santander-edge-function.js
```

## Como encontrar o INTEGRACAO_ID?

Se você já criou a integração pela UI:

1. Abra seu Supabase Dashboard
2. Vá para SQL Editor
3. Execute:
```sql
SELECT id, provedor, cnpj, status, created_at
FROM integracoes_financeiras
WHERE provedor = 'santander'
ORDER BY created_at DESC
LIMIT 1;
```

4. Copie o `id` para `SANTANDER_INTEGRACAO_ID` no `.env.local`

## O que o teste faz?

✅ Busca a integração Santander do banco  
✅ Descriptografa credenciais armazenadas (client_id, client_secret, etc)  
✅ Obtém token OAuth2 da API Santander  
✅ Consulta saldo da conta  
✅ Consulta extrato dos últimos 30 dias  
✅ Exibe resultados **sem expor dados sensíveis**

## Alternativa: Argumentos CLI

Se não quiser usar `.env.local`, pode passar tudo como argumentos:

```bash
node test-santander-edge-function.js \
  --supabase-url https://xxx.supabase.co \
  --supabase-key eyJ... \
  --integracao-id uuid \
  --banco-id 033 \
  --agencia 0001 \
  --conta 1234567
```

## Troubleshooting

### ❌ "Integração não encontrada"
- Verifique se o `SANTANDER_INTEGRACAO_ID` está correto
- Execute a query SQL acima para confirmar

### ❌ "Decryption failed"
- Verifique se a `ENCRYPTION_KEY` está configurada no Supabase
- Confirme que a integração foi criada com a UI (chaves criptografadas corretamente)

### ❌ "Token request failed"
- Verifique Client ID e Client Secret armazenados
- Teste se o certificado PFX é válido

### ❌ "Balance query failed" (Status 403)
- Pode ser permissão insuficiente na conta
- Valide Banco ID, Agência e Conta

## Próximos passos

Após validar que tudo funciona:

1. Implementar persistência de extratos em `extratos_bancarios`
2. Criar cron job para sincronizar regularmente
3. Implementar conciliação automática
4. Adicionar webhooks do Santander (se disponível)
