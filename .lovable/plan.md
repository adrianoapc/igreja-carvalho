

# Funcionalidades de Edição e Visualização de Itens de Reembolso

## Situação Atual

A tela de Reembolsos **não possui** funcionalidade para:
- Visualizar os itens individuais de uma solicitação
- Ver a foto/comprovante de cada item
- Editar classificações (categoria, subcategoria, fornecedor, centro de custo, base ministerial)
- Corrigir dados extraídos incorretamente pelo OCR

## Problema da Data (2022 vs 2025)

O chatbot extraiu e salvou a data como aparece na nota fiscal. Se a nota tinha "30/01/2022", isso foi salvo. A correção manual é necessária para esses casos, reforçando a importância dessa funcionalidade.

---

## Proposta de Implementação

### 1. Modal de Detalhes da Solicitação (`ReembolsoDetalhesDialog.tsx`)

Ao clicar em uma solicitação, abrir modal com:
- Dados gerais (status, data, forma de pagamento, observações)
- Lista de todos os itens com suas classificações
- **Miniatura clicável da foto** de cada item (usando padrão do `TransacaoDocumentViewer`)

### 2. Visualizador de Foto do Item

Reutilizar o componente `TransacaoDocumentViewer` já existente para:
- Exibir a imagem em tela cheia
- Controles de zoom (já implementados)
- Opção de download
- Suporte a PDF (se aplicável)

### 3. Edição de Item Individual (`ItemReembolsoEditDialog.tsx`)

Para cada item, permitir editar:
- Descrição
- Valor
- Data do comprovante
- Categoria
- Subcategoria
- Fornecedor
- Centro de Custo
- Base Ministerial

### 4. Permissões

- **Solicitante**: pode editar enquanto status = `rascunho` ou `pendente`
- **Admin/Tesoureiro**: pode editar em qualquer status (exceto `pago`)

---

## Layout dos Componentes

### Modal de Detalhes (Desktop)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Solicitação #ABC123                                     [X]    │
│  Status: Pendente | Valor Total: R$ 1.399,90                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ┌─────────┐                                              │  │
│  │  │  📷     │  CAIXA AMPLIFICADA PCX6                     │  │
│  │  │ (thumb) │  Valor: R$ 1.399,90                         │  │
│  │  │         │  Data: 30/01/2022 ⚠️                         │  │
│  │  └─────────┘  Fornecedor: HAVAN S.A.                     │  │
│  │               Categoria: Não definida                     │  │
│  │               Centro de Custo: Não definido               │  │
│  │               Base Ministerial: Não definida              │  │
│  │                                            [✏️ Editar]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Fechar]                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Comportamento da Miniatura

- Clique na miniatura → abre `TransacaoDocumentViewer` com a foto em tela cheia
- Se não houver foto → mostra ícone placeholder (FileText)
- Suporta zoom, download e visualização de PDF

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/financas/ReembolsoDetalhesDialog.tsx` | **Criar** | Modal principal com lista de itens e miniaturas |
| `src/components/financas/ItemReembolsoEditDialog.tsx` | **Criar** | Formulário de edição com selects das classificações |
| `src/pages/financas/Reembolsos.tsx` | Modificar | Adicionar botão "Ver Detalhes" e integrar os novos modais |

---

## Detalhes Técnicos

### Query para Buscar Itens com Relacionamentos

```sql
SELECT 
  ir.*,
  cf.nome as categoria_nome,
  sf.nome as subcategoria_nome,
  f.nome as fornecedor_nome,
  cc.nome as centro_custo_nome,
  bm.titulo as base_ministerial_nome
FROM itens_reembolso ir
LEFT JOIN categorias_financeiras cf ON ir.categoria_id = cf.id
LEFT JOIN subcategorias_financeiras sf ON ir.subcategoria_id = sf.id
LEFT JOIN fornecedores f ON ir.fornecedor_id = f.id
LEFT JOIN centros_custo cc ON ir.centro_custo_id = cc.id
LEFT JOIN bases_ministeriais bm ON ir.base_ministerial_id = bm.id
WHERE ir.solicitacao_id = :solicitacao_id
```

### Estrutura da Tabela `itens_reembolso` (existente)

| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | uuid | Identificador único |
| `solicitacao_id` | uuid | FK para solicitação |
| `descricao` | text | Descrição do item |
| `valor` | numeric | Valor do item |
| `data_item` | date | Data do comprovante |
| `foto_url` | text | **URL da foto/anexo** |
| `categoria_id` | uuid | FK categoria |
| `subcategoria_id` | uuid | FK subcategoria |
| `fornecedor_id` | uuid | FK fornecedor |
| `centro_custo_id` | uuid | FK centro de custo |
| `base_ministerial_id` | uuid | FK base ministerial |

### Reutilização do TransacaoDocumentViewer

```tsx
import { TransacaoDocumentViewer } from "./TransacaoDocumentViewer";

// No componente:
const [fotoViewerOpen, setFotoViewerOpen] = useState(false);
const [fotoUrl, setFotoUrl] = useState<string | null>(null);
const [imageZoom, setImageZoom] = useState(1);

// Ao clicar na miniatura:
<img 
  src={item.foto_url} 
  onClick={() => {
    setFotoUrl(item.foto_url);
    setFotoViewerOpen(true);
  }}
  className="cursor-pointer hover:opacity-80"
/>

<TransacaoDocumentViewer
  open={fotoViewerOpen}
  onOpenChange={setFotoViewerOpen}
  url={fotoUrl}
  imageZoom={imageZoom}
  setImageZoom={setImageZoom}
/>
```

---

## Fluxo de Uso

1. Usuário clica em uma solicitação na lista
2. Modal de detalhes abre mostrando header + lista de itens
3. Cada item exibe miniatura da foto (clicável) + dados resumidos
4. Clique na miniatura → abre visualizador fullscreen com zoom
5. Clique em "Editar" → abre formulário com selects para classificações
6. Ao salvar, sistema atualiza `itens_reembolso` e recalcula totais

---

## Resultado Esperado

Após implementação:
- Tesoureiro pode visualizar exatamente o que foi enviado (foto da nota)
- Corrigir classificações incorretas diretamente
- Ajustar datas extraídas com erro pelo OCR
- Melhor visibilidade para aprovação de reembolsos

