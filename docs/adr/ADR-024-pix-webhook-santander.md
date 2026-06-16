# ADR-024 — Webhook PIX Santander com CORS aberto e health check

- **Status**: Aceito
- **Data**: 2026-01-19
- **Contexto**:
  - Santander exige endpoint HTTP com **GET health check** e **POST** seguindo o payload BACEN (`pix[]`).
  - É necessário ingestão imediata de PIX recebidos (domingo/noite) sem expor credenciais no frontend e preservando multi-tenant.
  - A chave PIX (CNPJ) identifica a igreja; o payload chega sem `igreja_id` explícito.
  - A tabela de entrada é `pix_webhook_temp`, usada como staging para conciliação de ofertas.

- **Decisão**:
  - Adotar **edge function `pix-webhook`** com CORS liberado (`*`) apenas para esse endpoint, aceitando GET (health) e POST (notificações).
  - Resolver `igreja_id` via busca pelo CNPJ da chave PIX (limpo e formatado), antes de inserir.
  - Persistir cada notificação em `pix_webhook_temp` com status `recebido`, payload bruto e `banco_id` fixo (Santander CNPJ `90400888000142`).
  - Manter idempotência pelo campo `pix_id` (endToEndId) com UNIQUE na tabela.

- **Alternativas consideradas**:
  - **Polling de extrato bancário**: descartado; atraso até D+1 e risco de perder timestamp real do recebimento.
  - **Webhook autenticado por token secreto**: não suportado pelo provedor; BACEN entrega sem header customizado.
  - **Resolver igreja por header `X-Igreja-ID`**: não viável para notificações de produção do banco; permanece apenas para testes internos.

- **Consequências**:
  - Permite ingestão imediata para conciliação e dashboards de ofertas em tempo real.
  - CORS aberto restrito ao endpoint `pix-webhook`; mitigação por validação de estrutura e idempotência no banco.
  - Acoplamento ao provedor Santander (payload BACEN); novos bancos exigirão adaptadores ou tabela de mapeamento de chave → igreja.
  - Necessário monitorar erros de inserção (duplicatas) e PIX sem correspondência de igreja (log em console, sem rejeitar o payload).

- **Referências**:
  - Código: `supabase/functions/pix-webhook/index.ts`
  - Migration staging: `supabase/migrations/20260117_create_pix_webhook_temp.sql`
  - Docs operacionais originais fundidos aqui: `docs/_archive/_fundidos/WEBHOOK_PIX_{README,SETUP,PAYLOADS}.md`

---

## Apêndice Operacional (fundido de WEBHOOK_PIX_README + SETUP + PAYLOADS)

> ⚠️ **Drift corrigido**: os docs originais (jan/2026) referenciavam `pix-webhook-receiver`.
> O nome real da edge function é **`pix-webhook`** — conforme `supabase/functions/pix-webhook/index.ts`.
> Todo `pix-webhook-receiver` abaixo é nomenclatura histórica.

### Estrutura do payload Santander (padrão BACEN)

```json
{
  "idNotificacao": "12345678901234567890",
  "tipoNotificacao": "pix.recebimento",
  "pixId": "e1234567-e123-4567-e123-456789012345",
  "endToEndId": "E1234567890123456789012345678",
  "txid": "A1234567890123456789012345",
  "valor": 250.50,
  "status": "CONCLUIDO",
  "calendario": { "criacao": "2026-01-19T20:00:00Z", "expiracao": 3600 },
  "devedor": { "nome": "João da Silva Santos", "cpf": "12345678900", "cnpj": null },
  "infoAdicionais": [{ "nome": "campo1", "valor": "Oferta Culto Domingo" }]
}
```

### Mapeamento de campos → `pix_webhook_temp`

| Campo Santander           | Coluna DB          | Descrição              |
|---------------------------|--------------------|------------------------|
| `pixId`                   | `pix_id` (UNIQUE)  | ID único do PIX        |
| `valor`                   | `valor`            | Valor em reais         |
| `devedor.nome`            | `pagador_nome`     | Quem enviou            |
| `devedor.cpf / cnpj`      | `pagador_cpf_cnpj` | CPF ou CNPJ            |
| `calendario.criacao`      | `data_pix`         | Data/hora real do PIX  |
| `infoAdicionais[0].valor` | `descricao`        | Descrição              |

### Configurar webhook no Santander

```
Portal: https://developer.santander.com.br/
Menu: Webhooks → PIX Recebimento
URL (corrigida): https://<projeto>.supabase.co/functions/v1/pix-webhook
Evento: pix.recebimento | Método: POST
```

> O GET no mesmo endpoint serve como health check (retorna 200 `{"status":"ok"}`).

### Queries de monitoramento (`pix_webhook_temp`)

```sql
-- PIX não vinculados a oferta
SELECT id, pix_id, valor, pagador_nome, data_pix
FROM pix_webhook_temp
WHERE oferta_id IS NULL AND status = 'processado'
  AND igreja_id = '<uuid>' ORDER BY data_pix DESC;

-- Somatório por dia (últimos 7 dias)
SELECT DATE_TRUNC('day', data_pix) as dia, COUNT(*) as qtd, SUM(valor) as total
FROM pix_webhook_temp
WHERE igreja_id = '<uuid>' AND data_pix >= NOW() - INTERVAL '7 days'
GROUP BY 1 ORDER BY 1 DESC;

-- PIX com erro
SELECT pix_id, valor, erro_mensagem, created_at
FROM pix_webhook_temp WHERE status = 'erro' AND igreja_id = '<uuid>'
ORDER BY created_at DESC;
```

### Troubleshooting rápido

| Sintoma | Causa | Solução |
|---|---|---|
| `duplicate key value` | `pix_id` já existe | Idempotente — ignorar, não reprocessar |
| `Valor inválido` | valor null ou ≤ 0 | Validar antes do POST |
| `Header obrigatório` | `X-Igreja-ID` ausente | Adicionar header na configuração do webhook |
