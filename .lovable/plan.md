
# Plano: ADR-027 - Definição de Valor vs Valor Líquido e Sincronização de Importação

## Resumo Executivo

Este plano documenta formalmente a diferença entre **valor bruto** e **valor líquido** nas transações financeiras, e sincroniza a importação de saídas com a de entradas, adicionando suporte aos campos de ajuste financeiro.

---

## Parte 1: Documentação Arquitetural (ADR-027)

### Arquivo a criar
`docs/adr/ADR-027-valor-bruto-vs-valor-liquido.md`

### Conteúdo

Define formalmente:
- **`valor` (Bruto)**: Valor original da nota/fatura → Usado para DRE (competência)
- **`valor_liquido` (Caixa)**: Valor efetivamente pago → Usado para conciliação bancária
- **Fórmula**: `valor_liquido = valor + juros + multas + taxas_administrativas - desconto`

Impacto:
- DRE usa `valor` para categoria principal
- Ajustes vão para categorias financeiras separadas
- Conciliação bancária usa `valor_liquido`

### Atualização do README
Adicionar entrada para ADR-027 no `docs/adr/README.MD`

---

## Parte 2: Implementação no ImportarExcelDialog.tsx (Saídas)

### 2.1 Expandir ColumnMapping (linha ~35-49)

Adicionar campos que já existem no ImportarTab.tsx:

```typescript
type ColumnMapping = {
  // ... campos existentes ...
  valor_liquido?: string;  // Novo: mapeia "valor_pago"
  multas?: string;
  juros?: string;
  desconto?: string;
  taxas_administrativas?: string;
};
```

### 2.2 Atualizar autoDetectMapping (linha ~91-120)

Adicionar detecção automática:

```typescript
// Detectar valor_liquido/valor_pago
if (colLower.includes("valor_pago") || colLower.includes("liquido") || colLower.includes("pago")) 
  autoMapping.valor_liquido = col;

// Detectar ajustes
if (colLower.includes("multa")) autoMapping.multas = col;
if (colLower.includes("juros")) autoMapping.juros = col;
if (colLower.includes("desconto")) autoMapping.desconto = col;
if (colLower.includes("taxa")) autoMapping.taxas_administrativas = col;
```

### 2.3 Atualizar processarImportacao (linhas ~319-455)

Parsear novos campos e calcular `valor_liquido`:

```typescript
// Parsear ajustes
const multas = mapping.multas ? parseValor(row[mapping.multas]) : 0;
const juros = mapping.juros ? parseValor(row[mapping.juros]) : 0;
const desconto = mapping.desconto ? parseValor(row[mapping.desconto]) : 0;
const taxasAdm = mapping.taxas_administrativas 
  ? parseValor(row[mapping.taxas_administrativas]) : 0;

// Calcular valor_liquido
const valorLiquido = mapping.valor_liquido 
  ? parseValor(row[mapping.valor_liquido])
  : valor + juros + multas + taxasAdm - desconto;

// Incluir na transação
transacoes.push({
  // ... campos existentes ...
  valor_liquido: valorLiquido || valor,
  multas: multas || null,
  juros: juros || null,
  desconto: desconto || null,
  taxas_administrativas: taxasAdm || null,
});
```

### 2.4 Adicionar campos na UI de mapeamento

Novos selects na interface (após linha ~600):
- Valor Pago (Líquido)
- Juros
- Multas  
- Desconto
- Taxas Administrativas

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `docs/adr/ADR-027-valor-bruto-vs-valor-liquido.md` | Criar |
| `docs/adr/README.MD` | Atualizar (adicionar entrada) |
| `src/components/financas/ImportarExcelDialog.tsx` | Modificar |

---

## Detalhes Técnicos

### Regra de Cálculo

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Se valor_pago informado:                                           │
│    valor_liquido = valor_pago                                       │
│                                                                     │
│  Senão, se ajustes informados:                                      │
│    valor_liquido = valor + juros + multas + taxas - desconto        │
│                                                                     │
│  Senão:                                                             │
│    valor_liquido = valor (cópia)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Compatibilidade

- Nenhuma migração de banco necessária (campos já existem)
- ReconciliacaoBancaria já usa `valor_liquido || valor` (compatível)
- DRE pode evoluir para usar `valor` para categoria + ajustes separados

---

## Validação

Após implementação, testar:
1. Importar planilha só com `valor` → `valor_liquido` deve copiar `valor`
2. Importar com `valor` e `valor_pago` → `valor_liquido` deve usar `valor_pago`
3. Importar com `valor` e ajustes → `valor_liquido` deve ser calculado
4. Conciliação bancária deve encontrar match pelo `valor_liquido`
