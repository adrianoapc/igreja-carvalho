# Análise: Sistema de Conciliação de Ofertas Bancárias

**Data:** 17 de janeiro de 2026  
**Status:** Análise para revisão segunda-feira (20/01)

---

## 📋 Índice
1. [Situação Atual](#situação-atual)
2. [Problema](#problema)
3. [Sugestões de Solução](#sugestões-de-solução)
4. [Estrutura de Dados](#estrutura-de-dados)
5. [Pontos de Atenção](#pontos-de-atenção)
6. [Próximos Passos](#próximos-passos)

---

## 🔍 Situação Atual

### O que você tem

- ✅ **Extrato bancário integrado:** Transações individualizadas do Santander
- ✅ **Relatório de ofertas:** Agregado por forma (PIX, cartão, dinheiro)
- ✅ **Transações de saída:** Com correspondentes financeiros diretos

### O que falta

- ❌ **Mapeamento entrada-extrato:** Uma entrada no relatório pode corresponder a 1, 10 ou 100 transações no extrato
- ❌ **Contexto de culto:** Sem informação de data/hora, impossível saber qual transação pertence a qual culto
- ❌ **Automação de classificação:** Cultos têm períodos específicos (quinta, domingo, quarta, etc)
- ❌ **Rastreabilidade:** Conciliação manual é trabalhosa e propensa a erros

---

## 🎯 Problema

### Cenário Típico

```
RELATÓRIO DE OFERTAS (Domingo 15/01)
├─ PIX: R$ 5.000
├─ Cartão: R$ 3.000
└─ Dinheiro: R$ 1.000

EXTRATO (Segunda 16/01 - Santander processa no dia útil)
├─ [16/01 09:30] PIX entrada R$ 500 (recebimento de domingo)
├─ [16/01 09:32] PIX entrada R$ 250
├─ [16/01 09:35] PIX entrada R$ 800
├─ [16/01 09:40] PIX entrada R$ 350
├─ [16/01 09:45] PIX entrada R$ 200
├─ [16/01 09:50] PIX entrada R$ 400
├─ ... (mais 94 transações PIX)
└─ Soma PIX: R$ 5.000 ✓ (mas como saber qual culto?)
```

### Desafio Central

Como vincular transações individualizadas do extrato com:
1. **Entrada unificada** do relatório de ofertas
2. **Culto específico** (qual culto gerou essas ofertas?)
3. **Período de culto** (transações recebidas entre horário X e Y pertencem ao culto Z)

---

## 💡 Sugestões de Solução

### **Opção 1: Sistema de Regras de Classificação** ⭐ RECOMENDADO

Permite definir regras automáticas de classificação por padrões:

#### Estrutura de Regra

```
REGRA: "PIX - Culto Domingo Manhã"
├─ Forma de pagamento: PIX
├─ Dia da semana: Domingo
├─ Horário: 08:00 - 12:00
├─ Culto associado: [Culto Domingo Manhã]
├─ Padrão de descrição (opcional): ["OFERTA", "DÍZIMO"]
└─ Ativo: [Toggle]

REGRA: "Dinheiro - Quarta à Noite"
├─ Forma: Dinheiro (lançamento manual)
├─ Dia: Quarta-feira
├─ Horário: 19:00 - 21:00
├─ Culto: [Culto Quarta à Noite]
├─ Prioridade: Alta (aplica primeira)
└─ Ativo: [Toggle]
```

#### Benefícios

- ✅ **Auto-classifica** transações conforme recebidas
- ✅ **Adaptável** a mudanças de horários
- ✅ **Suporta múltiplos cultos** no mesmo dia
- ✅ **Interface simples** para manutenção
- ✅ **Histórico** de mudanças de regras

---

### **Opção 2: Conciliação com Intervalo de Tempo**

Tela que agrupa transações por período e permite vincular manualmente:

```
┌─────────────────────────────────────────┐
│ CONCILIAÇÃO DE OFERTAS                  │
├─────────────────────────────────────────┤
│                                         │
│ RELATÓRIO (Domingo 15/01)               │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ PIX: R$ 5.000 [52 transações]     │ │
│ │   Classificado: Culto Domingo Manhã │ │
│ │   Status: Conciliado ✓              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ⚠ Cartão: R$ 3.000 [Pendente]      │ │
│ │   [Buscar no extrato...]            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ TRANSAÇÕES DISPONÍVEIS (Segunda 16/01)  │
│ ┌─────────────────────────────────────┐ │
│ │ [09:30] PIX R$ 500     ← Vinculado  │ │
│ │ [09:32] PIX R$ 250     ← Vinculado  │ │
│ │ [09:35] PIX R$ 800     ← Vinculado  │ │
│ │ ...                                  │ │
│ │ [10:45] Cartão R$ 1.500 [Vinc.]     │ │
│ │ [10:46] Cartão R$ 1.500 [Vinc.]     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

#### Benefícios

- ✅ **Visual e intuitiva**
- ✅ **Permite revisar** agrupamentos antes de confirmar
- ✅ **Rastreabilidade completa**
- ✅ **Detecta discrepâncias** automaticamente

---

### **Opção 3: Híbrido (Regras + Revisão Manual)** ⭐ IDEAL A LONGO PRAZO

Combina automação com flexibilidade:

1. **Regras de classificação** definem padrão automático
2. **Dashboard de conciliação** mostra:
   - ✅ Transações já classificadas automaticamente
   - ⚠️ Transações pendentes de classificação
   - ❌ Discrepâncias (ex: PIX em horário diferente do esperado)
3. **Interface de ajuste manual** para casos excepcionais

#### Fluxo

```
Nova Transação PIX Recebida
       ↓
Tenta Aplicar Regra
       ↓
   ┌─────────────┐
   │ Encontrou?  │
   └──┬───────┬──┘
      │ Sim   │ Não
      ↓       ↓
  Classifica  Aguarda
  Automática  Manual
      ↓       ↓
   ✅ OK     ⚠️ Dashboard
```

---

## 📊 Minha Recomendação: Caminho Progressivo

### **Fase 1 (Agora)** - Conciliação Manual com Agrupamento

**O que fazer:**
- Tela que mostra relatório de ofertas + extrato do período
- Usuário agrupa transações manualmente (arrasta e solta / checkboxes)
- Vincula ao culto
- Gera relatório de conferência com assinatura

**Por quê:**
- ✅ Rápido de implementar (2-3 dias)
- ✅ Valida seu fluxo real
- ✅ Gera dados históricos para análise
- ✅ Identifica padrões manualmente
- ✅ Usuário aprende o processo

**Resultados:**
- Relatório de ofertas pode ser conferenciado
- Identifica gargalos reais
- Base de dados para próxima fase

---

### **Fase 2 (Próxima semana após análise)** - Sistema de Regras

**O que fazer:**
- Cria tela de manutenção de regras (criar, editar, deletar)
- Classifica automaticamente novas transações
- Dashboard de exceções (o que não casou)

**Benefícios:**
- ✅ Reduz 80% do trabalho manual
- ✅ Consistência nos critérios
- ✅ Histórico de mudanças
- ✅ Auditoria (qual regra classificou)

---

### **Fase 3 (Futuro - opcional)** - IA/ML

**O que fazer:**
- Aprende padrões históricos automaticamente
- Sugere classificações com confiança %
- Auto-ajusta regras conforme novos dados

---

## 💾 Estrutura de Dados Necessária

### Nova Tabela: `regras_classificacao`

```typescript
interface RegraClassificacao {
  id: string;
  igreja_id: string;
  
  // Identificação
  nome: string;
  descricao?: string;
  
  // Critérios de Classificação
  forma_pagamento: "pix" | "cartao" | "dinheiro" | "transferencia" | "boleto";
  dia_semana?: number; // 0-6 (segunda-domingo)
  hora_inicio?: string; // "08:00"
  hora_fim?: string; // "12:00"
  
  // Associação
  culto_id: string; // Qual culto recebe essa classificação
  
  // Opcional: Filtro por descrição
  padrao_descricao?: string[]; // ["OFERTA", "DÍZIMO"] - palavras-chave
  
  // Metadata
  ativo: boolean;
  prioridade: number; // 1-10 (maior = aplica primeira)
  created_at: timestamp;
  updated_at: timestamp;
  created_by: string;
}
```

### Ampliação: `transacoes_financeiras`

```typescript
interface TransacaoFinanceira {
  // ... campos existentes
  
  // Novo: Classificação de Culto
  culto_id?: string;
  regra_classificacao_id?: string;
  
  // Novo: Rastreamento de Conciliação
  conciliacao_id?: string; // Link para registro de conciliação
  foi_manual: boolean; // true = usuário classificou, false = automático
  classificado_em: timestamp;
}
```

### Nova Tabela: `conciliacoes`

```typescript
interface Conciliacao {
  id: string;
  
  // Período
  periodo_inicio: date;
  periodo_fim: date;
  
  // O que foi conciliado
  entrada_oferta_id: string; // Da tabela de ofertas
  transacao_extrato_ids: string[]; // Array de IDs do extrato vinculadas
  
  // Resultado
  culto_id: string;
  status: "pendente" | "conciliada" | "discrepancia" | "revisada";
  
  // Valores
  valor_relatório: number; // Do relatório de ofertas
  valor_extrato: number; // Soma do extrato
  diferenca: number; // valor_relatório - valor_extrato
  
  // Auditoria
  created_by: string;
  created_at: timestamp;
  updated_by?: string;
  updated_at?: timestamp;
  observacoes?: string;
}
```

### Tabela Temporária: `pix_webhook_temp` (para webhook PIX)

```typescript
interface PixWebhookTemp {
  id: string;
  
  // Dados do PIX
  pix_id: string; // Identificador único do PIX no banco
  valor: number;
  pagador?: string;
  descricao?: string;
  
  // Timestamp real (do PIX, não do processamento)
  data_pix: timestamp; // Quando realmente foi enviado
  data_recebimento: timestamp; // Quando chegou no webhook
  
  // Status de processamento
  status: "recebido" | "processado" | "vinculado" | "erro";
  
  // Para qual instituição bancária
  banco_id?: string; // Ex: 90400888000142 (Santander)
  Igreja_id: string;
  
  // Rastreamento
  webhook_payload?: jsonb; // Payload completo do webhook (para auditoria)
  processado_em?: timestamp;
  erro_mensagem?: string;
  
  // Link com sistema
  transacao_id?: string; // FK para transacoes_financeiras quando vinculado
  oferta_id?: string; // FK para ofertas quando vinculado
  
  created_at: timestamp;
  updated_at: timestamp;
}
```

---

## ⚠️ Pontos de Atenção

### 1. **Timing é Crítico** 🕐

**Problema:**
- PIX de sexta à noite pode cair na segunda no banco
- Cartão de débito pode ter atraso de até 3 dias
- Santander disponibiliza virtualmente no domingo, mas extrato aparece segunda

**Solução:**
- ✅ Permitir janela de **2-3 dias** para agrupamento
- ✅ Usar `data_pix` (timestamp real) vs `data_extrato` (quando processou)
- ✅ PIX webhook resolve isso: recebe em tempo real
- ✅ Dashboard mostra "pendentes de extrato" vs "já conciliados"

**Para Webhook PIX:**
```
Domingo 15/01 20:00 - PIX recebido (webhook)
  ↓
Armazenado em pix_webhook_temp com data_pix = domingo
  ↓
Segunda 16/01 09:00 - Extrato do Santander chega
  ↓
Sistema agrupa: PIX webhook + extrato
  ↓
Relatório mostra "domingo" como data correta
```

---

### 2. **Múltiplos Cultos no Mesmo Dia** 🙏

**Problema:**
- Segunda-feira pode ter culto de oração + culto jovem
- Ambos recebem PIX no mesmo dia
- Como diferençar?

**Solução:**
- ✅ Regra precisa de **horário específico**
- ✅ Prioridade: regras com horário exato > regras genéricas

**Exemplo:**
```
REGRA 1 (Alta Prioridade): PIX + Segunda + 19:00-20:00 → Culto Oração
REGRA 2 (Média Prioridade): PIX + Segunda + 20:30-22:00 → Culto Jovem
REGRA 3 (Baixa Prioridade): PIX + Segunda → Culto Geral (fallback)
```

---

### 3. **Ofertas Unificadas vs. Individualizadas** 📊

**Problema:**
- Você pode lançar "PIX total do dia" em uma entrada
- Ou lançar cada PIX individualmente
- Sistema precisa lidar com ambos

**Solução:**
- ✅ Adicionar campo `tipo_entrada` em ofertas:
  - `"unificada"` = R$ 5.000 (agrupa múltiplas transações)
  - `"detalhada"` = Cada PIX é uma entrada

**Impacto:**
```
Se tipo="unificada" e valor R$ 5.000
  → Busca múltiplas transações que somem R$ 5.000

Se tipo="detalhada" e valor R$ 500
  → Busca uma transação de R$ 500
```

---

### 4. **Discrepâncias Inevitáveis** 🔴

**Problema:**
- Sempre haverá casos que não batem:
  - PIX perdido/devolvido
  - Lançamento manual incorreto
  - Taxa bancária não contabilizada
  - Transação duplicada

**Solução:**
- ✅ Dashboard de exceções para investigar
- ✅ Campo "observações" para documentar discrepâncias
- ✅ Status `"discrepancia"` permite revisão posterior
- ✅ Relatório de não-conciliados

**Dashboard:**
```
DISCREPÂNCIAS DETECTADAS

❌ PIX: Relatório R$ 5.000 | Extrato R$ 4.800 | Diferença: -R$ 200
   [Investigar] [Resolver]

❌ Cartão: Relatório R$ 3.000 | Extrato R$ 3.150 | Diferença: +R$ 150
   (Taxa bancária adicionada?)
   [Investigar] [Aceitar] [Rejeitar]
```

---

### 5. **Horários Variam por Culto** ⏰

**Problema:**
- Culto domingo manhã: 8h-12h
- Culto domingo noite: 18h-20h
- Culto quarta: 19h-21h
- Cada um recebe PIX em janelas diferentes

**Solução:**
- ✅ Manutenção de regras por culto
- ✅ Permitir múltiplas regras por culto (ex: PIX vs Cartão)
- ✅ Tela de "Agenda de Cultos" vinculada a regras

---

### 6. **Auditoria e Rastreabilidade** 📋

**Importante:**
- Quem classificou?
- Quando foi classificado?
- Qual regra aplicou?
- Houve ajuste manual depois?

**Solução:**
- ✅ Campos `created_by`, `updated_by`
- ✅ Tabela `conciliacoes` com histórico
- ✅ Logs de mudanças de regras
- ✅ Relatório "Conciliações Realizadas" com assinatura

---

## 🚀 Próximos Passos

### Antes da Reunião de Segunda-feira

- [ ] Revisar este documento
- [ ] Identificar qual opção faz mais sentido
- [ ] Listar cultos com horários fixos
- [ ] Definir se ofertas são unificadas ou detalhadas

### Segunda-feira: Implementação

1. **Webhook PIX** + tabela `pix_webhook_temp`
2. **Tela de conciliação manual** (Fase 1)
3. Estruturar base para Fase 2 (regras)

---

## 📝 Notas Finais

**O sistema que você está montando é complexo porque é realista.**

A maioria das igrejas enfrenta esse mesmo desafio. As que resolvem bem têm:

1. ✅ Automação parcial (regras)
2. ✅ Interface amigável (conciliação visual)
3. ✅ Histórico e auditoria (rastreabilidade)
4. ✅ Dashboard de exceções (controle)

Sua abordagem (Fase 1 → Fase 2 → Fase 3) é correta e pragmática.

---

**Próxima ação:** Aguardando feedback para iniciar implementação do webhook PIX.
