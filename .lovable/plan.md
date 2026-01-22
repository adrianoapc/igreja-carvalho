
# Plano: Padronizar Campo de Mensagem no chatbot-triagem

## Problema Identificado

O Make.com envia este payload:
```json
{
  "tipo": "text",
  "mensagem": "compartilhe",       // ← Campo que o Make envia
  "telefone": "5517988216456",
  "whatsapp_number": "5517996559063",
  ...
}
```

Mas o `chatbot-triagem` espera:
```typescript
interface RequestBody {
  conteudo_texto?: string;  // ← Campo que a função espera
}
```

As outras funções (`chatbot-financeiro` e `inscricao-compartilhe`) já foram corrigidas e aceitam múltiplos nomes de campo (`mensagem`, `text`, `message`, etc.), mas o `chatbot-triagem` ficou para trás.

## Solução Proposta

Atualizar a edge function `chatbot-triagem` para aceitar os mesmos campos de mensagem que as outras funções, garantindo retrocompatibilidade com qualquer código existente.

## Alterações Técnicas

### 1. Atualizar Interface RequestBody

Adicionar campos alternativos na interface:

```typescript
interface RequestBody {
  telefone: string;
  nome_perfil: string;
  tipo_mensagem?: "text" | "audio" | "image";
  
  // Campos de texto (múltiplos nomes aceitos)
  conteudo_texto?: string;
  mensagem?: string;
  text?: string;
  message?: string;
  
  // Campo whatsapp_number para roteamento
  whatsapp_number?: string;
  display_phone_number?: string;
  
  media_id?: string;
}
```

### 2. Extrair Texto com Fallback

Onde o código usa `body.conteudo_texto`, alterar para:

```typescript
const textoMensagem = 
  body.mensagem ??
  body.conteudo_texto ??
  body.text ??
  body.message ??
  body?.messages?.[0]?.text?.body ??
  "";
```

### 3. Adicionar Log de Debug

Adicionar log ao receber a mensagem para facilitar debug futuro:

```typescript
console.log(`[Triagem] Payload recebido - campos: ${Object.keys(body).join(', ')}`);
console.log(`[Triagem] Texto extraído: "${textoMensagem.slice(0, 50)}..."`);
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chatbot-triagem/index.ts` | Atualizar interface e extração de mensagem |

## Validação

Após deploy, testar enviando o mesmo payload do Make.com e verificar:
1. Log mostra o texto "compartilhe" extraído corretamente
2. IA identifica intenção `INSCRICAO_EVENTO`
3. Fluxo de delegação para `inscricao-compartilhe` é acionado
