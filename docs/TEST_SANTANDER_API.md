# 🧪 Script de Teste - API Santander

Este script permite validar a integração com a API Santander **sem implementar nada no banco de dados**, apenas testando:

1. **Conexão HTTPS + mTLS** com o certificado PFX
2. **Autenticação OAuth2** (obtenção de token)
3. **Consulta de Saldo**
4. **Consulta de Extrato**

## Pré-requisitos

- Node.js 14+ instalado
- Certificado PFX válido do Santander
- Credenciais Santander (Client ID e Client Secret)
- Dados da conta (Bank ID, Agência, Conta)

## Como usar

### 1. Preparar o certificado

Certifique-se de ter o arquivo `.pfx` salvo localmente. Ex.: `/path/to/cert.pfx`

### 2. Executar o teste

```bash
cd /Users/adriano.oliveira/Development/igreja-carvalho

node test-santander-api.js \
  --pfx /path/to/cert.pfx \
  --password sua_senha_pfx \
  --client-id seu_client_id \
  --client-secret seu_client_secret \
  --bank-id 033 \
  --agency 0001 \
  --account 1234567
```

### 3. Exemplo com valores reais

```bash
node test-santander-api.js \
  --pfx ~/Downloads/certado_banco.pfx \
  --password "minha_senha_secreta" \
  --client-id "app_prod_12345678" \
  --client-secret "secret_abcdef1234567890" \
  --bank-id "033" \
  --agency "1234" \
  --account "567890-1"
```

## O que o script faz

### ✓ Teste 1: Conexão mTLS

- Carrega o certificado PFX
- Cria uma conexão HTTPS com autenticação via certificado

### ✓ Teste 2: OAuth2

- Envia credenciais (Client ID + Client Secret) para o endpoint de token
- Valida que recebeu um `access_token` válido

### ✓ Teste 3: Consulta de Saldo

- Usa o token para chamar o endpoint de saldo
- Exibe o saldo da conta

### ✓ Teste 4: Consulta de Extrato

- Usa o token para chamar o endpoint de extrato
- Busca transações dos últimos 30 dias
- Exibe as transações retornadas

## Output esperado

```
============================================================
🧪 TESTE DE INTEGRAÇÃO COM API SANTANDER
============================================================

ℹ Configuração:
ℹ   Bank ID: 033
ℹ   Agency: 1234
ℹ   Account: 567890-1
ℹ   Client ID: app_prod_12345678
✓ Arquivo PFX encontrado: /path/to/cert.pfx
✓ Cliente HTTPS (mTLS) criado com sucesso

============================================================
1. Obtendo Token OAuth2
============================================================

ℹ POST https://trust-open.api.santander.com.br/auth/oauth/v2/token
✓ Token obtido com sucesso
ℹ Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ℹ Tipo: Bearer
ℹ Expira em: 3600 segundos

============================================================
2. Consultando Saldo
============================================================

ℹ GET https://trust-open.api.santander.com.br/bank_account_information/v1/banks/033/balances/1234.567890-1
✓ Saldo consultado com sucesso
ℹ Resposta:
{
  "availableBalance": 10000.50,
  "currentBalance": 12000.75,
  "currency": "BRL"
}

============================================================
3. Consultando Extrato
============================================================

ℹ GET https://trust-open.api.santander.com.br/bank_account_information/v1/banks/033/statements/1234.567890-1?...
✓ Extrato consultado com sucesso
ℹ Total de transações retornadas: 5
ℹ Primeira transação:
{
  "transactionId": "TRX001",
  "postingDate": "2026-01-15",
  "amount": 500.00,
  "type": "DEBIT",
  "description": "Pagamento PIX"
}

============================================================
✅ TESTES CONCLUÍDOS COM SUCESSO
============================================================
```

## O que fazer quando o teste passar

1. **Documente os dados que retornaram** (campos, formato, etc)
2. **Crie um mapping** no `supabase/functions/santander-extrato/index.ts`
3. **Implemente a persistência** no banco de dados
4. **Crie os testes de edge cases** (pagination, dates, etc)

## Troubleshooting

### Erro: "Arquivo PFX não encontrado"

- Verifique o caminho do arquivo
- Use caminho absoluto, não relativo

### Erro: "Falha ao obter token. Status: 401"

- Valide Client ID e Client Secret
- Verifique se o certificado PFX é válido

### Erro: "Falha ao consultar saldo. Status: 403"

- Pode ser permissão insuficiente da conta
- Valide Bank ID, Agency e Account

### Erro: "ENOTFOUND" ou "ECONNREFUSED"

- Problema de conectividade
- Verifique se tem acesso à internet
- Teste ping para `trust-open.api.santander.com.br`

## Limpeza

O script **não persiste nada no banco de dados**, então não há risco de dados de teste ficarem gravados.

Para remover o script após testes:

```bash
rm test-santander-api.js
```

## Próximos passos

Após validar que tudo funciona:

1. Ir para `src/pages/financas/Integracoes.tsx`
2. Testar a UI de criar integração com seus dados reais
3. Implementar a Edge Function `santander-extrato` para usar os dados salvos
4. Criar testes de sincronização de extratos
