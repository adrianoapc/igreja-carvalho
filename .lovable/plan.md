
# Corrigir Formato da Mensagem no WhatsApp

## Problema
Na linha 691-692 do `disparar-alerta/index.ts`, a mensagem e construida assim:
```typescript
const mensagem = formatarTemplate(
  `Evento: ${eventoCfg?.nome || evento}. ${JSON.stringify(dados)}`,
  dados
);
```

Isso gera o texto feio com JSON inteiro: `Evento: Lembrete de Evento (Inscricao). {"nome":"Teste","evento_titulo":"Compartilhe",...}`

## Solucao
Quando `dados.mensagem` existir (como no caso dos lembretes de evento), usar diretamente esse campo. Caso contrario, manter um fallback legivel.

### Alteracao em `supabase/functions/disparar-alerta/index.ts` (linhas 689-694)

**Antes:**
```typescript
const titulo = eventoCfg?.nome || evento;
const mensagem = formatarTemplate(
  `Evento: ${eventoCfg?.nome || evento}. ${JSON.stringify(dados)}`,
  dados
);
```

**Depois:**
```typescript
const titulo = eventoCfg?.nome || evento;
const mensagemBase = typeof dados.mensagem === "string"
  ? dados.mensagem
  : `Evento: ${eventoCfg?.nome || evento}. ${JSON.stringify(dados)}`;
const mensagem = formatarTemplate(mensagemBase, dados);
```

## Resultado
- Quando `dados.mensagem` estiver preenchido (lembretes, alertas com mensagem customizada): envia texto limpo como `Lembrete: o evento "Compartilhe" acontece hoje, dia 28/02 as 16:00, na Igreja Carvalho. Nos vemos la!`
- Quando nao houver `dados.mensagem`: mantém o comportamento atual como fallback
