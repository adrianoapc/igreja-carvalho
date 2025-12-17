# ADR-010 — Intercessão: Redirecionamento Inteligente vs Automação de Criação

## Status
**Aceito**

## Contexto

O módulo de Intercessão gerencia pedidos de oração, testemunhos e sentimentos dos membros. Uma decisão crítica é como o sistema deve responder a registros de sentimentos:

### Cenários em discussão

1. **Redirecionamento Inteligente (Adotado)**
   - Membro registra sentimento
   - Sistema analisa e **sugere ação** (testemunho ou pedido de oração)
   - Exibe link ou ícone chamando atenção
   - Membro clica **voluntariamente** para criar

2. **Automação de Criação (Rejeitado)**
   - Membro registra sentimento
   - Sistema **cria automaticamente** esboço de pedido/testemunho
   - Pré-popula campos com contexto
   - Membro apenas valida e envia
   - Risco: Criar ruído (muitos pedidos/testemunhos vazios ou irrelevantes)

3. **Automação de Submissão (Rejeitado)**
   - Membro registra sentimento
   - Sistema **cria e submete** automaticamente pedido/testemunho
   - Sem intervenção do membro
   - Risco: Muito invasivo, viola autonomia do usuário

## ❗ Problema

Como garantir que o sistema **sugira ações relevantes sem automatizar demais** e criar:
- Ruído no sistema (muitos pedidos/testemunhos de baixa qualidade)
- Invasão de privacidade (ações não consentidas)
- Desengajamento do membro (sente-se controlado)

Ao mesmo tempo, precisamos:
- Orientar membros em sofrimento (negativo) para pedir oração
- Encorajar membros em alegria (positivo) a compartilhar testemunho
- Oferecer fluxo rápido e intuitivo

## ✅ Decisão

**Adotamos Redirecionamento Inteligente com UI explícita:**

### 1. Fluxo de Sentimentos
```
Membro registra sentimento
    ↓
Sistema analisa (IF positivo OU negativo)
    ↓
SE positivo (feliz/grato/abençoado):
    → Exibe card: "Compartilhar Testemunho? ✨"
    → Link destacado → `/intercessao/testemunhos?novo=true`
    → Membro clica (ação voluntária)
    → Abre dialog NovoTestemunhoDialog (vazio, mas com contexto visual)
    
SE negativo (triste/ansioso/angustiado):
    → Exibe card: "Fazer Pedido de Oração? 🙏"
    → Link destacado → `/intercessao/pedidos?novo=true`
    → Membro clica (ação voluntária)
    → Abre dialog NovoPedidoDialog (vazio)
    
SE neutro/sem padrão:
    → Sem sugestão adicional
    → Apenas confirma registro
```

### 2. Alertas Críticos (Fora do Fluxo Imediato)
```
Nightly Job (ou em tempo real via função):
    1. Detecta 3+ dias consecutivos de sentimentos negativos
    2. Marca membro em `alertas_criticos` ou status
    3. Admin vê em dashboard com UI destacada
    4. Admin **manualmente** contata membro (WhatsApp, email, etc.)
    5. Cria observação pastoral se necessário
```

### 3. Tabelas & Campos

Nenhuma tabela nova é criada para "sugestões" ou "esboços automáticos":
- Pedidos, Testemunhos, Sentimentos são criados apenas quando membro intenciona
- RLS garante que membro vê apenas conteúdo apropriado
- Histórico de sentimentos fica em `sentimentos_membros` (simples, auditável)

## 🎯 Motivação

**Por que NÃO automação?**
- Membros em crise emocional precisam de agency (poder de decisão)
- Criar pedidos/testemunhos automáticos gera lixo no sistema
- Dificulta auditoria e rastreamento de autoria real
- Viola responsabilidade: "Membro SER criou este conteúdo"
- Cria ruído para intercessores (muitos pedidos irrelevantes)

**Por que Redirecionamento?**
- Orientação sem invasão
- Fluxo rápido: 1-2 cliques para criar conteúdo
- Mantém integridade dos dados (apenas conteúdo voluntário)
- Alinhado com valores pastorais de livre arbítrio
- Admin ainda recebe alertas de crises via alertas críticos

## 🛠️ Implementação

### Frontend
- `RegistrarSentimentoDialog.tsx`: Após INSERT bem-sucedido, renderiza sugestão contextual
- Link/Botão clicável para novo pedido/testemunho
- CSS: Card destacado com ícone + cores visuais (verde para positivo, vermelho para negativo)

### Backend
- Sem Edge Function extra necessária
- RLS garante isolamento de dados
- Alertas críticos: Pode ser job nocturno OU função com trigger em `sentimentos_membros`

### Analytics (a confirmar)
- Rastrear: % de membros que clicam em sugestão de redirecionamento
- Rastrear: Tempo entre registro de sentimento e criação de pedido/testemunho
- Para otimizar UX no futuro

## 📊 Alternativas Consideradas

| Alternativa | Prós | Contras | Status |
|-------------|------|---------|--------|
| **Redirecionamento Inteligente (Adotado)** | Agency do membro; Dados limpos; Auditável; Rápido | Requer 1-2 cliques extra | ✅ ACEITO |
| **Automação de Esboço** | 1 clique para enviar | Ruído; Difícil auditoria; Muitos abandonados | ❌ REJEITADO |
| **Automação de Submissão** | Máxima orientação | Invasivo; Violação de autonomia; Ruído massivo | ❌ REJEITADO |
| **Sem Sugestão** | Simplicidade | Membros não recebem orientação; Menos pedidos/testemunhos | ❌ REJEITADO |

## ✍️ Consequências

**Positivas:**
- Fluxos simples, intuitivos e rápidos
- Dados auditáveis (apenas conteúdo voluntário)
- Alinhamento com valores pastorais
- Admin mantém controle sobre integridade

**Negativas:**
- Menos pedidos/testemunhos (membro precisa clicar)
- Requer UI clara para sugestões (senão passam despercebidas)
- Admin precisa monitorar alertas críticos (não é automático)

## 🔗 Relações com Outras Decisões

- **ADR-006 (Comunicação vs Notificações)**: Sugestões de redirecionamento ≠ Notificações automáticas; são UI hints, não disparos de mensagens
- **ADR-003 (RLS)**: Alertas críticos só visíveis a admin via RLS
- **ADR-008 (Eventos de Domínio)**: Registrar sentimento é evento; redirecionamento é apenas sugestão UI, não novo evento

## 📚 Referências

- Manual do Usuário (6.5): [`../manual-usuario.md#65-sentimentos`](../manual-usuario.md#65-sentimentos)
- Funcionalidades (4.4): [`../funcionalidades.md#44-sentimentos`](../funcionalidades.md#44-sentimentos)
- Sequência (4): [`../diagramas/sequencia-intercessao.md#4-sequência-registrar-sentimento--redirecionamento-inteligente`](../diagramas/sequencia-intercessao.md#4-sequência-registrar-sentimento--redirecionamento-inteligente)

---

**Data de Aceite:** 2025-03-15  
**Decisores:** Tecnologia, Pastores, UX  
**Próxima Revisão:** 2025-06-15 (avaliar métricas de cliques e engajamento)
