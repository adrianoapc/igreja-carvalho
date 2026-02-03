
# Diagnóstico e Redesign da Experiência de Conciliação Bancária

## Problemas Identificados

### 1. Falta de Feedback após Reconciliação Automática
**Problema:** O botão "Reconciliar Automático" exibe apenas um toast genérico ("204 transações reconciliadas") mas:
- Não mostra QUAIS transações foram reconciliadas
- Não tem uma lista de resultados/histórico recente
- Usuário não consegue verificar se fez o trabalho certo
- O contador retorna do RPC mas não persiste em tela

### 2. Fluxo Fragmentado entre Abas
**Problema:** Interface dividida entre 4 abas sem conexão clara:
- "Saldos" → Reconcilia valores gerais
- "Conciliação Manual" → 2 sub-abas (Extrato e Transação)
- "Histórico de Extratos" → Lista tudo, mas separado
- "Relatório" → Analytics, mas sem detalhes

**Sintoma:** Usuário precisa alternar entre várias abas para entender o que está acontecendo.

### 3. Cenário 1:N Não Implementado
**Problema atual:** Sistema suporta apenas:
- 1:1 (1 extrato → 1 transação)
- N:1 (múltiplos extratos → 1 transação) via "Conciliar em Lote"

**Faltando:** 1:N (1 extrato → múltiplas transações)
Exemplo: 1 pagamento de R$ 3.000 no banco = Aluguel (R$ 2.500) + IPTU (R$ 350) + Taxa (R$ 150)

### 4. Ausência de "Histórico de Ações Recentes"
O sistema faz ações mas não mostra o que acabou de fazer - essencial para confiança do usuário.

### 5. Dados Reais do Banco de Dados
- Total extratos: 721
- Reconciliados: 9
- Vinculados: 1
- Pendentes: ~712

A reconciliação automática identificou 204 matches potenciais mas nenhum foi aplicado - a função `reconciliar_transacoes` encontra matches mas precisa que `aplicar_conciliacao` seja chamado para efetivar.

---

## Proposta de Redesign

### Mudança 1: Dashboard de Conciliação (Nova Tela Inicial)

Em vez de 4 abas separadas, criar um **dashboard unificado** que mostre:

```text
+--------------------------------------------------+
|  RECONCILIAÇÃO BANCÁRIA                          |
+--------------------------------------------------+
| [Resumo em Cards]                                |
| ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  |
| │ 712     │ │ 9       │ │ 1       │ │ 85%     │  |
| │Pendentes│ │Conciliad│ │Em Lote  │ │Cobertura│  |
| └─────────┘ └─────────┘ └─────────┘ └─────────┘  |
|                                                  |
| [🔄 Executar Reconciliação Automática]           |
+--------------------------------------------------+
| AÇÕES RECENTES (últimas 24h)                     |
| ┌──────────────────────────────────────────────┐ |
| │ ✓ PIX MARIA SILVA → Oferta Culto (Auto 100%) │ |
| │ ✓ TED ALUGUEL → Aluguel Jan (Manual)         │ |
| │ ✓ 5 PIXs → Oferta Consolidada (Lote)         │ |
| └──────────────────────────────────────────────┘ |
|                                                  |
| [📋 Ver Pendentes] [📊 Relatório] [📜 Histórico] |
+--------------------------------------------------+
```

### Mudança 2: Resultado Detalhado da Reconciliação Automática

Ao clicar "Reconciliar Automático", exibir um **modal de resultados**:

```text
+------------------------------------------+
| RESULTADO DA RECONCILIAÇÃO AUTOMÁTICA     |
+------------------------------------------+
| ✓ 129 extratos reconciliados              |
| ⚠ 583 pendentes (sem correspondência)     |
+------------------------------------------+
| MATCHES APLICADOS (ordenados por score):  |
| ┌────────────────────────────────────────┐|
| │ Score │ Extrato          │ Transação   │|
| │ 100%  │ PIX R$ 50,00     │ Oferta #123 │|
| │ 100%  │ CPFL R$ 198,01   │ Energia Jan │|
| │ 80%   │ TED R$ 1.500     │ Salário     │|
| └────────────────────────────────────────┘|
| [Ver todos] [Desfazer] [Fechar]           |
+------------------------------------------+
```

### Mudança 3: Suporte a 1:N (1 Extrato → N Transações)

Novo dialog "Dividir Extrato":

```text
+--------------------------------------------+
| DIVIDIR EXTRATO EM MÚLTIPLAS TRANSAÇÕES    |
+--------------------------------------------+
| Extrato: TED ALUGUEL R$ 3.000,00           |
+--------------------------------------------+
| TRANSAÇÕES A VINCULAR:                      |
| ☑ Aluguel Janeiro ............ R$ 2.500,00 |
| ☑ IPTU Janeiro ............... R$   350,00 |
| ☑ Taxa Bancária .............. R$   150,00 |
| ─────────────────────────────────────────── |
| Soma: R$ 3.000,00   Diferença: R$ 0,00  ✓  |
+--------------------------------------------+
| [Cancelar]              [Confirmar Divisão] |
+--------------------------------------------+
```

### Mudança 4: Lista Unificada de Pendentes com Ações Contextuais

Em vez de duas abas (Por Extrato / Por Transação), uma lista única com filtros e ações inteligentes:

```text
+--------------------------------------------------+
| PENDENTES DE CONCILIAÇÃO    [Filtrar ▼] [Buscar] |
+--------------------------------------------------+
| [Agrupar por: Data | Conta | Valor]              |
+--------------------------------------------------+
| 📅 15/12/2025                                    |
| ┌──────────────────────────────────────────────┐ |
| │ ⬇ PIX MARIA R$ 50,00                         │ |
| │   Sugestão: Oferta #456 (Score 100%)         │ |
| │   [Aceitar] [Vincular Outro] [Lote] [Ignorar]│ |
| ├──────────────────────────────────────────────┤ |
| │ ⬆ TED ALUGUEL R$ 3.000,00                    │ |
| │   Nenhuma correspondência exata              │ |
| │   [Vincular] [Dividir em N] [Ignorar]        │ |
| └──────────────────────────────────────────────┘ |
+--------------------------------------------------+
```

---

## Implementação Técnica

### Fase 1: Correção Imediata (Crítico)
1. **Corrigir o fluxo "Reconciliar Automático"** - Atualmente chama `reconciliar_transacoes` mas NÃO aplica os resultados via `aplicar_conciliacao`
2. **Modal de Resultados** - Mostrar o que foi reconciliado após ação automática
3. **Seção "Ações Recentes"** - Exibir logs de auditoria na tela principal

### Fase 2: Unificação da Experiência
1. **Novo componente DashboardConciliacao** - Substitui as 4 abas por dashboard integrado
2. **Lista unificada de pendentes** com sugestões inline
3. **Ações contextuais** (Aceitar sugestão, Vincular outro, Dividir, Lote)

### Fase 3: Suporte 1:N
1. **Nova tabela** `conciliacoes_divisao` para relacionamento 1 extrato → N transações
2. **Dialog "Dividir Extrato"** - Selecionar múltiplas transações que somam o valor
3. **Trigger** para calcular soma e validar que valores batem

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `ResultadoReconciliacaoDialog.tsx` | Criar | Modal com resultados da reconciliação automática |
| `DashboardConciliacao.tsx` | Criar | Novo componente dashboard unificado |
| `DividirExtratoDialog.tsx` | Criar | Dialog para 1:N (1 extrato → N transações) |
| `ConciliacaoManual.tsx` | Modificar | Adicionar chamada a `aplicar_conciliacao` no loop |
| `Reconciliacao.tsx` | Modificar | Substituir tabs por dashboard |
| Migration SQL | Criar | Tabela `conciliacoes_divisao` e RLS |

### Mudanças no Banco de Dados

```sql
-- Nova tabela para suporte 1:N
CREATE TABLE conciliacoes_divisao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extrato_id UUID NOT NULL REFERENCES extratos_bancarios(id),
  igreja_id UUID NOT NULL,
  filial_id UUID,
  valor_extrato NUMERIC NOT NULL,
  status TEXT DEFAULT 'conciliada',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conciliacoes_divisao_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conciliacao_divisao_id UUID NOT NULL REFERENCES conciliacoes_divisao(id),
  transacao_id UUID NOT NULL REFERENCES transacoes_financeiras(id),
  valor NUMERIC NOT NULL
);

-- Trigger para marcar extrato como reconciliado quando divisão é criada
```

---

## Resumo das Melhorias

| Antes | Depois |
|-------|--------|
| 4 abas desconectadas | Dashboard unificado |
| "204 reconciliadas" sem detalhes | Modal com lista completa de matches |
| Sem histórico de ações | Seção "Ações Recentes" com auditoria |
| Apenas 1:1 e N:1 | Suporte completo: 1:1, N:1, 1:N |
| Fluxo automático não efetiva | Loop chama `aplicar_conciliacao` |
| Usuário perdido | Sugestões inline e ações contextuais |

---

## Ordem de Prioridade Sugerida

1. **Urgente:** Corrigir o botão "Reconciliar Automático" para aplicar os matches
2. **Alta:** Criar modal de resultados mostrando o que foi feito
3. **Alta:** Adicionar seção "Ações Recentes" com logs de auditoria
4. **Média:** Criar suporte 1:N (Dividir Extrato)
5. **Média:** Redesenhar para dashboard unificado

Posso começar pela correção do fluxo automático e o modal de resultados?
