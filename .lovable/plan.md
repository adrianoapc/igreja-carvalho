
# Funcionalidades de Edição e Visualização de Itens de Reembolso

## ✅ Implementado

### Componentes Criados

1. **`ReembolsoDetalhesDialog.tsx`** - Modal principal com:
   - Header com ID, data, valor total e status
   - Lista de todos os itens com miniatura clicável da foto
   - Indicador visual (⚠️) para datas suspeitas (ex: 2022)
   - Exibição de classificações (fornecedor, categoria, centro custo, base ministerial)
   - Botão "Editar" por item (respeitando permissões)

2. **`ItemReembolsoEditDialog.tsx`** - Formulário de edição com:
   - Campos: descrição, valor, data do comprovante
   - Selects: categoria, subcategoria, fornecedor, centro de custo, base ministerial
   - Subcategoria dinâmica baseada na categoria selecionada
   - Validação de campos obrigatórios

3. **Reutilização do `TransacaoDocumentViewer`** para visualização fullscreen de fotos com zoom

### Modificações em Reembolsos.tsx

- Adicionado estado `detalhesOpen` para controlar o modal
- Botão "Ver Detalhes" em cada card (aba "Meus Pedidos" e "Gestão")
- Integração com ReembolsoDetalhesDialog respeitando permissões

### Permissões Implementadas

- **Solicitante**: pode editar itens em status `rascunho` ou `pendente`
- **Admin/Tesoureiro**: pode editar em qualquer status (exceto `pago`)

---

## Arquivos Modificados/Criados

| Arquivo | Status |
|---------|--------|
| `src/components/financas/ReembolsoDetalhesDialog.tsx` | ✅ Criado |
| `src/components/financas/ItemReembolsoEditDialog.tsx` | ✅ Criado |
| `src/pages/financas/Reembolsos.tsx` | ✅ Modificado |
