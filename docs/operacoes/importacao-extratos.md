# Guia Operacional - Importacao de Extratos Bancarios (Arquivo e API)

Escopo: orientar como importar extratos bancarios via arquivo (CSV/XLSX/OFX) e via API (Santander e Getnet), garantindo consistencia no armazenamento em `extratos_bancarios` e preparando terreno para conciliacao automatizada.

## 1. Formatos Suportados (Arquivo)

- CSV/XLSX: colunas auto-detectadas (data, descricao, valor, saldo, numero_documento, tipo)
- OFX: parseado via `ofx-js` (campos `DTPOSTED`, `TRNAMT`, `MEMO/NAME`, `FITID/CHECKNUM`, `TRNTYPE`)
- Limite de tamanho: 10MB por arquivo (atual wizard)
- Tipos obrigatorios: data, descricao, valor (>= 0.01)

## 2. Mapeamento para `extratos_bancarios`

- `conta_id`: conta selecionada na UI ou contexto do conector API
- `igreja_id` / `filial_id`: do contexto `useFilialId` (arquivo) ou do tenant configurado no conector
- `data_transacao`: normalizar para YYYY-MM-DD
- `descricao`: texto do historico/memo
- `valor`: numerico (positivo = credito, negativo = debito); inferencia se sinal ausente
- `saldo` (opcional): saldo corrente informado pelo banco
- `numero_documento`: FITID / reference / NSU / auth code (quando existir)
- `tipo`: `credito` ou `debito` (inferir por sinal ou TRNTYPE)
- `reconciliado`: default FALSE

## 3. Idempotencia e Dedupe

- Chave sugerida: `conta_id + data_transacao + valor + coalesce(numero_documento, descricao)`
- OFX: preferir `FITID` como chave unica
- API: se houver `transactionId`/`nsu`, usar como `numero_documento` e na chave
- Politica: ao reprocessar, ignorar duplicados (upsert ou filtro antes do insert)

## 4. Fluxo - Upload Manual (Arquivo)

1. Selecionar conta destino
2. Fazer upload (CSV/XLSX/OFX)
3. Auto-mapeamento + ajuste manual (se preciso)
4. Validacao: data valida, descricao preenchida, valor != 0
5. Preview virtualizado e opcao de excluir linhas com erro
6. Importacao em chunks de 200 registros
7. Registros salvos em `extratos_bancarios` com `reconciliado = FALSE`

## 5. Fluxo - API Santander (a confirmar com specs)
### 5.1 Afericao (hipoteses a validar)
- **mTLS + JWT/OAuth2**: o banco exige certificado cliente (PFX) e emissao de JWT via fluxo `client_credentials` (ou `client_assertion`) para acessar extratos. (a confirmar)
- **Endpoints Santander (Postman)**:
  - **Lista de contas**: `GET /bank_account_information/v1/banks/{bankId}/accounts?_offset=1&_limit=50`
  - **Saldo**: `GET /bank_account_information/v1/banks/{bankId}/balances/{agencia}.{conta}`
  - **Extrato**: `GET /bank_account_information/v1/banks/{bankId}/statements/{agencia}.{conta}?_offset=1&_limit=50&initialDate=YYYY-MM-DD&finalDate=YYYY-MM-DD`
- **Paginacao**: `_offset` e `_limit` (conforme collection).
- **Campos**: response inclui `transactionId`/`fitId`, `postingDate`, `amount`, `description`, `balance` (a confirmar).

### 5.2 Armazenamento seguro do certificado `.pfx`
- **Opcao preferencial**: armazenar o `.pfx` em **Supabase Vault/Secrets** como Base64 (`SANTANDER_PFX_B64`) + senha (`SANTANDER_PFX_PASSWORD`). (a confirmar suporte do ambiente)
- **Alternativa**: bucket privado no Supabase Storage com acesso por service role, e a senha no Vault/Secrets.
- **Nunca** persistir o `.pfx` em tabela Postgres ou no repo.
- **Rotacao**: registrar data de expiracao no metadata do conector para alertas (ex.: 30 dias antes).

### 5.3 Como o `.pfx` sera utilizado
- Edge Function (ou worker externo) decodifica o Base64 em memoria, converte para PEM (cert + key) em runtime.
- Configurar cliente HTTP com mTLS usando os artefatos PEM apenas em memoria (sem gravar em disco).
- **Scope**: cada igreja/filial aponta para um `conector_id` com seus segredos.

### 5.4 Obtencao do JWT
- **Endpoint (Postman)**: `POST /auth/oauth/v2/token` com `client_id`, `client_secret`, `grant_type=client_credentials`.
- **Hipotese**: endpoint de token OAuth2 exige mTLS + `client_id/client_secret` e retorna `access_token` JWT.
- Guardar `client_id`/`client_secret` em Vault/Secrets (ou tabela criptografada via `pgcrypto` + chave em Vault).
- Cache do token em memoria com TTL (ou tabela `integracoes_tokens` com expiracao) para evitar chamadas excessivas.

### 5.5 Consulta de saldo/extrato (parametros a confirmar)
- Parametros esperados (a confirmar): `bank_id`, `agencia`, `conta`, `_offset`, `_limit`, `initialDate`, `finalDate`.
- **Mapa**: normalizar `postingDate` -> `data_transacao`, `amount` -> `valor`, `balance` -> `saldo`, `transactionId` -> `numero_documento`.
- **Dedupe**: usar `transactionId` quando existir; fallback para chave sugerida.
- **Auditoria**: gravar log de execucao com janela consultada, tempo, total recebido/inserido/ignorado.

### 5.6 Comprovantes de pagamento (API Santander)
- **Listar comprovantes**: `GET /consult_payment_receipts/v1/payment_receipts?_limit=100&_offset=0&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Headers**: `Authorization: Bearer <token>` + `x-application-key`.
- Filtros opcionais (a confirmar): `start_time`, `end_time`, `beneficiary_document`, `account_agency`, `account_number`, `category`.
- **Gerar arquivo**: `POST /consult_payment_receipts/v1/payment_receipts/{receipt_id}/file_requests`
- **Consultar arquivo**: `GET /consult_payment_receipts/v1/payment_receipts/{receipt_id}/file_requests/{file_request_id}`
- **Listar arquivos**: `GET /consult_payment_receipts/v1/payment_receipts/{receipt_id}/file_requests?_offset=...&_limit=...`

### 5.7 Implementacao inicial (Edge Function)
- Função sugerida: `supabase/functions/santander-extrato/index.ts`.
- **Payload**:
  - `action`: `saldo` | `extrato`
  - `igrejaId`, `filialId`, `contaId`
  - `bankId`, `agencia`, `conta`
  - `initialDate`, `finalDate`, `_offset`, `_limit` (ou `offset`/`limit` como fallback)
- **Secrets esperados**: `SANTANDER_PFX_B64`, `SANTANDER_PFX_PASSWORD`, `SANTANDER_CLIENT_ID`, `SANTANDER_CLIENT_SECRET`, `SANTANDER_APPLICATION_KEY` (se exigido).

### 5.7.1 Steps de implementacao (agnostico por provedor)
**✅ 1) Tela de “Integrações Financeiras” (agnóstica)**
- Objetivo: permitir que cada igreja/filial configure seu banco/adquirente.
- Funcionalidades:
  - Selecionar provedor (Santander, BB, Itaú, Getnet, …).
  - Informar CNPJ (por igreja/filial).
  - Cadastrar conta bancária (agência/conta).
  - Upload de certificado (PFX) quando exigido.
  - Campos de autenticação (client_id, client_secret, application_key).
  - Toggle: ativo/inativo.
- Por quê: já temos ingestão e conciliação baseadas em `extratos_bancarios`, então o conector apenas precisa entregar extratos e saldos nesse formato.

**✅ 2) Armazenamento seguro (PFX e credenciais)**
- Ponto crítico: secrets não podem ficar no frontend nem no banco em texto puro.
- Recomendação prática:
  - Upload do `.pfx` → bucket privado do Supabase Storage.
  - Edge Function faz a leitura segura e regrava criptografado (ex.: via `pgcrypto`) em tabela de integrações.
  - O segredo de criptografia fica apenas no servidor (env).
- No guia atual já deixamos claro que credenciais devem ficar em secrets/vault e com uso restrito.

**✅ 3) Modelo de dados proposto (agnóstico)**
- Tabelas sugeridas:
  - `integracoes_financeiras`: `id`, `igreja_id`, `filial_id`, `provedor`, `cnpj`, `status`, `config_json`
  - `integracoes_financeiras_secrets` (criptografado): `integracao_id`, `pfx_blob`, `pfx_password`, `client_id`, `client_secret`
- Isso permite múltiplos bancos por igreja/filial, sem acoplamento ao Santander.

**✅ 4) Fluxo sugerido do upload de certificado**
- Usuário envia `.pfx` pela tela → Storage privado.
- Edge Function lê o arquivo (server-side).
- Converte/valida e criptografa → grava em `integracoes_financeiras_secrets`.
- Remove o arquivo temporário (opcional).
- Isso mantém o `.pfx` fora do banco “em texto claro”.

**✅ 5) Integração com extratos/saldos**
- Para Santander já temos um caminho claro de endpoints e execução inicial, e isso pode virar um conector por provedor.
- Padrão:
  - Obter token
  - Buscar saldo
  - Buscar extrato
  - Normalizar e inserir em `extratos_bancarios`
- Essa estratégia já está no guia operacional e é agnóstica ao banco.

**✅ Próximo passo prático (se quiser seguir)**
- Implementar:
  - Tabelas `integracoes_financeiras` e `integracoes_financeiras_secrets`.
  - Tela de configuração (CRUD por igreja/filial).
  - Edge Function para upload/cripto do PFX.
  - Adaptação do conector Santander para buscar credenciais nessa tabela.

### 5.8 Validacao pratica
- Usar sandbox (se disponivel) para: (1) obter token, (2) listar saldo, (3) listar extrato de 1-2 dias.
- Validar: timezone, sinal dos valores, identificadores unicos, paginacao real e rate limits.

### 5.9 Notificacao de recebimento PIX (portal Santander)
- **Pesquisa pendente**: tentativa de acesso ao portal do Santander via `curl` retornou **403** (sem acesso ao conteudo das docs no ambiente atual).
- **Proximo passo**: validar no portal se existe **API Pix com webhook** (ex.: notificacao de recebimento/creditos) ou se a integracao depende de **polling** de extrato/boletos.

## 6. Fluxo - Getnet via FTP/SFTP (a confirmar com specs)
### 6.1 Afericao (hipoteses a validar)
- **Entrega via arquivo**: Getnet disponibiliza arquivos diários (vendas/recebimentos/chargebacks) via SFTP. (a confirmar)
- **Formato**: CSV/TXT com layout fixo e campos `nsu`, `authorization_code`, `valor`, `data`, `descricao`. (a confirmar)
- **Janela**: arquivos por data de liquidação ou data da venda. (a confirmar)

### 6.2 Armazenamento de credenciais
- Guardar `host`, `porta`, `usuario`, `senha`/`private_key` em Vault/Secrets.
- Para chave privada, aplicar o mesmo padrão do `.pfx`: Base64 em segredo + senha separada.

### 6.3 Como sera utilizado (pipeline SFTP)
- **Worker externo** (Cloud Run/Cron + Node/Go) conecta no SFTP, baixa arquivos, grava em bucket privado (raw), e aciona Edge Function para parse + ingestao.
- **Alternativa**: Edge Function com biblioteca SFTP se suportada, mas validar limites de runtime e bibliotecas permitidas no Supabase.
- Parsear layout, mapear para `extratos_bancarios` e aplicar dedupe.

### 6.4 Parametros/controles
- Parametros de execucao: `data_inicio`, `data_fim`, `tipo_arquivo` (vendas, recebimentos, chargebacks).
- Controle de processamento: registrar `hash`/`nome_arquivo` para evitar reprocessar.

### 6.5 Validacao pratica
- Conectar em ambiente homologacao, baixar 1 arquivo e validar layout.
- Executar ingestao e conferir duplicidade/importacao incremental.

- Autenticacao: client_id/secret + token (onde guardar: Supabase secrets ou vault) (a confirmar)
- Obtencao de extratos: endpoint, janela de datas, timezone, paginacao (a confirmar)
- Campos esperados: data, valor, historico, saldo, identificador unico (transactionId/FITID) (a confirmar)
- Polling vs webhook: definir se ha notificacao push; caso nao, usar polling com backoff (a confirmar)
- Dedupe: usar identificador unico do banco; fallback para chave sugerida
- Erros/transientes: retry com backoff exponencial e jitter em 429/5xx (a confirmar limites)
- Auditoria: log de execucao, total recebido, total inserido, total ignorado

## 6. Fluxo - API Getnet (a confirmar com specs)

- Autenticacao: client_id/secret/token (a confirmar storage e escopo)
- Endpoints: transacoes/settlements com janela de datas e paginacao (a confirmar)
- Campos mapeaveis: data, valor, NSU/autorizacao, descricao/estabelecimento, saldo (se houver) (a confirmar)
- Dedupe: usar NSU/authorizationCode como `numero_documento`
- Erros/transientes: retry com backoff exponencial e jitter em 429/5xx (a confirmar limites)
- Auditoria: log de execucao, total recebido, total inserido, total ignorado

## 7. Politica de Erros e Alertas

- Retentativas: 3 tentativas com backoff exponencial (ex.: 2s, 4s, 8s) e jitter
- Erros fatais (401/403/422): nao retentar; notificar operacoes
- Alertas recomendados: falha de autenticacao, zero registros retornados em janela, explosao de volume (pico anomalo)

## 8. Homologacao e Testes

- Sandbox/conta fake por conector (Santander/Getnet) (a confirmar)
- Massa de teste com: credito, debito, tarifas, chargeback/estorno, datas cruzando fuso/DST
- Casos de borda: valor zero (rejeitar), datas invalidas, duplicidade, pagina vazia
- Validar dedupe: importar duas vezes e conferir que duplicados nao entram
- Validar timezone: datas devem refletir dia util correto no extrato

## 9. Seguranca e Credenciais

- Armazenar secrets em local seguro (Supabase secrets ou vault dedicado) (a confirmar)
- Rotacao de tokens: definir periodicidade e quem executa
- Nao logar payloads com PII/segredos; mascarar tokens
- Limitar escopo: apenas leitura de extratos/transacoes
- Preferir isolamento por `conector_id` com politicas RLS e acesso apenas por service role em jobs.

## 10. Quando Criar ADR

- Definicao de estrategia de ingestao por conector (webhook vs polling vs SFTP)
- Modelo de staging/dedupe (tabela temporaria vs upsert direto)
- Armazenamento/rotacao de credenciais e papel do vault
- Algoritmo de reconciliacao automatica (matching score, similaridade, tolerancia de valor/data)

## 11. Itens A Confirmar

- Endpoints oficiais e payloads de Santander (sandbox/produçao)
- Endpoints oficiais e payloads de Getnet (sandbox/produçao)
- Limites de rate limit/paginacao de cada API
- Timezone padrao dos retornos (UTC ou local)
- Se existem webhooks/push para novas transacoes
- Requisitos de certificado (PFX, validade, chain, algoritmo suportado)
- Formato e layout oficial dos arquivos Getnet (campos obrigatorios, separador, encoding)

## 12. Referencias

- UI: `src/components/financas/ImportarExtratosTab.tsx` (upload CSV/XLSX/OFX)
- Tabela: `supabase/migrations/20260109_extratos_bancarios.sql`
- Changelog: docs/CHANGELOG.md (entrada 9 Jan 2026)
