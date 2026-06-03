
# Plano — Getnet Extrato Eletrônico TXT (v10.1) posicional

Fluxo em **duas fases**: (1) baixar todos os arquivos do dia para o bucket, (2) processar um a um a partir do bucket. Cada arquivo gera seu próprio log com status independente.

## 1. Migration — tabelas + bucket

### 1.1 `public.getnet_resumo` (linha tipo "1")
`id`, `integracao_id` (fk), `igreja_id`, `filial_id`, `arquivo_nome`, `codigo_produto`, `forma_captura`, `rv`, `data_rv date`, `valor_bruto numeric(14,2)`, `valor_liquido numeric(14,2)` (já com sinal aplicado), `sinal char(1)`, `raw_line`, `created_at`, `updated_at`. Unique `(integracao_id, rv, data_rv)`.

### 1.2 `public.getnet_analitico` (linha tipo "2")
`id`, `integracao_id` (fk), `igreja_id`, `filial_id`, `arquivo_nome`, `rv`, `nsu_cv`, `cartao_truncado`, `valor_transacao numeric(14,2)`, `codigo_autorizacao`, `forma_captura`, `status`, `raw_line`, `created_at`, `updated_at`. Unique `(integracao_id, rv, nsu_cv)`.

GRANT padrão (authenticated CRUD + service_role ALL). RLS via `has_role + get_current_user_igreja_id()`. Índices `(integracao_id, data_rv DESC)` e `(integracao_id, rv)`.

### 1.3 Bucket `getnet_raw_files` (privado)
Path: `{igreja_id}/{integracao_id}/{YYYY-MM-DD}/{arquivo_nome}`. Policies em `storage.objects`: leitura/escrita só `service_role`; admins/tesoureiros leem se path começa com seu `igreja_id`.

## 2. Refactor `supabase/functions/getnet-sftp/index.ts`

Novo layout `config.sftp.layout = 'extrato_eletronico_v10'` (preserva `settlement_v1`). `import_extrato` despacha para parser correto.

### 2.1 FASE 1 — Download de todos os arquivos
1. Conecta SFTP (try/finally garante `sftp.end()`).
2. Lista `config.sftp.path`.
3. Filtra por regex configurável (`config.sftp.file_pattern_regex`, default `^EEVD?_\d+_(\d{2})(\d{2})(\d{4})\.txt$`, case-insensitive) e por data DDMMAAAA = data alvo (`payload.data_referencia` ou hoje BRT).
4. Cria 1 log "mestre" em `integracoes_execucoes_log` com `acao='import_extrato'`, `status='running'`, `metadata={ fase:'download', layout, data_referencia, arquivos_encontrados:N }`.
5. Para cada arquivo da lista:
   - `sftp.get(remotePath)` → Buffer.
   - Upload para `getnet_raw_files` no path `{igreja_id}/{integracao_id}/{data_ref}/{nome}` (`upsert: true`).
   - Coleta `{ nome, storage_path, tamanho, modified_at, status:'baixado' }` em `arquivos[]`.
   - Falha de download: registra `{ nome, status:'erro_download', erro }` e continua.
6. Fecha SFTP. Se nenhum arquivo baixado com sucesso → finaliza log mestre com `status='error'` e retorna.

### 2.2 FASE 2 — Processamento por arquivo (a partir do bucket)
Para cada item `arquivo` em `arquivos[]` com `status='baixado'`:

1. Cria **log filho** em `integracoes_execucoes_log`: `acao='import_extrato_arquivo'`, `status='running'`, `arquivo_nome`, `arquivo_tamanho`, `arquivo_modified_at`, `metadata={ parent_log_id, storage_path }`.
2. Try/catch isolado:
   - Baixa do bucket (`storage.from('getnet_raw_files').download(path)`).
   - Decodifica com `TextDecoder('latin1')`.
   - Split por `\r?\n`, descarta vazias e linhas iniciadas em `0`/`9`.
   - Para cada linha: valida `length >= 400` (linhas inválidas vão para `linhas_invalidas`, não derrubam o arquivo).
   - Despacha por `line[0]`:

     **Tipo `1` — Resumo Transacional** (helpers: `f(l,ini,fim)=l.slice(ini-1,fim).trim()`, `money(s)=Number(s)/100`, `date(s)=${s.slice(4,8)}-${s.slice(2,4)}-${s.slice(0,2)}`)
     - `codigo_produto` ← f(17,18)
     - `forma_captura` ← f(19,21)
     - `rv` ← f(22,30)
     - `data_rv` ← date(f(31,38))
     - `valor_bruto` ← money(f(85,96))
     - `valor_liquido_abs` ← money(f(97,108))
     - `sinal` ← f(286,286)
     - `valor_liquido` ← `sinal === '-' ? -valor_liquido_abs : +valor_liquido_abs`

     **Tipo `2` — Analítico Transacional**
     - `rv` ← f(17,25)
     - `nsu_cv` ← f(26,37)
     - `cartao_truncado` ← f(52,70)
     - `valor_transacao` ← money(f(71,82))
     - `codigo_autorizacao` ← f(131,140)
     - `forma_captura` ← f(141,143)
     - `status` ← f(144,144)

   - Upsert em chunks de 500:
     - `getnet_resumo` → `onConflict:'integracao_id,rv,data_rv', ignoreDuplicates:true`
     - `getnet_analitico` → `onConflict:'integracao_id,rv,nsu_cv', ignoreDuplicates:true`
   - Espelha cada RV em `extratos_bancarios` (1 linha por resumo) — se `config.sftp.conta_id` setado:
     - `data_transacao=data_rv`, `descricao='Getnet RV '+rv`, `valor=valor_bruto`, `valor_liquido=valor_liquido`, `tipo` por sinal, `external_id='getnet_rv:'+rv+':'+data_rv`, `origem='getnet_sftp_txt'`, `reconciliado=false`. Upsert `onConflict:'conta_id,external_id'`.
   - Finaliza log filho: `status='success'`, `total_recebido` (1+2), `total_inserido`, `total_ignorado`, `metadata.{resumos,analiticos,linhas_invalidas}`.
3. Catch: finaliza log filho com `status='error'`, `erro_mensagem`, `erro_stack`, `metadata.linha_atual` (índice da linha sendo processada, se aplicável). Continua para o próximo arquivo.

### 2.3 Finalização (log mestre)
Atualiza log mestre com:
- `status` = `success` (todos ok), `partial` (mistos) ou `error` (todos falharam).
- `metadata.arquivos` = array `[{ nome, storage_path, status, log_id, erro?, totais? }, ...]`.
- Totais agregados (`total_recebido`, `total_inserido`, `total_ignorado`).

### 2.4 Resposta
`200 { success, status, data_referencia, arquivos_baixados, arquivos_processados, arquivos_com_erro, totais, parent_log_id }`. Erros de negócio (sem `conta_id`, conexão SFTP) sempre retornam `200` com `success:false`.

## 3. Frontend mínimo

- `IntegracoesCriarDialog.tsx`: adiciona `'extrato_eletronico_v10'` no select de **Layout** SFTP.
- `IntegracaoLogsDialog.tsx`: ajusta para distinguir `acao='import_extrato'` (mestre) e `acao='import_extrato_arquivo'` (filho), exibindo `arquivo_nome` quando presente. Sem novos botões — `Importar agora` + `Histórico` já existem.

## 4. Detalhes técnicos

- Sem nova dependência (`ssh2-sftp-client` já está no projeto).
- Idempotência: reprocessar mesmo dia não duplica (unique + `ignoreDuplicates`); arquivos no bucket são sobrescritos (`upsert:true`).
- "Hoje" calculado em `America/Sao_Paulo`.
- `raw_line` armazenada para auditoria.
- Logs filhos permitem reprocesso seletivo futuro (basta ler o `storage_path` do log com erro).

## 5. Ordem de execução

1. Migration: `getnet_resumo` + `getnet_analitico` + índices + GRANT + RLS + policies.
2. Bucket `getnet_raw_files` (privado) + policies em `storage.objects`.
3. Refator `getnet-sftp/index.ts`: fase 1 (download em massa) + fase 2 (processamento por arquivo) + espelho em `extratos_bancarios` + logs mestre/filho.
4. Frontend: opção de layout no dialog + ajuste de exibição no dialog de logs.
5. Teste: "Importar agora" → conferir log mestre + filhos + tabelas + extratos_bancarios.

## 6. Fora de escopo

- Cron diário.
- Telas dedicadas de visualização.
- Backfill (manual via `payload.data_referencia`).
- Reprocesso seletivo via UI (infra de log já preparada, UI fica para depois).
