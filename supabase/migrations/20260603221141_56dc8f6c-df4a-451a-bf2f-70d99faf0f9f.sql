
-- ============== getnet_resumo ==============
CREATE TABLE public.getnet_resumo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id uuid NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id uuid NOT NULL,
  filial_id uuid,
  arquivo_nome text NOT NULL,
  codigo_produto text,
  forma_captura text,
  rv text NOT NULL,
  data_rv date NOT NULL,
  valor_bruto numeric(14,2) NOT NULL,
  valor_liquido numeric(14,2) NOT NULL,
  sinal char(1),
  raw_line text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getnet_resumo_unique UNIQUE (integracao_id, rv, data_rv)
);
CREATE INDEX idx_getnet_resumo_int_data ON public.getnet_resumo(integracao_id, data_rv DESC);
CREATE INDEX idx_getnet_resumo_int_rv ON public.getnet_resumo(integracao_id, rv);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_resumo TO authenticated;
GRANT ALL ON public.getnet_resumo TO service_role;

ALTER TABLE public.getnet_resumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "getnet_resumo_select" ON public.getnet_resumo
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

CREATE POLICY "getnet_resumo_modify" ON public.getnet_resumo
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
  WITH CHECK (
    igreja_id = public.get_current_user_igreja_id()
  );

CREATE TRIGGER trg_getnet_resumo_updated_at
  BEFORE UPDATE ON public.getnet_resumo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== getnet_analitico ==============
CREATE TABLE public.getnet_analitico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id uuid NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id uuid NOT NULL,
  filial_id uuid,
  arquivo_nome text NOT NULL,
  rv text NOT NULL,
  nsu_cv text NOT NULL,
  cartao_truncado text,
  valor_transacao numeric(14,2) NOT NULL,
  codigo_autorizacao text,
  forma_captura text,
  status text,
  raw_line text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT getnet_analitico_unique UNIQUE (integracao_id, rv, nsu_cv)
);
CREATE INDEX idx_getnet_analitico_int_rv ON public.getnet_analitico(integracao_id, rv);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.getnet_analitico TO authenticated;
GRANT ALL ON public.getnet_analitico TO service_role;

ALTER TABLE public.getnet_analitico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "getnet_analitico_select" ON public.getnet_analitico
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

CREATE POLICY "getnet_analitico_modify" ON public.getnet_analitico
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
  WITH CHECK (
    igreja_id = public.get_current_user_igreja_id()
  );

CREATE TRIGGER trg_getnet_analitico_updated_at
  BEFORE UPDATE ON public.getnet_analitico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
