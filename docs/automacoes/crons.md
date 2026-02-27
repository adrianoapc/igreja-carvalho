# Cron Jobs - Automações Agendadas

## 1. `inscricoes-lembretes` (Cobrança de Pagamento)

- **Frequência:** A cada 15 minutos (`*/15 * * * *`)
- **Função:** Envia lembrete de pagamento para inscrições pendentes (12h) e cancela automaticamente após 24h sem pagamento.
- **Tabela:** `inscricoes_eventos` (campos `lembrete_pagamento_em`, `cancelado_em`)

## 2. `inscricoes-lembrete-evento` (Lembrete de Evento)

- **Frequência:** Diário às 9h BRT / 12h UTC (`0 12 * * *`)
- **Função:** Envia lembrete "seu evento é amanhã!" para inscritos confirmados em eventos que acontecem nas próximas 24-48h.
- **Anti-spam:** Coluna `lembrete_evento_em` na tabela `inscricoes_eventos` — só envia uma vez por inscrição.
- **Canal:** WhatsApp + In-App via `disparar-alerta`
- **Mensagem exemplo:** _"Lembrete: o evento Conferência de Jovens acontece amanhã, dia 28/02 às 19h, no Templo Central. Nos vemos lá!"_
