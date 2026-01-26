

# Plano: Correção da Duplicação de Mensagens e Fluxo Fallback

## Problema Identificado

Analisando os logs e a base de dados, identifiquei **dois problemas distintos**:

### Problema 1: Flow "fallback" Não Tratado

A IA está retornando `fluxo_atual: "fallback"` que é salvo na sessão:

```text
[Triagem] Flow detectado pela IA: fallback - salvando para proteção da sessão
[Triagem] Sessão com flow ativo: fallback, step: undefined
```

O switch no código só trata os flows válidos:
```typescript
switch (meta.flow) {
  case "inscricao":    // ✓ tratado
  case "oracao":       // ✓ tratado  
  case "testemunho":   // ✓ tratado
  case "pastoral":     // ✓ tratado
  // "fallback" ❌ NÃO TRATADO - cai fora do switch
}
```

Quando `meta.flow = "fallback"` (truthy), a condição para detectar inscrição falha:
```typescript
if (!meta.flow && detectarIntencaoInscricao(inputTexto))
//   ↑ false porque "fallback" é truthy
```

### Problema 2: Mensagens Duplicadas

Os logs mostram que a mesma mensagem "compartilhe" foi recebida duas vezes em sequência:
- 17:36:27 - `[Triagem] Texto extraído: "compartilhe"`
- 17:37:06 - `[Triagem] Texto extraído: "COMPARTILHE"`

Isso pode ser causado por:
- Make.com com retry automático
- Webhook duplicado do WhatsApp
- Timeout na resposta causando reenvio

---

## Solução Proposta

### 1. Validar Flows Salvos na Sessão

Modificar a função `pickFlowFromParsed` para retornar `null` quando o flow não é reconhecido:

```typescript
const FLOWS_VALIDOS = ["inscricao", "oracao", "testemunho", "pastoral"];

function pickFlowFromParsed(parsed: Record<string, unknown> | null): string | null {
  if (!parsed) return null;
  
  const fluxoAtual = typeof parsed.fluxo_atual === "string" ? parsed.fluxo_atual : null;
  if (fluxoAtual) {
    const normalizado = fluxoAtual.trim().toLowerCase();
    // SÓ retorna se for um flow válido
    if (FLOWS_VALIDOS.includes(normalizado)) {
      return normalizado;
    }
    return null; // Ignora flows inválidos como "fallback"
  }
  
  const intencao = typeof parsed.intencao === "string" ? parsed.intencao : null;
  return mapIntencaoToFlow(intencao);
}
```

### 2. Tratar Flows Inválidos no Switch

Adicionar tratamento para flows não reconhecidos:

```typescript
const meta = (sessao.meta_dados || {}) as SessionMeta;
const FLOWS_VALIDOS = ["inscricao", "oracao", "testemunho", "pastoral"];

// Validar se o flow é reconhecido
const flowValido = meta.flow && FLOWS_VALIDOS.includes(meta.flow);

if (flowValido) {
  switch (meta.flow) {
    case "inscricao":
      return await handleFluxoInscricao(...);
    case "oracao":
    case "testemunho":
    case "pastoral":
      break;
  }
}

// DETECÇÃO DE INSCRIÇÃO - agora funciona mesmo com flow inválido
if (!flowValido && detectarIntencaoInscricao(inputTexto)) {
  // Limpar flow inválido antes de iniciar novo fluxo
  if (meta.flow && !FLOWS_VALIDOS.includes(meta.flow)) {
    await supabase.from("atendimentos_bot").update({
      meta_dados: { ...meta, flow: null }
    }).eq("id", sessao.id);
  }
  return await iniciarFluxoInscricao(...);
}
```

### 3. Adicionar Proteção contra Duplicação (Idempotência)

Implementar verificação de mensagem recente duplicada:

```typescript
// No início do processamento, após obter sessão
const historico = sessao?.historico_conversa || [];
const ultimaMensagemUsuario = historico
  .filter((h: any) => h.role === "user")
  .slice(-1)[0]?.content;

// Se a última mensagem é idêntica e foi há menos de 5 segundos
if (ultimaMensagemUsuario === inputTexto && sessao?.updated_at) {
  const diffMs = Date.now() - new Date(sessao.updated_at).getTime();
  if (diffMs < 5000) {
    console.log(`[Triagem] Mensagem duplicada ignorada (${diffMs}ms)`);
    return new Response(JSON.stringify({ 
      reply_message: null, 
      duplicate: true 
    }), { headers: corsHeaders });
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chatbot-triagem/index.ts` | Validar flows, tratar fallback, proteção duplicação |

---

## Fluxo Corrigido

```text
+------------------------------------------------------------------+
| 1. Recebe mensagem "compartilhe"                                 |
+------------------------------------------------------------------+
| 2. Busca sessão existente                                        |
+------------------------------------------------------------------+
| 3. NOVO: Verifica duplicação (mesma msg < 5s)                    |
|    SE duplicada -> ignora com reply_message: null                |
+------------------------------------------------------------------+
| 4. Verifica meta.flow                                            |
|    SE flow = "fallback" ou inválido -> trata como SEM flow       |
+------------------------------------------------------------------+
| 5. Detecta keyword "compartilhe"                                 |
|    -> Inicia fluxo de inscrição                                  |
+------------------------------------------------------------------+
```

---

## Benefícios

- **Correção do bug**: Keyword "compartilhe" funciona mesmo com sessão "suja"
- **Resiliência**: Flows inválidos da IA são ignorados
- **Sem duplicação**: Mensagens repetidas em sequência são ignoradas
- **Logs claros**: Facilita debug futuro

---

## Ordem de Implementação

1. Adicionar lista de flows válidos como constante
2. Modificar `pickFlowFromParsed` para validar flows
3. Ajustar lógica do switch para verificar flows válidos
4. Adicionar verificação de duplicação por idempotência
5. Testar cenário com "compartilhe" após conversa com IA

