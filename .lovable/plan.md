## Permissões granulares do Bot Financeiro

Hoje existe uma única flag `autorizado_bot_financeiro` em `profiles`, que libera os 4 fluxos do bot (Despesas, Reembolso, Nova Conta, Transferência). A proposta é dividir em permissões independentes por tipo de lançamento.

### 1. Banco de dados (migration)

Adicionar 3 colunas em `public.profiles`:
- `autorizado_lancar_despesas BOOLEAN NOT NULL DEFAULT false` — cobre os fluxos **Despesas** e **Nova Conta** (ambos lançam despesa, mudam só na forma de pagamento)
- `autorizado_lancar_depositos BOOLEAN NOT NULL DEFAULT false` — cobre o fluxo **Transferência** (depósito entre contas)
- `autorizado_lancar_reembolsos BOOLEAN NOT NULL DEFAULT false` — cobre o fluxo **Reembolso**

Backfill: para todo perfil onde `autorizado_bot_financeiro = true`, ligar as 3 novas flags (mantém o comportamento atual de quem já estava autorizado).

A flag mestra `autorizado_bot_financeiro` continua existindo como "porta de entrada" do bot: se estiver `false`, o telefone nem entra no fluxo. As 3 novas funcionam como sub-permissões dentro dela.

### 2. Edge function `supabase/functions/chatbot-financeiro/index.ts`

- Incluir as 3 novas colunas no `select` do `profiles` (linha ~492) e no objeto `membroAutorizado`.
- No bloco "CENÁRIO A: SEM SESSÃO ATIVA" (linha ~599), **antes** de criar a sessão, validar a permissão por fluxo:
  - `isTransferencia` → exige `autorizado_lancar_depositos`
  - `isDespesas` → exige `autorizado_lancar_despesas`
  - `isReembolso` → exige `autorizado_lancar_reembolsos`
  - `isContaUnica` (Nova Conta) → exige `autorizado_lancar_despesas`
- Se não tiver a permissão específica, responder com texto amigável listando o que ele **pode** fazer:
  > "❌ Você não tem autorização para lançar *Despesas*.\n\nPermissões liberadas para você:\n• Reembolso"
  
  e **não** abrir sessão. Manter HTTP 200 (padrão do projeto para erros de regra de negócio).
- Atualizar o menu inicial (a mensagem "Olá! Sou o assistente financeiro…") para listar **apenas** as opções que o usuário tem permissão, em vez de mostrar as 4 fixas. Se nenhuma estiver liberada mas `autorizado_bot_financeiro = true`, responder que o acesso ainda não foi configurado.

Sem mudanças em RLS — as flags são lidas via service role dentro da edge function.

### 3. UI — `src/components/pessoas/EditarDadosAdicionaisDialog.tsx`

Substituir o switch único "Autorizado Bot Financeiro" por um bloco com:

- Switch mestre **Autorizado Bot Financeiro** (mantém `autorizado_bot_financeiro`) — descrição: "Libera o uso do bot financeiro no WhatsApp".
- Quando ligado, mostrar 3 sub-switches indentados:
  - **Lançar Despesas** (`autorizado_lancar_despesas`) — "Despesas e Nova Conta"
  - **Lançar Depósitos** (`autorizado_lancar_depositos`) — "Transferências entre contas"
  - **Solicitar Reembolso** (`autorizado_lancar_reembolsos`)
- Quando o mestre é desligado, as 3 sub-flags são forçadas para `false` no submit.
- Quando o mestre é ligado pela primeira vez, as 3 vêm pré-marcadas (usuário pode desmarcar antes de salvar).

Atualizar nos arquivos relacionados:
- `schema` Zod e tipo `dadosAtuais` no dialog.
- `formData` inicial + reset no `useEffect`.
- Mutation `update` enviando as 3 colunas novas.
- Resumo em `src/pages/PessoaDetalhes.tsx` (seção "Informações Adicionais"): trocar o item único por uma linha "Bot Financeiro: Despesas ✓ • Depósitos ✗ • Reembolso ✓" e ampliar as interfaces locais em `PessoaDetalhes.tsx` e `src/pages/pessoas/EditarPessoa.tsx`.

### Escopo fora desta tarefa
- Mover essas flags para o RBAC dinâmico (`app_permissions`). Continuam como colunas diretas em `profiles`, como já é hoje.
- Tela dedicada de "Permissões financeiras em lote".
- Auditoria específica de quem alterou as flags (segue o trigger genérico de profiles, se existir).

### Detalhes técnicos
- A migration usa `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `UPDATE` único para o backfill.
- O `src/integrations/supabase/types.ts` é auto-gerado; após a migration aprovada, o frontend enxerga as colunas sem edição manual.
- Mensagens do bot em PT-BR, mantendo o tom atual (emoji + frase curta).