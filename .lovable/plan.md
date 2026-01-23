
# Plano: Corrigir Prioridade do Flow Ativo sobre Keywords

## Problema Identificado

O código atual tem uma falha de lógica:

```text
┌─────────────────────────────────────────────────────────────┐
│  if (meta.flow) {                                           │
│    switch (meta.flow) {                                     │
│      case "inscricao": return handleFluxoInscricao();       │
│      case "oracao":                                         │
│      case "testemunho":                                     │
│      case "pastoral":                                       │
│        console.log("Flow ativo...");                        │
│        break;  ◄── SAI DO SWITCH, MAS NÃO DA FUNÇÃO!        │
│    }                                                        │
│  }                                                          │
│                                                             │
│  if (detectarIntencaoInscricao(inputTexto)) {  ◄── EXECUTA! │
│    return iniciarFluxoInscricao();  // SOBRESCREVE O FLOW   │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

### Cenário que causou o bug:
1. Usuário inicia testemunho → sessão criada com `flow: "testemunho"`
2. Usuário envia: "Deus tem dado... **Compartilhe** com os amados..."
3. Código verifica `meta.flow = "testemunho"` → faz `break`
4. Código verifica keyword "compartilhe" → **VAI PARA INSCRIÇÃO!**
5. Como não há eventos → "No momento não temos eventos..."

## Solução

A detecção de keyword só deve acontecer quando **NÃO** há flow ativo. Adicionar uma condição para pular a verificação de keyword se já existe um flow definido.

### Alteração no arquivo `supabase/functions/chatbot-triagem/index.ts`

Linha ~768, modificar a condição:

```typescript
// ANTES (bugado):
if (detectarIntencaoInscricao(inputTexto)) {

// DEPOIS (corrigido):
if (!meta.flow && detectarIntencaoInscricao(inputTexto)) {
```

## Fluxo Corrigido

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
┌──────────────────┐  ┌────────────────────────────┐
│ HANDLER DO FLOW  │  │ 2. DETECTAR KEYWORD?       │
│ • inscricao→     │  │ (só se NÃO tem flow!)     │
│   handleFluxo    │  └────────────┬───────────────┘
│ • outros →       │               │
│   continua IA    │      ┌────────┴────────┐
│   (NÃO pula para │      │                 │
│    inscrição!)   │    SIM                NÃO
└──────────────────┘      │                 │
                          ▼                 ▼
              ┌───────────────────┐  ┌─────────────────┐
              │ iniciarFluxo      │  │ 3. CHAMAR IA    │
              │ Inscricao()       │  │ (classificação) │
              └───────────────────┘  └─────────────────┘
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chatbot-triagem/index.ts` | Adicionar `!meta.flow &&` na condição de detecção de keyword (linha ~769) |

## Código Final

```typescript
// ========== DETECÇÃO DETERMINÍSTICA DE INSCRIÇÃO ==========
// SÓ detecta keyword se NÃO houver flow ativo na sessão
if (!meta.flow && detectarIntencaoInscricao(inputTexto)) {
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
```

## Testes Após Correção

1. Iniciar testemunho → enviar texto com "compartilhe" → deve continuar no fluxo de testemunho
2. Enviar "compartilhe" sem sessão ativa → deve ir para fluxo de inscrição
3. Estar em fluxo de oração → enviar "quero participar do evento" → deve continuar no fluxo de oração
4. Sem flow ativo → enviar "quero participar" → deve ir para inscrição
