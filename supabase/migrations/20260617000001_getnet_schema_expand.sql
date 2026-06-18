-- =============================================================================
-- Getnet Schema Expansion — V10.1 completo
-- =============================================================================
-- 1. Novas colunas em getnet_resumo (tipo 1)
-- 2. Novo constraint de ciclo de vida (PF→LQ como linhas distintas)
-- 3. Novas colunas em getnet_analitico (tipo 2)
-- 4. Nova tabela getnet_arquivos (controle por arquivo)
-- 5. Nova tabela getnet_ajustes (tipo 3)
-- 6. Nova tabela getnet_financeiro_resumo (tipo 5)
-- 7. Nova tabela getnet_financeiro_detalhe (tipo 6)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. getnet_resumo — novas colunas
-- -----------------------------------------------------------------------------

ALTER TABLE public.getnet_resumo
  ADD COLUMN IF NOT EXISTS indicador_tipo_pagamento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data_pagamento_rv        date,
  ADD COLUMN IF NOT EXISTS chave_ur                 text,
  ADD COLUMN IF NOT EXISTS valor_tarifa             numeric(14,2),
  ADD COLUMN IF NOT EXISTS valor_taxa_desconto      numeric(14,2),
  ADD COLUMN IF NOT EXISTS banco                    text,
  ADD COLUMN IF NOT EXISTS agencia                  text,
  ADD COLUMN IF NOT EXISTS conta_corrente           text,
  ADD COLUMN IF NOT EXISTS tipo_conta               text,
  ADD COLUMN IF NOT EXISTS num_parcela_rv           int,
  ADD COLUMN IF NOT EXISTS qtd_parcelas_rv          int,
  ADD COLUMN IF NOT EXISTS data_vencimento_original date,
  ADD COLUMN IF NOT EXISTS moeda                    text;

-- Constraint de ciclo de vida: PF e LQ do mesmo RV ficam em linhas distintas
ALTER TABLE public.getnet_resumo
  DROP CONSTRAINT IF EXISTS getnet_resumo_unique;

ALTER TABLE public.getnet_resumo
  ADD CONSTRAINT getnet_resumo_unique
  UNIQUE (integracao_id, rv, data_rv, indicador_tipo_pagamento);

-- Índice auxiliar para junção por chave_ur (1↔5↔6)
CREATE INDEX IF NOT EXISTS idx_getnet_resumo_chave_ur
  ON public.getnet_resumo(integracao_id, chave_ur)
  WHERE chave_ur IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. getnet_analitico — novas colunas
-- -----------------------------------------------------------------------------

ALTER TABLE public.getnet_analitico
  ADD COLUMN IF NOT EXISTS data_transacao  date,
  ADD COLUMN IF NOT EXISTS hora_transacao  text,
  ADD COLUMN IF NOT EXISTS codigo_terminal text,
  ADD COLUMN IF NOT EXISTS valor_comissao  numeric(14,2),
  ADD COLUMN IF NOT EXISTS numero_parcelas int,
  ADD COLUMN IF NOT EXISTS parcela_do_cv   int,
  ADD COLUMN IF NOT EXISTS valor_parcela   numeric(14,2),
  ADD COLUMN IF NOT EXISTS moeda           text,
  ADD COLUMN IF NOT EXISTS sinal           char(1);

-- -----------------------------------------------------------------------------
-- 3. getnet_arquivos — controle por arquivo importado
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.getnet_arquivos (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id            uuid        NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id                uuid        NOT NULL,
  arquivo_nome             text        NOT NULL,
  data_referencia          date        NOT NULL,
  sequencia_remessa        int,
  qtd_registros_declarada  int,
  qtd_registros_lida       int,
  validacao_ok             boolean,
  erros_validacao          text[],
  storage_path             text,
  codigo_estabelecimento   text,
  cnpj_adquirente          text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getnet_arquivos_unique UNIQUE (integracao_id, arquivo_nome)
);

CREATE INDEX IF NOT EXISTS idx_getnet_arquivos_int_data
  ON public.getnet_arquivos(integracao_id, data_referencia DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_arquivos TO authenticated;
GRANT ALL ON public.getnet_arquivos TO service_role;

ALTER TABLE public.getnet_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "getnet_arquivos_select" ON public.getnet_arquivos
  FOR SELECT TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "getnet_arquivos_modify" ON public.getnet_arquivos
  FOR ALL TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (igreja_id = public.get_current_user_igreja_id());

-- -----------------------------------------------------------------------------
-- 4. getnet_ajustes — registro tipo 3 (chargebacks, cancelamentos, aluguéis)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.getnet_ajustes (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id            uuid        NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id                uuid        NOT NULL,
  arquivo_nome             text        NOT NULL,
  linha_num                int         NOT NULL,
  rv_ajustado              text        NOT NULL,
  data_rv                  date,
  data_pagamento_rv        date,
  identificador_ajuste     text        NOT NULL DEFAULT '',
  sinal                    char(1),
  valor_ajuste             numeric(14,2),
  motivo_ajuste            text,
  data_carta               date,
  cartao_truncado          text,
  rv_original              text,
  nsu_cv                   text,
  data_transacao_original  date,
  indicador_tipo_pagamento text,
  numero_terminal          text,
  data_pagamento_original  date,
  moeda                    text,
  valor_comissao           numeric(14,2),
  raw_line                 text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getnet_ajustes_unique UNIQUE (integracao_id, rv_ajustado, identificador_ajuste)
);

CREATE INDEX IF NOT EXISTS idx_getnet_ajustes_int_rv
  ON public.getnet_ajustes(integracao_id, rv_ajustado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_ajustes TO authenticated;
GRANT ALL ON public.getnet_ajustes TO service_role;

ALTER TABLE public.getnet_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "getnet_ajustes_select" ON public.getnet_ajustes
  FOR SELECT TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "getnet_ajustes_modify" ON public.getnet_ajustes
  FOR ALL TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (igreja_id = public.get_current_user_igreja_id());

-- -----------------------------------------------------------------------------
-- 5. getnet_financeiro_resumo — registro tipo 5 (onde está o dinheiro real)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.getnet_financeiro_resumo (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id            uuid        NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id                uuid        NOT NULL,
  arquivo_nome             text        NOT NULL,
  linha_num                int         NOT NULL,
  numero_operacao          text        NOT NULL,
  chave_ur                 text,
  data_operacao            date,
  data_credito_operacao    date,
  tipo_operacao            text,        -- CS/CF/PG/AC/CL/GL/GF/AL/LQ
  valor_bruto_operacao     numeric(14,2),
  valor_custo_operacao     numeric(14,2),
  valor_liquido_operacao   numeric(14,2),
  taxa_mensal_operacao     numeric(14,7),
  tipo_conta_estabelecimento text,
  banco                    text,
  agencia                  text,
  conta_corrente           text,
  canal_operacao           text,
  tipo_movimento           text,        -- A/C/D/I/L
  codigo_arranjo           text,
  raw_line                 text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getnet_fin_resumo_unique UNIQUE (integracao_id, numero_operacao)
);

CREATE INDEX IF NOT EXISTS idx_getnet_fin_resumo_int_data
  ON public.getnet_financeiro_resumo(integracao_id, data_operacao DESC);
CREATE INDEX IF NOT EXISTS idx_getnet_fin_resumo_chave_ur
  ON public.getnet_financeiro_resumo(integracao_id, chave_ur)
  WHERE chave_ur IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_financeiro_resumo TO authenticated;
GRANT ALL ON public.getnet_financeiro_resumo TO service_role;

ALTER TABLE public.getnet_financeiro_resumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "getnet_fin_resumo_select" ON public.getnet_financeiro_resumo
  FOR SELECT TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "getnet_fin_resumo_modify" ON public.getnet_financeiro_resumo
  FOR ALL TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (igreja_id = public.get_current_user_igreja_id());

-- -----------------------------------------------------------------------------
-- 6. getnet_financeiro_detalhe — registro tipo 6 (detalhe por UR)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.getnet_financeiro_detalhe (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id            uuid        NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id                uuid        NOT NULL,
  arquivo_nome             text        NOT NULL,
  linha_num                int         NOT NULL,
  numero_operacao          text        NOT NULL,
  chave_ur                 text        NOT NULL,
  data_operacao            date,
  tipo_operacao            text,
  codigo_produto           text,
  data_vencimento_ur       date,
  valor_liquido_ur         numeric(14,2),
  valor_custo_ur           numeric(14,2),
  valor_bruto_ur           numeric(14,2),
  tipo_conta_estabelecimento text,
  tipo_movimento           text,
  raw_line                 text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getnet_fin_detalhe_unique UNIQUE (integracao_id, numero_operacao, chave_ur)
);

CREATE INDEX IF NOT EXISTS idx_getnet_fin_detalhe_chave_ur
  ON public.getnet_financeiro_detalhe(integracao_id, chave_ur);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_financeiro_detalhe TO authenticated;
GRANT ALL ON public.getnet_financeiro_detalhe TO service_role;

ALTER TABLE public.getnet_financeiro_detalhe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "getnet_fin_detalhe_select" ON public.getnet_financeiro_detalhe
  FOR SELECT TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "getnet_fin_detalhe_modify" ON public.getnet_financeiro_detalhe
  FOR ALL TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (igreja_id = public.get_current_user_igreja_id());
