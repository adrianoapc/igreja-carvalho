

# Botao "Enviar Lembrete" na Tela de Inscricoes

## O Que Sera Feito

Adicionar um botao **"Enviar Lembrete"** ao lado do botao "Adicionar Inscrito" no header da lista de inscritos. Ao clicar, ele chama a edge function `inscricoes-lembrete-evento` ja criada, que envia notificacao (WhatsApp + in-app) para todos os inscritos confirmados que ainda nao receberam lembrete.

## Comportamento

- Botao com icone de sino (Bell) no header, ao lado de "Adicionar Inscrito"
- Ao clicar, exibe confirmacao: "Enviar lembrete para X inscritos?"
- Chama a edge function passando o `evento_id` especifico (ao inves de buscar por janela de 24-48h)
- Mostra toast com resultado: "Y lembretes enviados"
- Botao fica desabilitado durante o envio (loading spinner)

## Alteracoes

### 1. Edge Function `inscricoes-lembrete-evento`
Ajustar para aceitar um parametro opcional `evento_id` no body. Quando presente, busca apenas esse evento (ignorando a janela de 24-48h). Quando ausente, mantem o comportamento atual do cron.

### 2. Componente `InscricoesTabContent.tsx`
- Adicionar botao "Enviar Lembrete" no header
- Funcao `handleEnviarLembrete` que invoca a edge function via `supabase.functions.invoke`
- Estado de loading para o botao
- Toast com feedback do resultado

### 3. Filtro de status
A function ja filtra por `status_pagamento = 'confirmado'` quando o evento requer pagamento. Para eventos gratuitos, envia para todos. Tambem respeita o anti-spam (`lembrete_evento_em IS NULL`).

## Fluxo

```text
Admin clica "Enviar Lembrete"
  -> Confirmacao: "Enviar para X inscritos?"
  -> POST inscricoes-lembrete-evento { evento_id: "..." }
  -> Function busca inscricoes do evento sem lembrete enviado
  -> Dispara alertas via disparar-alerta (fluxo padrao)
  -> Retorna contagem
  -> Toast: "5 lembretes enviados!"
```

