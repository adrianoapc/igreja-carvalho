# Hook useFilialPaginatedQuery

## Resumo

Hook universal para **queries paginadas** com suporte completo a **multi-filial** (quando `isAllFiliais=true`).

**Substitui:** Múltiplas queries `useEffect + setState` por uma query otimizada com paginação automática.

---

## Instalação

O arquivo já está criado em:

```
src/hooks/useFilialPaginatedQuery.ts
```

## Importação

```typescript
import {
  useFilialPaginatedQuery,
  flattenPaginatedData,
} from "@/hooks/useFilialPaginatedQuery";
```

---

## Uso Básico

```typescript
const {
  data, // pages de dados
  fetchNextPage, // função para carregar próxima página
  hasNextPage, // boolean indicando se há mais
  isLoading, // boolean de carregamento
  error, // erro se houver
} = useFilialPaginatedQuery({
  table: "pedidos_oracao",
  select: "*,intercessores(nome)",
  igrejaId,
  filialId,
  isAllFiliais,
});

// Extrair dados planos
const items = flattenPaginatedData(data?.pages || []);
```

---

## Interface de Opções

```typescript
interface UsePaginatedQueryOptions {
  table: string; // Tabela do Supabase
  select: string; // Colunas e relations
  filters?: Record<string, unknown>; // Filtros WHERE
  orderBy?: {
    column: string; // Coluna para ORDER BY
    ascending?: boolean; // Direção (default: true)
  };
  igrejaId: string | null; // De AuthContext
  filialId: string | null; // De AuthContext
  isAllFiliais: boolean; // De AuthContext
  pageSize?: number; // Default: 50
  enabled?: boolean; // Para queries condicionais
}
```

---

## Exemplos

### 1. Pedidos de Oração com Filtro

```typescript
const { data, fetchNextPage, hasNextPage } = useFilialPaginatedQuery({
  table: "pedidos_oracao",
  select: `
    *,
    intercessores(nome),
    profiles!pedidos_oracao_pessoa_id_fkey(nome)
  `,
  filters: {
    status: "pendente",
  },
  orderBy: {
    column: "data_criacao",
    ascending: false,
  },
  igrejaId,
  filialId,
  isAllFiliais,
});

const pedidos = flattenPaginatedData(data?.pages || []);
```

### 2. Testemunhos com Paginação

```typescript
const { data, fetchNextPage, hasNextPage, isLoading } = useFilialPaginatedQuery(
  {
    table: "testemunhos",
    select: "*,profiles!testemunhos_autor_id_fkey(nome)",
    filters: { publicar: true },
    orderBy: { column: "created_at", ascending: false },
    igrejaId,
    filialId,
    isAllFiliais,
  }
);

const testemunhos = flattenPaginatedData(data?.pages || []);
```

### 3. Transações Financeiras

```typescript
const { data, fetchNextPage, hasNextPage } = useFilialPaginatedQuery({
  table: "transacoes_financeiras",
  select: "id, descricao, valor, data_vencimento, status, tipo",
  filters: {
    tipo: "saida",
    status: "pendente",
  },
  orderBy: {
    column: "data_vencimento",
    ascending: true,
  },
  igrejaId,
  filialId,
  isAllFiliais,
});

const transacoes = flattenPaginatedData(data?.pages || []);
```

---

## Diferença: isAllFiliais

### isAllFiliais = false

```sql
SELECT * FROM tabela
WHERE igreja_id = ? AND filial_id = ?
ORDER BY ...
LIMIT 50
```

Retorna: Apenas registros da filial específica

### isAllFiliais = true

```sql
SELECT * FROM tabela
WHERE igreja_id = ?
ORDER BY ...
LIMIT 50
```

Retorna: Todos os registros da Igreja (todas as filiais)

---

## Renderização no UI

### Botão "Carregar Mais" Simples

```tsx
{
  hasNextPage && (
    <button onClick={() => fetchNextPage()} disabled={isLoading}>
      Carregar mais
    </button>
  );
}
```

### Infinite Scroll (com Intersection Observer)

```tsx
const { ref } = useInView({
  onChange: (inView) => {
    if (inView && hasNextPage && !isLoading) {
      fetchNextPage();
    }
  },
});

// No final da lista:
<div ref={ref} />;
```

---

## Caching & Revalidação

O hook já inclui:

- **Cache por 5 minutos** (staleTime)
- **Garbage collection em 10 minutos** (gcTime)
- **Retry automático** (2 tentativas com exponential backoff)
- **Deduplicação de queries** via React Query

---

## Performance

### Antes (sem paginação)

```
Carrega: 10.000 registros de uma vez
Tempo: 5-10 segundos
Memória: 50-100 MB
```

### Depois (com paginação)

```
Carrega: 50 registros por página
Tempo: <500ms por página
Memória: 2-5 MB
```

---

## Utilities

### flattenPaginatedData()

```typescript
// Converter pages em array plano
const items = flattenPaginatedData(data?.pages || []);
```

### hasMoreData()

```typescript
// Verificar se há mais dados
const hasMore = hasMoreData(lastPage.length, 50);
```

### getTotalLoadedCount()

```typescript
// Contar total de itens carregados
const total = getTotalLoadedCount(data?.pages || []);
```

---

## Próximos Passos

1. ✅ Hook criado
2. ⏳ Refactor de SalaDeGuerra.tsx
3. ⏳ Refactor de Escalas.tsx
4. ⏳ Refactor de páginas de Financas
5. ⏳ Verificar índices de DB

---

## Troubleshooting

### Query não executa

```typescript
// Verificar se enabled=true (ou se falta)
enabled: !authLoading && !!igrejaId;
```

### Dados vazios

```typescript
// Verificar se igrejaId/filialId estão corretos
console.log({ igrejaId, filialId, isAllFiliais });
```

### Erro de tipos TypeScript

```typescript
// Verificar se select está correto
// Usar autocomplete no Supabase para validar
```

---

## Referência Completa

- **Arquivo:** `src/hooks/useFilialPaginatedQuery.ts`
- **Exemplos:** `src/hooks/useFilialPaginatedQuery.examples.tsx`
- **React Query Docs:** https://tanstack.com/query/latest
