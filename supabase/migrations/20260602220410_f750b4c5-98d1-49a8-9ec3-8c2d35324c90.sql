
CREATE TABLE public.integracoes_execucoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integracao_id uuid NOT NULL REFERENCES public.integracoes_financeiras(id) ON DELETE CASCADE,
  igreja_id uuid NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_id uuid REFERENCES public.filiais(id) ON DELETE SET NULL,
  provedor text NOT NULL,
  acao text NOT NULL CHECK (acao IN ('test_connection','list_files','download_file','import_extrato')),
  status text NOT NULL CHECK (status IN ('success','error','partial','running')),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  duracao_ms integer,
  arquivo_nome text,
  arquivo_tamanho bigint,
  arquivo_modified_at timestamptz,
  total_recebido integer,
  total_inserido integer,
  total_ignorado integer,
  erro_mensagem text,
  erro_stack text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integracoes_execucoes_log TO authenticated;
GRANT ALL ON public.integracoes_execucoes_log TO service_role;

ALTER TABLE public.integracoes_execucoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visualizar logs de integracoes da igreja"
ON public.integracoes_execucoes_log
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role_in_igreja(auth.uid(), 'admin'::app_role, igreja_id)
  OR has_role_in_igreja(auth.uid(), 'admin_igreja'::app_role, igreja_id)
  OR has_role_in_igreja(auth.uid(), 'tesoureiro'::app_role, igreja_id)
);

CREATE INDEX idx_int_exec_log_integracao_iniciado
  ON public.integracoes_execucoes_log (integracao_id, iniciado_em DESC);

CREATE INDEX idx_int_exec_log_igreja_status_iniciado
  ON public.integracoes_execucoes_log (igreja_id, status, iniciado_em DESC);
