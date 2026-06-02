
# Plano — Importação Getnet SFTP + Auditoria

## 1. Tabela de auditoria `integracoes_execucoes_log`

Migration nova. Uma linha por execução (teste de conexão, listagem, download, import).

Campos:
- `id uuid pk`
- `integracao_id uuid` (FK → `integracoes_financeiras`, on delete cascade)
- `igreja_id uuid` / `filial_id uuid` (para RLS multi-tenant)
- `provedor text` (`getnet`, futuro `santander`, etc.)
- `acao text` (`test_connection` | `list_files` | `download_file` | `import_extrato`)
- `status text` (`success` | `error` | `partial`)
- `iniciado_em timestamptz default now()`
- `finalizado_em timestamptz`
- `duracao_ms int`
- `arquivo_nome text` (quando aplicável)
- `arquivo_tamanho bigint`
- `arquivo_modified_at timestamptz`
- `total_recebido int`, `total_inserido int`, `total_ignorado int` (dedupe)
- `erro_mensagem text`, `erro_stack text`
- `metadata jsonb` (host conectado, path, request_id, contadores extras)
- `created_by uuid` (user que disparou, null se cron)

GRANT + RLS: `authenticated` SELECT/INSERT só dentro da própria igreja (via `has_role` admin/tesoureiro + `igreja_id = get_current_user_igreja_id()`); `service_role` ALL (edge functions). Index em `(integracao_id, iniciado_em DESC)` e `(igreja_id, status, iniciado_em DESC)`.

## 2. Refactor `getnet-sftp` para logar tudo

Em todo handler (`test_connection`, `list_files`, e nova ação `import_extrato`):
- Cria registro `iniciado_em = now()` no início.
- Atualiza no fim com `status`, `finalizado_em`, `duracao_ms`, métricas e `erro_mensagem` (em caso de exceção, inclusive falhas de conexão/decrypt).
- Usa `service_role` para escrever no log (independente de RLS do usuário).
- Mantém retorno `200 { success: false, error }` em falha de negócio (padrão do projeto), `5xx` só em panic.

## 3. Nova ação `import_extrato` em `getnet-sftp`

Fluxo:
1. Conecta no SFTP com credenciais decriptadas (mesma rotina já existente).
2. Lista `config.sftp.path`.
3. Filtra por extensão configurável (`config.sftp.file_pattern`, default `*.csv`) e tipo arquivo (`-`).
4. Ordena por `modifyTime DESC` e pega o **mais recente** (parâmetro opcional `arquivo_nome` no payload permite forçar um específico, útil para reprocesso).
5. Baixa em memória via `sftp.get(remotePath)` (Buffer).
6. Parser: ler como **CSV** (delimitador `;` ou `,` autodetect), header na primeira linha. Mapeamento mínimo Getnet (settlement padrão):
   - `data_transacao` ← `Data de Venda` / `data_venda`
   - `descricao` ← `Bandeira` + `NSU` (`"VISA - NSU 12345"`)
   - `valor` ← `Valor Bruto` (crédito) ou `-Taxa` separado (ver abaixo)
   - `numero_documento` ← `NSU` / `Código de Autorização`
   - `tipo`: positivo = `credito`, negativo = `debito`
   - `external_id` ← `NSU` + `data_transacao` (chave dedupe natural da Getnet)
   - `conta_id`, `igreja_id`, `filial_id` ← vêm de `integracoes_financeiras` (precisa ter `conta_id` configurado; validar antes).
7. Dedupe via constraint única `(conta_id, external_id)` — usar `.upsert({ onConflict: 'conta_id,external_id', ignoreDuplicates: true })` para permitir reprocesso seguro.
8. Insere em `extratos_bancarios` com `origem='getnet_sftp'`, `reconciliado=false`.
9. Fecha conexão SFTP em `finally`.
10. Atualiza log com totais e retorna `{ success, arquivo, total_recebido, total_inserido, total_ignorado }`.

**Observação sobre formato:** o layout exato do CSV Getnet varia (settlement vs. transações). Vou implementar parser configurável via `config.sftp.layout = 'settlement_v1' | 'transacoes_v1'` com mapeamento default `settlement_v1`. Layouts adicionais podem ser plugados depois sem mudar a infra.

## 4. UI — Tela de Integrações

Adicionar dois elementos na linha da integração Getnet/SFTP em `src/pages/financas/Integracoes.tsx`:
- Botão **"Importar agora"** (chama `getnet-sftp` com `action=import_extrato`, mostra toast com contagens).
- Botão **"Histórico"** abrindo um Dialog (`IntegracaoLogsDialog.tsx`, novo) que lista as últimas 50 execuções da tabela de auditoria com: data/hora, ação, status (badge colorido), arquivo, contadores e mensagem de erro expansível. Filtro por status. Sem modal gigante — usar layout 2-col + scroll interno conforme regra de memória (`modal-sizing`).

## 5. Automação (opcional, fora deste passo)

Não criar cron agora. Deixar pronto para futura agendamento via `pg_cron` chamando `getnet-sftp` com `action=import_extrato` por integração ativa — citado nas notas de implementação, não executado.

## Ordem de execução

1. Migration: criar `integracoes_execucoes_log` + GRANT + RLS + índices.
2. Refactor `supabase/functions/getnet-sftp/index.ts`: helper `logExecucao(start/finish)` + nova ação `import_extrato` com parser CSV settlement.
3. Frontend: `IntegracoesCriarDialog.tsx` adiciona campos `file_pattern` e `layout` em `config.sftp` quando `tipo_auth=sftp`.
4. Frontend: `Integracoes.tsx` ganha botões "Importar agora" + "Histórico".
5. Frontend: novo `IntegracaoLogsDialog.tsx` (sm:max-w-3xl, sticky header/footer, scroll interno).

## Detalhes técnicos

- Logging usa `supabaseAdmin` (service_role) sempre, evita falha de RLS mascarar erro.
- Toda exceção dentro do handler é capturada e gravada no log antes de responder.
- Parser CSV: usar `npm:papaparse@5` (já roda em Deno). Sem dependências extras.
- Datas no CSV Getnet são `DD/MM/YYYY` BRT — converter para ISO antes de gravar.
- Valores `R$ 1.234,56` → normalizar removendo `R$`, `.` e trocando `,` por `.`.
- Não criar staging table; dedupe direto via `external_id` (Getnet garante NSU único por adquirência).
- Sem migração de dados.
