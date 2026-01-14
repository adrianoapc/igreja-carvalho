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

## 12. Referencias

- UI: `src/components/financas/ImportarExtratosTab.tsx` (upload CSV/XLSX/OFX)
- Tabela: `supabase/migrations/20260109_extratos_bancarios.sql`
- Changelog: docs/CHANGELOG.md (entrada 9 Jan 2026)
