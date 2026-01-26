
# Plano: Filtrar Categorias e Contas por Igreja/Filial no EventoDialog

## Problema Identificado

A função `loadDadosFinanceiros` em `EventoDialog.tsx` busca **todas** as categorias financeiras e contas ativas do banco, sem filtrar por `igreja_id` ou `filial_id`:

```typescript
// Código atual (linhas 298-305)
const loadDadosFinanceiros = async () => {
  const [catRes, contaRes] = await Promise.all([
    supabase.from("categorias_financeiras").select("id, nome").eq("ativo", true).eq("tipo", "entrada"),
    supabase.from("contas").select("id, nome").eq("ativo", true)
  ]);
  // ...
};
```

Isso faz com que ao marcar um evento como pago, o usuário veja categorias e contas de **todas as igrejas/filiais**, não apenas as da sua filial.

---

## Solução Proposta

1. Importar o hook `useAuthContext` para obter `igrejaId` e `filialId`
2. Adicionar filtros nas queries de categorias e contas

---

## Alterações Necessárias

### Arquivo: `src/components/eventos/EventoDialog.tsx`

**1. Adicionar import do AuthContext (início do arquivo):**

```typescript
import { useAuthContext } from "@/contexts/AuthContextProvider";
```

**2. Obter igrejaId e filialId do contexto (dentro do componente, ~linha 177):**

```typescript
const { igrejaId, filialId, isAllFiliais } = useAuthContext();
```

**3. Atualizar função loadDadosFinanceiros (~linha 298):**

```typescript
const loadDadosFinanceiros = async () => {
  // Não buscar se não tiver igreja
  if (!igrejaId) return;
  
  // Query para categorias - filtrar por igreja
  let catQuery = supabase
    .from("categorias_financeiras")
    .select("id, nome")
    .eq("ativo", true)
    .eq("tipo", "entrada")
    .eq("igreja_id", igrejaId);
  
  // Query para contas - filtrar por igreja e opcionalmente por filial
  let contaQuery = supabase
    .from("contas")
    .select("id, nome")
    .eq("ativo", true)
    .eq("igreja_id", igrejaId);
  
  // Se não for "todas as filiais" e tiver filial específica, filtrar por ela
  if (!isAllFiliais && filialId) {
    contaQuery = contaQuery.eq("filial_id", filialId);
  }
  
  const [catRes, contaRes] = await Promise.all([catQuery, contaQuery]);
  
  setCategoriasFinanceiras(catRes.data || []);
  setContasFinanceiras(contaRes.data || []);
};
```

**4. Atualizar dependências do useEffect (~linha 308):**

```typescript
useEffect(() => {
  if (tipoSelecionado === "EVENTO" && open && igrejaId) {
    loadDadosFinanceiros();
  }
}, [tipoSelecionado, open, igrejaId, filialId, isAllFiliais]);
```

---

## Lógica de Filtragem

| Contexto | Categorias | Contas |
|----------|------------|--------|
| Usuário com filial específica | Filtrar por `igreja_id` | Filtrar por `igreja_id` + `filial_id` |
| Usuário com "Todas as filiais" | Filtrar por `igreja_id` | Filtrar apenas por `igreja_id` |

---

## Resumo das Alterações

| Linha | Alteração |
|-------|-----------|
| ~1-43 | Adicionar import `useAuthContext` |
| ~177 | Extrair `igrejaId`, `filialId`, `isAllFiliais` do contexto |
| ~298-305 | Reescrever `loadDadosFinanceiros` com filtros |
| ~308-312 | Atualizar dependências do `useEffect` |

---

## Resultado Esperado

Após a implementação:
- Categorias financeiras serão filtradas pela igreja do usuário
- Contas serão filtradas pela igreja e filial do usuário (quando aplicável)
- Usuários com acesso a "todas as filiais" verão contas de todas as filiais da igreja
