# Edge Function: Consultar Sessão

## 📍 Localização
`supabase/functions/consultar-sessao/index.ts`

## 🎯 Objetivo

Essa function foi criada **especificamente para o Make.com** consultar se existe uma sessão ativa para um usuário, sem precisar de query SQL direto.

**Problema:** Make não consegue fazer query direto no Supabase  
**Solução:** Uma function que retorna o estado da sessão em JSON

---

## 🔒 Segurança Multi-Tenant

A função implementa **validação rigorosa de contexto de Igreja/Filial**:

### Fluxo de Validação Automática:
```
1. Make envia: { telefone, phone_number_id }
   ↓
2. Function busca phone_number_id em whatsapp_numeros
   ↓
3. Extrai: { igreja_id, filial_id, enabled }
   ↓
4. Valida:
   ✅ phone_number_id existe e está habilitado?
   ✅ Usa os valores extraídos para filtrar sessões
   ✅ Sessão retornada SEMPRE pertence à Igreja/Filial correta
```

### Bloqueios de Segurança:
```
❌ Se phone_number_id inválido → 403 Forbidden
❌ Se phone_number_id desativado → 403 Forbidden
❌ Sessão retornada APENAS se pertencer à Igreja do phone_number_id
```

### Exemplo: Tentativa de Cross-Church
```
❌ Entrada: { telefone: "5517988888888", phone_number_id: "987654" }

Se 987654 pertence à Igreja B mas você está usando em Igreja A:
→ Nada acontece! Igreja A não "vê" o número 987654

Resultado: 
{ 
  error: "Phone number ID inválido", 
  status: 403 
}
```

### Benefício:
- **Make não precisa saber Igreja/Filial** - function descobre automaticamente
- **Impossível acessar sessão errada** - bloqueado no banco
- **Auditoria clara** - logs mostram qual phone_number_id foi usado

---

## 🔧 Como Usar no Make

### Módulo 1: Webhook WhatsApp (igual antes)
```
Recebe mensagem do usuário
```

### Módulo 2: HTTP Request → Consultar Sessão (NOVO!)

**Método:** POST  
**URL:** `https://SEU_PROJETO.supabase.co/functions/v1/consultar-sessao`

**Headers:**
```
Authorization: Bearer SUA_SUPABASE_ANON_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "telefone": "{{1.entry[].changes[].value.messages[].from}}",
  "phone_number_id": "{{1.entry[].changes[].value.metadata.phone_number_id}}"
}
```

**Parâmetros:**
- `telefone` (obrigatório): Número de telefone do usuário
- `phone_number_id` (obrigatório): ID do WhatsApp que recebeu a mensagem

**Validação Automática:**
- ✅ Function busca `phone_number_id` na tabela `whatsapp_numeros`
- ✅ Extrai automaticamente `igreja_id` e `filial_id` correspondentes
- ✅ Bloqueia se `phone_number_id` for inválido ou desativado
- ✅ Retorna sessões APENAS da Igreja/Filial correspondente

**Resposta (Se sessão ativa):**
```json
{
  "encontrada": true,
  "sessao_id": "abc-123-def",
  "telefone": "5517988888888",
  "origem_canal": "whatsapp_compartilhe",
  "status": "EM_ANDAMENTO",
  "meta_dados": {
    "phone_number_id": "123456",
    "step": "confirmacao_dados",
    "fluxo": "compartilhe"
  },
  "updated_at": "2026-01-19T10:15:00Z",
  "pode_continuar": true
}
```

**Resposta (Se NÃO há sessão ativa):**
```json
{
  "encontrada": false,
  "sessao_id": null,
  "telefone": "5517988888888",
  "origem_canal": null,
  "status": null,
  "meta_dados": null,
  "pode_continuar": false
}
```

---

## 🔄 Novo Fluxo no Make

```
Webhook WhatsApp
        ↓
📌 HTTP: Consultar Sessão
        ↓
        ├─ Sessão ativa encontrada?
        │
        ├─ SIM → Usa origem_canal da sessão
        │        └─ Manda para chatbot correspondente
        │           (triagem, financeiro, compartilhe)
        │
        └─ NÃO → Usa Router por palavra-chave
                 └─ Cria nova sessão
```

---

## ⚙️ Lógica no Make: Decidir Rota

### Filtro: Sessão Ativa Existe?
```
if 2.encontrada == true:
  // TEM SESSÃO ATIVA
  // IGNORA conteúdo da mensagem
  // VAI DIRETO para chatbot da origem_canal
  
  origem = 2.origem_canal
  
  if origem == "whatsapp":
    → Manda para chatbot-triagem
  else if origem == "whatsapp_financeiro":
    → Manda para chatbot-financeiro
  else if origem == "whatsapp_compartilhe":
    → Manda para inscricao-compartilhe
    
else:
  // SEM SESSÃO ATIVA
  // USA Router por palavra-chave
  
  if mensagem contains "oração":
    → chatbot-triagem
  else if mensagem contains "reembolso":
    → chatbot-financeiro
  else if mensagem contains "inscrição":
    → inscricao-compartilhe
```

### Importante: Mudança de Assunto
```
Se usuário tem sessão ativa de ORAÇÃO
E envia: "Quero reembolso"

✅ Mensagem vai para chatbot-triagem (sessão ativa)
✅ Chatbot-triagem responde: "Desculpe, não entendi. Qual o motivo da oração?"
✅ Usuário pode enviar "/sair" para cancelar e começar novo assunto
```

---

## 📊 Exemplo Prático no Make

### Cenário: João alternando entre Oração e Compartilhe

#### Passo 1: João envia "Preciso de oração"

```
Módulo 1 (Webhook):
  from: "5517988888888"
  text: "Preciso de oração"

Módulo 2 (Consultar Sessão):
  POST /consultar-sessao
  Body: { 
    telefone: "5517988888888", 
    phone_number_id: "123456"
  }
  
  Resposta:
  {
    encontrada: false,
    pode_continuar: false
  }
  
Decisão: "Não tem sessão ativa, usa Router"

Módulo 3 (Router):
  Detecta "oração" em "Preciso de oração"
  ↓ Vai para chatbot-triagem
```

#### Passo 2: João recebe resposta de Oração

```
Chatbot-triagem cria sessão:
{
  telefone: "5517988888888",
  origem_canal: "whatsapp",
  meta_dados: { phone_number_id: "123456", step: "coletando_motivo" }
}

Responde: "Qual é o motivo da oração?"
```

#### Passo 3: João envia "Agora quero me inscrever"

```
Módulo 1 (Webhook):
  from: "5517988888888"
  text: "Agora quero me inscrever"

Módulo 2 (Consultar Sessão):
  POST /consultar-sessao
  Body: { 
    telefone: "5517988888888", 
    phone_number_id: "123456"
  }
  
  Resposta:
  {
    encontrada: true,
    origem_canal: "whatsapp",          ← ORAÇÃO
    meta_dados: { step: "coletando_motivo" },
    pode_continuar: true
  }

Decisão: "Tem sessão ativa de ORAÇÃO"

Módulo 3 (Router):
  Detecta "inscrição" em "Agora quero me inscrever"
  Nova origem seria: "whatsapp_compartilhe"
  
  Comparação:
  anterior: "whatsapp"
  nova: "whatsapp_compartilhe"
  SÃO DIFERENTES? ✅ SIM
  
  ↓ Cria NOVA sessão
  ↓ Não finaliza ORAÇÃO
  ↓ Vai para chatbot-compartilhe
```

#### Passo 4: Compartilhe responde

```
Chatbot-compartilhe cria nova sessão:
{
  telefone: "5517988888888",
  origem_canal: "whatsapp_compartilhe",
  meta_dados: { phone_number_id: "123456", step: "confirmacao_dados" }
}

Responde: "Os seus dados estão corretos?"

Result no banco:
- Sessão 1: ORAÇÃO (ativa, esperando resposta)
- Sessão 2: COMPARTILHE (ativa, em confirmação)
```

#### Passo 5: João responde "Sim"

```
Módulo 1 (Webhook):
  from: "5517988888888"
  text: "Sim"

Módulo 2 (Consultar Sessão):
  POST /consultar-sessao
  Body: { telefone: "5517988888888", phone_number_id: "123456" }
  
  Resposta: (pega a MAIS RECENTE)
  {
    encontrada: true,
    origem_canal: "whatsapp_compartilhe",  ← COMPARTILHE!
    meta_dados: { step: "confirmacao_dados" },
    pode_continuar: true
  }

Decisão: "Tem sessão ativa de COMPARTILHE"

Módulo 3 (Router):
  "Sim" não tem keyword forte
  MAS temos sessão ativa de compartilhe
  ↓ PULA Router
  ↓ Vai direto para chatbot-compartilhe

Chatbot-compartilhe:
  "Ótimo! Você está confirmando?"
  ✅ Processa no contexto CORRETO
```

---

## 🔑 Campos da Resposta Explicados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `encontrada` | boolean | Se existe sessão ativa |
| `sessao_id` | string/null | ID único da sessão |
| `telefone` | string | Telefone do usuário |
| `origem_canal` | string/null | Qual chatbot: `whatsapp`, `whatsapp_financeiro`, `whatsapp_compartilhe` |
| `status` | string/null | Status: `INICIADO`, `EM_ANDAMENTO`, `CONCLUIDO` |
| `meta_dados` | object/null | Dados da sessão: `{phone_number_id, step, fluxo, ...}` |
| `updated_at` | string/null | Última atualização (ISO 8601) |
| `pode_continuar` | boolean | Flag auxiliar para Make: `true` = use esta sessão |

---

## 📋 Checklist: Implementar no Make

- [ ] Adicionar módulo HTTP POST antes do Router
- [ ] URL: `https://SEU_PROJETO.supabase.co/functions/v1/consultar-sessao`
- [ ] Headers: Authorization com ANON_KEY e Content-Type
- [ ] Body: `{ "telefone": ..., "phone_number_id": ... }`
- [ ] Adicionar condicional após este módulo:
  ```
  if 2.encontrada == true:
    Use 2.origem_canal para decidir rota
  else:
    Use Router por keyword
  ```
- [ ] Testar: Múltiplas conversas simultâneas
- [ ] Validar: `atendimentos_bot` mostra 2+ sessões ativas

---

## 🧪 Como Testar com cURL

```bash
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/consultar-sessao \
  -H "Authorization: Bearer SUA_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "telefone": "5517988888888",
    "phone_number_id": "123456"
  }'
```

**Resposta esperada:**
```json
{
  "encontrada": true,
  "sessao_id": "abc-123",
  "origem_canal": "whatsapp_compartilhe",
  "status": "EM_ANDAMENTO",
  "pode_continuar": true
}
```

---

## 🐛 Troubleshooting

### Erro: HTTP 401
**Causa:** ANON_KEY inválida  
**Solução:** Copiar novamente do Supabase Dashboard

### Erro: "Telefone é obrigatório"
**Causa:** Body não tem campo `telefone`  
**Solução:** Verificar mapeamento em Módulo 2 do Make

### Retorna `encontrada: false` quando deveria ser `true`
**Causa:** 
1. Sessão foi finalizada (`status = 'CONCLUIDO'`)
2. `phone_number_id` não bate
3. `updated_at` > 24 horas atrás (se houver limite)

**Solução:** Verificar banco: `SELECT * FROM atendimentos_bot WHERE telefone = '5517988888888' AND status != 'CONCLUIDO'`

### Retorna a sessão errada
**Causa:** Múltiplas sessões ativas, function retorna a MAIS RECENTE mas não era a esperada  
**Solução:** Verificar `updated_at` em `atendimentos_bot`, garantir que sessão esperada é mais recente

---

## 📚 Referências

- Edge Function criada: `supabase/functions/consultar-sessao/index.ts`
- Usar com: Make.com Module 2 (antes do Router)
- Documentação Make: [Make HTTP Module](https://www.make.com/en/help/app/http)
- Documentação Supabase Edge Functions: [Supabase Docs](https://supabase.com/docs/guides/functions)

---

**Version:** 1.0.0  
**Created:** 19 Jan 2026  
**Status:** Production Ready
