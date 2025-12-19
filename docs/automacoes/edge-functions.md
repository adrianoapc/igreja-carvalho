# Edge Functions

## chatbot-triagem

- **Path:** `supabase/functions/chatbot-triagem/index.ts`
- **Disparo:** HTTP `POST /functions/v1/chatbot-triagem` (`verify_jwt = false`)
- **Entrada esperada:**
	```json
	{
		"telefone": "+5517999999999",
		"nome_perfil": "Contato WhatsApp",
		"tipo_mensagem": "text",
		"conteudo_texto": "mensagem livre",
		"media_id": "id-opcional"
	}
	```
- **Valores aceitos para `tipo_mensagem`:** `text`, `audio`, `image` (imagem ainda sem processamento automático).
- **Observação:** `media_id` só é enviado quando `tipo_mensagem = "audio"`.
- **Fluxo resumido:**
	1. Transcreve áudios recebidos do WhatsApp via API Meta (`whisper-1`).
	2. Recupera/cria sessão ativa em `atendimentos_bot` (janela de 24h) e registra histórico.
	3. Escreve audit trail no `logs_auditoria_chat` para compliance LGPD (USER/BOT).
	4. Chama OpenAI `gpt-4o-mini` com system prompt otimizado para intenções (pedido/testemunho/dúvida/solicitação pastoral).
	5. Quando o modelo retorna JSON `concluido`, encerra sessão, cria registros:
		 - `pedidos_oracao` com vínculo a membro (profiles) ou lead (`visitantes_leads`).
		 - `testemunhos` com flag de publicação.
		 - Pedidos pastorais com título prefixado e gravidade alta.
	6. Atualiza `visitantes_leads` para contatos externos e retorna texto amigável + flag `notificar_admin`.
- **Saída:**
	```json
	{
		"reply_message": "texto enviado ao WhatsApp",
		"notificar_admin": false,
		"dados_contato": { "telefone": "...", "nome": "...", "motivo": "..." }
	}
	```
- **Dependências:** `OPENAI_API_KEY`, `WHATSAPP_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` configurados como secrets.
- **Cenários críticos:** garantir quota do Whisper, monitorar erro 500 (retorno genérico) e ajustar prompt ao incluir novas intenções.
