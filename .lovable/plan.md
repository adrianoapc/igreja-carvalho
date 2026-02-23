

# Desconciliar: Reverter Conciliações de Forma Segura

## Problema Atual

Não existe uma ação unificada para reverter uma conciliação. Quando o usuário precisa desfazer, ele depende de correções manuais via SQL, pois:
- O "Desvincular" no Histórico de Extratos só limpa o extrato, deixando a transação como `conciliado_extrato`
- O menu da transação não oferece opção de desconciliar vínculos com extrato
- Lotes (N:1) e divisões (1:N) não são revertidos automaticamente

## Solução

Criar uma função RPC no banco (`desconciliar_transacao`) e um botão "Desconciliar" no menu de ações da transação que reverte **todos os vínculos** de forma atômica.

---

## Etapa 1 — Função RPC `desconciliar_transacao`

Criar uma migration SQL com uma função que recebe o ID da transação e:

1. Busca todos os extratos vinculados (1:1 via `transacao_vinculada_id`, N:1 via `conciliacoes_lote`, 1:N via `conciliacoes_divisao`)
2. Reseta os extratos: `reconciliado = false`, `transacao_vinculada_id = NULL`
3. Remove vínculos de lotes e divisões associados
4. Reseta a transação: `conciliacao_status = 'nao_conciliado'`
5. Registra um log de auditoria (`reconciliacao_audit_logs`) com acao = `desconciliacao`
6. Retorna um resumo do que foi revertido (quantidade de extratos, lotes e divisões afetados)

Tudo dentro de uma única transação SQL para garantir atomicidade.

## Etapa 2 — Botão "Desconciliar" no Menu da Transação

No componente `TransacaoActionsMenu.tsx`:

- Adicionar opção "Desconciliar" quando `conciliacaoStatus` for `conciliado_extrato` ou `conciliado_bot`
- Exibir um dialog de confirmação antes de executar
- Chamar a RPC `desconciliar_transacao`
- Invalidar queries relevantes após sucesso

## Etapa 3 — Corrigir "Desvincular" no Histórico de Extratos

No `HistoricoExtratos.tsx`, atualizar `handleDesvincular` para também:
- Resetar o `conciliacao_status` da transação vinculada para `nao_conciliado`
- Remover lotes/divisões associados (ou chamar a mesma RPC)

---

## Fluxo do Usuário

1. Usuário abre o menu de ações (tres pontinhos) de uma transação conciliada
2. Clica em "Desconciliar"
3. Vê um dialog de confirmação mostrando o que será revertido
4. Confirma e o sistema reverte atomicamente todos os vínculos
5. Transação e extratos voltam a aparecer como disponíveis para nova conciliação

## Arquivos Afetados

| Arquivo | Alteração |
|---|---|
| Nova migration SQL | Criar função `desconciliar_transacao` |
| `TransacaoActionsMenu.tsx` | Adicionar botão + dialog de confirmação + chamada RPC |
| `HistoricoExtratos.tsx` | Corrigir `handleDesvincular` para limpar ambos os lados |

