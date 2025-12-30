-- Criar tabela de histórico de movimentações de candidatos voluntários
CREATE TABLE public.candidatos_voluntario_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID NOT NULL REFERENCES public.candidatos_voluntario(id) ON DELETE CASCADE,
  acao TEXT NOT NULL, -- 'criado', 'status_alterado', 'avaliado', 'trilha_vinculada', etc.
  status_anterior TEXT,
  status_novo TEXT,
  observacoes TEXT,
  realizado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_candidatos_historico_candidato ON public.candidatos_voluntario_historico(candidato_id);
CREATE INDEX idx_candidatos_historico_data ON public.candidatos_voluntario_historico(created_at DESC);

-- RLS
ALTER TABLE public.candidatos_voluntario_historico ENABLE ROW LEVEL SECURITY;

-- Apenas admins e líderes podem ver o histórico
CREATE POLICY "Admins e líderes podem ver histórico"
ON public.candidatos_voluntario_historico
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'lider'::app_role)
);

-- Sistema pode inserir (via trigger)
CREATE POLICY "Sistema pode inserir histórico"
ON public.candidatos_voluntario_historico
FOR INSERT
WITH CHECK (true);

-- Trigger para registrar automaticamente alterações de status
CREATE OR REPLACE FUNCTION public.log_candidato_voluntario_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_acao TEXT;
  v_obs TEXT;
  v_realizado_por UUID;
BEGIN
  -- Buscar profile_id do usuário atual
  SELECT id INTO v_realizado_por
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.candidatos_voluntario_historico (
      candidato_id, acao, status_novo, observacoes, realizado_por
    ) VALUES (
      NEW.id, 'criado', NEW.status, 'Candidatura registrada', v_realizado_por
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Mudança de status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_acao := 'status_alterado';
      v_obs := format('Status alterado de %s para %s', OLD.status, NEW.status);
      
      INSERT INTO public.candidatos_voluntario_historico (
        candidato_id, acao, status_anterior, status_novo, observacoes, realizado_por
      ) VALUES (
        NEW.id, v_acao, OLD.status, NEW.status, v_obs, COALESCE(NEW.avaliado_por, v_realizado_por)
      );
    END IF;

    -- Vinculação de trilha
    IF OLD.trilha_requerida_id IS DISTINCT FROM NEW.trilha_requerida_id AND NEW.trilha_requerida_id IS NOT NULL THEN
      INSERT INTO public.candidatos_voluntario_historico (
        candidato_id, acao, observacoes, realizado_por
      ) VALUES (
        NEW.id, 'trilha_vinculada', 'Trilha de capacitação vinculada', COALESCE(NEW.avaliado_por, v_realizado_por)
      );
    END IF;

    -- Avaliação realizada
    IF OLD.avaliado_por IS DISTINCT FROM NEW.avaliado_por AND NEW.avaliado_por IS NOT NULL THEN
      INSERT INTO public.candidatos_voluntario_historico (
        candidato_id, acao, observacoes, realizado_por
      ) VALUES (
        NEW.id, 'avaliado', COALESCE(NEW.observacoes, 'Candidato avaliado'), NEW.avaliado_por
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Criar trigger
CREATE TRIGGER trigger_log_candidato_voluntario
AFTER INSERT OR UPDATE ON public.candidatos_voluntario
FOR EACH ROW
EXECUTE FUNCTION public.log_candidato_voluntario_changes();