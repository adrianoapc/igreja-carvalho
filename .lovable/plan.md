
# Plano: Corrigir URL e Adicionar Gerador de QR Code

## Problemas Identificados

### 1. URL Incorreta
A edge function `chatbot-triagem` usa um fallback desatualizado:
```typescript
const APP_URL = Deno.env.get("APP_URL") || "https://igreja.lovable.app";
```

A URL correta do projeto publicado é: `https://appcarvalho.lovable.app`

### 2. Página de Check-in Requer Login
A rota `/eventos/checkin/:token` está protegida por `AuthGate`. Quando o usuário clica no link pelo WhatsApp, é redirecionado para login - péssima experiência.

### 3. Solução Proposta
Criar uma **Edge Function geradora de QR Code em imagem PNG**, permitindo que o chatbot retorne uma URL de imagem que pode ser enviada diretamente no WhatsApp.

---

## Alterações Necessárias

### Parte 1: Corrigir APP_URL (Configuração)

Adicionar o secret `APP_URL` com valor `https://appcarvalho.lovable.app`:
- Isso corrige o link retornado pelo chatbot

### Parte 2: Criar Edge Function `gerar-qrcode-inscricao`

**Arquivo:** `supabase/functions/gerar-qrcode-inscricao/index.ts`

Essa função:
1. Recebe um `qr_token` via query string
2. Busca a inscrição no banco
3. Gera um QR Code PNG em memória
4. Retorna a imagem com `Content-Type: image/png`

```typescript
// Exemplo simplificado
import QRCode from "npm:qrcode";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  
  // Buscar inscrição
  const inscricao = await supabase.from("inscricoes_eventos")
    .select("id, pessoa:profiles(nome), evento:eventos(titulo)")
    .eq("qr_token", token).single();
  
  if (!inscricao) return new Response("Not found", { status: 404 });
  
  // Gerar QR Code PNG
  const qrBuffer = await QRCode.toBuffer(
    `${APP_URL}/eventos/checkin/${token}`,
    { type: "png", width: 300 }
  );
  
  return new Response(qrBuffer, {
    headers: { "Content-Type": "image/png" }
  });
});
```

### Parte 3: Criar Página Pública de Visualização de Inscrição

**Arquivo:** `src/pages/InscricaoPublica.tsx`

Uma página **pública** (sem AuthGate) que:
1. Mostra os dados da inscrição (nome, evento, data)
2. Exibe o QR Code renderizado
3. Permite download como PDF (opcional)
4. Valida o check-in apenas se operador estiver logado

### Parte 4: Rota Pública

**Arquivo:** `src/App.tsx`

```typescript
// NOVA ROTA PÚBLICA (sem AuthGate)
<Route path="/inscricao/:token" element={<InscricaoPublica />} />
```

### Parte 5: Atualizar chatbot-triagem

Atualizar para retornar a nova URL pública:
```typescript
const qrLink = `${APP_URL}/inscricao/${qr_token}`;
const qrImageUrl = `${SUPABASE_URL}/functions/v1/gerar-qrcode-inscricao?token=${qr_token}`;

return respostaJson(mensagemFinal, { 
  qr_url: qrLink,
  qr_image: qrImageUrl  // URL da imagem para envio via WhatsApp
});
```

---

## Fluxo do Usuário Após Implementação

1. **Usuário envia "Compartilhe"** → Chatbot processa inscrição
2. **Chatbot retorna:**
   - `qr_url`: Link para página pública da inscrição
   - `qr_image`: URL da imagem PNG do QR Code
3. **Make.com pode enviar** a imagem do QR Code diretamente no WhatsApp
4. **Usuário acessa link** → Vê sua inscrição com QR Code visual
5. **Operador na portaria** → Escaneia QR → É redirecionado para `/eventos/checkin/:token` (que requer login)

---

## Resumo das Alterações

| Item | Descrição |
|------|-----------|
| Secret `APP_URL` | Configurar com `https://appcarvalho.lovable.app` |
| `supabase/functions/gerar-qrcode-inscricao/index.ts` | Nova Edge Function que gera imagem PNG |
| `src/pages/InscricaoPublica.tsx` | Nova página pública com QR Code visual |
| `src/App.tsx` | Adicionar rota `/inscricao/:token` sem AuthGate |
| `supabase/functions/chatbot-triagem/index.ts` | Retornar `qr_image` além de `qr_url` |

---

## Benefícios

1. **URL correta** → Links funcionam
2. **Página pública** → Usuário vê inscrição sem precisar logar
3. **Imagem PNG** → Pode ser enviada diretamente no WhatsApp
4. **Download PDF** (futuro) → Usuário pode salvar comprovante
5. **Segurança mantida** → Check-in real ainda requer operador autenticado
