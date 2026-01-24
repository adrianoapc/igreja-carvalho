

# Plano: Corrigir Persistência do Flow na Continuação de Conversa

## Problema Raiz Identificado

O código tem **dois blocos distintos** de atualização de sessão, mas apenas um salva o flow:

```text
if (parsedJson?.concluido) {
  // Fecha sessão (não precisa salvar flow)
  ...
} else {
  // Conversa continua → NÃO ESTÁ SALVANDO meta_dados.flow! ❌
  await supabase.from("atendimentos_bot").update({
    historico_conversa: [...],  // SÓ histórico, sem meta_dados!
  }).eq("id", sessao.id);
}
```

### Fluxo Atual (Bugado)

```text
Msg 1: "Tenho um testemunho!"
     │
     ▼
IA: "Pode contar?"
    {"fluxo_atual": "TESTEMUNHO"}
     │
     ▼
pickFlowFromParsed() → "TESTEMUNHO"
     │
     ▼
BLOCO ELSE → update({ historico_conversa: [...] })
            ❌ NÃO SALVA meta.flow!
     │
     ▼
Msg 2: "Compartilhe com todos..."
     │
     ▼
meta.flow = undefined (não foi salvo!)
     │
     ▼
!meta.flow = true → detectarIntencaoInscricao("Compartilhe") = true
     │
     ▼
→ INSCRIÇÃO EM EVENTO ❌
```

## Solução

Modificar o bloco `else` (linhas 987-998) para **incluir a persistência de `meta_dados.flow`** usando o valor já extraído por `pickFlowFromParsed()`.

### Alteração no arquivo `supabase/functions/chatbot-triagem/index.ts`

**Linhas 987-998 - ANTES:**
```typescript
} else {
  // Conversa continua
  await supabase
    .from("atendimentos_bot")
    .update({
      historico_conversa: [
        ...historico,
        { role: "user", content: inputTexto },
        { role: "assistant", content: aiContent },
      ],
    })
    .eq("id", sessao.id);
}
```

**DEPOIS:**
```typescript
} else {
  // Conversa continua - SALVAR FLOW PARA PROTEGER SESSÃO
  const inferredFlow = pickFlowFromParsed(parsedJson);
  const currentMeta = (sessao.meta_dados || {}) as SessionMeta;
  const novoFlow = inferredFlow || currentMeta.flow;
  
  if (novoFlow && novoFlow !== currentMeta.flow) {
    console.log(`[Triagem] Flow detectado pela IA: ${novoFlow} - salvando para proteção da sessão`);
  }
  
  await supabase
    .from("atendimentos_bot")
    .update({
      historico_conversa: [
        ...historico,
        { role: "user", content: inputTexto },
        { role: "assistant", content: aiContent },
      ],
      meta_dados: {
        ...currentMeta,
        flow: novoFlow,
      },
    })
    .eq("id", sessao.id);
}
```

### Ajuste Adicional: Normalizar Flow para lowercase

O switch (linhas 755-773) espera valores em **lowercase** (`"testemunho"`, `"oracao"`), mas `pickFlowFromParsed` retorna em **UPPERCASE** (`"TESTEMUNHO"`, `"ORACAO"`).

**Modificar `pickFlowFromParsed` (linhas ~183):**

```typescript
function pickFlowFromParsed(parsed: Record<string, unknown> | null): string | null {
  if (!parsed) return null;
  const fluxoAtual = typeof parsed.fluxo_atual === "string" ? parsed.fluxo_atual : null;
  if (fluxoAtual && fluxoAtual.trim()) {
    return fluxoAtual.trim().toLowerCase();  // ← CORRIGIR PARA LOWERCASE
  }
  const intencao = typeof parsed.intencao === "string" ? parsed.intencao : null;
  return mapIntencaoToFlow(intencao)?.toLowerCase() || null;  // ← CORRIGIR AQUI TAMBÉM
}
```

## Fluxo Corrigido

```text
Msg 1: "Tenho um testemunho!"
     │
     ▼
IA: "Pode contar?"
    {"fluxo_atual": "TESTEMUNHO"}
     │
     ▼
pickFlowFromParsed() → "testemunho" (lowercase)
     │
     ▼
BLOCO ELSE → update({ 
  historico_conversa: [...],
  meta_dados: { flow: "testemunho" }  ✓
})
     │
     ▼
Msg 2: "Compartilhe com todos..."
     │
     ▼
meta.flow = "testemunho" ✓
     │
     ▼
switch("testemunho") → case "testemunho": break;
     │
     ▼
SKIP keyword detection (já tem flow)
     │
     ▼
Continua com IA → coleta testemunho ✓
```

## Resumo das Alterações

| Arquivo | Linha(s) | Alteração |
|---------|----------|-----------|
| `supabase/functions/chatbot-triagem/index.ts` | 183-185 | `pickFlowFromParsed`: converter para lowercase |
| `supabase/functions/chatbot-triagem/index.ts` | 987-998 | Bloco `else`: incluir `meta_dados.flow` no update |

## Testes Após Implementação

1. **Testemunho protegido**: "Tenho testemunho" → IA responde → enviar "Compartilhe com todos" → deve continuar testemunho
2. **Oração protegida**: "Preciso de oração" → IA responde → enviar "Compartilhe sua bênção" → deve continuar oração
3. **Inscrição normal**: Sem sessão → "Compartilhe" → deve ir para inscrição
4. **Verificar banco**: `SELECT meta_dados FROM atendimentos_bot` → deve mostrar `flow` em lowercase

