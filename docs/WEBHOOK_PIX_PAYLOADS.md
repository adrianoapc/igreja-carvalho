# Exemplos de Payload - Webhook PIX

**Data:** 17 de janeiro de 2026  
**Referência para testes e integração**

---

## 📋 Índice

1. [Payload do Santander (Padrão)](#payload-do-santander-padrão)
2. [Payload Simplificado (Teste)](#payload-simplificado-teste)
3. [Exemplos de Cenários Reais](#exemplos-de-cenários-reais)
4. [Responses da API](#responses-da-api)
5. [Queries para Verificação](#queries-para-verificação)

---

## 📤 Payload do Santander (Padrão)

### Estrutura Completa

```json
{
  "idNotificacao": "12345678901234567890",
  "tipoNotificacao": "pix.recebimento",
  "pixId": "e1234567-e123-4567-e123-456789012345",
  "endToEndId": "E1234567890123456789012345678",
  "txid": "A1234567890123456789012345",
  "valor": 250.50,
  "status": "CONCLUIDO",
  "calendario": {
    "criacao": "2026-01-19T20:00:00Z",
    "expiracao": 3600
  },
  "devedor": {
    "nome": "João da Silva Santos",
    "cpf": "12345678900",
    "cnpj": null,
    "endereco": {
      "logradouro": "Rua A",
      "numero": 123,
      "complemento": "Apt 456",
      "cidade": "São Paulo",
      "uf": "SP",
      "cep": "01234567"
    }
  },
  "credenciador": null,
  "infoAdicionais": [
    {
      "nome": "campo1",
      "valor": "Oferta Culto Domingo"
    }
  ],
  "referencia": "REF-2026-01-19-001",
  "processamento": {
    "lote": "001",
    "sequencia": 5
  }
}
```

### Mapeamento de Campos

| Campo Santander | Nosso Campo | Descrição |
|-----------------|------------|-----------|
| `pixId` | `pix_id` | ID único do PIX |
| `valor` | `valor` | Valor em reais |
| `devedor.nome` | `pagador_nome` | Quem enviou |
| `devedor.cpf / cnpj` | `pagador_cpf_cnpj` | CPF ou CNPJ |
| `calendario.criacao` | `data_pix` | Data/hora real |
| `infoAdicionais[0].valor` | `descricao` | Descrição da transferência |

---

## 🧪 Payload Simplificado (Teste)

### Para Testes Locais

```json
{
  "pixId": "test-pix-001",
  "valor": 250.50,
  "devedor": {
    "nome": "João da Silva",
    "cpf": "12345678900"
  },
  "infoAdicionais": "Oferta Culto",
  "calendario": {
    "criacao": "2026-01-19T20:00:00Z"
  }
}
```

### cURL para Teste

```bash
curl -X POST \
  https://seu-projeto.supabase.co/functions/v1/pix-webhook-receiver \
  -H "Content-Type: application/json" \
  -H "X-Igreja-ID: 12345678-1234-5678-1234-567812345678" \
  -d '{
    "pixId": "test-pix-001",
    "valor": 250.50,
    "devedor": {
      "nome": "João Teste",
      "cpf": "12345678900"
    },
    "infoAdicionais": "Oferta Teste",
    "calendario": {
      "criacao": "2026-01-19T20:00:00Z"
    }
  }'
```

---

## 📊 Exemplos de Cenários Reais

### Cenário 1: PIX Simples (CPF)

```json
{
  "pixId": "pix-cpf-001",
  "valor": 100.00,
  "devedor": {
    "nome": "Maria Santos",
    "cpf": "98765432100"
  },
  "infoAdicionais": "Dízimo",
  "calendario": {
    "criacao": "2026-01-19T08:30:00Z"
  }
}
```

**Resultado esperado:**
```json
{
  "success": true,
  "pixId": "pix-cpf-001",
  "valor": 100.00,
  "pagador": "Maria Santos",
  "descricao": "Dízimo"
}
```

---

### Cenário 2: PIX de Empresa (CNPJ)

```json
{
  "pixId": "pix-cnpj-001",
  "valor": 5000.00,
  "devedor": {
    "nome": "Empresa XYZ Ltda",
    "cnpj": "12345678000190"
  },
  "infoAdicionais": "Parceria",
  "calendario": {
    "criacao": "2026-01-19T14:15:00Z"
  }
}
```

---

### Cenário 3: PIX Anônimo (Sem Identificação)

```json
{
  "pixId": "pix-anon-001",
  "valor": 50.00,
  "devedor": {
    "nome": null,
    "cpf": null
  },
  "infoAdicionais": "Oferta",
  "calendario": {
    "criacao": "2026-01-19T20:00:00Z"
  }
}
```

---

### Cenário 4: PIX Grande (Múltiplas Ofertas)

```json
{
  "pixId": "pix-grande-001",
  "valor": 3500.50,
  "devedor": {
    "nome": "Assembleia de Deus",
    "cnpj": "12345678000190"
  },
  "infoAdicionais": "Transferência Ofertas Acumuladas Semana",
  "calendario": {
    "criacao": "2026-01-20T09:00:00Z"
  }
}
```

---

## 📤 Responses da API

### 200 OK - Sucesso

```json
{
  "success": true,
  "message": "Webhook PIX recebido e armazenado",
  "pixId": "pix-cpf-001",
  "valor": 100.00
}
```

---

### 400 Bad Request - Valor Inválido

```json
{
  "error": "Valor inválido ou não informado",
  "pixId": null,
  "status": 400
}
```

---

### 400 Bad Request - Header Faltando

```json
{
  "error": "X-Igreja-ID header obrigatório",
  "status": 400
}
```

---

### 500 Internal Server Error

```json
{
  "error": "Falha ao processar webhook",
  "detail": "duplicate key value violates unique constraint \"pix_webhook_temp_pix_id_key\"",
  "status": 500
}
```

---

## 🔍 Queries para Verificação

### Query 1: Verificar PIX Recebido

```sql
SELECT 
  id,
  pix_id,
  valor,
  pagador_nome,
  status,
  data_pix,
  created_at
FROM pix_webhook_temp
WHERE igreja_id = '12345678-1234-5678-1234-567812345678'
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
```
id                                   | pix_id       | valor | pagador_nome  | status    | data_pix              | created_at
================================================================================================
e1234567-a123-4567-e123-456789012345 | pix-cpf-001  | 100   | Maria Santos  | recebido  | 2026-01-19 08:30:00Z | 2026-01-19 08:30:15Z
```

---

### Query 2: Somar PIX do Período

```sql
SELECT 
  DATE_TRUNC('day', data_pix) as dia,
  COUNT(*) as quantidade,
  SUM(valor) as total
FROM pix_webhook_temp
WHERE igreja_id = '12345678-1234-5678-1234-567812345678'
  AND data_pix >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', data_pix)
ORDER BY dia DESC;
```

**Resultado esperado:**
```
dia              | quantidade | total
============================================
2026-01-19 00:00 | 5          | 1350.50
2026-01-18 00:00 | 3          | 750.00
```

---

### Query 3: PIX com Erro

```sql
SELECT 
  pix_id,
  valor,
  erro_mensagem,
  created_at
FROM pix_webhook_temp
WHERE status = 'erro'
  AND igreja_id = '12345678-1234-5678-1234-567812345678'
ORDER BY created_at DESC;
```

---

### Query 4: PIX Não Vinculados

```sql
SELECT 
  id,
  pix_id,
  valor,
  pagador_nome,
  data_pix
FROM pix_webhook_temp
WHERE oferta_id IS NULL
  AND status = 'processado'
  AND igreja_id = '12345678-1234-5678-1234-567812345678'
ORDER BY data_pix DESC;
```

---

## 📝 Teste Manual

### Passo 1: Preparar Dados

```bash
# Salvar como payload.json
cat > payload.json << 'EOF'
{
  "pixId": "test-manual-001",
  "valor": 250.50,
  "devedor": {
    "nome": "Teste Manual",
    "cpf": "12345678900"
  },
  "infoAdicionais": "Teste Webhook",
  "calendario": {
    "criacao": "2026-01-19T20:00:00Z"
  }
}
EOF
```

### Passo 2: Enviar Webhook

```bash
curl -X POST \
  https://seu-projeto.supabase.co/functions/v1/pix-webhook-receiver \
  -H "Content-Type: application/json" \
  -H "X-Igreja-ID: 12345678-1234-5678-1234-567812345678" \
  -d @payload.json
```

### Passo 3: Verificar Resposta

```bash
# Deve retornar 200 OK com sucesso
{
  "success": true,
  "message": "Webhook PIX recebido e armazenado",
  "pixId": "test-manual-001",
  "valor": 250.50
}
```

### Passo 4: Confirmar no Banco

```sql
SELECT * FROM pix_webhook_temp 
WHERE pix_id = 'test-manual-001';
```

---

## 🐛 Troubleshooting por Payload

### Problema: "duplicate key value"

**Causa:** PIX ID já existe

**Solução:** Usar PIX ID único

```json
// ❌ Errado
{
  "pixId": "pix-cpf-001"  // Já usado
}

// ✅ Correto
{
  "pixId": "pix-cpf-001-retry-2"  // Novo ID
}
```

---

### Problema: "Valor inválido"

**Causa:** Valor null ou <= 0

**Solução:** Validar valor

```json
// ❌ Errado
{
  "valor": null
}

// ✅ Correto
{
  "valor": 100.00
}
```

---

### Problema: "Header obrigatório"

**Causa:** X-Igreja-ID não enviado

**Solução:** Adicionar header

```bash
# ❌ Errado
curl -X POST https://... -d @payload.json

# ✅ Correto
curl -X POST https://... \
  -H "X-Igreja-ID: 12345678-1234-5678-1234-567812345678" \
  -d @payload.json
```

---

**Pronto para testar! 🚀**
