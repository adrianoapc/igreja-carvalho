# ADR-027 — Definição de Valor Bruto vs Valor Líquido

**Status:** Aceito  
**Data:** 2026-01-30  
**Decisores:** Tesouraria, Tecnologia  
**Contexto:** Sistema Financeiro / Importação / Conciliação Bancária / DRE  

---

## 📌 Contexto

O sistema financeiro precisa distinguir entre:

- O **valor original** de uma nota/fatura (para classificação contábil)
- O **valor efetivamente pago** (para conciliação bancária)

Quando há juros, multas, descontos ou taxas administrativas, esses valores diferem. 
A falta de clareza sobre qual campo usar em cada contexto gera:

- DRE incorreto (usando valor pago em vez do original)
- Conciliação bancária falha (extrato não bate com valor original)
- Importação de saídas incompleta (campos de ajuste não suportados)

---

## ❗ Problema

Como garantir que:

- O DRE represente a natureza real do gasto (valor original)
- A conciliação bancária use o valor que aparece no extrato (valor pago)
- A importação de planilhas suporte ambos os valores e seus ajustes
- O cálculo de `valor_liquido` seja automático quando não informado

---

## ✅ Decisão

### Definição dos Campos

| Campo | Definição | Uso Principal |
|-------|-----------|---------------|
| `valor` | Valor bruto/original da nota/fatura | DRE (regime de competência) |
| `valor_liquido` | Valor efetivamente pago/recebido | Conciliação bancária |
| `juros` | Juros cobrados por atraso | DRE: Despesas Financeiras |
| `multas` | Multas por atraso | DRE: Despesas Financeiras |
| `desconto` | Desconto obtido | DRE: Receitas Financeiras |
| `taxas_administrativas` | Taxas de cartão, boleto, etc. | DRE: Despesas Administrativas |

### Fórmula de Cálculo

**Atualizada em jul/2026 (fix produção, ver `arquitetura-financeiro.md` §9.15
e §9.13-9.14 vizinhos)**: a fórmula original abaixo estava correta só para
`tipo='saida'` — uma taxa administrativa AUMENTA o que se paga numa despesa,
mas DIMINUI o que se recebe numa receita (ex.: oferta em cartão — a
adquirente fica com a taxa, a igreja recebe menos, não mais). Achado a
partir de um lançamento real com Valor Bruto R$200/Valor Líquido R$203,58 —
líquido maior que o bruto, o que não corresponde a dinheiro real.

```text
-- entrada (receita): taxa reduz o líquido
valor_liquido = valor + juros + multas - taxas_administrativas - desconto

-- saída (despesa): taxa aumenta o líquido (fórmula original, inalterada)
valor_liquido = valor + juros + multas + taxas_administrativas - desconto
```

Corrigido nas 4 RPCs `fin_*` que calculam `valor_liquido`
(`fin_criar_lancamento`, `fin_atualizar_lancamento`,
`fin_alterar_status_lancamento`, `fin_lancar_sessao`) e no recálculo
client-side de `TransacaoDialog.tsx` (que tinha o mesmo bug de sinal, mais
um bug de formatação: `taxas_administrativas`/`juros`/`multas`/`desconto`
eram preenchidos com `String(numero)` cru ao editar, em vez do formato
BR-locale usado por `valor`/`valor_liquido` — o parser do recálculo
automático assume formato BR e removia o ponto decimal como se fosse
separador de milhar, multiplicando taxas fracionárias por 10, ex.: `"0.9"`
virava `9`).

### Regras de Importação

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

---

## 📊 Impacto no DRE

O DRE deve ser construído considerando:

1. **Categoria Principal**: Usa `valor` (bruto)
   - Ex: Aluguel R$ 2.000,00

2. **Ajustes Financeiros**: Categorias separadas
   - Juros por atraso: R$ 50,00 → Despesas Financeiras
   - Multa: R$ 40,00 → Despesas Financeiras
   - Desconto obtido: R$ 20,00 → Receitas Financeiras

3. **Total no Caixa**: `valor_liquido` = R$ 2.070,00

---

## 🏦 Impacto na Conciliação Bancária

A conciliação usa `valor_liquido` para matching:

```sql
-- O extrato mostra R$ 2.070,00 (valor pago)
-- O sistema busca por: COALESCE(valor_liquido, valor) = 2070.00
```

Isso garante que a transação seja encontrada mesmo com ajustes.

---

## 📥 Impacto na Importação

### Campos Mapeáveis (Excel → Banco)

| Coluna Excel | Campo Banco |
|--------------|-------------|
| `valor` | `valor` |
| `valor_pago`, `liquido` | `valor_liquido` |
| `juros` | `juros` |
| `multa`, `multas` | `multas` |
| `desconto` | `desconto` |
| `taxa`, `taxas_admin` | `taxas_administrativas` |

### Sincronização Entre Entradas e Saídas

Tanto `ImportarTab.tsx` (entradas) quanto `ImportarExcelDialog.tsx` (saídas) 
devem suportar os mesmos campos de ajuste financeiro.

---

## 👍 Consequências Positivas

- DRE reflete a natureza real do gasto
- Conciliação bancária funciona com valores pagos
- Ajustes financeiros são categorizados separadamente
- Importação flexível suporta múltiplos cenários
- Compatível com estrutura atual (campos já existem no banco)

---

## ⚠️ Trade-offs

- Mais campos para mapear na importação
- Necessidade de calcular `valor_liquido` automaticamente
- DRE precisa evoluir para segregar ajustes (melhoria futura)

---

## 🔁 Compatibilidade

- **ReconciliacaoBancaria**: Já usa `COALESCE(valor_liquido, valor)` ✓
- **Banco de dados**: Campos já existem em `transacoes_financeiras` ✓
- **ImportarTab.tsx**: Já suporta ajustes ✓
- **ImportarExcelDialog.tsx**: Atualizado nesta ADR ✓

---

## 📚 Documentação Relacionada

- [ADR-001: Separação entre Fato Gerador, Fluxo de Caixa e DRE](ADR-001-separacao-fato-gerador-caixa-dre.md)
- [Fluxo Financeiro](../diagramas/fluxo-financeiro.md)
