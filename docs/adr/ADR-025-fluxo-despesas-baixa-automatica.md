# ADR-025: Fluxo Unificado de Despesas no Chatbot Financeiro com Baixa Automática

## Status
**Aceito** | Data: 27/01/2025

---

## Contexto e Problema

### Situação Atual
O `chatbot-financeiro` possuía dois fluxos distintos:
- **REEMBOLSO**: Para membros que pagaram do próprio bolso e querem ressarcimento
- **CONTA_UNICA**: Para registrar despesas gerais (notas fiscais)

### Problemas Identificados
| Problema | Impacto |
|----------|---------|
| Despesas pagas em dinheiro ficam como "pendente" | Tesoureiro precisa aprovar manualmente algo já pago |
| Não há pergunta sobre forma de pagamento no CONTA_UNICA | Sistema não sabe se dinheiro já saiu do caixa |
| Fluxo confuso entre "Reembolso" vs "Conta" | Usuário não sabe qual usar |

### Cenário Real
> Membro compra material com dinheiro do caixinha da igreja. Envia foto pelo WhatsApp.
> **Antes**: Cria transação com status "pendente" - tesoureiro precisa aprovar.
> **Agora**: Baixa automática pois dinheiro já saiu.

---

## Decisão

### Novo Fluxo: DESPESAS
Criar um terceiro fluxo unificado que:
1. Inicia com gatilho "despesas" ou "gastos"
2. Pergunta forma de pagamento ANTES de receber comprovantes
3. Processa fotos em loop ("Tem mais?")
4. Aplica baixa automática para pagamentos em dinheiro/espécie ou PIX já transferido

### Lógica de Baixa Automática
| Forma de Pagamento | Status | data_pagamento |
|-------------------|--------|----------------|
| Dinheiro / Espécie | `pago` | now() |
| PIX (já transferido) | `pago` | now() |
| Cartão / Boleto | `pendente` | null |
| A definir | `pendente` | null |

---

## Implementação

### Novos Estados na Máquina de Estados
```typescript
type EstadoSessao =
  | "AGUARDANDO_FORMA_INICIAL"  // Pergunta forma antes dos comprovantes
  | "AGUARDANDO_COMPROVANTES"
  | "AGUARDANDO_DATA"
  | "AGUARDANDO_FORMA_PGTO"
  | "FINALIZADO";
```

### Novos Campos no MetaDados
```typescript
interface MetaDados {
  fluxo: "REEMBOLSO" | "CONTA_UNICA" | "DESPESAS";
  forma_pagamento?: "pix" | "dinheiro" | "cartao" | "boleto" | "a_definir";
  baixa_automatica?: boolean;  // Indica se transação já nasce como "pago"
  // ... outros campos
}
```

### Diagrama de Estados - Fluxo DESPESAS

```
+-------------------+
| Usuário: DESPESAS |
+-------------------+
         |
         v
+---------------------------+
| AGUARDANDO_FORMA_INICIAL  |
| "Como foi pago?"          |
| 1. Dinheiro               |
| 2. PIX (já transferido)   |
| 3. Cartão/Boleto          |
| 4. A definir (tesoureiro) |
+---------------------------+
         |
         v
+---------------------------+
| AGUARDANDO_COMPROVANTES   |
| "Envie a foto..."         |
+---------------------------+
         |
         | (recebe foto)
         v
+---------------------------+
| Resumo + "Fechar"         |
+---------------------------+
         |
         v
+---------------------------+
| FINALIZAR                 |
| Criar transação(ões)      |
| status = pago/pendente    |
+---------------------------+
```

---

## Impactos

### DRE (Demonstrativo de Resultado)
**Não muda.** O fato gerador continua sendo a nota fiscal/comprovante. A categoria e o valor são registrados independentemente da forma de pagamento.

### Fluxo de Caixa
**Melhora significativa.** Transações pagas em dinheiro já aparecem como "pago" no caixa, refletindo a realidade imediatamente sem necessidade de aprovação manual.

### Conciliação Bancária
- Transações em dinheiro: Não aparecem para conciliação (já estão pagas)
- Transações PIX/Cartão/Boleto: Seguem fluxo normal de conciliação

---

## Consequências

### Positivas
- Despesas em dinheiro não precisam de aprovação manual
- Fluxo mais intuitivo ("Despesas" cobre maioria dos casos)
- Caixa reflete realidade imediatamente
- Tesoureiro foca em aprovar apenas o que precisa

### Negativas
- Mais um fluxo para manter
- Risco de baixa indevida se usuário escolher forma errada

### Mitigação de Riscos
- Mensagem clara sobre o que cada opção significa
- Log completo na observação da transação (forma escolhida, origem WhatsApp)
- Tesoureiro pode estornar se necessário

---

## Referências
- [ADR-001: Separação Fato Gerador vs Caixa vs DRE](./ADR-001-separacao-fato-gerador-caixa-dre.md)
- [Diagrama de Fluxo Financeiro](../diagramas/fluxo-financeiro.md)
