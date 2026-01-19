# 📱 Webhook PIX + Sistema de Conciliação de Ofertas

**Data:** 17 de janeiro de 2026  
**Status:** Pronto para Reunião de Segunda-feira

---

## ✅ Deliverables de Hoje

### 1️⃣ Análise Estratégica Completa
📄 **Arquivo:** `docs/CONCILIACAO_OFERTAS_ANALYSIS.md`

Contém:
- ✅ Situação atual (o que tem vs o que falta)
- ✅ 3 sugestões de solução (manual → regras → IA)
- ✅ Estrutura de dados completa
- ✅ 6 pontos críticos de atenção
- ✅ Roadmap de 3 fases

**Para revisar:** Abrir e comentar sugestões

---

### 2️⃣ Webhook PIX Implementado
🔧 **Arquivos:**
- `supabase/migrations/20260117_create_pix_webhook_temp.sql` (Tabela)
- `supabase/functions/pix-webhook-receiver/index.ts` (Edge Function)
- `src/components/financas/PixWebhookReceiver.tsx` (Component React)

**O que faz:**
- Recebe PIX em tempo real do banco
- Armazena em tabela temporária com data/hora reais
- Mantém payload completo para auditoria
- Pronto para vinculação com ofertas

**Status:** Código 100% pronto, aguardando aprovação para deploy

---

### 3️⃣ Documentação Técnica Completa
📚 **Arquivo:** `docs/WEBHOOK_PIX_SETUP.md`

Contém:
- 🏗️ Arquitetura do sistema
- 🔄 Fluxo passo a passo
- ⚙️ Como configurar webhook no Santander
- 💾 Estrutura da tabela
- 🧪 Testes práticos (cURL, SQL)
- 🔍 Troubleshooting
- 📊 Queries de monitoramento

**Para usar:** Guide passo a passo para setup

---

## 🎯 Roadmap para Segunda-feira

### ✨ Reunião: Alinhamento Estratégico
**Objetivo:** Validar abordagem e aprovar implementação

**Pauta:**
1. Revisar `CONCILIACAO_OFERTAS_ANALYSIS.md`
2. Escolher entre Opção 1, 2 ou 3 (ou híbrido)
3. Definir prioridades da Fase 1
4. Validar estrutura de cultos e horários

---

### 🚀 Implementação: Fase 1 (Segunda-feira)
**Tempo estimado:** 1-2 dias

**O que fazer:**
1. ✅ Deploy webhook PIX (5 min)
2. ✅ Testar webhook do banco (30 min)
3. ⏳ Criar tela de conciliação manual (2-3h)
4. ⏳ Integrar com relatório de ofertas (2h)
5. ⏳ Testar fluxo completo (1h)

**Resultado:** Conciliação manual funcional

---

### 📋 Implementação: Fase 2 (Próxima semana)
**Tempo estimado:** 2-3 dias

**O que fazer:**
1. Criar tabela `regras_classificacao`
2. Tela de manutenção de regras
3. Engine de aplicação de regras
4. Dashboard de exceções

**Resultado:** Auto-classificação por padrões

---

## 📊 Estrutura de Dados

### Tabela Temporária: `pix_webhook_temp`

```sql
-- Recebe PIX em tempo real
pix_id          (unique)     -- ID do PIX no banco
valor           (decimal)    -- Valor recebido
data_pix        (timestamp)  -- QUANDO foi enviado (real)
status          (texto)      -- recebido | processado | vinculado | erro
webhook_payload (json)       -- Dados completos do webhook
oferta_id       (uuid)       -- Quando vinculado com oferta
```

---

## 🔗 Como Tudo Se Conecta

```
BANCO (Santander)
    ↓
[PIX Recebido em tempo real - domingo 20h]
    ↓
pix-webhook-receiver (Edge Function)
    ↓
pix_webhook_temp (Tabela com dados reais)
    ↓
PixWebhookReceiver Component (UI)
    ↓
Usuário vincula com Relatório de Ofertas
    ↓
Sistema classifica por Culto (segunda-feira: regras)
```

---

## 📌 Pontos Críticos

### 🕐 Timing é Essencial
- PIX chega domingo
- Santander processa segunda
- Webhook resolve: armazena timestamp real
- Extrato pode vir 2-3 dias depois

### 🙏 Múltiplos Cultos
- Mesma forma (PIX), horários diferentes
- Solução: Regras com horário específico

### 💰 Ofertas Unificadas
- Relatório: "PIX R$ 5.000"
- Extrato: 50 transações de PIX
- Sistema agrupa automaticamente

### ⚠️ Discrepâncias Inevitáveis
- Dashboard de exceções para revisar
- Campo observações para documentar

---

## 🎬 Próximas Ações

### Hoje (17/01) - ✅ PRONTO
- [x] Análise estratégica
- [x] Código do webhook PIX
- [x] Componente React
- [x] Documentação completa

### Segunda (20/01) - ⏳ PLANEJADO
- [ ] Reunião de alinhamento
- [ ] Validar estratégia
- [ ] Iniciar Fase 1

### Próxima Semana - ⏳ AGENDADO
- [ ] Completar Fase 1
- [ ] Iniciar Fase 2 (regras)

---

## 📂 Arquivos Criados

```
docs/
├── CONCILIACAO_OFERTAS_ANALYSIS.md    (Análise estratégica)
└── WEBHOOK_PIX_SETUP.md               (Documentação técnica)

supabase/
├── migrations/
│   └── 20260117_create_pix_webhook_temp.sql
└── functions/
    └── pix-webhook-receiver/
        └── index.ts

src/
└── components/financas/
    └── PixWebhookReceiver.tsx
```

---

## 🚀 Como Usar

### 1. Revisar Documentação
```
1. Abrir docs/CONCILIACAO_OFERTAS_ANALYSIS.md
2. Comentar sugestões
3. Escolher estratégia
```

### 2. Deploy do Webhook (quando aprovado)
```bash
# Deploy da edge function
supabase functions deploy pix-webhook-receiver

# Verificar
supabase functions list
```

### 3. Configurar no Banco
```
Banco: https://developer.santander.com.br/
Menu: Webhooks → PIX Recebimento
URL: https://seu-projeto.supabase.co/functions/v1/pix-webhook-receiver
Headers: X-Igreja-ID: [uuid]
Testar webhook
```

### 4. Integrar Component
```tsx
import { PixWebhookReceiver } from "@/components/financas/PixWebhookReceiver";

<PixWebhookReceiver />
```

---

## 💬 Perguntas para Segunda-feira

1. **Qual estratégia prefere?**
   - Opção 1: Regras automáticas
   - Opção 2: Conciliação manual visual
   - Opção 3: Híbrido (começa manual, depois regras)

2. **Cultos têm horários fixos?**
   - Segunda: oração 19h + culto 20h
   - Terça: culto 20h
   - Quarta: culto 20h
   - Quinta: culto 20h
   - Sexta: culto 20h
   - Sábado: -
   - Domingo: manhã 8h + noite 18h

3. **Ofertas são unificadas ou detalhadas?**
   - Unificadas: "PIX R$ 5.000" (agrupa)
   - Detalhadas: Cada PIX é entrada

4. **Prioridade: velocidade ou precisão?**
   - Rápido (regras automáticas)
   - Preciso (revisão manual antes)

---

**Pronto para a reunião de segunda-feira! 🚀**
