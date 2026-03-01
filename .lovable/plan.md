
# Corrigir fluxo OTP: bypass do disparar-alerta

## Problema

O `criar-usuario` chama `disparar-alerta` para enviar o OTP via WhatsApp. Porém, o `disparar-alerta` (linhas 642-656) **busca regras** na tabela `notificacao_regras` para o evento `otp_verificacao`. Como nao existe nenhuma regra cadastrada, ele retorna "Nenhuma regra encontrada" e **nunca envia o WhatsApp**.

OTP nao deve depender de regras de notificacao -- eh um envio direto, operacional, nao configuravel pelo admin.

## Solucao

Modificar a funcao `criarEEnviarOTP` em `criar-usuario/index.ts` para **chamar o webhook diretamente** usando o utilitario compartilhado `webhook-resolver.ts`, ao inves de passar pelo `disparar-alerta`.

## Detalhes Tecnicos

### Arquivo: `supabase/functions/criar-usuario/index.ts`

**Antes**: `criarEEnviarOTP` faz `fetch` para `/functions/v1/disparar-alerta`

**Depois**: `criarEEnviarOTP` importa `resolverWebhookComRemetente` e `formatarParaWhatsApp` dos utilitarios compartilhados e envia o payload diretamente ao webhook Make resolvido para a `igreja_id` da pessoa.

Fluxo novo:
1. Chamar `resolverWebhookComRemetente(supabase, igrejaId, null, "whatsapp_make")` para resolver o webhook correto da igreja
2. Se encontrar webhook, montar o payload com `telefone`, `nome`, `mensagem`, `template: "otp_verificacao"`, `whatsapp_remetente`, `whatsapp_sender_id`
3. Fazer `fetch` direto ao `webhookUrl` resolvido
4. Se nao encontrar webhook da igreja, fallback para a env var `MAKE_WEBHOOK_URL` global

### Imports a adicionar em `criar-usuario/index.ts`
```text
import { resolverWebhookComRemetente } from "../_shared/webhook-resolver.ts";
import { formatarParaWhatsApp } from "../_shared/telefone-utils.ts";
```

### Payload enviado ao Make (sem mudanca)
```text
{
  "telefone": "5517988216456",
  "nome": "Joao Silva",
  "whatsapp_remetente": "<numero da igreja>",
  "whatsapp_sender_id": "<phone_number_id>",
  "mensagem": "Ola Joao Silva, seu codigo de verificacao e: 123456...",
  "template": "otp_verificacao",
  "webhook_nivel": "igreja",
  "timestamp": "2026-03-01T..."
}
```

### Arquivos afetados

| Arquivo | Acao |
|---|---|
| `supabase/functions/criar-usuario/index.ts` | Reescrever `criarEEnviarOTP` para usar webhook-resolver direto |

Nenhum outro arquivo precisa mudar. O `disparar-alerta` permanece inalterado.
