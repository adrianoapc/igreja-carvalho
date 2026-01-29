

# Plano: Conciliação N:1 (Múltiplas Transações de Extrato → Uma Entrada)

## Contexto do Problema

O sistema atual suporta apenas vinculação 1:1, mas na prática as ofertas funcionam assim:

```text
SISTEMA (transações_financeiras)          EXTRATO BANCÁRIO
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│ PIX Ofertas Domingo - R$ 5.000,00   │ ← │ PIX R$ 500,00                       │
│ (entrada única consolidada)          │   │ PIX R$ 250,00                       │
│                                      │   │ PIX R$ 800,00                       │
│                                      │   │ PIX R$ 350,00                       │
│                                      │   │ ... (mais 46 transações)            │
│                                      │   │ SOMA = R$ 5.000,00                  │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
```

**Problema**: O matching automático atual tenta encontrar **uma** transação de R$ 5.000 no extrato, mas ela não existe — são 50 transações menores que somam esse valor.

---

## Solução Proposta: Conciliação em Lote (N:1)

### Fluxo de Usuário

1. Usuário seleciona uma transação do sistema (ex: "PIX Ofertas Domingo - R$ 5.000")
2. Sistema exibe extratos do período que ainda não foram conciliados
3. Usuário seleciona múltiplos extratos (checkboxes)
4. Sistema mostra a soma em tempo real
5. Usuário confirma vinculação quando soma bater (ou com tolerância)

---

## Alterações Necessárias

### 1. Nova Tabela: `conciliacoes_lote`

Armazena o grupo de vinculação N:1:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `transacao_id` | UUID | FK para transacoes_financeiras |
| `igreja_id` | UUID | FK para igrejas |
| `filial_id` | UUID | FK para filiais |
| `valor_transacao` | NUMERIC | Valor original da transação |
| `valor_extratos` | NUMERIC | Soma dos extratos vinculados |
| `diferenca` | NUMERIC | valor_transacao - valor_extratos |
| `status` | TEXT | "pendente", "conciliada", "discrepancia" |
| `observacoes` | TEXT | Notas do usuário |
| `created_by` | UUID | Quem criou |
| `created_at` | TIMESTAMP | Quando criou |

### 2. Nova Tabela: `conciliacoes_lote_extratos`

Vincula extratos ao lote:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `conciliacao_lote_id` | UUID | FK para conciliacoes_lote |
| `extrato_id` | UUID | FK para extratos_bancarios |
| `created_at` | TIMESTAMP | Quando vinculou |

### 3. Novo Componente: `ConciliacaoLoteDialog.tsx`

Interface para seleção múltipla:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Conciliar em Lote                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ TRANSAÇÃO A CONCILIAR:                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ PIX Ofertas - Culto Domingo                                 │ │
│ │ 16/01/2026  •  Categoria: Ofertas                           │ │
│ │ Valor: R$ 5.000,00                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ FILTROS DO EXTRATO:                                             │
│ [Data: 15/01 - 17/01] [Tipo: Crédito ▼] [Buscar: ________]     │
│                                                                 │
│ EXTRATOS DISPONÍVEIS (52 encontrados):                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [✓] 16/01 09:30  PIX RECEBIDO JOAO****       R$    500,00   │ │
│ │ [✓] 16/01 09:32  PIX RECEBIDO MARIA***       R$    250,00   │ │
│ │ [✓] 16/01 09:35  PIX RECEBIDO PEDRO***       R$    800,00   │ │
│ │ [✓] 16/01 09:40  PIX RECEBIDO ANA****        R$    350,00   │ │
│ │ [ ] 16/01 10:15  PIX RECEBIDO CARLOS**       R$    200,00   │ │
│ │ ... (scroll)                                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ RESUMO:                                                     │ │
│ │ Selecionados: 48 extratos                                   │ │
│ │ Soma: R$ 4.850,00                                           │ │
│ │ Diferença: R$ 150,00 (faltando)                             │ │
│ │                                                             │ │
│ │ [Selecionar Todos do Período]  [Limpar Seleção]             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                      [Cancelar]  [Confirmar Conciliação]        │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Atualização do `VincularTransacaoDialog.tsx`

Adicionar modo "Lote" além do modo "Individual":

- Toggle: "Conciliar 1:1" vs "Conciliar em Lote"
- Se lote: Abre novo dialog com seleção múltipla

### 5. Atualização da `ConciliacaoManual.tsx`

Adicionar botão para iniciar conciliação por transação (inverso do fluxo atual):

```text
┌─────────────────────────────────────────────────────────────────┐
│ Conciliação Manual                           [Reconciliar Auto] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ABAS:  [ Por Extrato ]  [ Por Transação ]                       │
│                                                                 │
│ ── Aba "Por Transação" ──                                       │
│                                                                 │
│ TRANSAÇÕES PENDENTES DE CONCILIAÇÃO:                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ PIX Ofertas Domingo    16/01   R$ 5.000   [Conciliar Lote]  │ │
│ │ Cartão Ofertas         16/01   R$ 3.000   [Conciliar Lote]  │ │
│ │ Transferência XYZ      17/01   R$ 1.500   [Conciliar 1:1]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detalhamento Técnico

### Migração SQL

```sql
-- Tabela principal de lotes de conciliação
CREATE TABLE conciliacoes_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id UUID NOT NULL REFERENCES transacoes_financeiras(id),
  igreja_id UUID NOT NULL REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id),
  valor_transacao NUMERIC(15,2) NOT NULL,
  valor_extratos NUMERIC(15,2) NOT NULL DEFAULT 0,
  diferenca NUMERIC(15,2) GENERATED ALWAYS AS (valor_transacao - valor_extratos) STORED,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliada', 'discrepancia')),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de vínculos extrato <-> lote
CREATE TABLE conciliacoes_lote_extratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacao_lote_id UUID NOT NULL REFERENCES conciliacoes_lote(id) ON DELETE CASCADE,
  extrato_id UUID NOT NULL REFERENCES extratos_bancarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(extrato_id) -- Um extrato só pode estar em um lote
);

-- Trigger para atualizar valor_extratos automaticamente
CREATE OR REPLACE FUNCTION update_valor_extratos()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conciliacoes_lote
  SET valor_extratos = (
    SELECT COALESCE(SUM(e.valor), 0)
    FROM conciliacoes_lote_extratos cle
    JOIN extratos_bancarios e ON e.id = cle.extrato_id
    WHERE cle.conciliacao_lote_id = NEW.conciliacao_lote_id
  ),
  updated_at = now()
  WHERE id = NEW.conciliacao_lote_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_valor_extratos
AFTER INSERT OR DELETE ON conciliacoes_lote_extratos
FOR EACH ROW EXECUTE FUNCTION update_valor_extratos();

-- RLS
ALTER TABLE conciliacoes_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacoes_lote_extratos ENABLE ROW LEVEL SECURITY;

-- Policies (padrão admin/tesoureiro)
```

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `ConciliacaoLoteDialog.tsx` | Dialog de seleção múltipla de extratos |
| `useConciliacaoLote.ts` | Hook para gerenciar estado e mutações |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `ConciliacaoManual.tsx` | Adicionar aba "Por Transação" |
| `VincularTransacaoDialog.tsx` | Adicionar opção de abrir lote |
| `types.ts` (Supabase) | Atualizado automaticamente |

---

## Benefícios

1. **Resolve o problema real**: Ofertas consolidadas podem ser vinculadas a múltiplos PIX
2. **Auditoria completa**: Histórico de quem conciliou o quê
3. **Flexibilidade**: Permite diferenças (com justificativa)
4. **Visual intuitivo**: Soma em tempo real durante seleção
5. **Retrocompatível**: Mantém fluxo 1:1 para transações simples

---

## Fases de Implementação

### Fase 1: Estrutura Base
- Criar tabelas `conciliacoes_lote` e `conciliacoes_lote_extratos`
- Criar trigger de soma automática
- Configurar RLS

### Fase 2: Interface de Seleção
- Criar `ConciliacaoLoteDialog.tsx`
- Implementar seleção múltipla com soma em tempo real
- Filtros por data, tipo e busca

### Fase 3: Integração
- Adicionar aba "Por Transação" em `ConciliacaoManual.tsx`
- Marcar extratos como reconciliados após conciliação
- Exibir lotes já conciliados no histórico

