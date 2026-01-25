# Configuração de Webhook PIX - Documentação Técnica

**Data:** 17 de janeiro de 2026  
**Status:** Pronto para implementação

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Fluxo de Dados](#fluxo-de-dados)
4. [Configuração do Webhook](#configuração-do-webhook)
5. [Estrutura da Tabela](#estrutura-da-tabela)
6. [Edge Function](#edge-function)
7. [Componente React](#componente-react)
8. [Testes](#testes)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### O que é

Um webhook PIX que recebe transações em tempo real do banco (Santander) e as armazena em uma tabela temporária para processamento posterior.

### Por que

- ✅ **Tempo Real:** Recebe PIX conforme chega (domingo à noite)
- ✅ **Data Correta:** Armazena timestamp real do PIX, não do extrato
- ✅ **Input para Ofertas:** Alimenta o relatório de ofertas com dados precisos
- ✅ **Separado do Extrato:** Não interfere com conciliação de saldos

### Fluxo

```
BANCO (Santander)
       ↓
[PIX Recebido em tempo real]
       ↓
Envia para webhook
       ↓
https://seu-projeto.supabase.co/functions/v1/pix-webhook-receiver
       ↓
Armazena em pix_webhook_temp
       ↓
Usuário vincula com relatório de ofertas
       ↓
Sistema classifica por culto (regras - segunda-feira)
```

---

## 🏗️ Arquitetura

### Componentes

```
┌─────────────────────────────────────────────────────────┐
│ BANCO (Santander)                                       │
└────────────────────────────────────────────────────────┘
                           ↓
                  [Evento PIX Recebido]
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Webhook: pix-webhook-receiver (Edge Function)          │
│ - Recebe POST com dados do PIX                          │
│ - Valida dados (valor, data, instituição)              │
│ - Insere em pix_webhook_temp                            │
│ - Retorna 200 OK ao banco                               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Supabase Database                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ pix_webhook_temp                                    │ │
│ │ - id, pix_id, valor, data_pix, status              │ │
│ │ - webhook_payload (auditoria)                       │ │
│ │ - transacao_id, oferta_id (vinculação)             │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ React Component: PixWebhookReceiver                     │
│ - Exibe PIX recebidos                                   │
│ - Permite vinculação manual com ofertas                │
│ - Mostra status (recebido, processado, etc)            │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Dados

### Domingo 20h00 - PIX Recebido no Banco

```json
{
  "pixId": "e1234567-e123-4567-e123-456789012345",
  "valor": 250.5,
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

### Webhook Recebe e Armazena

**POST** `https://seu-projeto.supabase.co/functions/v1/pix-webhook-receiver`

**Headers:**

```
Content-Type: application/json
X-Igreja-ID: [uuid-da-igreja]
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Webhook PIX recebido e armazenado",
  "pixId": "e1234567-e123-4567-e123-456789012345",
  "valor": 250.5
}
```

### Banco Armazena em Tabela

**Tabela:** `pix_webhook_temp`

```
id                                   | pix_id                              | valor | data_pix              | status    | created_at
e1234567-a123-4567-e123-456789012345 | e1234567-e123-4567-e123-456789012345 | 250.50| 2026-01-19 20:00:00Z | recebido  | 2026-01-19 20:00:15Z
```

### Segunda-feira - Extrato Chega

Santander disponibiliza extrato com mesmas transações:

```
[16/01 09:00] PIX entrada R$ 250.50
```

Sistema reconhece: **PIX já processado** (estava em pix_webhook_temp)

---

## ⚙️ Configuração do Webhook

### Passo 1: Registrar Webhook no Banco

**Santander Open Banking:**

1. Acesse: https://developer.santander.com.br/
2. Menu: **Webhooks** → **PIX Recebimento**
3. Configure:
   - **URL:** `https://seu-projeto.supabase.co/functions/v1/pix-webhook-receiver`
   - **Eventos:** `pix.recebimento`
   - **Método:** `POST`
   - **Headers Customizados:**
     ```
     X-Igreja-ID: [uuid-da-sua-igreja]
     ```

4. **Teste:** Botão "Testar Webhook"
   - Santander envia payload de teste
   - Sistema deve retornar 200 OK

### Passo 2: Variáveis de Ambiente

Já estão em `.env.local`:

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key-here
```

### Passo 3: Deploy da Edge Function

```bash
supabase functions deploy pix-webhook-receiver
```

Verificar:

```bash
supabase functions list
```

---

## 💾 Estrutura da Tabela

### `pix_webhook_temp`

| Campo              | Tipo      | Descrição                                   |
| ------------------ | --------- | ------------------------------------------- |
| `id`               | UUID      | PK, gerado automaticamente                  |
| `pix_id`           | TEXT      | ID único do PIX no banco                    |
| `valor`            | DECIMAL   | Valor do PIX (ex: 250.50)                   |
| `pagador_nome`     | TEXT      | Nome de quem enviou                         |
| `pagador_cpf_cnpj` | TEXT      | CPF ou CNPJ do pagador                      |
| `descricao`        | TEXT      | Descrição da transferência                  |
| `data_pix`         | TIMESTAMP | Quando foi enviado (timestamp real)         |
| `data_recebimento` | TIMESTAMP | Quando webhook chegou                       |
| `status`           | TEXT      | recebido \| processado \| vinculado \| erro |
| `banco_id`         | TEXT      | CNPJ do banco (ex: 90400888000142)          |
| `igreja_id`        | UUID      | FK para igrejas                             |
| `webhook_payload`  | JSONB     | Payload completo do webhook                 |
| `transacao_id`     | UUID      | FK para transacoes_financeiras              |
| `oferta_id`        | UUID      | FK para ofertas (quando vinculado)          |
| `processado_em`    | TIMESTAMP | Quando foi processado                       |
| `erro_mensagem`    | TEXT      | Se houver erro                              |
| `created_at`       | TIMESTAMP | Data de criação                             |
| `updated_at`       | TIMESTAMP | Última atualização                          |

### Índices

```sql
-- Para queries rápidas
CREATE INDEX idx_pix_webhook_temp_igreja_id ON pix_webhook_temp(igreja_id);
CREATE INDEX idx_pix_webhook_temp_status ON pix_webhook_temp(status);
CREATE INDEX idx_pix_webhook_temp_data_pix ON pix_webhook_temp(data_pix);
CREATE INDEX idx_pix_webhook_temp_pix_id ON pix_webhook_temp(pix_id);
```

---

## 🔧 Edge Function

### Arquivo

`supabase/functions/pix-webhook-receiver/index.ts`

### Funcionalidades

1. **Validação de Método:** Apenas POST
2. **Parsing do Payload:** Extrai dados do PIX
3. **Validação de Dados:** Valor, igreja, timestamps
4. **Inserção:** Armazena em `pix_webhook_temp`
5. **Auditoria:** Salva payload completo
6. **Tratamento de Erros:** Retorna 400/500 com detalhes

### Response

**Sucesso (200):**

```json
{
  "success": true,
  "message": "Webhook PIX recebido e armazenado",
  "pixId": "e1234567-e123-4567-e123-456789012345",
  "valor": 250.5
}
```

**Erro (400):**

```json
{
  "error": "Valor inválido ou não informado"
}
```

**Erro (500):**

```json
{
  "error": "Falha ao processar webhook",
  "detail": "Mensagem de erro detalhada"
}
```

---

## 🎨 Componente React

### Arquivo

`src/components/financas/PixWebhookReceiver.tsx`

### Funcionalidades

- ✅ **Listagem:** Mostra todos os PIX recebidos
- ✅ **Filtros:** Por status (recebido, processado, vinculado, erro)
- ✅ **Totalizações:** Valor total e quantidade
- ✅ **Status Visual:** Ícones e badges por status
- ✅ **Ações:** Botões para vincular, deletar, etc
- ✅ **Ocultação de Valores:** Integra com HideValuesToggle

### Como Usar

```tsx
import { PixWebhookReceiver } from "@/components/financas/PixWebhookReceiver";

export function MeuComponente() {
  return (
    <div>
      <PixWebhookReceiver />
    </div>
  );
}
```

### Props

Nenhuma prop obrigatória. Usa:

- `useAuthContext()` para obter `igrejaId`
- `useQuery()` para buscar dados
- `useHideValues()` para formatar valores

---

## 🧪 Testes

### Teste 1: Webhook via Postman/cURL

```bash
curl -X POST \
  https://seu-projeto.supabase.co/functions/v1/pix-webhook-receiver \
  -H "Content-Type: application/json" \
  -H "X-Igreja-ID: [uuid-da-igreja]" \
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

**Response esperado:**

```json
{
  "success": true,
  "message": "Webhook PIX recebido e armazenado",
  "pixId": "test-pix-001",
  "valor": 250.5
}
```

### Teste 2: Verificar Tabela

```sql
-- Consultar PIX recebidos
SELECT id, pix_id, valor, status, data_pix, created_at
FROM pix_webhook_temp
WHERE igreja_id = '[sua-igreja-id]'
ORDER BY created_at DESC
LIMIT 10;
```

### Teste 3: UI Component

1. Integrar `PixWebhookReceiver` em página de Finanças
2. Visualizar lista de PIX
3. Confirmar filtros funcionam
4. Testar botões (vincular, deletar)

---

## 🔍 Troubleshooting

### Problema: Webhook não recebe dados

**Verificações:**

1. URL configurada corretamente no banco? ✓
2. Header `X-Igreja-ID` está sendo enviado? ✓
3. Edge Function está deployada? `supabase functions list`
4. Logs da function:
   ```bash
   supabase functions logs pix-webhook-receiver
   ```

### Problema: Erro 400 "X-Igreja-ID header obrigatório"

**Solução:** Adicionar header customizado no webhook do banco

```
Header: X-Igreja-ID
Value: [uuid-da-sua-igreja]
```

### Problema: Status 500 "Falha ao inserir"

**Causas possíveis:**

1. Igreja ID inválido (não existe em `igrejas`)
2. Dados duplicados (pix_id já existe)
3. Valor inválido (null ou <= 0)

**Debug:**

```sql
-- Verificar último erro
SELECT erro_mensagem, webhook_payload, created_at
FROM pix_webhook_temp
WHERE status = 'erro'
ORDER BY created_at DESC
LIMIT 1;
```

### Problema: Component não mostra dados

**Verificações:**

1. `useAuthContext()` retornando `igrejaId`?
2. RLS policies permitindo leitura?
3. Dados existem na tabela?

```sql
SELECT COUNT(*) FROM pix_webhook_temp
WHERE igreja_id = '[sua-igreja-id]';
```

---

## 📊 Monitoramento

### Queries Úteis

**PIX recebido hoje:**

```sql
SELECT COUNT(*), SUM(valor)
FROM pix_webhook_temp
WHERE data_pix::date = TODAY()
AND igreja_id = '[sua-id]';
```

**PIX por status:**

```sql
SELECT status, COUNT(*), SUM(valor)
FROM pix_webhook_temp
WHERE igreja_id = '[sua-id]'
GROUP BY status;
```

**PIX ainda não vinculados:**

```sql
SELECT *
FROM pix_webhook_temp
WHERE oferta_id IS NULL
AND status = 'processado'
ORDER BY data_pix DESC;
```

---

## 🚀 Próximos Passos (Segunda-feira)

1. ✅ Recebi webhook PIX em tempo real
2. ✅ Armazenou em tabela temporária
3. ⏳ **Segunda:** Implementar regras de classificação
4. ⏳ **Segunda:** Vincular com relatório de ofertas
5. ⏳ **Segunda:** Classificar por culto automaticamente

---

**Pronto para deploy!**
