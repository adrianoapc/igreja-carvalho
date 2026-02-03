
# Plano: Adicionar Filtro de Datas na Conciliação Manual

## Contexto
A tela de Conciliação Manual (`ConciliacaoManual.tsx`) atualmente busca extratos e transações dos últimos **90 dias fixos**. Você sugeriu adicionar um filtro de datas para delimitar melhor o período de busca, tornando a navegação mais eficiente.

## O Que Será Feito

### 1. Adicionar Componente de Filtro de Período
Reutilizar o componente `MonthPicker` já existente no projeto ou criar um seletor de datas simples para permitir escolher:
- Data inicial
- Data final
- Ou selecionar por mês (como na tela de Entradas/Saídas)

### 2. Layout do Filtro
O filtro será posicionado junto aos demais filtros existentes (busca, conta, tipo, origem):

```text
+--------------------------------------------------+
| [🔍 Buscar...] [📅 Período] [Conta ▼] [Tipo ▼]   |
+--------------------------------------------------+
```

### 3. Impacto nas Queries
- Query de extratos pendentes: filtrar por `data_transacao` dentro do período
- Query de transações: filtrar por `data_pagamento` dentro do período

### 4. Sincronização com Dashboard
Opcionalmente, aplicar o mesmo filtro de período no `DashboardConciliacao` para consistência.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `ConciliacaoManual.tsx` | Adicionar estados `dataInicio` e `dataFim`, inputs de data ou MonthPicker, e aplicar filtros nas queries |
| `DashboardConciliacao.tsx` | (Opcional) Adicionar mesmo filtro de período |

## Detalhes Técnicos

### Estados a Adicionar
```typescript
const [dataInicio, setDataInicio] = useState(() => 
  format(subDays(new Date(), 30), "yyyy-MM-dd")
);
const [dataFim, setDataFim] = useState(() => 
  format(new Date(), "yyyy-MM-dd")
);
```

### Modificação da Query de Extratos
```typescript
// Antes
.order("data_transacao", { ascending: false })
.limit(100);

// Depois
.gte("data_transacao", dataInicio)
.lte("data_transacao", dataFim)
.order("data_transacao", { ascending: false })
.limit(100);
```

### Componente de UI
Usar dois inputs de data lado a lado ou integrar com o `MonthPicker` já utilizado em outras telas.

---

## Resultado Esperado
O usuário poderá:
1. Selecionar um período específico (ex: "01/01/2026 a 31/01/2026")
2. A lista de extratos e transações será filtrada automaticamente
3. Fica mais fácil reconciliar períodos específicos sem ver dados de 90 dias misturados
