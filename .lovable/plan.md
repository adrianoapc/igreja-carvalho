
# Cron de Lembrete de Evento para Inscritos

## Situacao Atual

- A edge function `inscricoes-lembretes` ja existe mas trata apenas de **cobranca de pagamento pendente** (lembrete + cancelamento automatico).
- Nao ha nenhum lembrete do tipo **"seu evento e amanha!"** para inscritos confirmados.
- A function nao esta registrada no `config.toml`.
- Nao ha cron agendado no banco para nenhuma das duas funcoes.

## O Que Sera Feito

### 1. Nova Edge Function: `inscricoes-lembrete-evento`

Funcao dedicada que:
- Busca eventos que acontecerao nas proximas **24 a 48 horas**
- Filtra inscricoes com `status_pagamento = 'confirmado'` (ou eventos sem pagamento obrigatorio)
- Envia lembrete via `disparar-alerta` (WhatsApp + in-app) com dados do evento (titulo, data, local)
- Anti-spam: so envia se `lembrete_evento_em` for NULL (campo novo na tabela `inscricoes_eventos`)
- Atualiza `lembrete_evento_em` apos envio bem-sucedido
- Registra execucao via `log_edge_function_execution`

### 2. Migracao no Banco

- Adicionar coluna `lembrete_evento_em TIMESTAMPTZ` na tabela `inscricoes_eventos` (default NULL)
- Esse campo controla o anti-spam: se ja tem valor, nao reenvia

### 3. Registrar no config.toml

Adicionar:
```text
[functions.inscricoes-lembrete-evento]
verify_jwt = false
```

### 4. Agendar Cron Job

SQL para agendar execucao diaria as 9h (horario de Brasilia = 12h UTC):
```text
SELECT cron.schedule(
  'lembrete-diario-inscricoes-evento',
  '0 12 * * *',
  $$ SELECT net.http_post(...) $$
);
```

### 5. Registrar na documentacao

Atualizar `docs/automacoes/crons.md` com a descricao do novo cron.

---

## Logica da Mensagem

Exemplo de mensagem enviada:
> "Lembrete: o evento **Conferencia de Jovens** acontece amanha, dia 28/02 as 19h, no Templo Central. Nos vemos la!"

Os dados vem das tabelas `eventos` (titulo, data_inicio, local) e `profiles` (nome, telefone).

## Fluxo Resumido

```text
pg_cron (diario 9h BRT)
  -> HTTP POST inscricoes-lembrete-evento
    -> Busca eventos com data_inicio entre 24h e 48h no futuro
    -> Filtra inscricoes confirmadas (ou sem pagamento obrigatorio)
    -> Para cada inscrito com lembrete_evento_em = NULL:
       -> Chama disparar-alerta (WhatsApp + in-app)
       -> Atualiza lembrete_evento_em
    -> Loga execucao
```

## Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/inscricoes-lembrete-evento/index.ts` | Criar |
| `supabase/config.toml` | Adicionar entrada da function |
| `docs/automacoes/crons.md` | Documentar o cron |
| Migracao SQL | Adicionar coluna `lembrete_evento_em` |
| SQL (insert tool) | Agendar cron job com pg_cron |
