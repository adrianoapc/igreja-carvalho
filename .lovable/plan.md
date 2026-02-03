
# Plano: Corrigir Conciliação Manual - Filtrar Transações Já Conciliadas + Adicionar Botão "Dividir"

## Problemas Identificados

### 1. Aba "Por Transação" mostra transações já conciliadas
A aba "Por Transação" lista **todas** as transações pagas do período, incluindo aquelas que já foram vinculadas a extratos. Isso polui a lista e confunde o usuário.

Uma transação pode estar conciliada de 3 formas:
- **1:1** - `extratos_bancarios.transacao_vinculada_id` aponta para ela
- **N:1 (Lote)** - Vinculada em `conciliacoes_lote`
- **1:N (Divisão)** - Vinculada em `conciliacoes_divisao_transacoes`

### 2. Funcionalidade "Dividir Extrato" (1:N) não está acessível
O botão "Dividir" que permite vincular 1 extrato a N transações existe no Dashboard, mas **não está presente na tela de Conciliação Manual**. Você precisa ir para `/financas/conciliacao` (dashboard) para usar essa funcionalidade.

---

## Soluções

### Solução 1: Filtrar Transações Já Conciliadas na Aba "Por Transação"

**Arquivo:** `src/components/financas/ConciliacaoManual.tsx`

Buscar os IDs de transações já conciliadas (nas 3 formas) e excluí-las da lista:

```typescript
// Nova query para buscar transações já vinculadas
const { data: transacoesJaVinculadas } = useQuery({
  queryKey: ["transacoes-vinculadas", igrejaId],
  queryFn: async () => {
    // 1:1 - extratos com transacao_vinculada_id
    const { data: vinculadas1to1 } = await supabase
      .from("extratos_bancarios")
      .select("transacao_vinculada_id")
      .not("transacao_vinculada_id", "is", null);
    
    // N:1 - lotes
    const { data: lotes } = await supabase
      .from("conciliacoes_lote")
      .select("transacao_id");
    
    // 1:N - divisões
    const { data: divisoes } = await supabase
      .from("conciliacoes_divisao_transacoes")
      .select("transacao_id");
    
    const ids = new Set<string>();
    vinculadas1to1?.forEach(e => e.transacao_vinculada_id && ids.add(e.transacao_vinculada_id));
    lotes?.forEach(l => l.transacao_id && ids.add(l.transacao_id));
    divisoes?.forEach(d => d.transacao_id && ids.add(d.transacao_id));
    
    return ids;
  },
  enabled: !!igrejaId,
});

// Filtrar no useMemo transacoesPendentes
const transacoesPendentes = useMemo(() => {
  if (!transacoes) return [];
  
  return transacoes.filter((t) => {
    // Excluir já vinculadas
    if (transacoesJaVinculadas?.has(t.id)) return false;
    
    // Filtro de busca existente
    if (transacaoSearchTerm) { ... }
    return true;
  });
}, [transacoes, transacaoSearchTerm, transacoesJaVinculadas]);
```

### Solução 2: Adicionar Botão "Dividir" na Aba "Por Extrato"

**Arquivo:** `src/components/financas/ConciliacaoManual.tsx`

Adicionar o botão "Dividir" junto aos botões "Vincular" e "Ignorar" na aba "Por Extrato":

```tsx
// Importar componente e ícone
import { DividirExtratoDialog } from "./DividirExtratoDialog";
import { Split } from "lucide-react";

// Adicionar estado
const [dividirDialogOpen, setDividirDialogOpen] = useState(false);

// Adicionar handler
const handleDividir = (extrato: ExtratoItem) => {
  setSelectedExtrato(extrato);
  setDividirDialogOpen(true);
};

// Adicionar botão na UI (após "Vincular")
<Button
  size="sm"
  variant="outline"
  onClick={() => handleDividir(extrato)}
>
  <Split className="w-3 h-3 mr-1" />
  Dividir
</Button>

// Adicionar dialog no final
<DividirExtratoDialog
  open={dividirDialogOpen}
  onOpenChange={setDividirDialogOpen}
  extrato={selectedExtrato}
  onSuccess={handleVinculado}
/>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `ConciliacaoManual.tsx` | Adicionar query de transações vinculadas, filtro no useMemo, botão Dividir e dialog |

---

## Resultado Esperado

1. **Aba "Por Transação"**: Mostra apenas transações que ainda não foram conciliadas
2. **Aba "Por Extrato"**: Novo botão "Dividir" para dividir 1 extrato em N transações
3. **Cache invalidation**: Após qualquer conciliação, as listas são atualizadas automaticamente
