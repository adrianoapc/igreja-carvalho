
## Escopo confirmado

1. **`IntegracoesCriarDialog.tsx`** — converter conteúdo atual em `<Tabs>`:
   - **Credenciais** (tudo que já existe hoje).
   - **Webhook** (nova): URL de recebimento por provedor (`pix-webhook` para Santander; placeholder "em breve" para Getnet/API Genérica), botão copiar, gestão do secret via `set-webhook-secret` (rotacionar / revelar uma vez), e estatísticas básicas (último evento recebido, contagem 24h) consultando `pix_webhook_log`.
   - **Sincronização** (opcional, só se já houver campos relevantes hoje — caso contrário, deixar fora desta fase).

2. **`Integracoes.tsx`** — adicionar coluna **Webhook** com badge de status:
   - 🟢 Recebendo (último evento < 24h)
   - 🟡 Configurado, sem eventos recentes
   - ⚪ Não configurado
   - 🔴 Erro de assinatura nas últimas tentativas

3. **`ConfigFinanceiro.tsx`** — remover o card "Integração com Provedores" (legado, não usado). Os campos `provider_tipo`, `webhook_url`, `secret_hint`, `sync_strategy` ficam na tabela `configuracoes_financeiro` por ora; drop em migration separada depois de 1-2 semanas.

4. **`/configuracoes` → bloco Financeiro** — adicionar atalho **"Integrações Financeiras e Webhooks →"** que navega para `/financas/integracoes`. Mesmo padrão visual dos outros atalhos do bloco.

## Pontos técnicos

- **Detecção da URL do webhook por provedor**: mapa fixo no frontend (`santander → pix-webhook`, demais → "em breve"). Mostrar URL completa baseada em `VITE_SUPABASE_URL`.
- **Secret**: usar `set-webhook-secret` (já protegida por RBAC). "Revelar uma vez" só funciona logo após rotacionar (não armazenamos plaintext); caso contrário botão fica desabilitado com tooltip "Rotacione para gerar novo secret".
- **Stats de recebimento**: query simples em `pix_webhook_log` filtrando por `igreja_id` + janela 24h. Se a tabela não tiver `integracao_id`, agregamos por igreja (uma integração Santander por igreja é o caso comum).
- **Permissões**: aba Webhook visível apenas para quem tem permissão de editar integrações financeiras (mesmo gate do dialog atual).

## Fora do escopo desta fase

- Drop dos campos legados em `configuracoes_financeiro` (fazer depois).
- Webhook para Getnet/API Genérica (mostrar como "em breve").
- Tela dedicada de logs de webhook (o link "Histórico" já existente cobre logs de import; logs de webhook podem virar uma fase posterior).

Pode confirmar para eu implementar?
