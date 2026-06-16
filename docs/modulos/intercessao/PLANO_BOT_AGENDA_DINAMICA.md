# 📋 PLANO: Enriquecer BOT com Agenda Dinâmica

**Data de criação:** 28/01/2026  
**Status:** 🟡 Planejado (aguardando execução)  
**Prioridade:** Média  
**Estimativa:** 2-3 horas

---

## 🎯 OBJETIVO

Fazer o chatbot responder perguntas sobre agenda/eventos usando dados reais do banco, não apenas FAQ estática.

**Exemplos de perguntas que passarão a funcionar:**
- "Qual horário do culto de domingo?"
- "Tem culto hoje?"
- "Que eventos vocês têm essa semana?"
- "Quando é o próximo culto?"
- "Quando é o Compartilhe?"

---

## 📊 ANÁLISE DO ESTADO ATUAL

### Arquivo Alvo
`supabase/functions/chatbot-triagem/index.ts`

### Fluxo Atual
```
Mensagem → Carregar Sessão → Prompt Estático → OpenAI → Resposta
```

### Problema Identificado
O `DEFAULT_SYSTEM_PROMPT` tem FAQ fixa e desatualizada:
```typescript
FAQ: Cultos Dom 18h30/Qui 19h30. End: Av. Gabriel Jorge Cury 232.
```

**Limitações:**
- ❌ Não reflete eventos reais do banco
- ❌ Não atualiza automaticamente
- ❌ Horários podem mudar e o bot não sabe
- ❌ Eventos especiais não aparecem

---

## 🛠️ SOLUÇÃO PROPOSTA: Prompt Dinâmico Enriquecido

### Fluxo Modificado
```
Mensagem → Carregar Sessão → Buscar Agenda → Enriquecer Prompt → OpenAI → Resposta
                                    ↓
                            (1 query extra - 50-100ms)
```

---

## 📝 IMPLEMENTAÇÃO DETALHADA

### **PASSO 1: Criar função `buscarAgendaSemanal()`**

**Localização:** Logo após `buscarEventosAbertos()` (linha ~230)

**Assinatura:**
```typescript
async function buscarAgendaSemanal(
  supabaseClient: SupabaseClient,
  igrejaId: string,
  filialId: string | null,
): Promise<Array<{
  titulo: string;
  data_evento: string;
  tipo: string;
  local_evento: string | null;
}>>
```

**Responsabilidades:**
- Buscar próximos 7 dias de eventos
- Incluir TODOS os tipos (não só com inscrição)
- Filtrar por `igreja_id` e `filial_id` (se aplicável)
- Filtrar apenas eventos confirmados
- Ordenar por data (próximos primeiro)

**Query SQL:**
```typescript
let query = supabaseClient
  .from("eventos")
  .select("titulo, data_evento, tipo, local_evento")
  .eq("igreja_id", igrejaId)
  .eq("status", "confirmado")
  .gte("data_evento", new Date().toISOString())
  .lte("data_evento", dataLimite7Dias)
  .order("data_evento", { ascending: true })
  .limit(10);

if (filialId) {
  query = query.eq("filial_id", filialId);
}
```

**Tratamento de erro:**
- Se query falhar, retornar array vazio
- Logar erro mas não quebrar o fluxo

---

### **PASSO 2: Criar função `formatarAgendaParaPrompt()`**

**Localização:** Logo após `buscarAgendaSemanal()`

**Assinatura:**
```typescript
function formatarAgendaParaPrompt(
  eventos: Array<{ titulo: string; data_evento: string; tipo: string; local_evento: string | null }>
): string
```

**Responsabilidades:**
- Formatar eventos em texto legível
- Agrupar por tipo (Cultos, Eventos, Conferências)
- Formatar datas em português (ex: "Dom 02/02 às 18h30")
- Incluir local quando disponível

**Formato de saída:**
```
AGENDA SEMANAL (atualizada automaticamente):

🙏 CULTOS:
- Dom 02/02 às 18h30 - Culto de Celebração
- Qui 06/02 às 19h30 - Culto de Oração

🎉 EVENTOS ESPECIAIS:
- Sáb 08/02 às 15h00 - Compartilhe a Esperança
  Local: Auditório Principal

📚 REUNIÕES:
- Ter 04/02 às 20h00 - Escola de Líderes
```

**Lógica de agrupamento:**
```typescript
const grupos = {
  culto: { emoji: "🙏", titulo: "CULTOS" },
  evento: { emoji: "🎉", titulo: "EVENTOS ESPECIAIS" },
  conferencia: { emoji: "📖", titulo: "CONFERÊNCIAS" },
  reuniao: { emoji: "📚", titulo: "REUNIÕES" },
};
```

**Caso especial - sem eventos:**
```
AGENDA SEMANAL:
Não há eventos programados para os próximos 7 dias.
Nosso endereço: Av. Gabriel Jorge Cury 232.
```

---

### **PASSO 3: Modificar função de chamada à OpenAI**

**Localização:** Função que monta o prompt e chama a API (procurar por `OPENAI_API_KEY`)

**Mudanças necessárias:**

**ANTES (código atual):**
```typescript
const messages = [
  { role: "system", content: DEFAULT_SYSTEM_PROMPT },
  ...historico,
  { role: "user", content: mensagemUsuario }
];
```

**DEPOIS (código novo):**
```typescript
// 1. Buscar agenda semanal
const agendaSemanal = await buscarAgendaSemanal(supabase, igrejaId, filialId);
const agendaFormatada = formatarAgendaParaPrompt(agendaSemanal);

// 2. Enriquecer prompt
const systemPromptEnriquecido = `${DEFAULT_SYSTEM_PROMPT}

${agendaFormatada}

INSTRUÇÕES: Use a AGENDA SEMANAL acima (sempre atualizada) para responder perguntas sobre horários e eventos.`;

// 3. Montar mensagens
const messages = [
  { role: "system", content: systemPromptEnriquecido },
  ...historico,
  { role: "user", content: mensagemUsuario }
];
```

**Tratamento de erro:**
- Se `buscarAgendaSemanal()` falhar, usar `DEFAULT_SYSTEM_PROMPT` sem enriquecimento
- Logar warning mas continuar execução

---

### **PASSO 4: Atualizar `DEFAULT_SYSTEM_PROMPT`**

**Localização:** Constante global (linha ~72)

**ANTES:**
```typescript
const DEFAULT_SYSTEM_PROMPT = `
Você é da Equipe de Acolhimento da Igreja Carvalho.
REGRAS: 1. Nunca diga que é IA. 2. Use a FAQ. 
FLUXOS: 
- ORAÇÃO: Colete dados -> JSON (intencao: PEDIDO_ORACAO).
- PASTOR: Pergunte motivo -> JSON (intencao: SOLICITACAO_PASTORAL).
- TESTEMUNHO: Colete relato -> JSON (intencao: TESTEMUNHO).
- INSCRIÇÃO: Detecte interesse em eventos/compartilhe -> JSON (intencao: INSCRICAO_EVENTO).
FAQ: Cultos Dom 18h30/Qui 19h30. End: Av. Gabriel Jorge Cury 232.
...
`;
```

**DEPOIS:**
```typescript
const DEFAULT_SYSTEM_PROMPT = `
Você é da Equipe de Acolhimento da Igreja Carvalho.

REGRAS FUNDAMENTAIS:
1. Nunca diga que é IA ou assistente virtual
2. Use a AGENDA SEMANAL fornecida para responder sobre eventos e horários
3. Seja natural, acolhedor e prestativo
4. Não invente informações - use apenas dados fornecidos

FLUXOS DE ATENDIMENTO:
- ORAÇÃO: Colete nome e motivo → JSON (intencao: PEDIDO_ORACAO)
- PASTOR: Pergunte motivo do contato → JSON (intencao: SOLICITACAO_PASTORAL)
- TESTEMUNHO: Colete relato detalhado → JSON (intencao: TESTEMUNHO)
- INSCRIÇÃO: Detecte interesse em eventos → JSON (intencao: INSCRICAO_EVENTO)

INFORMAÇÕES FIXAS DA IGREJA:
- Endereço: Av. Gabriel Jorge Cury 232
- Contato: (informar se perguntarem)

[AGENDA SEMANAL será inserida aqui dinamicamente antes de cada conversa]

JSON FINAL:
\`\`\`json
{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO" | "TESTEMUNHO" | "SOLICITACAO_PASTORAL" | "INSCRICAO_EVENTO",
  "nome_final": "...",
  "motivo_resumo": "...",
  "texto_na_integra": "...",
  "categoria": "SAUDE|FAMILIA|FINANCEIRO|ESPIRITUAL|GABINETE|INSCRICAO|OUTROS",
  "anonimo": false,
  "publicar": false,
  "notificar_admin": false
}
\`\`\`
`;
```

**Mudanças:**
- ✅ Removida FAQ estática de horários
- ✅ Adicionada instrução para usar AGENDA SEMANAL
- ✅ Mantido endereço (menos propenso a mudar)
- ✅ Melhorada estrutura e clareza

---

## 📈 ANÁLISE DE IMPACTO

### Performance
| Métrica | Antes | Depois | Impacto |
|---------|-------|--------|---------|
| Queries por mensagem | 2-3 | 3-4 | +1 query |
| Latência estimada | 200-300ms | 250-400ms | +50-100ms |
| Tokens no prompt | ~500 | ~700-1000 | +200-500 tokens |

**Conclusão:** Impacto negligível para o usuário final.

### Custo OpenAI
- Modelo atual: GPT-4o-mini
- Custo adicional por mensagem: ~$0.0001
- Volume estimado: 1000 msg/mês
- **Custo adicional mensal: ~$0.10** (insignificante)

### Benefícios
- ✅ Bot sempre atualizado com agenda real
- ✅ Responde perguntas sobre horários corretamente
- ✅ Menciona eventos especiais automaticamente
- ✅ Não quebra fluxos existentes
- ✅ Zero mudança na interface/UX
- ✅ Reduz perguntas repetitivas à equipe

---

## 🧪 PLANO DE TESTES

### Testes Funcionais

#### 1. Perguntas sobre horários de cultos
```
Usuário: "Qual horário do culto de domingo?"
Esperado: "O culto de domingo é às 18h30" (baseado em dados reais)

Usuário: "Tem culto hoje?"
Esperado: 
- Se for dia de culto: "Sim! Hoje às [horário] temos [nome do culto]"
- Se não for: "Hoje não temos culto programado. Nossos cultos são [dias e horários]"
```

#### 2. Perguntas sobre eventos especiais
```
Usuário: "Que eventos vocês têm essa semana?"
Esperado: Lista de eventos da semana atual

Usuário: "Quando é o Compartilhe?"
Esperado: Data e horário do evento Compartilhe (se existir na agenda)
```

#### 3. Perguntas gerais
```
Usuário: "Onde fica a igreja?"
Esperado: "Av. Gabriel Jorge Cury 232"

Usuário: "Qual o próximo evento?"
Esperado: Nome, data e hora do próximo evento cronologicamente
```

#### 4. Fluxos existentes (não devem quebrar)
- ✅ Pedido de oração completo
- ✅ Solicitação pastoral
- ✅ Inscrição em evento
- ✅ Testemunho

### Edge Cases

#### 1. Agenda vazia
```
Cenário: Nenhum evento nos próximos 7 dias
Esperado: Bot informa que não há eventos programados
```

#### 2. Múltiplas filiais
```
Cenário: Usuário de filial específica
Esperado: Ver apenas eventos da sua filial
```

#### 3. Falha na query
```
Cenário: Banco de dados inacessível temporariamente
Esperado: Bot continua funcionando com FAQ estática
```

#### 4. Eventos passados
```
Cenário: Evento com data_evento no passado
Esperado: Não aparecer na agenda
```

---

## 🚀 CHECKLIST DE EXECUÇÃO

### Pré-implementação
- [ ] Revisar schema da tabela `eventos` (campos disponíveis)
- [ ] Confirmar formato de `data_evento` (timestamp vs date)
- [ ] Verificar valores possíveis de `tipo` evento
- [ ] Confirmar se `local_evento` está sendo preenchido

### Implementação
- [ ] Criar função `buscarAgendaSemanal()`
- [ ] Criar função `formatarAgendaParaPrompt()`
- [ ] Modificar função de chamada à OpenAI
- [ ] Atualizar `DEFAULT_SYSTEM_PROMPT`
- [ ] Adicionar logs para debug (`console.log` com prefixo `[AgendaDinamica]`)

### Testes em DEV
- [ ] Testar com agenda vazia
- [ ] Testar com 1 evento
- [ ] Testar com múltiplos eventos
- [ ] Testar agrupamento por tipo
- [ ] Testar formatação de datas
- [ ] Verificar logs no Supabase Functions

### Deploy
- [ ] Fazer backup do código atual
- [ ] Deploy para produção
- [ ] Monitorar logs por 2 horas
- [ ] Testar com conta real

### Pós-deploy
- [ ] Monitorar erros por 24h
- [ ] Coletar feedback de 5-10 conversas reais
- [ ] Ajustar formatação se necessário
- [ ] Documentar em CHANGELOG.md

---

## ❓ DECISÕES PENDENTES

### 1. Período da agenda
**Opções:**
- A) 7 dias (semana corrente) ✅ **RECOMENDADO**
- B) 14 dias (2 semanas)
- C) 30 dias (mês)

**Decisão:** [ ] A  [ ] B  [ ] C

**Justificativa escolhida:** _______________________

---

### 2. Tipos de eventos a incluir
**Opções:**
- A) Todos os eventos confirmados ✅ **RECOMENDADO**
- B) Apenas eventos com inscrição
- C) Personalizar por tipo (cultos sempre, eventos só se inscrição aberta)

**Decisão:** [ ] A  [ ] B  [ ] C

**Justificativa escolhida:** _______________________

---

### 3. Incluir local dos eventos?
**Opções:**
- A) Sempre incluir (se preenchido no banco) ✅ **RECOMENDADO**
- B) Nunca incluir
- C) Incluir apenas se diferente do endereço padrão

**Decisão:** [ ] A  [ ] B  [ ] C

**Justificativa escolhida:** _______________________

---

### 4. Formato de hora
**Opções:**
- A) 18h30 ✅ **RECOMENDADO** (mais brasileiro)
- B) 18:30
- C) 6:30 PM

**Decisão:** [ ] A  [ ] B  [ ] C

**Justificativa escolhida:** _______________________

---

### 5. Cache da agenda
**Opções:**
- A) Sem cache (buscar sempre) ✅ **RECOMENDADO** (v1)
- B) Cache de 5 minutos
- C) Cache de 1 hora

**Decisão:** [ ] A  [ ] B  [ ] C

**Justificativa escolhida:** _______________________

---

## 📊 MÉTRICAS DE SUCESSO

### Indicadores de sucesso (medir após 1 semana)
- [ ] Redução de 30%+ em perguntas sobre horários para equipe
- [ ] Zero erros críticos no bot
- [ ] Latência média < 500ms
- [ ] 90%+ de respostas corretas sobre agenda
- [ ] Feedback positivo de usuários

### Como medir
- Logs do Supabase Functions
- Feedback manual de 10 usuários
- Análise de conversas salvas em `atendimentos_bot`

---

## 🔄 ROLLBACK

### Se algo der errado
1. Fazer rollback para versão anterior da função
2. Investigar logs de erro
3. Corrigir em branch separada
4. Testar novamente em DEV

### Backup do código atual
- [ ] Commit atual tagueado como `pre-agenda-dinamica`
- [ ] Branch de backup criada: `backup/chatbot-triagem-estatico`

---

## 📚 REFERÊNCIAS

- Arquivo principal: `supabase/functions/chatbot-triagem/index.ts`
- Schema de eventos: `docs/database-schema.sql`
- ADR relacionada: ADR-026 (integração de lotes)
- Documentação OpenAI: https://platform.openai.com/docs

---

## 📝 NOTAS ADICIONAIS

### Considerações técnicas
- Usar `date-fns` para formatação de datas (já está no projeto?)
- Considerar timezone (America/Sao_Paulo)
- Validar se `tipo` do evento é enum ou texto livre

### Melhorias futuras (fora do escopo desta task)
- [ ] Cache inteligente com invalidação
- [ ] Function calling para buscar eventos sob demanda
- [ ] Integração com calendário externo
- [ ] Notificações proativas sobre eventos

---

**Última atualização:** 28/01/2026  
**Autor:** Sistema de Planejamento  
**Revisor:** [ ] Pendente

---

## ✅ APROVAÇÃO PARA EXECUÇÃO

- [ ] Plano revisado e aprovado
- [ ] Decisões pendentes resolvidas
- [ ] Estimativa de tempo confirmada
- [ ] Ambiente de testes preparado

**Data de aprovação:** ___ / ___ / ______  
**Responsável pela execução:** ________________________
