# 🔄 Novo Fluxo Make com Consultar Sessão

## Diagrama Visual do Fluxo Completo

```
┌──────────────────────────────────────────────────────────────────┐
│                 WEBHOOK: WhatsApp Message                        │
│                      (Módulo 1)                                  │
│                                                                  │
│  Recebe: telefone, mensagem, phone_number_id                    │
└──────────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│          📌 HTTP: CONSULTAR SESSÃO ATIVA (Módulo 2)             │
│              (NOVO! Só Make consegue)                           │
│                                                                  │
│  POST /consultar-sessao                                          │
│  Body: { telefone, phone_number_id }                             │
│                                                                  │
│  Resposta:                                                       │
│  {                                                              │
│    encontrada: true/false,                                      │
│    origem_canal: "whatsapp" | "whatsapp_financeiro" | ...       │
│    meta_dados: { step, fluxo, ... }                             │
│  }                                                              │
└──────────────────────────────────────────────────────────────────┘
                             ↓
                    Decisão Crítica:
                   /                \
                  /                  \
        encontrada:                encontrada:
           TRUE                      FALSE
           (2.1)                    (2.2)
            ↓                         ↓
    ┌────────────────┐      ┌────────────────┐
    │ SEM MUDANÇA?   │      │   USA ROUTER   │
    │                │      │   por keyword  │
    │ origem_canal   │      │                │
    │ = anterior?    │      │ Detecta:       │
    │                │      │ - "oração"     │
    │ (triagem ==    │      │ - "reembolso"  │
    │  triagem)      │      │ - "inscrição"  │
    └────────────────┘      └────────────────┘
        /        \                  |
       /          \                 |
    SIM           NÃO        ┌──────▼──────┐
    │             │         │   Router    │
    │             │         │  (Módulo 3) │
    │             │         └─────┬─┬─┬───┘
    │             │               │ │ │
    │             │      ┌────────┘ │ └────────┐
    │             │      │          │         │
    │             │   Triagem   Financeiro Compartilhe
    │             │      │          │         │
    │      ┌──────▼──────▼─┐       │         │
    │      │ CRIA NOVA    │       │         │
    │      │ SESSÃO       │       │         │
    │      │              │       │         │
    │      │ origem_canal │       │         │
    │      │ = nova       │       │         │
    │      │ (diferente)  │       │         │
    │      └──────┬───────┘       │         │
    │             │               │         │
    └─────────┬───┴───────────────┴────────┴──┐
              │                               │
              ▼                               ▼
        ┌─────────────────────────────────────────────┐
        │  HTTP: ROTAS (Módulos 3a, 3b, 3c)          │
        │                                             │
        │  • chatbot-triagem                          │
        │  • chatbot-financeiro                       │
        │  • inscricao-compartilhe                    │
        │                                             │
        │  Cada edge function recebe:                 │
        │  - telefone                                 │
        │  - mensagem                                 │
        │  - phone_number_id                          │
        │  - origem_canal                             │
        └─────────────────────────────────────────────┘
                             ↓
        ┌─────────────────────────────────────────────┐
        │  Parse JSON Response (Módulo 4)             │
        │                                             │
        │  Extrai: { text, notificar_admin, ... }     │
        └─────────────────────────────────────────────┘
                             ↓
        ┌─────────────────────────────────────────────┐
        │  Send WhatsApp Message (Módulo 5)           │
        │  Resposta ao usuário                        │
        │                                             │
        │  TO: messages[].from                        │
        │  FROM: metadata.phone_number_id             │
        │  TEXT: Resposta do bot                      │
        └─────────────────────────────────────────────┘
                             ↓
        ┌─────────────────────────────────────────────┐
        │  Filter: Notificar Admin? (Módulo 6)        │
        │                                             │
        │  if notificar_admin == true                 │
        │    → Send WhatsApp to Admin (Módulo 7)     │
        └─────────────────────────────────────────────┘
```

---

## 🔑 Decisões Críticas (Pontos 2.1 e 2.2)

### Decisão 2.1: Sessão Ativa EXISTE

```
✅ SEMPRE continua na mesma sessão (ignora conteúdo da mensagem)

Lógica:
- Consultar Sessão retornou: encontrada=true, origem_canal="whatsapp"
- Make PULA Router
- Make envia direto para o chatbot da origem_canal
- Chatbot decide se a mensagem faz sentido ou não

Exemplo:
- Sessão ativa: ORAÇÃO (origem_canal="whatsapp")
- Usuário envia: "Quero reembolso"
- Make: IGNORA "reembolso", manda para chatbot-triagem
- Chatbot-triagem responde: "Desculpe, não entendi. Qual o motivo da oração?"

┌─────────────────────────────────────────┐
│  Sessão ativa encontrada?                │
│  → SIM                                   │
│                                          │
│  ✅ PULA Router                          │
│  ✅ USA origem_canal da sessão           │
│  ✅ Manda direto para chatbot            │
│  ✅ Chatbot valida se mensagem faz sentido│
└─────────────────────────────────────────┘
```

### Decisão 2.2: SEM Sessão Ativa

```
✅ USA Router para decidir por palavra-chave

Lógica:
- Consultar Sessão retornou: encontrada=false
- Make USA Router
- Router analisa mensagem: "oração" → rota triagem
- Cria nova sessão com origem_canal="whatsapp"

┌─────────────────────────────────────────┐
│  encontrada = FALSE                      │
│                                          │
│  ✅ USA ROUTER por keyword               │
│  ✅ Detecta palavra-chave                │
│  ✅ CRIA nova sessão no chatbot           │
└─────────────────────────────────────────┘
```

---

## 📊 Exemplos de Fluxo Real

### Exemplo 1: João continua em Oração

```
10:00 - João: "Preciso de oração"
        ↓ Módulo 2: encontrada = false
        ↓ Módulo 3: Router → detecta "oração"
        ↓ Módulo 3a: chatbot-triagem
        ↓ Resposta: "Qual é o motivo?"
        ↓ Cria: origem_canal = "whatsapp"

10:05 - João: "Para saúde de meu pai"
        ↓ Módulo 2: encontrada = true, origem_canal = "whatsapp"
        ↓ Pergunta: mesma origem? "whatsapp" == "whatsapp"? SIM
        ✅ CONTINUA em Oração
        ✓ NÃO usa Router
        ✓ MANDA DIRETO para chatbot-triagem
        ✓ "Ok, vou registrar este pedido"
```

### Exemplo 2: João muda de Oração para Compartilhe

```
10:00 - João: "Preciso de oração"
        ↓ Cria: origem_canal = "whatsapp"

10:10 - João: "Agora quero me inscrever"
        ↓ Módulo 2: encontrada = true, origem_canal = "whatsapp"
        ✅ TEM sessão ativa de ORAÇÃO
        ✅ IGNORA palavra-chave "inscrever"
        ✓ PULA Router
        ✓ Manda direto para chatbot-triagem
        
Chatbot-triagem recebe: "Agora quero me inscrever"
Chatbot responde: "Desculpe, não entendi. Qual o motivo da oração?"

João percebe e envia: "/sair" ou "cancelar"
        ↓ Chatbot-triagem finaliza sessão (status=CONCLUIDO)
        
10:15 - João: "Quero me inscrever"
        ↓ Módulo 2: encontrada = false (sessão foi finalizada)
        ✅ SEM sessão ativa
        ✓ USA Router
        ✓ Router detecta "inscrever" → whatsapp_compartilhe
        ✓ Cria nova sessão: origem_canal = "whatsapp_compartilhe"
        ✓ "Os seus dados estão corretos?"

Banco de dados:
- Sessão 1: Oração (CONCLUIDO) ← finalizou
- Sessão 2: Compartilhe (EM_ANDAMENTO) ← nova
```

### Exemplo 3: João finaliza uma sessão e inicia outra

```
10:00 - João: "Quero reembolso"
        ↓ Cria: origem_canal = "whatsapp_financeiro"
        ↓ Chatbot coleta dados...
        
10:10 - João: "Concluído" (ou chatbot finaliza automaticamente)
        ↓ Sessão financeiro: status = CONCLUIDO

10:15 - João: "Preciso de oração"
        ↓ Módulo 2: encontrada = false (financeiro está CONCLUIDO)
        ✅ SEM sessão ativa
        ✓ USA Router
        ✓ Router detecta "oração" → whatsapp
        ✓ CRIA nova sessão de Oração
        ✓ "Qual é o motivo da oração?"

Banco de dados:
- Sessão 1: Financeiro (CONCLUIDO) ← finalizado
- Sessão 2: Oração (EM_ANDAMENTO) ← nova
```

---

## ⚠️ Comportamento Importante: Sessão Ativa Tem Prioridade

**Regra de Ouro:** Se `consultar-sessao` retorna `encontrada=true`, **SEMPRE vai para aquele chatbot**, independente do conteúdo da mensagem.

### Por quê?

```
Problema: Como saber se usuário quer trocar de assunto ou continuar?

Solução Simples: Se tem sessão ativa, continua nela.
- Chatbot decide se mensagem faz sentido
- Se não fizer sentido, chatbot orienta usuário
- Usuário pode finalizar com "/sair" ou "cancelar"
```

### Comando de Saída (Recomendação)

Todos os chatbots devem reconhecer:
- `/sair`
- `/cancelar`
- `/menu`
- `sair`
- `cancelar`

**Ação:** Finaliza sessão atual (`status=CONCLUIDO`) e permite nova conversa.

---

## 🎯 Fluxo Simplificado no Make

```javascript
Módulo 2: Consultar Sessão
↓
if (2.encontrada == true) {
  // TEM SESSÃO ATIVA
  // PULA Router
  // Vai direto para chatbot da origem_canal
  
  if (2.origem_canal == "whatsapp") {
    → chatbot-triagem
  } else if (2.origem_canal == "whatsapp_financeiro") {
    → chatbot-financeiro
  } else if (2.origem_canal == "whatsapp_compartilhe") {
    → inscricao-compartilhe
  }
  
} else {
  // SEM SESSÃO ATIVA
  // USA Router
  
  if (mensagem contains "oração") {
    → chatbot-triagem
  } else if (mensagem contains "reembolso") {
    → chatbot-financeiro
  } else if (mensagem contains "inscrição") {
    → inscricao-compartilhe
  }
}
```

---

## 📋 Implementação Passo a Passo

1. **Criar função** `consultar-sessao` ✅ (já feito)
2. **Adicionar Módulo 2 no Make** com HTTP POST
3. **Adicionar lógica de decisão** após Módulo 2
4. **Testar** com João alternando entre conversas
5. **Validar** banco de dados com 2+ sessões ativas

---

## ✅ Checklist

- [ ] Function `consultar-sessao` implantada no Supabase
- [ ] Módulo 2 configurado no Make
- [ ] Headers com ANON_KEY correto
- [ ] Body com `telefone` e `phone_number_id`
- [ ] Condicional após Módulo 2 implementada
- [ ] Testado: Uma sessão ativa
- [ ] Testado: Múltiplas sessões simultâneas
- [ ] Validado: `atendimentos_bot` mostra estado correto

---

**Status:** Pronto para implementação  
**Próximo passo:** Configurar Módulo 2 no Make conforme doc CONSULTAR_SESSAO_MAKE.md
