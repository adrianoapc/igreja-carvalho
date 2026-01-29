
# Plano: Inferir Status a partir da Data de Pagamento na Importação

## Problema Identificado

Na importação financeira, mesmo quando a planilha contém uma data de pagamento/recebimento preenchida, o sistema mantém o status como "pendente" se não houver uma coluna de status explícita.

**Comportamento esperado:**
- Se `data_pagamento` estiver preenchida → status = `"pago"` (para saídas) ou `"recebido"` (para entradas)
- Se `data_pagamento` estiver vazia → status = `"pendente"`

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/financas/ImportarTab.tsx` | Alterar função `buildTransacao` |
| `src/components/financas/ImportarExcelWizard.tsx` | Alterar função `buildTransacao` |

## Lógica Proposta

Na função `buildTransacao` de ambos os arquivos, após parsear a `dataPagamento`:

```typescript
// Determinar status
let status = "pendente";

// 1. Prioridade: coluna de status explícita
if (mapping.status) {
  const s = String(row[mapping.status] || "").toLowerCase();
  if (s.includes("pago") || s.includes("recebido")) {
    status = "pago";
  } else if (s.includes("pendente") || s.includes("aberto")) {
    status = "pendente";
  } else if (s.includes("cancelado") || s.includes("estornado")) {
    status = "cancelado";
  }
}

// 2. Fallback: inferir pelo data_pagamento (se status não foi definido por coluna)
if (status === "pendente" && dataPagamento) {
  // Se tem data de pagamento, está pago/recebido
  status = "pago";
}
```

## Detalhamento Técnico

### ImportarTab.tsx (linhas 528-532)

**Antes:**
```typescript
let status = "pendente";
if (mapping.status) {
  const s = String(row[mapping.status] || "").toLowerCase();
  if (s.includes("pago") || s.includes("recebido")) status = "pago";
}
const dataPagamento = mapping.data_pagamento
  ? parseData(row[mapping.data_pagamento])
  : null;
```

**Depois:**
```typescript
const dataPagamento = mapping.data_pagamento
  ? parseData(row[mapping.data_pagamento])
  : null;

// Determinar status: prioridade para coluna explícita, fallback para data_pagamento
let status = "pendente";
if (mapping.status) {
  const s = String(row[mapping.status] || "").toLowerCase();
  if (s.includes("pago") || s.includes("recebido")) {
    status = "pago";
  } else if (s.includes("cancelado") || s.includes("estornado")) {
    status = "cancelado";
  }
}
// Se não tem coluna de status OU status ficou pendente, mas tem data_pagamento → pago
if (status === "pendente" && dataPagamento) {
  status = "pago";
}
```

### ImportarExcelWizard.tsx (linhas 432-439)

Mesma lógica aplicada.

## Cenários de Teste

| Coluna Status | data_pagamento | Resultado |
|---------------|----------------|-----------|
| "Pago" | 2024-01-15 | `pago` |
| "Pendente" | 2024-01-15 | `pago` (data_pagamento sobrescreve) |
| (vazio) | 2024-01-15 | `pago` (inferido pela data) |
| (vazio) | (vazio) | `pendente` |
| "Cancelado" | 2024-01-15 | `cancelado` (status explícito tem prioridade) |

## Benefícios

1. **Menos colunas obrigatórias**: Usuário não precisa incluir coluna de status se já tem data de pagamento
2. **Inteligência automática**: Sistema deduz o óbvio - se tem data de pagamento, foi pago
3. **Compatibilidade**: Mantém funcionamento atual se houver coluna de status explícita
