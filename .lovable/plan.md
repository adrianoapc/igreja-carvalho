
# Melhorias na Gestao de Check-in e Inscricoes

## 1. Badge de Check-in na aba de Inscricoes

Na tabela de inscritos (`InscricoesTabContent.tsx`), adicionar um badge visual ao lado do nome ou na coluna de status indicando se a pessoa ja fez check-in ou nao.

**Alteracao em `InscricoesTabContent.tsx`:**
- Na coluna "Participante" (ao lado do nome), exibir um mini-badge:
  - Verde com icone CheckCircle2 e texto "Check-in" quando `checkins.has(inscricao.pessoa_id)`
  - Cinza/outline com texto "Pendente" quando nao fez check-in
- Isso ja usa o state `checkins` (Set de pessoa_ids) que ja existe no componente

## 2. Cards de Estatisticas como Filtros na aba de Check-in

Na `CheckinTabContent.tsx`, transformar os 3 cards (Total, Presentes, Aguardando) em botoes clicaveis que filtram uma nova lista completa de participantes, substituindo a secao de "Ultimos Check-ins" por uma lista mais robusta.

**Reorganizacao do layout:**

```text
+----------------------------------+
| [Total] [Presentes] [Aguardando] |  <-- Cards clicaveis (filtro)
+----------------------------------+
| Barra de Progresso               |
+----------------------------------+
| Botao Scanner QR Code            |
+----------------------------------+
| Busca Manual (campo de pesquisa) |
+----------------------------------+
| Lista Completa de Participantes  |  <-- Nova lista filtrada
| (substitui "Ultimos Check-ins")  |
+----------------------------------+
```

**Detalhes tecnicos:**

### CheckinTabContent.tsx
- Adicionar state `filtro: "todos" | "presentes" | "pendentes"` (default: "todos")
- Cards ganham `cursor-pointer`, borda de destaque quando selecionados, e `onClick` para trocar o filtro
- Clicar no card ja selecionado volta para "todos"

### Nova query/dados na lista
- Buscar todos os inscritos (ou membros, dependendo de `requer_inscricao`) com join na tabela `checkins`
- Filtrar localmente pelo filtro ativo
- Exibir: avatar, nome, telefone, badge de status (presente/pendente), horario do check-in se presente
- Manter a busca manual integrada como campo de pesquisa na lista (unificar `CheckinManualSearch` com a nova lista)

### CheckinRecentList.tsx
- Sera substituido pelo novo componente de lista completa (`CheckinParticipantsList.tsx`)
- Remover o componente antigo ou mante-lo como fallback

### Novo componente: `CheckinParticipantsList.tsx`
- Props: `eventoId`, `filtro`, `searchTerm`
- Busca inscritos + checkins do evento
- Renderiza lista filtrada com acoes rapidas de check-in/cancelamento inline
- Atualiza via `refetchInterval` ou invalidacao de queries

## Arquivos a criar/editar

1. **`src/components/eventos/InscricoesTabContent.tsx`** - Adicionar badge de check-in na tabela
2. **`src/components/eventos/CheckinTabContent.tsx`** - Cards clicaveis + novo layout
3. **`src/components/eventos/CheckinParticipantsList.tsx`** (novo) - Lista completa filtrada de participantes
4. **`src/components/eventos/CheckinRecentList.tsx`** - Remover uso (substituido pela nova lista)
