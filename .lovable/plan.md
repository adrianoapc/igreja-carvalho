
# Correção do DRE - Filtro Multi-tenant

## Problema Identificado

A função `get_dre_anual` está retornando dados de **todas as igrejas** porque:

| Aspecto | Status Atual | Problema |
|---------|--------------|----------|
| `SECURITY DEFINER` | Sim | Ignora políticas RLS |
| Filtro `igreja_id` | Não existe | Soma transações de todas as igrejas |
| Filtro `filial_id` | Não existe | Não respeita contexto de filial |

**Evidência**: Existem 2 igrejas com transações em 2025:
- Igreja A: 356 transações (R$ 210.906,75 entradas / R$ 172.200,38 saídas)
- Igreja B: 147 transações (R$ 174.576,85 entradas / R$ 9.372,67 saídas)

O DRE está somando **tudo junto**, por isso os valores não batem com as movimentações da igreja do usuário.

---

## Solução Proposta

Atualizar a função `get_dre_anual` para filtrar por `igreja_id` usando `get_jwt_igreja_id()`.

### Alterações na Função SQL

```sql
CREATE OR REPLACE FUNCTION public.get_dre_anual(p_ano integer)
RETURNS TABLE(secao_dre text, categoria_nome text, categoria_id uuid, mes integer, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_igreja_id uuid;
BEGIN
  -- Obter igreja_id do contexto JWT do usuário
  v_igreja_id := public.get_jwt_igreja_id();
  
  RETURN QUERY
  SELECT 
    c.secao_dre,
    c.nome as categoria_nome,
    c.id as categoria_id,
    EXTRACT(MONTH FROM t.data_competencia)::INTEGER as mes,
    SUM(
      CASE 
        WHEN t.tipo = 'saida' THEN -t.valor 
        ELSE t.valor 
      END
    ) as total
  FROM public.transacoes_financeiras t
  JOIN public.categorias_financeiras c ON c.id = t.categoria_id
  LEFT JOIN public.solicitacoes_reembolso sr ON sr.id = t.solicitacao_reembolso_id
  WHERE 
    EXTRACT(YEAR FROM t.data_competencia) = p_ano
    AND t.status = 'pago'
    -- NOVO: Filtrar pela igreja do usuário logado
    AND (v_igreja_id IS NULL OR t.igreja_id = v_igreja_id)
    -- Exclui transações de reembolso que NÃO estão pagas
    AND (t.solicitacao_reembolso_id IS NULL OR sr.status = 'pago')
  GROUP BY 
    c.secao_dre,
    c.nome,
    c.id,
    EXTRACT(MONTH FROM t.data_competencia)
  ORDER BY 
    c.secao_dre DESC,
    c.nome;
END;
$function$;
```

### Por que manter `SECURITY DEFINER`?

A função precisa acessar tabelas como `categorias_financeiras` que podem ter políticas RLS diferentes. Ao adicionar o filtro explícito por `igreja_id`, garantimos o isolamento sem depender das políticas RLS (defesa em profundidade).

### Comportamento Esperado

| Cenário | Resultado |
|---------|-----------|
| Usuário logado com `igreja_id` | Vê apenas transações da sua igreja |
| Super admin sem `igreja_id` no JWT | Vê todas as transações (comportamento admin) |
| Usuário sem autenticação | Função falha (auth.uid() = null) |

---

## Impacto

- DRE mostrará valores corretos para cada igreja
- Não afeta outras funcionalidades
- Compatível com super_admin (pode ver tudo se JWT não tiver igreja_id específica)

---

## Detalhes Técnicos

### Migração SQL

Será criada uma migração para atualizar a função `get_dre_anual`.

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Atualizar função `get_dre_anual` com filtro `igreja_id` |

### Validação Pós-Deploy

1. Logar como usuário da Igreja A
2. Acessar DRE e verificar se valores batem com Entradas/Saídas da Igreja A
3. Logar como usuário da Igreja B
4. Verificar se DRE mostra apenas dados da Igreja B
