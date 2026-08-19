-- Linter Supabase (anon_security_definer_function_executable /
-- authenticated_security_definer_function_executable): 49 funções fin_*
-- SECURITY DEFINER continuam executáveis por `anon` mesmo depois de
-- migrations anteriores (20260710120000 e outras) tentarem fechar isso
-- com `REVOKE ALL ... FROM anon[, authenticated]`.
--
-- Causa raiz: EXECUTE em função nova é concedido a PUBLIC por padrão no
-- Postgres. `anon`/`authenticated` herdam esse acesso via PUBLIC, não
-- por grant próprio — revogar de um role nomeado não remove o que veio
-- de PUBLIC. Só `REVOKE ... FROM PUBLIC` fecha de verdade. Confirmado
-- comparando o dump ao vivo: as funções que só tinham
-- "REVOKE FROM anon[, authenticated]" continuam com anon executável;
-- nenhuma migration deste projeto jamais revogou de PUBLIC.
--
-- Verificado corpo a corpo (pg_get_functiondef ao vivo) que 45 das 49
-- já se protegem sozinhas via fin_resolver_contexto/
-- fin_exigir_leitura_financeira (RAISE EXCEPTION 'FIN_AUTH'/'FIN_TENANT'
-- antes de tocar em qualquer dado) — pra essas, o grant de PUBLIC é gap
-- de defesa em profundidade, não exploração ativa. As 4 exceções
-- confirmadas SEM guard interno, achado real:
--   - fin_registrar_auditoria: INSERT livre em fin_audit_log sem
--     validação nenhuma — qualquer um forjava entrada de auditoria pra
--     qualquer igreja.
--   - fin_materializar_recorrencias: job de pg_cron (03:15 UTC) sem
--     parâmetro nenhum, chamável por qualquer um — dispararia
--     materialização de recorrências de todas as igrejas fora de hora
--     (idempotente, não duplica, mas não deveria ser client-facing).
--   - fin_validar_fk_tenant / fin_validar_fk_filial: oráculo de
--     existência/tenant (retorna void ou exceção) — vaza só um
--     booleano, mas são helpers internos sem razão de estar expostos.
--
-- Achado bônus: fin_resumo_periodo e fin_validar_fk_filial tinham GRANT
-- EXECUTE ... TO anon EXPLÍCITO ao vivo, sem nenhuma migration
-- correspondente no git — drift, alguém rodou GRANT direto em produção
-- fora do fluxo de migration. fin_resumo_periodo é seguro na prática
-- (chama fin_exigir_leitura_financeira, que exige JWT), mas o grant
-- órfão some com REVOKE ... FROM PUBLIC, anon abaixo mesmo assim.
--
-- Nenhum grant a authenticated/service_role é tocado — todas as 49 já
-- tinham GRANT EXECUTE ... TO authenticated, service_role explícito
-- (exceto fin_materializar_recorrencias/fin_registrar_auditoria/
-- fin_resolver_contexto/fin_validar_fk_tenant, que já eram
-- service_role-only por desenho — chamadas só internamente por outras
-- fin_* SECURITY DEFINER, que rodam como o owner e não passam pelo
-- grant do caller original).

REVOKE ALL ON FUNCTION public.fin_ajustar_saldo(uuid, numeric, text, text, date, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_alterar_competencia_grupo(uuid, date, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_alterar_status_lancamento(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_alternar_conferencia_manual(uuid, boolean, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_atualizar_lancamento(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_buscar_financeiro_participante_getnet(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_buscar_recebiveis_getnet_oferta(uuid, uuid, jsonb, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_conferencia_totais_getnet(uuid, date, date, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_confirmar_conciliacao(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_criar_lancamento(text, numeric, date, uuid, text, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_criar_transferencia(uuid, uuid, numeric, date, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_desconciliar(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_desfazer_ingestao(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_desfazer_vinculo_lote_antecipacao(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_desfazer_vinculo_venda_banco_getnet(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_diagnosticar_drift_saldo(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_diagnosticar_vinculos_getnet_espelho(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_estornar_transferencia(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_excluir_lancamento(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_exigir_leitura_financeira(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_conciliacao(uuid, date, date, numeric, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_lote_antecipacao_getnet(uuid, jsonb, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_oferta_venda_getnet(uuid, date, date, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_venda_banco_getnet(uuid, uuid, date, date, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_importar_recebivel_getnet(uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_ingerir_extratos(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_lancar_desagio_antecipacao(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_lancar_sessao(uuid, jsonb, boolean, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_listar_ajustes_getnet(uuid, date, date, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_listar_extratos_vinculados_lote(uuid[], jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_listar_resumo_ci_getnet(uuid, date, date, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_marcar_extrato_ignorado(uuid, boolean, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_materializar_recorrencias() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_ofertas_periodo(date, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_pagar_reembolso(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_projecao_mensal(integer, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_recalcular_saldo_conta(uuid, boolean, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_registrar_auditoria(jsonb, text, text, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_resolver_contexto(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_resumo_periodo(date, date, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_reverter_desagio_antecipacao(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_stats_cartao_getnet(uuid, date, date, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_validar_fk_filial(text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_validar_fk_tenant(text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_vincular_lote_antecipacao(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_vincular_venda_banco_getnet(uuid, uuid[], jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb) FROM PUBLIC, anon;
