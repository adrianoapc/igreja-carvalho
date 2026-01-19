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
  - Doc operacional: `docs/WEBHOOK_PIX_README.md`
