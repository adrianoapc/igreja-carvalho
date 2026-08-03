-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 03/08 02:19, commit revisado
-- 4f1a1b24), P1, sobre a MITIGAÇÃO da rodada anterior (§9.78): filtrar
-- `useLotesAntecipacao.ts` client-side pela filial efetiva do vínculo evita
-- que a UI OFEREÇA a ação sobre um lote de outra filial, mas os dados do
-- extrato (`extratos_bancarios(valor, data_transacao, descricao,
-- filial_id)`) já chegaram no payload de rede ANTES do filtro rodar —
-- PostgREST embute a relação e, como a RLS de SELECT de `extratos_
-- bancarios` não checa filial (§9.78), o embed NÃO fica null pra um
-- usuário sem acesso: ele traz os dados reais. Filtrar depois, no
-- React, é tarde demais — o vazamento já aconteceu no fio.
--
-- Fix: parar de embutir `extratos_bancarios` via PostgREST nessa tela.
-- `getnet_antecipacao_lotes` mantém sua própria RLS (já correta, granular,
-- com `user_filial_access`) — só o acesso ao EXTRATO vinculado precisa de
-- um caminho que resolva a filial ANTES de devolver os campos, igual toda
-- outra leitura sensível deste módulo. Nova RPC `SECURITY DEFINER`,
-- só-leitura, que recebe os `extrato_bancario_id`s já carregados e devolve
-- só os que o chamador tem `has_filial_access` — nunca envia os campos de
-- quem não tem.
--
-- Deliberadamente NÃO mexe na RLS de `extratos_bancarios` em si (14
-- read-paths diferentes no app leem essa tabela direto, vários por design
-- cruzando filiais — ex. o próprio `VincularExtratoLoteDialog.tsx`,
-- que busca candidatos de QUALQUER filial pra permitir vínculo manual).
-- Mudar a RLS da tabela é escopo maior, documentado como risco separado em
-- §9.78/§11 (mesma classe das 8 RPCs sem has_filial_access) — fora desta
-- PR. Este fix fecha especificamente o caminho que o review apontou.
--
-- Testado em harness Postgres real (scratchpad harness_v28_*): tesoureiro
-- restrito à filial B pedindo [extrato_A, extrato_B, extrato_global] só
-- recebe B+global de volta; pedindo SÓ o extrato_A (o caso exato do
-- achado) recebe 0 linhas — o dado nunca sai da função. Admin recebe os 3.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_listar_extratos_vinculados_lote(
  p_extrato_ids uuid[],
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  valor numeric,
  data_transacao date,
  descricao text,
  filial_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  RETURN QUERY
  SELECT e.id, e.valor, e.data_transacao, e.descricao, e.filial_id
    FROM public.extratos_bancarios e
   WHERE e.id = ANY(p_extrato_ids)
     AND e.igreja_id = v_igreja
     AND public.has_filial_access(v_igreja, e.filial_id);
END;
$$;

COMMENT ON FUNCTION public.fin_listar_extratos_vinculados_lote(uuid[], jsonb) IS
  'Só-leitura: devolve os extratos bancários (id/valor/data/descrição/filial) do conjunto de ids informado, filtrando por has_filial_access — nunca inclui um extrato de filial sem acesso no resultado. Usada por useLotesAntecipacao.ts pra resolver o extrato vinculado de cada lote sem embutir extratos_bancarios via PostgREST (cuja RLS de SELECT não é filial-scoped, achado §9.78/§9.79).';

GRANT EXECUTE ON FUNCTION public.fin_listar_extratos_vinculados_lote(uuid[], jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_extratos_vinculados_lote(uuid[], jsonb) FROM anon;
