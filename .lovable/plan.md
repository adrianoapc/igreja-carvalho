
# Plano — SFTP reutilizando secrets + Conexão Getnet

## Passo 1 — Reaproveitar campos criptografados para SFTP

### Mapeamento acordado
Sem novas colunas em `integracoes_financeiras_secrets`. Os mesmos 3 campos já criptografados servem para token OU sftp, conforme `tipo_auth`:

| Campo secret (criptografado) | tipo_auth = token | tipo_auth = sftp |
|---|---|---|
| `client_id` | Client ID | **Username** |
| `client_secret` | Client Secret | **Password** |
| `application_key` | Application Key (Getnet) | **Host** (ex: `sftp.getnet.com.br`) |
| `pix_client_id` / `pix_client_secret` | PIX creds | (não usado) |
| `pfx_blob` / `pfx_password` | mTLS | (não usado) |

Dados **não-sensíveis** do SFTP vão em `integracoes_financeiras.config` (JSONB):
```json
{ "sftp": { "port": 22, "path": "/extratos/" } }
```

### Rollback da migration anterior
Dropar as colunas `sftp_host`, `sftp_port`, `sftp_username`, `sftp_password`, `sftp_path` em `integracoes_financeiras_secrets` (adicionadas na última migration). A coluna `tipo_auth` em `integracoes_financeiras` **fica** — é ela que diferencia o uso dos campos.

### Edge function `integracoes-config`
- Remover do payload e da lógica os campos `sftp_*`.
- Quando `tipo_auth = 'sftp'`, aceitar `sftp_username`/`sftp_password`/`sftp_host` do frontend e gravá-los respectivamente em `client_id` / `client_secret` / `application_key` (mesma rotina `encryptData`).
- `port` e `path` entram em `config.sftp` (texto puro, não passam por encrypt).

### UI `IntegracoesCriarDialog.tsx`
- Mantém o seletor "Tipo de Integração" (token/sftp), travado em token para Santander.
- Quando `sftp`: renderiza **Host / Port / Username / Password / Path** com labels claras. Internamente o submit monta o payload mapeando para `application_key`/`client_id`/`client_secret` + `config.sftp.{port,path}`.
- Quando `token`: renderiza como hoje (client_id, client_secret, application_key, PIX, PFX).

## Passo 2 — Edge function `getnet-sftp` (conexão + listagem)

### Escopo deste entregável
Conectar no SFTP da Getnet usando as credenciais decriptadas e **listar arquivos** do diretório configurado. Sem download/parsing ainda.

### Estrutura
- Arquivo: `supabase/functions/getnet-sftp/index.ts`
- Actions:
  - `test_connection` → conecta, lista raiz/path, fecha. Retorna `{ success, files_count }`.
  - `list_files` → conecta, lista `config.sftp.path`, retorna `{ files: [{ name, size, modified }] }`.
- Lib SFTP em Deno: `npm:ssh2-sftp-client@10` (roda em Deno via npm specifier).
- Validação JWT (admin/tesoureiro) + decrypt das secrets (mesma rotina secretbox do `integracoes-config`, extraída/duplicada).
- Retorna `200` com `success:false` em erro de negócio (padrão do projeto), `5xx` só em falha de infra.

### UI
Botão **"Testar"** na linha da integração (tabela em `/financas/integracoes`) já existe para Santander; estender para chamar `getnet-sftp` quando `provedor='getnet' && tipo_auth='sftp'`, mostrando contagem de arquivos no toast.

## Ordem de execução
1. Migration: DROP das colunas `sftp_*` em `integracoes_financeiras_secrets`.
2. Refactor `integracoes-config/index.ts` (remove sftp_*, mapeia para client_id/secret/application_key + config.sftp).
3. Refactor `IntegracoesCriarDialog.tsx` (UI mantém labels SFTP, submit mapeia).
4. Nova edge function `getnet-sftp` com `test_connection` + `list_files`.
5. Wire do botão Testar na tela de Integrações para Getnet/SFTP.

## Detalhes técnicos
- `tipo_auth` continua governando renderização da UI e validação no backend.
- Sem migração de dados (não há registros SFTP em produção ainda — Getnet atual está em `token`).
- Decrypt utility será movido para arquivo compartilhado? Não — duplicar inline no `getnet-sftp` é mais simples e isola dependências (padrão atual do projeto com `santander-api`).
