

# Corrigir Formatacao do Telefone para WhatsApp nos Lembretes

## Problema Identificado
O telefone do inscrito esta sendo enviado no formato do banco de dados (apenas DDD + numero, ex: `3496322958`) em vez do formato exigido pelo WhatsApp (com codigo do pais, ex: `553496322958`).

Na funcao `dispararWhatsAppMultiTenant` (linha 228 de `disparar-alerta/index.ts`), o campo `telefone` e passado diretamente ao payload sem passar pelo utilitario `formatarParaWhatsApp`, que ja esta importado no arquivo mas nao esta sendo utilizado nesta funcao.

## Alteracao

### `supabase/functions/disparar-alerta/index.ts`
Na funcao `dispararWhatsAppMultiTenant`, aplicar `formatarParaWhatsApp(telefone)` antes de montar o payload. Isso garante que o numero enviado ao Make tenha o prefixo `55` do Brasil.

**Antes (linha 227-228):**
```typescript
const payload = {
  telefone,
```

**Depois:**
```typescript
const telefoneWhatsApp = formatarParaWhatsApp(telefone) || telefone;
const payload = {
  telefone: telefoneWhatsApp,
```

A mesma formatacao sera aplicada nas rotas Meta Cloud API e Evolution (linhas 269 e ~300+), onde o `telefone` tambem e usado diretamente.

## Resultado
O numero enviado ao Make passara de `3496322958` para `553496322958`, permitindo que o WhatsApp identifique corretamente o destinatario.
