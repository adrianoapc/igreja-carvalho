
# Plano: Adicionar Campo de Observação/Comentário ao Chatbot Financeiro

## Contexto

Atualmente, o `chatbot-financeiro` processa comprovantes via OCR e extrai dados automaticamente (valor, fornecedor, descrição). Porém:
- Não solicita comentário/observação do usuário
- Não permite corrigir categoria/subcategoria sugeridas pela IA
- Não associa à base ministerial (Infantil, Louvor, etc.)

## Objetivo

Adicionar um passo opcional para o usuário informar observações/contexto que ajudem a:
1. Documentar o motivo da despesa ("Lanche do encontro de casais")
2. Identificar a base ministerial ("Materiais para reforma da cozinha")
3. Melhorar relatórios e auditoria

## Solução Proposta

### Novo Estado na Máquina de Estados

Adicionar `AGUARDANDO_OBSERVACAO` como estado intermediário entre enviar comprovantes e finalizar:

```text
AGUARDANDO_COMPROVANTES 
       ↓ (usuário digita "fechar")
AGUARDANDO_OBSERVACAO    ← NOVO
       ↓ (usuário envia texto ou "pular")
FINALIZADO
```

### Alterações em `chatbot-financeiro/index.ts`

**1. Novo estado no tipo `EstadoSessao`:**
```typescript
type EstadoSessao =
  | "AGUARDANDO_FORMA_INICIAL"
  | "AGUARDANDO_COMPROVANTES"
  | "AGUARDANDO_OBSERVACAO"  // NOVO
  | "AGUARDANDO_DATA"
  | "AGUARDANDO_FORMA_PGTO"
  | "FINALIZADO";
```

**2. Novo campo no `MetaDados`:**
```typescript
interface MetaDados {
  // ... campos existentes
  observacao_usuario?: string;  // NOVO: comentário livre do usuário
}
```

**3. Lógica do novo estado:**

Quando usuário digita "Fechar" (após enviar comprovantes), ao invés de finalizar direto:

```typescript
// APÓS receber todos os comprovantes (comando "Fechar")
if (qtdItens > 0) {
  // Transição para pedir observação
  await supabase.from("atendimentos_bot").update({
    meta_dados: { ...metaDados, estado_atual: "AGUARDANDO_OBSERVACAO" }
  }).eq("id", sessao.id);

  return respostaJson(`📋 *Resumo: ${qtdItens} comprovante(s)*
💰 Total: ${formatarValor(valorTotal)}

✏️ Deseja adicionar uma observação?
Ex: "Lanche do infantil" ou "Material reforma cozinha"

Digite a observação ou *Pular* para continuar.`);
}
```

**4. Tratamento do estado `AGUARDANDO_OBSERVACAO`:**

```typescript
if (estadoAtual === "AGUARDANDO_OBSERVACAO") {
  const texto = (mensagem || "").trim();
  
  // Verificar se quer pular
  const querPular = /^(pular|skip|nao|não|n|continuar)$/i.test(texto.toLowerCase());
  
  // Salvar observação (ou null se pulou)
  const observacaoFinal = querPular ? null : texto;
  
  await supabase.from("atendimentos_bot").update({
    meta_dados: {
      ...metaDados,
      observacao_usuario: observacaoFinal,
      estado_atual: metaDados.fluxo === "REEMBOLSO" 
        ? "AGUARDANDO_DATA" 
        : "FINALIZADO"
    }
  }).eq("id", sessao.id);

  // Se DESPESAS ou CONTA_UNICA, finalizar direto
  // Se REEMBOLSO, continuar para perguntar data
}
```

**5. Incluir observação nas transações/reembolsos:**

No momento da gravação, adicionar a observação do usuário:

```typescript
// Para transações (DESPESAS/CONTA_UNICA)
observacoes: [
  item.descricao,
  metaDados.observacao_usuario, // NOVO
  `Fornecedor: ${item.fornecedor}`,
  `Origem: WhatsApp`,
].filter(Boolean).join("\n"),

// Para itens de reembolso
descricao: metaDados.observacao_usuario 
  ? `${item.descricao} - ${metaDados.observacao_usuario}`
  : item.descricao,
```

### Fluxo de Usuário (Exemplo)

```
Usuário: despesas
Bot: 💸 Como foi paga? 1-Dinheiro 2-PIX...

Usuário: 1
Bot: ✅ Forma: Dinheiro. Envie as fotos...

Usuário: [envia foto do cupom fiscal]
Bot: 📥 Comprovante 1 recebido! Valor: R$ 45,00 - Supermercado XYZ

Usuário: fechar
Bot: 📋 Resumo: 1 comprovante(s), R$ 45,00
     ✏️ Deseja adicionar uma observação?
     Ex: "Lanche do infantil"
     Digite ou *Pular*.

Usuário: Lanche para o encontro de jovens
Bot: ✅ 1 despesa registrada!
     💰 Total: R$ 45,00
     📝 Obs: Lanche para o encontro de jovens
     💚 Baixa automática realizada!
```

### Diagrama de Estados Atualizado

```text
┌─────────────────────────────────────────────────────────┐
│ DESPESAS                                                 │
├─────────────────────────────────────────────────────────┤
│ AGUARDANDO_FORMA_INICIAL                                │
│          ↓ (escolhe forma)                              │
│ AGUARDANDO_COMPROVANTES                                 │
│          ↓ (digita "fechar")                            │
│ AGUARDANDO_OBSERVACAO    ← NOVO                         │
│          ↓ (texto ou "pular")                           │
│ FINALIZADO → Cria transações com observação             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ REEMBOLSO                                                │
├─────────────────────────────────────────────────────────┤
│ AGUARDANDO_COMPROVANTES                                 │
│          ↓ (digita "fechar")                            │
│ AGUARDANDO_OBSERVACAO    ← NOVO                         │
│          ↓ (texto ou "pular")                           │
│ AGUARDANDO_DATA                                         │
│          ↓ (informa data)                               │
│ AGUARDANDO_FORMA_PGTO                                   │
│          ↓ (escolhe PIX/Dinheiro)                       │
│ FINALIZADO → Cria solicitação com observação            │
└─────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chatbot-financeiro/index.ts` | Adicionar estado AGUARDANDO_OBSERVACAO, lógica de transição, salvar observação |

## Melhorias Futuras (Fora do Escopo)

1. **Sugestão de Base Ministerial**: Analisar texto da observação para sugerir base ministerial automaticamente
2. **Confirmação de Categoria**: Perguntar se a categoria sugerida pela IA está correta
3. **Histórico de Observações**: Sugerir observações baseadas em despesas anteriores similares

## Estimativa

| Tarefa | Tempo |
|--------|-------|
| Adicionar tipo e estado | 10 min |
| Implementar lógica AGUARDANDO_OBSERVACAO | 30 min |
| Integrar observação na gravação | 20 min |
| Testes via WhatsApp | 20 min |
| **Total** | ~1h20 |
