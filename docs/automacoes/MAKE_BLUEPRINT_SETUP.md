# Blueprint Make.com - WhatsApp Chatbots

## 📥 Como Importar

1. Acesse sua conta no [Make.com](https://www.make.com)
2. Vá em **Scenarios** → **Create a new scenario**
3. Clique nos 3 pontinhos (⋮) no canto superior direito
4. Selecione **Import Blueprint**
5. Faça upload do arquivo `make-whatsapp-chatbots-blueprint.json`
6. Clique em **Save**

---

## ⚙️ Configuração Necessária (Pré-Requisitos)

### 1. WhatsApp Business Cloud API
- [ ] Conta Meta Business criada
- [ ] WhatsApp Business App configurado
- [ ] Número de telefone verificado
- [ ] Token de acesso permanente gerado
- [ ] Webhook configurado apontando para o Make

**Documentação:** [Meta for Developers - WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

### 2. Supabase
- [ ] Projeto criado
- [ ] Edge Functions implantadas (`chatbot-triagem`, `chatbot-financeiro`, `inscricao-compartilhe`)
- [ ] ANON_KEY copiada (Settings → API)
- [ ] URL do projeto copiada (ex: `https://abcdefgh.supabase.co`)

### 3. Make.com
- [ ] Conta criada (plano Free ou superior)
- [ ] Conexão WhatsApp Business configurada

---

## 🔧 Configurar o Blueprint Após Importação

### Módulo 1: Watch WhatsApp Events (Webhook)

**O que fazer:**
1. No módulo webhook, clique em **Create a webhook**
2. Copie a URL gerada (ex: `https://hook.us1.make.com/abc123xyz`)
3. Vá no Meta Business → WhatsApp → Configuration → Webhook
4. Cole a URL do Make
5. Subscribe nos eventos:
   - ✅ `messages`
   - ✅ `message_status`
6. Teste enviando uma mensagem para o número WhatsApp

**Validação:** Você deve ver os dados chegando no histórico do Make.

---

### Módulo 3, 4, 5: HTTP Requests (Edge Functions)

**O que fazer em CADA módulo:**

1. **Substituir URL:**
   ```
   Antes: https://SEU_PROJETO.supabase.co/functions/v1/...
   Depois: https://abcdefgh.supabase.co/functions/v1/...
   ```

2. **Substituir Authorization Header:**
   ```
   Antes: Bearer SUA_SUPABASE_ANON_KEY
   Depois: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

**Onde encontrar:**
- URL: Supabase Dashboard → Settings → API → Project URL
- ANON_KEY: Supabase Dashboard → Settings → API → Project API keys → `anon` `public`

**⚠️ IMPORTANTE:** Configure os 3 módulos:
- Módulo 3: `chatbot-triagem`
- Módulo 4: `chatbot-financeiro`
- Módulo 5: `inscricao-compartilhe`

---

### Módulo 6: Send WhatsApp Message (Resposta)

**O que fazer:**

1. **Substituir Authorization Header:**
   ```
   Antes: Bearer SEU_WHATSAPP_BUSINESS_TOKEN
   Depois: Bearer EAAGm7J8ZB4...seu_token_permanente
   ```

**Onde encontrar:**
- Meta Business Manager → System Users → Add System User
- Assign WhatsApp Business Management permission
- Generate Token → Copy

**⚠️ CRÍTICO:** A URL do módulo já está dinâmica:
```
https://graph.facebook.com/v18.0/{{1.entry[].changes[].value.metadata.phone_number_id}}/messages
```

**NÃO substitua** `phone_number_id` por um valor fixo! Isso garante que a resposta vai pelo número correto.

---

### Módulo 8: Send WhatsApp to Admin (Notificação)

**O que fazer:**

1. **Substituir token** (mesmo do módulo 6)
2. **Ajustar telefone de fallback:**
   ```json
   "to": "... ; '5517988216456'))..."
                 ^^^^^^^^^^^^^^
                 Seu telefone admin
   ```

**Quando é disparado:**
- `notificar_admin = true` retornado pelo edge function
- Exemplos: Solicitação pastoral urgente, pedido de reembolso acima de R$ 1000

---

## ✅ Checklist Final

- [ ] Webhook configurado e recebendo eventos
- [ ] Módulo 3 (triagem) com URL e token corretos
- [ ] Módulo 4 (financeiro) com URL e token corretos
- [ ] Módulo 5 (compartilhe) com URL e token corretos
- [ ] Módulo 6 (resposta) com token WhatsApp correto
- [ ] Módulo 8 (admin) com token e telefone corretos
- [ ] Scenario ativado (toggle ON no canto superior direito)
- [ ] Teste enviado: "Olá" para o número WhatsApp
- [ ] Resposta recebida: Mensagem do bot de boas-vindas

---

## 🧪 Testes Recomendados

### Teste 1: Triagem (Pastoral)
**Enviar:** "Preciso de oração"  
**Esperado:** Bot inicia fluxo de coleta de pedido de oração

### Teste 2: Financeiro
**Enviar:** "Quero fazer um reembolso"  
**Esperado:** Bot inicia fluxo de reembolso, pede comprovantes

### Teste 3: Compartilhe (Inscrição)
**Enviar:** "Quero me inscrever no compartilhe"  
**Esperado:** Bot lista eventos disponíveis para inscrição

### Teste 4: Continuidade
**Enviar:** "reembolso" → aguardar resposta → enviar "sim"  
**Esperado:** Bot mantém contexto e continua fluxo de reembolso

### Teste 5: Multi-número (Isolamento)
**Setup:** Dois números WhatsApp (A e B) na mesma conta  
**Enviar:**
1. Para Número A: "reembolso"
2. Para Número B: "oração"
**Esperado:** Duas conversas isoladas, sem cruzamento de contexto

---

## 🐛 Troubleshooting

### Erro: "Invalid webhook URL"
**Causa:** URL do Make não foi configurada no Meta Business  
**Solução:** Verificar/reconfigurar webhook no Meta → WhatsApp → Configuration

### Erro: HTTP 401 nos módulos HTTP
**Causa:** ANON_KEY incorreta ou expirada  
**Solução:** Copiar novamente do Supabase Dashboard → Settings → API

### Erro: HTTP 403 ao enviar mensagem WhatsApp
**Causa:** Token WhatsApp sem permissões ou expirado  
**Solução:** Gerar novo token permanente com permissão `whatsapp_business_management`

### Bot não responde
**Causa:** Scenario desativado ou filtros do Router não batendo  
**Solução:** 
1. Verificar se scenario está ON (toggle verde)
2. Ver histórico de execuções (History)
3. Verificar se entrou em alguma rota do Router

### Resposta vem pelo número errado
**Causa:** `phone_number_id` fixo em vez de dinâmico  
**Solução:** Garantir que URL do módulo 6 usa `{{1.entry[].changes[].value.metadata.phone_number_id}}`

---

## 📊 Monitoramento

### Métricas Importantes

**No Make.com:**
- Operations usado: Ver no Dashboard → Usage
- Execuções com sucesso vs erro: History
- Tempo médio de resposta: History → Duration

**No Supabase:**
- Logs de edge functions: `supabase functions logs chatbot-triagem --tail`
- Sessões ativas: Query em `atendimentos_bot` com `status != 'CONCLUIDO'`
- Taxa de conclusão: % de sessões com `status = 'CONCLUIDO'`

**No Meta Business:**
- Quality Rating: Business Manager → WhatsApp → Insights
- Message Templates Status: Se estiver usando templates
- Webhook Delivery Rate: Configuration → Webhook → View Events

---

## 🔄 Atualizações Futuras

### Como Adicionar Nova Rota

1. No Router (módulo 2), clique em **Add route**
2. Configure filtro: `contains(toLower(...); "keyword")`
3. Adicione módulo HTTP Request apontando para novo edge function
4. Certifique-se de incluir `phone_number_id` no body
5. Teste isoladamente antes de ativar em produção

### Como Adicionar Template WhatsApp

No módulo 6 (Send Message), mude o body para:

```json
{
  "messaging_product": "whatsapp",
  "to": "{{1.entry[].changes[].value.messages[].from}}",
  "type": "template",
  "template": {
    "name": "nome_do_template",
    "language": {
      "code": "pt_BR"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "{{variavel_dinamica}}"
          }
        ]
      }
    ]
  }
}
```

---

## 📚 Documentação Relacionada

- [Guia de Ajustes `phone_number_id`](./MAKE_WHATSAPP_PHONE_NUMBER_ID.md)
- [Edge Functions do Supabase](../funcionalidades.md#chatbots-whatsapp)
- [Catálogo de Automações](./catalogo-automacoes.md)

---

## 🆘 Suporte

**Problemas com o blueprint?**
1. Verifique logs no Make: History → Click na execução → Ver detalhes
2. Verifique logs no Supabase: Dashboard → Logs → Filter by function
3. Consulte troubleshooting acima
4. Abra issue no GitHub com:
   - Screenshot do erro
   - Payload recebido (sem dados sensíveis)
   - Versão do blueprint

---

**Blueprint Version:** 1.0.0  
**Last Updated:** 19 Jan 2026  
**Tested with:** Make.com Free Plan, Supabase Free Tier, WhatsApp Business Cloud API
