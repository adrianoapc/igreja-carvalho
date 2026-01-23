
# Plano: Correção do Fluxo de Detecção de Inscrição

## Problema Identificado

O fluxo atual tem uma falha crítica:

1. A IA é chamada para classificar a mensagem "compartilhe"
2. A IA responde de forma **conversacional** ("Só confirmando...") em vez de retornar um JSON com `concluido: true` e `intencao: INSCRICAO_EVENTO`
3. Como `parsedJson?.concluido` é `false`/`undefined`, o código **não entra** no fluxo de inscrição
4. A resposta da IA é enviada diretamente ao usuário, ignorando completamente a busca de eventos

### Evidência dos Logs:
```
[Triagem] Sem flow ativo, chamando IA para classificação...
```
→ Mas NÃO aparece: `[Triagem] IA retornou JSON concluído. Intenção: INSCRICAO_EVENTO`
→ Nem: `[Triagem] Iniciando fluxo de inscrição integrado...`

## Solução

Adicionar uma **detecção determinística ANTES da chamada à IA** para palavras-chave de inscrição ("compartilhe", "inscrição", "evento", "quero participar", etc.). Se detectado, ir direto para o fluxo de inscrição sem passar pela IA.

### Alteração Técnica

No arquivo `supabase/functions/chatbot-triagem/index.ts`:

#### 1. Nova função de detecção de palavras-chave

```typescript
// Detectar intenção de inscrição por palavras-chave (SEM IA)
function detectarIntencaoInscricao(texto: string): boolean {
  const textoNorm = texto.toLowerCase().trim();
  const keywords = [
    "compartilhe",
    "inscricao",
    "inscrição",
    "inscrever",
    "quero participar",
    "quero me inscrever",
    "participar do evento",
    "evento",
    "workshop",
    "conferencia",
    "conferência",
  ];
  return keywords.some((kw) => textoNorm.includes(kw));
}
```

#### 2. Verificação ANTES de chamar a IA

Após verificar se há flow ativo (linha ~748), adicionar:

```typescript
// ========== NOVO: DETECÇÃO DETERMINÍSTICA DE INSCRIÇÃO ==========
if (detectarIntencaoInscricao(inputTexto)) {
  console.log(`[Triagem] Detectada intenção de inscrição por palavra-chave. Iniciando fluxo direto...`);
  return await iniciarFluxoInscricao(
    sessao,
    inputTexto,
    supabase,
    igrejaId!,
    filialId,
    nome_perfil
  );
}

// ========== SEM FLOW E SEM KEYWORD: CLASSIFICAR COM IA ==========
```

## Diagrama do Fluxo Corrigido

```text
MENSAGEM RECEBIDA
       │
       ▼
┌──────────────────────────┐
│ 1. TEM SESSÃO COM FLOW?  │
│    (meta.flow definido)  │
└────────────┬─────────────┘
             │
     ┌───────┴───────┐
     │               │
   SIM              NÃO
     │               │
     ▼               ▼
┌──────────┐  ┌────────────────────────────┐
│ Handler  │  │ 2. DETECTAR KEYWORD?       │◄── NOVO
│ Direto   │  │ (compartilhe, inscrição...)│
└──────────┘  └────────────┬───────────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
                SIM                NÃO
                  │                 │
                  ▼                 ▼
      ┌───────────────────┐  ┌─────────────────┐
      │ iniciarFluxo      │  │ 3. CHAMAR IA    │
      │ Inscricao()       │  │ (classificação) │
      │ (busca eventos,   │  └────────┬────────┘
      │  fuzzy match)     │           │
      └───────────────────┘           ▼
                              ┌─────────────────┐
                              │ Processar       │
                              │ resposta IA     │
                              └─────────────────┘
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chatbot-triagem/index.ts` | Adicionar função `detectarIntencaoInscricao()` e verificação antes da chamada à IA |

## Benefícios

1. **Resposta Instantânea**: Mensagens com "compartilhe" não passam mais pela IA
2. **Fluxo Correto**: A busca de eventos é executada imediatamente
3. **Sem Eventos**: Usuário recebe a mensagem correta ("No momento não temos eventos...")
4. **Menor Custo**: Menos chamadas à IA para casos claros

## Testes Após Implementação

1. Enviar "compartilhe" → deve ir direto para `iniciarFluxoInscricao()`
2. Sem eventos no banco → responder "No momento não temos eventos..."
3. Com eventos → listar ou confirmar dados
4. Mensagens genéricas ("oi", "bom dia") → continuar chamando IA
