# Migração de backend: Lovable Cloud → Supabase real + Vercel

> Checklist operacional da migração do backend gerenciado pelo **Lovable Cloud**
> para o **Supabase real** (projeto `ugnrumtngcskbfpwynsr` — igreja-carvalho) e do
> frontend para o **Vercel**. Vivo até a migração fechar. Não contém valores de
> secret — só nomes.

## Estado observado (2026-07-12)

| Item | Estado |
|---|---|
| **Migrations** | ✅ chegam ao Supabase real (F0-F4 aplicadas; verificado por `supabase migration list --linked` e chamada real de RPC). O caminho era o sync do Lovable. |
| **Edge functions** | ⚠️ **só 2 de 57 deployadas** (`chatbot-financeiro`, `receber-pedido-make`). O Lovable **não** migrou as demais. |
| **Secrets de runtime (functions)** | ⚠️ **nenhum** dos ~28 customizados está setado no Supabase real (só os 7 automáticos do Supabase). |
| **CI de deploy** | ✅ reativado — `.github/workflows/supabase-deploy.yml` roda no push para `main` (migrations + 57 functions). |

**Conclusão**: deploy de function e migração de secrets são o trabalho pendente.
Os valores dos secrets vivem no cofre do Lovable Cloud e nos painéis dos
provedores (Santander, Getnet, Meta/WhatsApp, OpenAI, Google, Cloudflare) —
**não estão no repositório**.

## Passo a passo

### 1. Secrets do repositório (GitHub Actions)
Sem eles o workflow falha no `Link project` / `db push`:

```
gh secret set SUPABASE_ACCESS_TOKEN   # token da conta com acesso ao projeto
gh secret set SUPABASE_DB_PASSWORD    # senha do banco do projeto
```

### 2. Secrets de runtime (projeto Supabase)
Setar no projeto (`supabase secrets set NOME=valor --project-ref ugnrumtngcskbfpwynsr`
ou pelo dashboard). Template com **placeholders** (preencha os valores):

```bash
REF=ugnrumtngcskbfpwynsr

# --- Santander (santander-extrato) ---
supabase secrets set --project-ref $REF \
  SANTANDER_APPLICATION_KEY=... \
  SANTANDER_CLIENT_ID=... \
  SANTANDER_CLIENT_SECRET=... \
  SANTANDER_PFX_B64=... \
  SANTANDER_PFX_PASSWORD=...

# --- Cripto / segredos internos ---
supabase secrets set --project-ref $REF \
  ENCRYPTION_KEY=... \
  WEBHOOK_ENCRYPTION_KEY=... \
  INTERNAL_FUNCTION_SECRET=...

# --- PIX ---
supabase secrets set --project-ref $REF \
  PIX_WEBHOOK_SECRET=...

# --- Make (webhooks) ---
supabase secrets set --project-ref $REF \
  MAKE_WEBHOOK_SECRET=... \
  MAKE_WEBHOOK_URL=... \
  ALERT_WEBHOOK_URL=... \
  WEBHOOK_MAKE_ALERTA_EMOCIONAL=...

# --- WhatsApp / Meta ---
supabase secrets set --project-ref $REF \
  WHATSAPP_API_TOKEN=... \
  WHATSAPP_TOKEN=... \
  WHATSAPP_OTP_TEMPLATE=... \
  WHATSAPP_OTP_TEMPLATE_LANG=...

# --- IA ---
supabase secrets set --project-ref $REF \
  OPENAI_API_KEY=... \
  GEMINI_API_KEY=... \
  GOOGLE_API_KEY=...
  # LOVABLE_API_KEY: ver alerta 1 abaixo — provavelmente sai de cena

# --- Outros ---
supabase secrets set --project-ref $REF \
  CLOUDFLARE_TURNSTILE_SECRET_KEY=... \
  TELEFONE_PLANTAO=... \
  APP_URL=https://SEU-DOMINIO-VERCEL   # ver alerta 2
  # TEST_SANTANDER_DEBUG=true  # opcional, só p/ debug
```

Conferir depois: `supabase secrets list --project-ref $REF`.

### 3. Merge do PR de CI
Após (1) e (2), mergear o PR que reativa `supabase-deploy.yml`. O primeiro push
para `main` dispara o deploy completo (migrations + 57 functions).

### 4. Frontend no Vercel
Setar as env vars do projeto Vercel apontando para o Supabase real:

```
VITE_SUPABASE_URL=https://ugnrumtngcskbfpwynsr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
```

Obter a key: `supabase projects api-keys --project-ref ugnrumtngcskbfpwynsr`.

## Mapa function → secrets

**Não precisam de secret custom (~33)** — deployam e funcionam só com os secrets
automáticos do Supabase. Inclui as do financeiro: `gerar-sugestoes-ml`,
`reclass-transacoes`, `undo-import`, `undo-reclass`, `finance-sync`,
`buscar-pix-cron`, `sync-transferencias-conciliacao`, entre outras.

**Precisam de secret (24)** — o mapa abaixo é dos env vars usados no diretório da
própria function; funções que importam `_shared/internal-auth.ts` também exigem
`INTERNAL_FUNCTION_SECRET` (coluna à parte).

| Function | Secrets |
|---|---|
| santander-extrato | SANTANDER_APPLICATION_KEY, SANTANDER_CLIENT_ID, SANTANDER_CLIENT_SECRET, SANTANDER_PFX_B64, SANTANDER_PFX_PASSWORD |
| santander-api | ENCRYPTION_KEY |
| test-santander | ENCRYPTION_KEY, TEST_SANTANDER_DEBUG |
| getnet-sftp | ENCRYPTION_KEY |
| integracoes-config | ENCRYPTION_KEY |
| debug-certificate | ENCRYPTION_KEY |
| pix-webhook | PIX_WEBHOOK_SECRET |
| criar-cobranca-pix | WEBHOOK_ENCRYPTION_KEY |
| buscar-pix-recebidos | WEBHOOK_ENCRYPTION_KEY |
| set-webhook-secret | WEBHOOK_ENCRYPTION_KEY |
| chatbot-financeiro | MAKE_WEBHOOK_SECRET, WHATSAPP_API_TOKEN |
| chatbot-triagem | APP_URL, LOVABLE_API_KEY, OPENAI_API_KEY, WHATSAPP_API_TOKEN |
| checkin-whatsapp-geo | MAKE_WEBHOOK_SECRET |
| criar-usuario | MAKE_WEBHOOK_URL, (+INTERNAL_FUNCTION_SECRET) |
| receber-pedido-make | CLOUDFLARE_TURNSTILE_SECRET_KEY, MAKE_WEBHOOK_SECRET |
| receber-testemunho-make | MAKE_WEBHOOK_SECRET |
| disparar-alerta | APP_URL, MAKE_WEBHOOK_URL, TELEFONE_PLANTAO, (+INTERNAL_FUNCTION_SECRET) |
| verificar-sentimentos-criticos | WEBHOOK_MAKE_ALERTA_EMOCIONAL |
| send-otp | ALERT_WEBHOOK_URL, WHATSAPP_OTP_TEMPLATE, WHATSAPP_OTP_TEMPLATE_LANG, WHATSAPP_TOKEN |
| processar-nota-fiscal | GEMINI_API_KEY, GOOGLE_API_KEY, LOVABLE_API_KEY, OPENAI_API_KEY |
| analise-pedido-ia | LOVABLE_API_KEY, (+INTERNAL_FUNCTION_SECRET) |
| analise-sentimento-ia | LOVABLE_API_KEY, (+INTERNAL_FUNCTION_SECRET) |
| gerar-qrcode-inscricao | APP_URL |
| inscricao-compartilhe | APP_URL |

Outras funções com `_shared/internal-auth.ts` (exigem `INTERNAL_FUNCTION_SECRET`):
`disparar-escala`, `verificar-escalas-pendentes`, `automacao-duplicidade-pessoas`.

## ⚠️ Alertas críticos da migração

1. **`LOVABLE_API_KEY` sai de cena.** É o gateway de IA do Lovable, usado por
   `processar-nota-fiscal`, `chatbot-triagem`, `analise-pedido-ia`,
   `analise-sentimento-ia`. Saindo do Lovable, essa key provavelmente para de
   funcionar — essas functions precisam usar OpenAI/Gemini direto (algumas já
   têm `OPENAI_API_KEY`/`GEMINI_API_KEY`; conferir a lógica de fallback antes do
   cutover).
2. **`APP_URL` = URL do Vercel**, não a do Lovable (entra em links de alerta,
   QR Code e páginas de inscrição).
3. **Dois nomes de token WhatsApp**: `WHATSAPP_API_TOKEN` (chatbot-*) e
   `WHATSAPP_TOKEN` (send-otp). Setar os dois (provavelmente o mesmo valor) ou
   reconciliar os nomes.

## Verificação pós-deploy

```bash
REF=ugnrumtngcskbfpwynsr
ANON=$(supabase projects api-keys --project-ref $REF | grep -iE 'anon|publishable' | grep -oE 'eyJ[A-Za-z0-9_.-]{60,}|sb_publishable_[A-Za-z0-9_]+' | head -1)
# function deployada responde (não 404):
for fn in gerar-sugestoes-ml reclass-transacoes santander-api getnet-sftp pix-webhook; do
  echo -n "$fn -> "; curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    "https://$REF.supabase.co/functions/v1/$fn" -H "apikey: $ANON" -d '{}'
done
supabase functions list --project-ref $REF   # deve listar as 57
```

## Notas

- O deploy de **migration** já era automático (sync Lovable); com o CI próprio
  reativado passa a ser controlado por nós no push para `main`. As F0-F4 já estão
  no banco; o `db push` do CI é no-op para elas e aplica só as novas (F5+).
- O workflow deploya **todas** as 57 functions a cada trigger (garante que nada
  fique defasado). Se ficar lento, dá para evoluir para "só as que mudaram" via
  `git diff`.
