
# Incluir `igreja_id` no Fluxo de Lembretes

## Problema
O payload enviado para `disparar-alerta` nao inclui `igreja_id`, entao o handler padrao usa a funcao legada `dispararWhatsApp` que depende de env var global e nao resolve o webhook multi-tenant correto.

## Alteracoes

### 1. `supabase/functions/inscricoes-lembrete-evento/index.ts`
Adicionar `igreja_id: evento.igreja_id` dentro do objeto `dados` no body enviado para `disparar-alerta` (linha 138-145).

### 2. `supabase/functions/disparar-alerta/index.ts`
No bloco do canal WhatsApp (linhas 720-728), verificar se `dados.igreja_id` existe. Se sim, chamar `dispararWhatsAppMultiTenant(supabase, igrejaId, telefone, mensagem, evento, templateMeta)` em vez da funcao legada. Caso contrario, manter o fallback atual.

### 3. Corrigir provider do evento no banco
Executar UPDATE na tabela `notificacao_eventos` para alterar `provider_preferencial` de `meta_direto` para `whatsapp_make` (ou NULL) no slug `lembrete_evento_inscricao`.

## Resultado
O lembrete vai resolver o webhook correto da igreja via tabela `webhooks`, acionando o Make e enviando o WhatsApp pelo numero certo.
