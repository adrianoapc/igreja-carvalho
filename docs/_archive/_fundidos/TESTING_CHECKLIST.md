# ✅ Testing Checklist - ML Suggestions

## 🎯 Objetivo
Validar que sugestões ML aparecem, aceitam/rejeitam corretamente, e integram com tabela de conciliações.

---

## 🧪 Teste 1: Auto-trigger ao Abrir Tela

**Ação:** Abrir tela de Conciliação Inteligente
```
Financeiro → Conciliação → Aba "Inteligente"
```

**Esperado:**
- [ ] Tela carrega sem erros
- [ ] Botão Sparkles fica ativo
- [ ] Toast mostra: "X sugestões geradas com score ≥ 0.7"
- [ ] Console mostra resposta positiva da edge function

**Debugging:**
```javascript
// DevTools → Console
// Deve aparecer:
// "Erro ao gerar sugestões" ou "X sugestões geradas"
```

**Network:**
- [ ] POST `/functions/v1/gerar-sugestoes-ml` → Status 200
- [ ] Response payload contém: `{ success: true, sugestoes_criadas: 180, ... }`

---

## 🧪 Teste 2: Visualizar Sugestões

**Ação:** Após toast de sucesso, verificar se cards aparecem

**Esperado:**
- [ ] Section "Sugestões ML" mostra cards
- [ ] Cada card exibe:
  - [ ] Badge com score (cor baseada em %)
  - [ ] "Tipo: 1:1" ou similar
  - [ ] Features JSON expandível
  - [ ] Botões: ✅ Aceitar, ❌ Rejeitar
- [ ] Cards ordenados por score DESC (maior primeiro)
- [ ] Scroll área se houver muitas sugestões

**Visual esperado:**
```
┌─ Sugestões ML ─────────────────────────┐
│                                         │
│ ┌─ Score: 87% 🟨 Tipo: 1:1 ──────────┐ │
│ │ • Extrato ID: abc123...             │ │
│ │ • Transação ID: xyz789...           │ │
│ │ • Valor: R$ 1.500,00 (match)        │ │
│ │ • Data: 2 dias de diferença         │ │
│ │ [✅ Aceitar] [❌ Rejeitar]          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Aplicar Todas com Score ≥ 90%]        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🧪 Teste 3: Aceitar Sugestão Individual

**Ação:** Clicar botão "✅ Aceitar" em uma sugestão

**Esperado:**
- [ ] Card desaparece da lista
- [ ] Toast mostra: "Sugestão aceita"
- [ ] Spinner aparece enquanto processa
- [ ] Após retornar: números de extratos/transações são vinculados

**Verificar no Supabase:**
```sql
-- 1. Status muda para 'aceita'
SELECT status FROM conciliacao_ml_sugestoes 
WHERE id = '<sugestao_aceita_id>';
-- Esperado: 'aceita'

-- 2. Feedback registrado
SELECT * FROM conciliacao_ml_feedback 
WHERE sugestao_id = '<sugestao_aceita_id>';
-- Esperado: 1 registro com acao='aceita'

-- 3. Conciliação vinculada
SELECT COUNT(*) FROM conciliacoes_lote 
WHERE extrato_id = '<extrato_id>';
-- Esperado: 1 registro novo
```

---

## 🧪 Teste 4: Rejeitar Sugestão

**Ação:** Clicar botão "❌ Rejeitar" em uma sugestão diferente

**Esperado:**
- [ ] Card desaparece
- [ ] Toast mostra: "Sugestão rejeitada"
- [ ] Não cria conciliação

**Verificar no Supabase:**
```sql
-- Status muda para 'rejeitada'
SELECT status FROM conciliacao_ml_sugestoes 
WHERE id = '<sugestao_rejeitada_id>';
-- Esperado: 'rejeitada'

-- Feedback com acao='rejeitada'
SELECT * FROM conciliacao_ml_feedback 
WHERE sugestao_id = '<sugestao_rejeitada_id>';
-- Esperado: acao='rejeitada'
```

---

## 🧪 Teste 5: Batch Apply (≥ 90%)

**Ação:** Clicar "Aplicar Todas com Score ≥ 90%"

**Esperado:**
- [ ] Identifica sugestões com score ≥ 0.90
- [ ] Mostra dialog: "X sugestões com alta confiança. Aplicar?"
- [ ] Ao confirmar: processa todas simultaneamente
- [ ] Toast mostra: "X sugestões aplicadas com sucesso"
- [ ] Todas desaparecem da lista (status → 'aceita')

**Verificar:**
```sql
-- Todas com score ≥ 0.90 devem estar com status='aceita'
SELECT COUNT(*) FROM conciliacao_ml_sugestoes 
WHERE status = 'aceita' AND score >= 0.90;
```

---

## 🧪 Teste 6: Filtro de Mês (Re-trigger)

**Ação:** Alterar mês no date picker (ex: Nov 2025)

**Esperado:**
- [ ] useEffect dispara nova chamada de geração
- [ ] Edge function é chamada com novo período
- [ ] Toast mostra novas sugestões para Nov
- [ ] Lista atualiza com novos candidatos
- [ ] Sugestões de Dec/Jan desaparecem

**Network:**
- [ ] Nova chamada POST `/gerar-sugestoes-ml` com mes_inicio/mes_fim atualizados

---

## 🧪 Teste 7: Filtro de Conta (Re-trigger)

**Ação:** Selecionar conta diferente no dropdown

**Esperado:**
- [ ] useEffect dispara com conta_id atualizado
- [ ] Edge function chamada com nova conta
- [ ] Toast mostra sugestões para aquela conta
- [ ] Lista filtra para aquela conta apenas
- [ ] Outras contas desaparecem

---

## 🧪 Teste 8: Botão Manual (Sparkles)

**Ação:** Clicar botão Sparkles para regenerar manualmente

**Esperado:**
- [ ] Ícone muda para Loader (spinning)
- [ ] Botão fica disabled
- [ ] Edge function chamada
- [ ] Toast com resultado
- [ ] Ícone volta a Sparkles
- [ ] Botão re-habilita

---

## 🧪 Teste 9: Integração com Tabela de Conciliações

**Ação:** Aceitar 5 sugestões e verificar reflex na tabela de conciliações

**Esperado:**
- [ ] Extratos aceitos não aparecem mais em "Extratos Pendentes"
- [ ] Transações aceitas não aparecem em "Transações Pendentes"
- [ ] Balance bar atualiza para refletir novos pares conciliados

**SQL:**
```sql
-- Verificar extratos vinculados
SELECT COUNT(*) FROM extratos_bancarios 
WHERE transacao_vinculada_id IS NOT NULL;
-- Deve ter aumentado em 5

-- Verificar transações vinculadas
SELECT COUNT(*) FROM transacoes 
WHERE conciliacao_automática IS NOT NULL;
-- Deve ter aumentado em 5
```

---

## 🧪 Teste 10: RLS Permissions

**Ação:** Login com usuário diferente (filial diferente)

**Esperado:**
- [ ] Novo usuário não vê sugestões de outra filial
- [ ] Novo usuário só vê suas próprias sugestões
- [ ] Tentativa de aceitar sugestão alheia retorna erro

**SQL:**
```sql
-- Verificar que RLS está filtrando
-- User A:
SELECT COUNT(*) FROM conciliacao_ml_sugestoes;
-- User B:
SELECT COUNT(*) FROM conciliacao_ml_sugestoes;
-- Devem ser números diferentes se em filiais diferentes
```

---

## 📊 Métricas Esperadas Ao Final

| Métrica | Esperado | Atual |
|---------|----------|-------|
| Sugestões Geradas | ~180 | ? |
| Score Médio | 0.84-0.87 | ? |
| % Aceitas | ? | ? |
| Tempo Aceitação | <2s por sugestão | ? |
| Feedback Registrado | 1 por aceita/rejeita | ? |

---

## 🐛 Troubleshooting

### Erro: "Erro ao gerar sugestões"
```
→ Verificar Network tab: qual é o status code exato?
  - 401: Falta Authorization header
  - 403: Sem permissão na edge function
  - 500: Erro na RPC ou tabela
  - Solução: Checar logs da edge function no Supabase Dashboard
```

### Sugestões não aparecem mas edge function retorna 200
```
→ Verificar query em SugestoesML.tsx:
  - status = 'pendente'?
  - igreja_id = user_igreja_id?
  - filial_id match?
  - score >= score_minimo?
```

### Aceitar sugestão retorna erro
```
→ Verificar RPC aplicar_sugestao_conciliacao:
  - Sugestão existe?
  - Status é 'pendente'?
  - Usuario_id válido?
```

### Conciliação não vincula
```
→ Verificar RPC aplicar_conciliacao:
  - extrato_id/transacao_id são válidos?
  - Não estão já vinculados?
  - RLS permite atualizar conciliacoes_lote?
```

---

## ✅ Sign-off

- [ ] Todas as 10 categorias de teste passaram
- [ ] Nenhum erro no console
- [ ] Network requests são 200 OK
- [ ] Dados no Supabase correspondem às ações
- [ ] RLS está bloqueando corretamente
- [ ] Métricas foram coletadas

**Date Tested:** __________  
**Tester Name:** __________  
**Status:** ☐ PASS ☐ FAIL
