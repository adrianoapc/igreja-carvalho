# ADR-026: Integração de Lotes nos Chatbots WhatsApp

- **Status:** Proposto
- **Data:** 27/01/2025
- **Contexto:** Os chatbots de inscrição via WhatsApp não integram com o sistema de lotes, causando inconsistências em relatórios financeiros e de vagas.

## Problema Atual

### Diagnóstico

Os chatbots `chatbot-triagem` e `inscricao-compartilhe` criam inscrições sem:

- Vincular ao lote ativo (`lote_id = NULL`)
- Registrar valor (`valor_pago = NULL`)
- Validar vagas específicas do lote

### Impacto

| Área         | Problema                                                    |
| ------------ | ----------------------------------------------------------- |
| Financeiro   | Relatórios mostram valores zerados para inscrições WhatsApp |
| Vagas        | Lotes podem ser "estourados" pois validação é só global     |
| Consistência | Inscrições manuais vs WhatsApp têm dados diferentes         |

## Solução Proposta

### 1. Função Auxiliar: Buscar Lote Ativo

Criar função reutilizável para ambos os chatbots:

```typescript
interface LoteAtivo {
  id: string;
  nome: string;
  valor: number;
  vagas_disponiveis: number;
}

async function buscarLoteAtivo(
  supabase: SupabaseClient,
  eventoId: string,
  igrejaId: string,
): Promise<LoteAtivo | null> {
  const agora = new Date().toISOString();

  // Buscar lotes ativos ordenados por valor (menor primeiro)
  const { data: lotes } = await supabase
    .from("evento_lotes")
    .select("id, nome, valor, vagas_limite")
    .eq("evento_id", eventoId)
    .eq("igreja_id", igrejaId)
    .lte("data_inicio", agora)
    .gte("data_fim", agora)
    .order("valor", { ascending: true });

  if (!lotes || lotes.length === 0) return null;

  // Para cada lote, verificar vagas disponíveis
  for (const lote of lotes) {
    if (!lote.vagas_limite) {
      // Sem limite = disponível
      return { ...lote, vagas_disponiveis: Infinity };
    }

    const { count } = await supabase
      .from("inscricoes_eventos")
      .select("id", { count: "exact", head: true })
      .eq("lote_id", lote.id)
      .neq("status_pagamento", "cancelado");

    const vagasUsadas = count || 0;
    const vagasDisponiveis = lote.vagas_limite - vagasUsadas;

    if (vagasDisponiveis > 0) {
      return { ...lote, vagas_disponiveis: vagasDisponiveis };
    }
  }

  return null; // Todos os lotes esgotados
}
```

### 2. Modificar `inscricao-compartilhe/index.ts`

**Localização:** Após buscar evento, antes de criar inscrição (~linha 280)

```typescript
// NOVO: Buscar lote ativo
const loteAtivo = await buscarLoteAtivo(supabase, evento.id, igrejaId);

// Determinar valor e lote
let loteId: string | null = null;
let valorPago: number | null = null;

if (loteAtivo) {
  loteId = loteAtivo.id;
  valorPago = loteAtivo.valor;

  // Validar vagas do lote (além da validação global)
  if (loteAtivo.vagas_disponiveis <= 0) {
    // Redirecionar para lista de espera
    return await adicionarListaEsperaCompartilhe(...);
  }
}

// Modificar INSERT da inscrição
const { data: novaInscricao } = await supabase
  .from("inscricoes_eventos")
  .insert({
    evento_id: evento.id,
    pessoa_id: pessoaId,
    status_pagamento: statusPagamento,
    lote_id: loteId,           // NOVO
    valor_pago: valorPago,     // NOVO
    responsavel_inscricao_id: pessoaId,
    igreja_id: igrejaId,
    filial_id: filialId,
  })
  .select("id, qr_token")
  .single();
```

### 3. Modificar `chatbot-triagem/index.ts`

Aplicar mesma lógica na função `handleFluxoInscricao`:

```typescript
// Em handleFluxoInscricao, após buscar evento
const loteAtivo = await buscarLoteAtivo(supabase, evento.id, igrejaId);

// Usar loteAtivo.id e loteAtivo.valor na criação da inscrição
```

### 4. Atualizar Mensagens de Resposta

Incluir informações do lote nas mensagens:

```typescript
// Quando há lote com valor
const mensagemResposta =
  loteAtivo?.valor > 0
    ? `Inscrição registrada no lote "${loteAtivo.nome}" (R$ ${loteAtivo.valor.toFixed(2)}). Sua vaga está reservada por 24h. QR: ${qrLink}`
    : `Inscrição confirmada (gratuita). QR: ${qrLink}`;
```

## Arquivos a Modificar

| Arquivo                                             | Alteração                                              |
| --------------------------------------------------- | ------------------------------------------------------ |
| `supabase/functions/_shared/lotes.ts`               | CRIAR função `buscarLoteAtivo`                         |
| `supabase/functions/inscricao-compartilhe/index.ts` | Integrar busca de lote e salvar `lote_id`/`valor_pago` |
| `supabase/functions/chatbot-triagem/index.ts`       | Integrar busca de lote em `handleFluxoInscricao`       |

## Fluxo Atualizado

```
+----------------------------------------------------------+
| 1. Usuário envia "COMPARTILHE"                           |
+----------------------------------------------------------+
| 2. Buscar evento ativo do tipo "Ação Social"             |
+----------------------------------------------------------+
| 3. NOVO: Buscar lote ativo (menor valor com vagas)       |
|    - Se não há lote -> inscrição sem lote (retrocompat)  |
|    - Se há lote sem vagas -> lista de espera             |
|    - Se há lote com vagas -> usar lote                   |
+----------------------------------------------------------+
| 4. Criar inscrição com lote_id e valor_pago              |
+----------------------------------------------------------+
| 5. Retornar QR Code com info do lote                     |
+----------------------------------------------------------+
```

## Casos de Borda

| Cenário                         | Comportamento                             |
| ------------------------------- | ----------------------------------------- |
| Evento sem lotes cadastrados    | Inscrição sem `lote_id` (retrocompatível) |
| Todos os lotes esgotados        | Lista de espera                           |
| Múltiplos lotes ativos          | Seleciona o de menor valor                |
| Lote expirado durante inscrição | Busca próximo lote ativo                  |

## Migração de Dados

Script para corrigir inscrições existentes sem lote:

```sql
-- Identificar inscrições sem lote em eventos que têm lotes
SELECT ie.id, ie.evento_id, ie.created_at, e.titulo
FROM inscricoes_eventos ie
JOIN eventos e ON e.id = ie.evento_id
WHERE ie.lote_id IS NULL
AND EXISTS (
  SELECT 1 FROM evento_lotes el
  WHERE el.evento_id = ie.evento_id
);

-- Vincular ao lote que estava ativo na data da inscrição
UPDATE inscricoes_eventos ie
SET
  lote_id = (
    SELECT el.id FROM evento_lotes el
    WHERE el.evento_id = ie.evento_id
    AND el.data_inicio <= ie.created_at
    AND el.data_fim >= ie.created_at
    ORDER BY el.valor ASC
    LIMIT 1
  ),
  valor_pago = (
    SELECT el.valor FROM evento_lotes el
    WHERE el.evento_id = ie.evento_id
    AND el.data_inicio <= ie.created_at
    AND el.data_fim >= ie.created_at
    ORDER BY el.valor ASC
    LIMIT 1
  )
WHERE ie.lote_id IS NULL
AND EXISTS (
  SELECT 1 FROM evento_lotes el
  WHERE el.evento_id = ie.evento_id
);
```

## Testes

1. **Inscrição com lote ativo**: Verificar `lote_id` e `valor_pago` salvos
2. **Inscrição sem lotes**: Verificar retrocompatibilidade
3. **Lote esgotado**: Verificar redirecionamento para lista de espera
4. **Múltiplos lotes**: Verificar seleção do menor valor

## Estimativa

| Tarefa                          | Tempo  |
| ------------------------------- | ------ |
| Criar função compartilhada      | 15 min |
| Modificar inscricao-compartilhe | 30 min |
| Modificar chatbot-triagem       | 30 min |
| Testes                          | 30 min |
| **Total**                       | ~2h    |

## Consequências

### Positivas

- Relatórios financeiros precisos
- Controle de vagas por lote
- Consistência entre canais (web vs WhatsApp)

### Negativas

- Complexidade adicional nos chatbots
- Necessidade de migração de dados históricos
