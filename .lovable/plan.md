

# Plano: IA Sempre Informa o Fluxo Atual

## Problema Confirmado

O código **já está preparado** para capturar `fluxo_atual` (linhas 109-120 e 401-420), mas o **prompt não instrui a IA a retornar isso**.

### Situação Atual:
```text
Usuário: "Preciso de uma oração"
IA responde: "Pode me contar mais sobre o motivo?"
→ Sem JSON, parsedJson = null, flow = null ❌
```

### Situação Desejada:
```text
Usuário: "Preciso de uma oração"
IA responde: "Pode me contar mais sobre o motivo?"
{"fluxo_atual": "ORACAO"}
→ parsedJson.fluxo_atual = "ORACAO", flow = "ORACAO" ✓
```

---

## Alterações Necessárias

### 1. Atualizar Prompt no Banco de Dados

Adicionar nova regra obrigatória no início do prompt (tabela `chatbot_configs`, campo `role_texto`):

```
📌 REGRA OBRIGATÓRIA - TODA RESPOSTA

Em TODA resposta, SEMPRE inclua ao final um JSON mínimo indicando o fluxo atual:

{"fluxo_atual": "FLUXO_X"}

Onde FLUXO_X deve ser:
- "DUVIDA" → para fluxo 1 (dúvidas sobre a igreja)
- "ORACAO" → para fluxo 2 (pedido de oração)
- "TESTEMUNHO" → para fluxo 3 (testemunho)
- "PASTORAL" → para fluxo 4 (falar com pastor)
- "INSCRICAO" → para fluxo 5 (inscrição em evento)
- "FALLBACK" → quando ainda não identificou a intenção

Exemplos:

Durante coleta de dados (oração):
"Pode me contar mais sobre seu pedido?"
{"fluxo_atual": "ORACAO"}

Durante coleta de dados (testemunho):
"Que alegria! Pode nos contar seu testemunho?"
{"fluxo_atual": "TESTEMUNHO"}

Ao concluir (adicione os campos completos conforme definido):
"Vamos orar por você com carinho. 🙏"
{"concluido": true, "intencao": "PEDIDO_ORACAO", "fluxo_atual": "ORACAO", ...}
```

### 2. Modificar Regras Existentes no Prompt

Alterar as regras atuais que dizem "Gere JSON somente ao final" para:

**Antes:**
> "Nunca gere JSON fora dos fluxos 2, 3, 4 ou 5."
> "Gere o JSON somente ao final"

**Depois:**
> "Sempre gere `{"fluxo_atual": "X"}` em TODA resposta."
> "Gere o JSON COMPLETO (com concluido: true) somente ao final"

---

## Fluxo Corrigido

```text
1. Usuário: "Preciso de uma oração pela minha família"
2. IA: "Claro! Pode me contar mais?"
        {"fluxo_atual": "ORACAO"}     ◄── IA INFORMA
3. extractJsonAndText() captura o JSON
4. pickFlowFromParsed() retorna "ORACAO"
5. sessaoMetaNovo = { ...meta, flow: "ORACAO" }
6. Salva no banco: meta_dados.flow = "ORACAO" ✓

PRÓXIMA MENSAGEM:
7. Usuário: "Compartilhe com a equipe de intercessão"
8. Código carrega sessão: meta.flow = "ORACAO" ✓
9. Se houver detecção de keyword: !meta.flow = false → IGNORA
10. Continua no fluxo de oração ✓
```

---

## Prompt Atualizado (Completo)

O prompt deve ser atualizado para incluir a nova seção no início e ajustar as regras existentes.

**Nova seção a adicionar (após "⛔ REGRAS CRÍTICAS"):**

```
📌 REGRA DE FLUXO (OBRIGATÓRIO EM TODA RESPOSTA)

SEMPRE inclua ao final de cada resposta um JSON mínimo:
{"fluxo_atual": "X"}

Valores possíveis:
• "DUVIDA" - Pergunta sobre a igreja (FAQ)
• "ORACAO" - Pedido de oração
• "TESTEMUNHO" - Compartilhando testemunho
• "PASTORAL" - Quer falar com pastor
• "INSCRICAO" - Interesse em evento
• "FALLBACK" - Não identificou ainda

Isso é SEPARADO do JSON final. Sempre envie.
```

**Regra a ajustar:**
- Remover: "Nunca gere JSON fora dos fluxos 2, 3, 4 ou 5"
- Adicionar: "O JSON de `fluxo_atual` é obrigatório em TODA resposta. O JSON completo (com `concluido: true`) só ao finalizar."

---

## Resumo das Alterações

| Local | Alteração |
|-------|-----------|
| Banco: `chatbot_configs.role_texto` | Adicionar regra obrigatória de `fluxo_atual` |
| Banco: `chatbot_configs.role_texto` | Remover/ajustar "nunca gere JSON fora dos fluxos" |

---

## Por que isso funciona?

1. **O código já está pronto**: `pickFlowFromParsed()` já procura por `fluxo_atual`
2. **A IA sabe exatamente o fluxo**: Ela não vai confundir "bênção" (oração) com "bênção" (testemunho)
3. **Proteção contra keywords**: Uma vez que `meta.flow` existe, keywords são ignoradas
4. **Zero alteração no código da edge function**: Só precisa atualizar o prompt no banco

---

## Testes Após Implementação

1. **Oração**: Enviar "Preciso de oração" → IA responde com `{"fluxo_atual": "ORACAO"}`
2. **Proteção**: Continuar com "Compartilhe com os irmãos" → Deve continuar no fluxo de oração
3. **Testemunho**: Enviar "Tenho um testemunho" → IA responde com `{"fluxo_atual": "TESTEMUNHO"}`
4. **Fallback**: Enviar "oi" → IA responde com `{"fluxo_atual": "FALLBACK"}`
5. **Verificar banco**: `SELECT meta_dados FROM atendimentos_bot` → Deve mostrar `flow` correto

---

## SQL para Atualização

```sql
UPDATE chatbot_configs 
SET role_texto = '...[prompt atualizado]...'
WHERE id = '00d1b26f-ed8b-4fb3-a588-b47ab149a48d';
```

