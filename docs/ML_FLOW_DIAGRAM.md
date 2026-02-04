# 🎯 ML Suggestions - Fluxo Completo

## Diagrama Visual do Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TELA DE CONCILIAÇÃO INTELIGENTE                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  useEffect: Ao abrir ou alterar mês/conta                           │   │
│  │  ↓                                                                   │   │
│  │  gerarSugestoes({                                                   │   │
│  │    igreja_id, conta_id?, mes_inicio, mes_fim, score_minimo: 0.7   │   │
│  │  })                                                                 │   │
│  └──────────────────┬───────────────────────────────────────────────────┘   │
│                     │                                                         │
└─────────────────────┼─────────────────────────────────────────────────────────┘
                      │
                      │ POST /functions/v1/gerar-sugestoes-ml
                      ↓
        ┌─────────────────────────────────────────┐
        │  EDGE FUNCTION (gerar-sugestoes-ml)     │
        │                                         │
        │  1. Valida Authorization header         │
        │  2. Autentica usuário (getUser)         │
        │  3. Busca filial_id do profile          │
        │  4. Chama RPC:                          │
        │     gerar_candidatos_conciliacao(...)   │
        │     ↓                                    │
        │     Retorna 180+ candidatos (score 0.84)│
        │  5. Limpa sugestões antigas             │
        │     DELETE FROM conciliacao_ml_sugestoes│
        │     WHERE status = 'pendente'           │
        │  6. Insere novos candidatos             │
        │     INSERT INTO conciliacao_ml_sugestoes│
        │  7. Retorna:                            │
        │     {success: true,                     │
        │      sugestoes_criadas: 180}            │
        └──────────────┬──────────────────────────┘
                       │ Response
                       ↓
        ┌──────────────────────────────────┐
        │  Hook: useGerarSuggestoesConciliacao│
        │                                    │
        │  onSuccess: Toast("180 sugestões")  │
        │  onError: Toast("Erro ao gerar")    │
        └────────────────┬───────────────────┘
                         │
                         ↓
        ┌──────────────────────────────────────────┐
        │  useQuery refetch na SugestoesML          │
        │                                          │
        │  SELECT * FROM conciliacao_ml_sugestoes │
        │  WHERE status = 'pendente'              │
        │    AND score >= 0.7                     │
        │  ORDER BY score DESC                    │
        └────────────────┬─────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPONENT: <SugestoesML />                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Sugestões ML                                                        │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  Score: 87% 🟨  Tipo: 1:1  [Valor Match] [+2 dias]               │   │
│  │  ├─ Extrato: R$ 1.500,00 em 03/01                                │   │
│  │  ├─ Transação: R$ 1.500,00 em 05/01                              │   │
│  │  ├─ Features: {valor_diff: 0, dias_diff: 2}                      │   │
│  │  │                                                                 │   │
│  │  │  [✅ Aceitar]  [❌ Rejeitar]                                   │   │
│  │  │                                                                 │   │
│  │  └─────────────────────────────────────────────────────────────── │   │
│  │                                                                     │   │
│  │  Score: 85% 🟨  Tipo: 1:1  [Valor Match] [+3 dias]               │   │
│  │  ├─ Extrato: R$ 2.300,00 em 10/01                                │   │
│  │  ├─ Transação: R$ 2.300,00 em 13/01                              │   │
│  │  │                                                                 │   │
│  │  │  [✅ Aceitar]  [❌ Rejeitar]                                   │   │
│  │  │                                                                 │   │
│  │  └─────────────────────────────────────────────────────────────── │   │
│  │                                                                     │   │
│  │  ... (mais sugestões)                                              │   │
│  │                                                                     │   │
│  │  ┌────────────────────────────────────────────────────────────┐   │   │
│  │  │ [Aplicar Todas com Score ≥ 90%]                           │   │   │
│  │  │                                                            │   │   │
│  │  │ Identifica: 45 sugestões com score >= 0.90               │   │   │
│  │  │                                                            │   │   │
│  │  │ [Cancelar] [Confirmar]                                    │   │   │
│  │  └────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Botão Sparkles (top-right): ↻ Regenerar manualmente                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                 │                          │
         ┌───────┴───────┐        ┌─────────┴──────┐
         │               │        │                │
         ↓ Click Aceitar ↓        ↓ Click Batch   ↓
         
┌──────────────────────────┐  ┌──────────────────────────┐
│  MUTATION: aceitarSugestao│  │  MUTATION: aplicarTodas  │
│                          │  │                          │
│  RPC: aplicar_sugestao_  │  │  Para cada sugestão:     │
│       conciliacao(       │  │  → RPC: aplicar_sugestao_│
│    sugestao_id,         │  │       conciliacao()      │
│    usuario_id)          │  │                          │
│                          │  │  Batch await all        │
│  INSERT feedback:        │  │                          │
│  ├─ acao: 'aceita'      │  │  INSERT batch feedback   │
│  ├─ score: score        │  │  Cada uma com acao='aceita'│
│  ├─ usuario_id: user    │  │                          │
│  └─ created_at: now     │  │  Toast: "45 aplicadas"  │
│                          │  │                          │
│  UPDATE status:          │  │  Invalida queries:      │
│  'pendente' → 'aceita'   │  │  ├─ sugestoes-ml        │
│                          │  │  └─ extratos-pendentes  │
│  Invalida queries        │  │  └─ transacoes-pendentes│
└──────────────────────────┘  └──────────────────────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
                        ↓
         ┌──────────────────────────────┐
         │  RPC: aplicar_conciliacao()  │
         │                              │
         │  Para cada extrato_id/       │
         │  transacao_id pair:          │
         │                              │
         │  INSERT conciliacoes_lote    │
         │  ├─ extrato_id              │
         │  ├─ transacao_id            │
         │  ├─ usuario_id              │
         │  └─ created_at              │
         │                              │
         │  UPDATE transacoes           │
         │  SET transacao_vinculada_id  │
         │  SET conciliacao_automática  │
         │                              │
         │  UPDATE extratos_bancarios   │
         │  SET transacao_vinculada_id  │
         └──────────────┬───────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS (Supabase)                                │
│                                                                              │
│  Tabelas Atualizadas:                                                       │
│  ✅ conciliacao_ml_sugestoes:  status 'pendente' → 'aceita'                │
│  ✅ conciliacao_ml_feedback:   novos registros com acao='aceita'            │
│  ✅ conciliacoes_lote:         novos pares conciliados                      │
│  ✅ transacoes:                transacao_vinculada_id preenchido            │
│  ✅ extratos_bancarios:        transacao_vinculada_id preenchido            │
│                                                                              │
│  Listas atualizadas:                                                        │
│  ✅ Extratos Pendentes:         -X (removidos os conciliados)               │
│  ✅ Transações Pendentes:       -X (removidas as conciliadas)               │
│  ✅ Balance Bar:                Atualizado com novos pares                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Estados das Sugestões

```
PENDENTE (Inicial)
    │
    ├─→ [Usuário Clica ✅ Aceitar] ──→ ACEITA ──→ Vincula extrato/transação
    │
    ├─→ [Usuário Clica ❌ Rejeitar] ──→ REJEITADA ──→ Sem ação
    │
    └─→ [Batch Apply] ──→ ACEITA (em massa) ──→ Vincula todos em paralelo

Cada mudança de estado:
  1. UPDATE status em conciliacao_ml_sugestoes
  2. INSERT feedback em conciliacao_ml_feedback com acao
  3. Se ACEITA: chama RPC aplicar_conciliacao() para cada par
```

---

## 🔄 Ciclo de Vida Completo

```
Dia 1: Janeiro
│
├─ 🌅 Morning:
│  ├─ Usuário abre Conciliação Inteligente
│  ├─ useEffect detecta igrejaId → chama gerarSugestoes()
│  ├─ Edge function → RPC → 180 candidatos gerados
│  ├─ SugestoesML exibe cards com scores 0.84-0.87
│  │
│  └─ Usuário clica ✅ 10 vezes
│     ├─ 10 INSERT em conciliacao_ml_feedback (acao='aceita')
│     ├─ 10 UPDATE em conciliacao_ml_sugestoes (status='aceita')
│     ├─ 10 INSERT em conciliacoes_lote
│     └─ 10 vinculações extrato ↔ transação
│
├─ 💼 Afternoon:
│  ├─ Muda para Dezembro (mês anterior)
│  ├─ useEffect dispara com mes_inicio='2025-12-01', mes_fim='2025-12-31'
│  ├─ Edge function limpa sugestões antigas de Janeiro
│  ├─ Gera novos candidatos para Dezembro (120 sugestões)
│  └─ SugestoesML atualiza para novo período
│
└─ 🌙 Evening:
   ├─ Clica botão "Aplicar Todas com Score ≥ 90%"
   ├─ Identifica 45 sugestões altas
   ├─ Batch apply: paralelo INSERT 45 feedbacks, 45 updates status, 45 conciliações
   ├─ Toast: "45 sugestões aplicadas com sucesso"
   └─ Dashboard atualiza: +55 conciliações hoje, +65% de aceitação

Dia 2: Continua no ciclo...
```

---

## 💾 Dados Fluindo (Exemplo Real)

### Input (Usuário clica Aceitar em 1 sugestão):
```javascript
{
  sugestao_id: "sugg_abc123",
  usuario_id: "user_xyz789",
  score: 0.87,
  tipo_match: "1:1",
  extrato_ids: ["ext_001"],
  transacao_ids: ["trx_001"]
}
```

### Output no Banco:

**1️⃣ conciliacao_ml_sugestoes:**
```
id: sugg_abc123
status: 'pendente' → 'aceita'
score: 0.87
features: {valor_extrato: 1500, valor_transacao: 1500, ...}
updated_at: NOW()
```

**2️⃣ conciliacao_ml_feedback:**
```
id: feedback_001
sugestao_id: sugg_abc123
acao: 'aceita'
score: 0.87
usuario_id: user_xyz789
created_at: NOW()
```

**3️⃣ conciliacoes_lote:**
```
id: conc_001
extrato_id: ext_001
transacao_id: trx_001
usuario_id: user_xyz789
criado_por_ml: true
created_at: NOW()
```

**4️⃣ extratos_bancarios:**
```
id: ext_001
transacao_vinculada_id: trx_001 (novo!)
status: 'conciliado'
```

**5️⃣ transacoes:**
```
id: trx_001
transacao_vinculada_id: ext_001 (novo!)
conciliacao_automática: true
```

---

## 🎯 O Que Deveria Estar Acontecendo Agora

1. ✅ **Tela carrega** → useEffect detecta igrejaId
2. ✅ **Edge function é chamada** → POST para gerar-sugestoes-ml
3. ✅ **RPC é executada** → gerar_candidatos_conciliacao() retorna 180 registros
4. ✅ **Tabela é populada** → INSERT em conciliacao_ml_sugestoes com status='pendente'
5. ✅ **UI é atualizada** → SugestoesML component exibe cards com badges
6. ✅ **Usuário interage** → Clica aceitar/rejeitar
7. ✅ **Feedback é registrado** → Insere em conciliacao_ml_feedback
8. ✅ **Conciliação vincula** → RPC aplicar_conciliacao() cria pares
9. ✅ **Listas atualizam** → Extratos/transações desaparecem de pendentes
10. ✅ **Dashboard reflete** → Novos números aparecem

---

## ⚡ Performance Esperada

| Operação | Tempo | Limitação |
|----------|-------|-----------|
| Gerar 180 sugestões | 1-2s | RPC + insert |
| Exibir cards | <500ms | React render |
| Aceitar 1 sugestão | 500ms-1s | RPC + invalidate |
| Batch apply 45 | 2-3s | Paralelo |
| Query sugestões | <200ms | Index em (igreja_id, status) |

---

## 🚀 Pronto para o Próximo Nível

Quando estiver 100% validado:
- [ ] Adicionar N:1 e 1:N matching (combinações)
- [ ] Integrar com modelo externo (Claude API)
- [ ] Setup training pipeline (GitHub Actions)
- [ ] Dashboard de métricas real-time
- [ ] Active learning feedback loop
