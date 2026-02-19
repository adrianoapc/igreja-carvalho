
# Plano de Implementação: Fluxo CANCELAR + Correção de Build

## Resumo das mudanças

Dois arquivos serão alterados nesta implementação.

---

## 1. Corrigir build error em TransacaoVinculadaDialog.tsx

O arquivo possui o componente completo e correto até a linha 132, seguido de um bloco de código duplicado e solto (linhas 133-221) que causa o erro de TypeScript "Unterminated template literal".

**Ação:** Deletar tudo a partir da linha 133 até o final do arquivo.

---

## 2. Adicionar fluxo CANCELAR no chatbot-triagem

### 2a. Separar "cancelar" da função `isNegativo` (linha 110-113)

Atualmente, "cancelar" e "cancela" estão dentro do regex de `isNegativo`, o que faz com que cancelar tenha o mesmo efeito de "não" (pede correção de nome). Precisamos removê-los dali.

**Antes:**
```
/^(nao|não|n|errado|corrigir|cancelar|cancela|mudar|incorreto|no)$/i
```

**Depois:**
```
/^(nao|não|n|errado|corrigir|mudar|incorreto|no)$/i
```

### 2b. Criar nova função `isCancelamento` logo após `isNegativo`

```typescript
const isCancelamento = (text: string): boolean =>
  /^(cancelar|cancela|sair|desistir|nao quero|não quero)$/i.test(text.trim());
```

### 2c. Adicionar checagem de cancelamento no step `confirmando_dados` (antes da linha 794)

Antes do check de `isNegativo`, verificar se o texto é um cancelamento. Se sim:
- Encerrar a sessão (status: "CONCLUIDO", limpar fluxo)
- Retornar mensagem amigável

```typescript
if (isCancelamento(textoNorm)) {
  await supabaseClient
    .from("atendimentos_bot")
    .update({ status: "CONCLUIDO", fluxo_atual: null, meta_dados: null })
    .eq("id", sessao.id);
  return respostaJson(
    "Tudo bem! Inscrição cancelada. Se precisar de algo, é só chamar. 🙏"
  );
}
```

### 2d. Adicionar checagem de cancelamento no step `correcao` (antes da linha 812)

Mesma lógica: se a pessoa digitar "cancelar" enquanto está sendo solicitado o nome correto, encerrar a sessão.

### 2e. Atualizar mensagens de confirmação para informar a opção CANCELAR

Nos 4 locais onde aparece "Responda *SIM* ou *NÃO*", adicionar instrução sobre cancelamento:

| Linha | Local |
|---|---|
| 774 | Após seleção de evento na lista |
| 807 | Resposta ambígua (repetição) |
| 823 | Após correção de nome |
| 889 | Evento único ou inferido |

**Novo texto padrão no final de cada mensagem:**
```
...Está correto? Responda *SIM* ou *NÃO*.
_(Digite *CANCELAR* para sair)_
```

## Fluxo final

```text
Bot: "Encontrei o evento *Compartilhe*! Vamos realizar sua inscrição.
     Confirme seus dados:
     Nome: Joao
     Telefone: 11999...

     Está correto? Responda *SIM* ou *NÃO*.
     _(Digite *CANCELAR* para sair)_"

  SIM      -> Finaliza inscrição (sem mudança)
  NÃO      -> "Qual o nome correto para a inscrição?" (sem mudança)
  CANCELAR -> Encerra sessão: "Tudo bem! Inscrição cancelada. Se precisar, é só chamar. 🙏"
  Outro    -> Repete a pergunta com as opções
```

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/financas/TransacaoVinculadaDialog.tsx` | Remover bloco duplicado (linhas 133-221) |
| `supabase/functions/chatbot-triagem/index.ts` | Separar `isCancelamento` de `isNegativo`, adicionar checagem nos steps `confirmando_dados` e `correcao`, atualizar 4 textos de confirmação |
