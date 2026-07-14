-- ============================================================================
-- F6 — trava a origem do espelho por arquivo (fix P1 do review do PR #52)
--
-- Problema: `espelho_tipo5_desde` decide o branch tipo1×tipo5 comparando a
-- data de corte contra `data_referencia` do arquivo sendo processado. Se um
-- arquivo já foi importado (espelho tipo 1, external_id `getnet_rv:...`) e o
-- operador depois configura um corte retroativo cobrindo essa mesma data, um
-- reprocessamento manual (`import_extrato` com `arquivo_nome`/`requestedFile`
-- — fluxo de reparo já existente) passa a gerar o espelho pelo tipo 5
-- (external_id `getnet_fin5:...`), que NÃO colide com o external_id antigo no
-- dedupe `(conta_id, external_id)` — duplicando o mesmo crédito em
-- extratos_bancarios.
--
-- Fix: `getnet_arquivos` (já escrito só após sucesso total, base da
-- idempotência de reprocessamento) passa a registrar qual origem de espelho
-- foi usada da PRIMEIRA vez. Reprocessamentos do MESMO arquivo reusam essa
-- origem travada, ignorando a config atual — a decisão by-config só vale na
-- primeira vez que um arquivo é importado. NULL (arquivos importados antes
-- desta coluna existir, ou seja, antes da F6) é tratado como "tipo 1" no
-- código, já que a origem tipo5 não existia antes desta PR.
-- ============================================================================

ALTER TABLE public.getnet_arquivos
  ADD COLUMN IF NOT EXISTS espelho_origem text;

COMMENT ON COLUMN public.getnet_arquivos.espelho_origem IS
  'Origem do espelho em extratos_bancarios usada na 1a importação deste arquivo (getnet_sftp_txt|getnet_sftp_tipo5); trava reprocessamento p/ não duplicar crédito se a config de corte mudar depois. NULL = importado antes da F6 (tipo 1).';
