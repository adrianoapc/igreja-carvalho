

# Cadastro Rápido de Visitante no Dialog de Inscrição

## Problema

O dialog "Adicionar Inscrito" (`AdicionarInscricaoDialog.tsx`) só permite selecionar pessoas já cadastradas no sistema. Quando o visitante é novo, não há como cadastrá-lo diretamente -- o usuário precisa sair do fluxo, ir ao módulo Pessoas, cadastrar, e depois voltar.

## Solução

Adicionar um botão "Cadastrar Visitante" dentro do `AdicionarInscricaoDialog` que abre o `RegistrarVisitanteDialog` já existente. Quando o visitante for cadastrado com sucesso, a lista de pessoas é recarregada e o novo visitante é automaticamente selecionado.

## Alterações

### Arquivo: `src/components/eventos/AdicionarInscricaoDialog.tsx`

1. Importar o `RegistrarVisitanteDialog` existente
2. Adicionar estado `registrarVisitanteOpen` para controlar o dialog
3. Adicionar um botão "Cadastrar Visitante" na área de busca, visível quando a pesquisa não encontra resultados ou sempre acessível como ação secundária
4. No `onSuccess` do `RegistrarVisitanteDialog`, recarregar a lista de pessoas (`loadPessoas()`) para que o novo cadastro apareça na lista

### Detalhes da UI

- O botão aparecerá logo abaixo da lista de pessoas, com ícone `UserPlus` e texto "Cadastrar novo visitante"
- Também será exibido de forma mais proeminente quando a busca retorna zero resultados, substituindo o texto "Nenhuma pessoa encontrada" por uma mensagem com call-to-action
- O `RegistrarVisitanteDialog` já existente será reutilizado sem modificações

