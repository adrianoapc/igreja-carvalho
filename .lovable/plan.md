
# Completar Cadastro de Inscrito (com Sexo e Endereco)

## Problema

Na lista de inscritos do evento, nao ha como ver detalhes do perfil nem completar dados de visitantes cadastrados com informacoes incompletas (ex: nome com emoji do WhatsApp, sem telefone, sem endereco). Os campos sexo e endereco sao essenciais e precisam estar disponiveis.

## Solucao

Adicionar no `InscricoesTabContent.tsx`:

1. **"Ver Perfil"** no menu de acoes -- navega para `/pessoas/{pessoa_id}`
2. **"Completar Cadastro"** no menu de acoes -- abre um dialog completo para preencher dados pessoais e de endereco
3. **Indicador visual** de cadastro incompleto ao lado do nome

## Novo componente: `CompletarCadastroInscritoDialog.tsx`

Dialog dedicado com dois blocos de campos:

### Bloco 1 - Dados Pessoais
- Nome (obrigatorio)
- Telefone (com mascara)
- Email
- Sexo (select: Masculino/Feminino)
- Data de Nascimento (dia/mes/ano)

### Bloco 2 - Endereco
- CEP (com busca automatica via `useCepAutocomplete`)
- Cidade (preenchido automaticamente pelo CEP)
- Bairro (preenchido automaticamente pelo CEP)
- UF (preenchido automaticamente pelo CEP)
- Endereco/Logradouro (preenchido automaticamente pelo CEP)
- Numero
- Complemento

O dialog pre-preenche todos os campos com dados existentes da pessoa (buscados do `profiles` ao abrir). Ao salvar, faz `UPDATE` na tabela `profiles`.

## Alteracoes em `InscricoesTabContent.tsx`

1. Importar `useNavigate`, icones `Eye`, `UserPen`, `AlertCircle`, e `DropdownMenuSeparator`
2. Importar o novo `CompletarCadastroInscritoDialog`
3. Adicionar estado `editingPessoaId` (string | null)
4. No dropdown de cada inscrito, adicionar no topo:
   - "Ver Perfil" (icone Eye) -- `navigate(/pessoas/${pessoa_id})`
   - "Completar Cadastro" (icone UserPen) -- abre o dialog
   - Separador visual antes das opcoes de pagamento
5. Indicador: icone `AlertCircle` amarelo ao lado do nome quando email E telefone estao ambos vazios
6. Ao fechar o dialog com sucesso, chamar `loadInscricoes()` para atualizar a lista

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/components/eventos/CompletarCadastroInscritoDialog.tsx` | Criar (novo componente) |
| `src/components/eventos/InscricoesTabContent.tsx` | Editar (adicionar acoes no dropdown + indicador) |

## Padroes reutilizados

- `useCepAutocomplete` para busca de CEP (mesmo hook usado em `EditarContatosDialog` e `CadastrarPessoaDialog`)
- Mascara de telefone com `react-input-mask` (mesmo padrao de `RegistrarVisitanteDialog`)
- Layout de formulario com `Label` + `Input` + `Select` (padrao existente no projeto)
- `ResponsiveDialog` para o dialog (padrao do projeto)
