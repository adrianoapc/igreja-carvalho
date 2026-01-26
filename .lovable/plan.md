
# Plano: Corrigir URL e Adicionar Gerador de QR Code ✅ CONCLUÍDO

## Implementação Realizada

### ✅ Parte 1: Corrigir APP_URL (Configuração)
- Secret `APP_URL` configurado com `https://appcarvalho.lovable.app`
- Ambos os chatbots atualizados para usar o novo fallback

### ✅ Parte 2: Criar Edge Function `gerar-qrcode-inscricao`
- **Arquivo:** `supabase/functions/gerar-qrcode-inscricao/index.ts`
- Gera QR Code PNG via query string `?token=xxx`
- Usa biblioteca `qrcode` para gerar imagem em memória
- Retorna `Content-Type: image/png` com cache de 24h

### ✅ Parte 3: Criar Página Pública de Visualização
- **Arquivo:** `src/pages/InscricaoPublica.tsx`
- Página pública (sem AuthGate) que exibe:
  - Dados da inscrição (nome, evento, data/hora, local)
  - Status da inscrição (confirmada, pendente, cancelada)
  - QR Code visual para check-in
  - Botão para download do QR Code

### ✅ Parte 4: Rota Pública
- **Arquivo:** `src/App.tsx`
- Nova rota: `/inscricao/:token` (pública, sem AuthGate)

### ✅ Parte 5: Atualizar Chatbots
- `chatbot-triagem` e `inscricao-compartilhe` agora retornam:
  - `qr_url`: Link para página pública (`/inscricao/:token`)
  - `qr_image`: URL da imagem PNG do QR Code

---

## Fluxo do Usuário

1. **Usuário envia "Compartilhe"** → Chatbot processa inscrição
2. **Chatbot retorna:**
   - `qr_url`: `https://appcarvalho.lovable.app/inscricao/{token}`
   - `qr_image`: `https://mcomwaelbwvyotvudnzt.supabase.co/functions/v1/gerar-qrcode-inscricao?token={token}`
3. **Make.com pode enviar** a imagem do QR Code diretamente no WhatsApp
4. **Usuário acessa link** → Vê sua inscrição com QR Code visual
5. **Operador na portaria** → Escaneia QR → É redirecionado para `/eventos/checkin/:token` (protegido)

---

## Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/gerar-qrcode-inscricao/index.ts` | Criado |
| `src/pages/InscricaoPublica.tsx` | Criado |
| `src/App.tsx` | Modificado (nova rota) |
| `supabase/config.toml` | Modificado (nova função) |
| `supabase/functions/chatbot-triagem/index.ts` | Modificado (URLs) |
| `supabase/functions/inscricao-compartilhe/index.ts` | Modificado (URLs) |
