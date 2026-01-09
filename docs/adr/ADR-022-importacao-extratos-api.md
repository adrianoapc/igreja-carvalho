# ADR-022: Estrategia de Importacao de Extratos via API (Santander e Getnet)

- **Status:** Proposto
- **Data:** 2026-01-09
- **Autores:** Time Financas/Engenharia

## Contexto

- Ja existe importacao manual de extratos por arquivo (CSV/XLSX/OFX) gravando em `extratos_bancarios`.
- Precisamos integrar com APIs bancarias (Santander) e adquirencia (Getnet) para reduzir trabalho manual e habilitar conciliacao automatica.
- Requisitos chave: dedupe/idempotencia, isolamento multi-tenant, armazenamento seguro de credenciais, tolerancia a falhas e observabilidade.
- Informacoes pendentes dos provedores: endpoints, rate limits, timezone, suporte a webhooks e payloads exatos.

## Decisao

Adotar um conector por provedor com ingestao **polling** inicial (fallback universal) e pipeline de normalizacao + dedupe antes de persistir em `extratos_bancarios`.

### Pilares da decisao

1. **Ingestao (Polling com backoff)**
   - Usar polling enquanto nao houver webhooks/documentacao de push.
   - Respeitar rate limits e aplicar backoff exponencial com jitter em 429/5xx.
2. **Credenciais e tokens**
   - Armazenar `client_id/secret/refresh_token` em secrets seguros (Supabase secrets ou vault externo).
   - Rotacao de tokens definida por TTL do provedor; nunca logar segredos.
3. **Normalizacao e mapeamento**
   - Mapear sempre para os campos do modelo de extrato: data_transacao, descricao, valor, numero_documento, saldo (opcional), tipo (credito/debito), conta_id, igreja_id, filial_id.
   - Inferir tipo por sinal do valor quando o provedor nao enviar campo explicito.
4. **Idempotencia e dedupe**
   - Chave de dedupe por conector: usar identificador unico do provedor quando existir (`FITID`/`transactionId`/`nsu`).
   - Fallback: `conta_id + data_transacao + valor + coalesce(numero_documento, descricao)`.
   - Aplicar filtro antes do insert ou upsert com chave unica em staging (a ser implementado).
5. **Persistencia**
   - Gravar no modelo consolidado `extratos_bancarios` com `reconciliado = FALSE`.
   - Considerar staging leve apenas para dedupe (sem retenção longa) se necessario.
6. **Observabilidade**
   - Logar execucoes: total recebido, inserido, ignorado, tempo de execucao, ultimo cursor/pagina.
   - Alertar em: falha de autenticacao, zero registros em janela esperada, pico anomalo de volume.

### Escopo por provedor

- **Santander (a confirmar):** polling de extrato/statement; usar `transactionId`/`FITID` se exposto; timezone e paginacao a definir.
- **Getnet (a confirmar):** polling de transacoes/settlements; usar `nsu`/`authorizationCode` como `numero_documento`; timezone e paginacao a definir.

## Alternativas consideradas

1. **Webhooks/push**: rejeitado por ora (dependemos de suporte do provedor e validacao de segurança). Pode ser adotado depois, mantendo dedupe/idempotencia.
2. **Importar direto em `extratos_bancarios` sem dedupe**: rejeitado por risco alto de duplicidade em reprocessamentos/paginas.
3. **Staging completo com historico longo**: adiado; manter staging leve ou filtro em memoria para evitar custo de armazenamento ate que o volume e SLA justifiquem.

## Consequencias

- **Positivas**: Padrao unico para conectores; reduz retrabalho manual; prepara terreno para conciliacao automatica; protege contra duplicidade e falhas transientes.
- **Negativas/Trade-offs**: Polling aumenta latencia vs push; exige disciplina de rotacao de tokens; staging leve pode nao cobrir todos cenarios de reprocessamento (revisitar se volume crescer).
- **Follow-ups obrigatorios**:
  - Confirmar payloads/rate limits/timezone de Santander e Getnet.
  - Definir store de secrets (Supabase secrets vs vault) e playbook de rotacao.
  - Implementar dedupe com chave unica por conector (staging ou upsert direto).
  - Adicionar metricas/alertas conforme seções de observabilidade.
