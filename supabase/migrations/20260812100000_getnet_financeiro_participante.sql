-- ============================================================================
-- Ciclo 2 (C2-5) — Campos de participante em getnet_financeiro_resumo/detalhe
--
-- O parser (`getnetExtratoParser.ts`) já descartava, desde sempre, os gaps
-- de bytes 149-255 (tipo5, LAYOUT_FIN_RESUMO) e 155-261 (tipo6,
-- LAYOUT_FIN_DETALHE) — nesses ranges o manual V10.1 (Tabela Resumo/Detalhe
-- Financeiro, pág. 21-25) documenta CNPJ/CPF do participante, Razão Social
-- do Participante e, só no tipo5 ("Exceto quando PG"), Banco/Agência/Conta
-- do domicílio bancário do participante. No tipo6 essas 3 últimas posições
-- (seq 22-25, bytes 191-221) são documentadas como "ZEROS"/"ESPAÇO" (Antigo
-- Tipo de conta/Banco/Agência/Conta do participante) — deprecadas, só o
-- CNPJ/CPF e a Razão Social seguem vivos ali.
--
-- IMPORTANTE — sem verificação empírica: `getnet_financeiro_resumo`/
-- `getnet_financeiro_detalhe` estão VAZIAS em produção (nenhuma linha
-- tipo5/tipo6 jamais recebida por esta integração até a data desta
-- migration) — não há amostra real disponível pra confirmar os byte
-- ranges nem a alegação de "deprecado" do manual pro tipo6. Decisão
-- explícita do usuário: confiar na documentação Getnet e implementar
-- mesmo assim, em vez de bloquear a fase esperando um arquivo com essas
-- linhas. Se/quando uma linha tipo5/6 real chegar, validar os valores
-- capturados contra o `raw_line` já armazenado antes de tratar esses
-- campos como confiáveis em qualquer tela/relatório.
-- ============================================================================

ALTER TABLE public.getnet_financeiro_resumo
  ADD COLUMN IF NOT EXISTS participante_cnpj_cpf text,
  ADD COLUMN IF NOT EXISTS participante_banco text,
  ADD COLUMN IF NOT EXISTS participante_agencia text,
  ADD COLUMN IF NOT EXISTS participante_conta_corrente text,
  ADD COLUMN IF NOT EXISTS participante_razao_social text;

COMMENT ON COLUMN public.getnet_financeiro_resumo.participante_cnpj_cpf IS
  'Tipo 5, seq 21 (bytes 171-184). CNPJ/CPF do participante (manual V10.1, pág. 21). Não verificado empiricamente — ver comentário desta migration.';
COMMENT ON COLUMN public.getnet_financeiro_resumo.participante_banco IS
  'Tipo 5, seq 23 (bytes 187-189). Banco do domicílio bancário do participante — "Exceto quando PG" (manual V10.1, pág. 22). Não verificado empiricamente.';
COMMENT ON COLUMN public.getnet_financeiro_resumo.participante_agencia IS
  'Tipo 5, seq 24 (bytes 190-195). Agência do domicílio bancário do participante — "Exceto quando PG" (manual V10.1, pág. 22). Não verificado empiricamente.';
COMMENT ON COLUMN public.getnet_financeiro_resumo.participante_conta_corrente IS
  'Tipo 5, seq 25 (bytes 196-215). Conta do domicílio bancário do participante — "Exceto quando PG" (manual V10.1, pág. 22). Não verificado empiricamente.';
COMMENT ON COLUMN public.getnet_financeiro_resumo.participante_razao_social IS
  'Tipo 5, seq 27 (bytes 231-255). Razão Social do Participante — "Exceto quando PG" (manual V10.1, pág. 22). Não verificado empiricamente.';

ALTER TABLE public.getnet_financeiro_detalhe
  ADD COLUMN IF NOT EXISTS participante_cnpj_cpf text,
  ADD COLUMN IF NOT EXISTS participante_razao_social text;

COMMENT ON COLUMN public.getnet_financeiro_detalhe.participante_cnpj_cpf IS
  'Tipo 6, seq 21 (bytes 177-190). CNPJ/CPF do participante (manual V10.1, pág. 23-24). Sem Banco/Agência/Conta correspondentes — manual documenta essas posições (seq 22-25, bytes 191-221) como ZEROS/ESPAÇO no tipo6 (deprecado), diferente do tipo5. Não verificado empiricamente.';
COMMENT ON COLUMN public.getnet_financeiro_detalhe.participante_razao_social IS
  'Tipo 6, seq 27 (bytes 237-261). Razão Social do Participante (manual V10.1, pág. 24-25). Não verificado empiricamente.';
