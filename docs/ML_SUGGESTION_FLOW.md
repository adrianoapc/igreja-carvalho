# Fluxo de Sugestões ML - Comportamento Esperado

## 🔄 Comportamento Atual do Sistema

### 1. **Tela Abre** 
- `ConciliacaoInteligente.tsx` carrega
- `useEffect` dispara automaticamente ao detectar `igrejaId`
- Parâmetros enviados:
  - `igreja_id`: ID da igreja logada
  - `conta_id`: Filtro de conta (opcional)
  - `mes_inicio`: Primeiro dia do mês atual
  - `mes_fim`: Último dia do mês atual
  - `score_minimo`: 0.7 (padrão)

### 2. **Edge Function - gerar-sugestoes-ml**
```
POST /functions/v1/gerar-sugestoes-ml
├─ Valida Authorization header
├─ Autentica usuário
├─ Chama RPC: gerar_candidatos_conciliacao()
│  └─ Retorna: 180+ candidatos com score 0.84-0.87 (1:1 matches)
├─ Limpa sugestões antigas (status='pendente')
├─ Insere novos candidatos em conciliacao_ml_sugestoes
│  ├─ status: 'pendente'
│  ├─ score: 0.84-0.87
│  ├─ features: {valor_extrato, valor_transacao, diferenca_dias, tipo_match}
│  └─ tipo_match: '1:1'
└─ Retorna: { success: true, sugestoes_criadas: 180, score_minimo: 0.7 }
```

### 3. **SugestoesML Component - Exibição**
```
├─ useQuery monitora conciliacao_ml_sugestoes
├─ Filtra: status='pendente', igreja_id, filial_id, conta_id
├─ Ordena por score DESC (maior score primeiro)
├─ Renderiza cards com:
│  ├─ Badge de score (cor por range):
│  │  ├─ verde: score ≥ 0.90 (muito confiável)
│  │  ├─ amarelo: score 0.70-0.90 (moderado)
│  │  └─ cinza: score < 0.70 (baixo)
│  ├─ Features exibidas (valor, data, diferença)
│  ├─ Botões individuais:
│  │  ├─ ✅ Aceitar: status → 'aceita', insere feedback
│  │  └─ ❌ Rejeitar: status → 'rejeitada', insere feedback
│  └─ Botão batch "Aplicar Todas":
│     ├─ Filtra score ≥ 0.9
│     ├─ Chama RPC aplicar_sugestao_conciliacao() para cada
│     ├─ Insere em conciliacao_ml_feedback (acao='aceita')
│     └─ Invalida queries para atualizar UI
└─ Toast de sucesso/erro ao final
```

### 4. **RPC - aplicar_sugestao_conciliacao()**
```
├─ Recebe: sugestao_id, usuario_id
├─ Atualiza status: 'pendente' → 'aceita'
├─ Para cada par extrato_id/transacao_id:
│  └─ Chama RPC: aplicar_conciliacao()
│     └─ Cria registro em conciliacoes_lote
├─ Insere feedback em conciliacao_ml_feedback
│  ├─ acao: 'aceita' (ou 'rejeitada')
│  ├─ score: score da sugestão
│  ├─ usuario_id: quem aceitou
│  └─ created_at: timestamp
└─ Retorna: quantidade de pares conciliados
```

### 5. **Filtros Dinâmicos - Regeneram Sugestões**
Quando usuário altera:
- ✅ **Mês** (mes picker) → useEffect re-dispara geração
- ✅ **Conta** (conta filter) → useEffect re-dispara geração
- 🎯 **Botão Sparkles** → Re-dispara manualmente

Nova chamada limpa sugestões antigas e gera para novo período/conta.

---

## 🎯 Próximos Passos (Sequencial)

### **FASE 1: Validação de Funcionamento** ✅ Em Progresso
- [ ] 1. **Testar no navegador**
  - Abrir tela de Conciliação Inteligente
  - Verificar se carrega sugestões automaticamente
  - Conferir if toast mostra "X sugestões geradas"
  - DevTools → Network: verificar resposta da edge function

- [ ] 2. **Testar Filtros**
  - Alterar mês → deve regenerar
  - Alterar conta → deve regenerar
  - Clicar botão Sparkles → deve regenerar manualmente

- [ ] 3. **Testar Aceitação**
  - Clicar ✅ em uma sugestão
  - Verificar if desaparece da lista (status → 'aceita')
  - Verificar if criou feedback em conciliacao_ml_feedback
  - Verificar if vinculou extrato ↔ transação em conciliacoes_lote

### **FASE 2: Refinamento de Heurística** (Após validar)
- [ ] 4. **Melhorar geração de candidatos**
  - Incluir 1:N matches (combinações de transações somadas)
  - Incluir N:1 matches (extratos divididos)
  - Ajustar scoring: peso de features (valor, data, tipo, categoria)
  - Testar com Nov/Dec/Jan (90 dias histórico)

- [ ] 5. **Dashboard de Métricas**
  - View: `view_conciliacao_ml_dashboard`
  - Exibir: total sugestões, % aceitas, score médio
  - Adicionar gráfico de performance ao longo do tempo

### **FASE 3: Training Pipeline** (Futuro)
- [ ] 6. **Setup GitHub Actions**
  - Cron mensal para re-treinar modelo
  - Exportar dataset via `view_conciliacao_ml_export_dataset`
  - Submeter para modelo externo (Claude API ou classificador)
  - Salvar modelo em Supabase Storage

- [ ] 7. **Active Learning Loop**
  - Monitorar `conciliacao_ml_feedback`
  - Reweighting features baseado em rejeições
  - Auto-atualizar `modelo_versao` quando treina

### **FASE 4: Unificação de Lógica** (Futuro)
- [ ] 8. **Substituir old `reconciliar_transacoes`**
  - Remover call old RPC de `santander-api` edge function
  - Usar novo ML approach como padrão
  - Manter old como fallback para edge cases

---

## 📊 Dados Esperados Agora

### **Na Tabela `conciliacao_ml_sugestoes`**
```sql
SELECT COUNT(*), AVG(score), MIN(score), MAX(score)
FROM conciliacao_ml_sugestoes
WHERE status = 'pendente' AND igreja_id = '<current_user_igreja_id>';

-- Esperado: ~180 registros, score ~0.84
```

### **Na Tabela `conciliacao_ml_feedback`** (após aceitar)
```sql
SELECT COUNT(*), acao, AVG(score)
FROM conciliacao_ml_feedback
WHERE usuario_id = '<current_user_id>'
GROUP BY acao;

-- Esperado após aceitar 10: 10 registros com acao='aceita'
```

### **Na Tabela `conciliacoes_lote`** (após aceitar)
```sql
SELECT COUNT(*) FROM conciliacoes_lote
WHERE extrato_id IN (SELECT unnest(extrato_ids) FROM conciliacao_ml_sugestoes WHERE status='aceita');

-- Esperado: N pares conciliados (1 para cada sugestão aceita)
```

---

## 🐛 Debugging Checklist

Se sugestões não aparecerem:
1. ✅ Edge function retorna 200 OK? (Network tab)
2. ✅ Response contém `sugestoes_criadas > 0`? (Network → Response)
3. ✅ Tabela `conciliacao_ml_sugestoes` tem registros? (Supabase Dashboard)
4. ✅ RLS policy permite ler? (Check `eq('igreja_id', user_igreja_id)`)
5. ✅ Filter de status='pendente' está correto? (Query em SugestoesML)
6. ✅ Score está >= score_minimo? (No RPC filter)

---

## 🔐 Permissões RLS Necessárias

```sql
-- Usuário pode ver sugestões da sua igreja
SELECT * FROM conciliacao_ml_sugestoes 
WHERE igreja_id = auth.user().igreja_id

-- Usuário pode aceitar/rejeitar sugestões
UPDATE conciliacao_ml_sugestoes 
SET status = 'aceita'
WHERE igreja_id = auth.user().igreja_id

-- Usuário pode ver feedback que criou
SELECT * FROM conciliacao_ml_feedback 
WHERE usuario_id = auth.user().id
```

---

## 📝 Status Atual

**Última atualização:** 2026-02-04  
**Branch:** main  
**Commit:** db37d71 (feat: add ML suggestion generation hook)

**Componentes implementados:**
- ✅ `useGerarSuggestoesConciliacao` hook
- ✅ `SugestoesML` component com badges e batch apply
- ✅ `gerar-sugestoes-ml` edge function com logs
- ✅ RPC functions (`gerar_candidatos_conciliacao`, `aplicar_sugestao_conciliacao`)
- ✅ Database schema (tables, views, functions, RLS)

**Aguardando:**
- 🔄 Testes de end-to-end no navegador
- 🔄 Validação de dashboard de métricas
- 🔄 Setup de training pipeline

---

## 💡 Notas Importante

- Score atual é heurístico (value match + date proximity + type match)
- Threshold de 0.90 para batch apply é conservador (sem confirmação)
- Nov/Dec/Jan tem 180 candidatos 1:1 prontos para testar
- Feedback loop permite retraining automático no futuro
- Pivô para ML foi necessário pois manual reconciliation era lento
