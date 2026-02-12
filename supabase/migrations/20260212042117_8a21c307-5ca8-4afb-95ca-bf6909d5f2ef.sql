
-- Tabela de auditoria para rastrear alterações em profiles
CREATE TABLE IF NOT EXISTS public.profile_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'VIEW')),
  table_name TEXT NOT NULL,
  column_name TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_profile_audit_log_profile_id ON public.profile_audit_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_audit_log_created_at ON public.profile_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_audit_log_user_id ON public.profile_audit_log(user_id);

-- RLS para auditoria
ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs from same church"
ON public.profile_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.igreja_id = p2.igreja_id
    WHERE p1.id = profile_audit_log.profile_id
    AND p2.user_id = auth.uid()
  )
);

-- Função para registrar auditoria ao atualizar profiles
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  _old_value TEXT;
  _new_value TEXT;
  _column_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOREACH _column_name IN ARRAY
      ARRAY['nome', 'email', 'telefone', 'cep', 'cidade', 'bairro', 'estado', 'endereco', 'numero', 'complemento', 'status']
    LOOP
      _old_value := CASE _column_name
        WHEN 'nome' THEN OLD.nome::TEXT
        WHEN 'email' THEN OLD.email::TEXT
        WHEN 'telefone' THEN OLD.telefone::TEXT
        WHEN 'cep' THEN OLD.cep::TEXT
        WHEN 'cidade' THEN OLD.cidade::TEXT
        WHEN 'bairro' THEN OLD.bairro::TEXT
        WHEN 'estado' THEN OLD.estado::TEXT
        WHEN 'endereco' THEN OLD.endereco::TEXT
        WHEN 'numero' THEN OLD.numero::TEXT
        WHEN 'complemento' THEN OLD.complemento::TEXT
        WHEN 'status' THEN OLD.status::TEXT
      END;

      _new_value := CASE _column_name
        WHEN 'nome' THEN NEW.nome::TEXT
        WHEN 'email' THEN NEW.email::TEXT
        WHEN 'telefone' THEN NEW.telefone::TEXT
        WHEN 'cep' THEN NEW.cep::TEXT
        WHEN 'cidade' THEN NEW.cidade::TEXT
        WHEN 'bairro' THEN NEW.bairro::TEXT
        WHEN 'estado' THEN NEW.estado::TEXT
        WHEN 'endereco' THEN NEW.endereco::TEXT
        WHEN 'numero' THEN NEW.numero::TEXT
        WHEN 'complemento' THEN NEW.complemento::TEXT
        WHEN 'status' THEN NEW.status::TEXT
      END;

      IF _old_value IS DISTINCT FROM _new_value THEN
        INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, column_name, old_value, new_value, description)
        VALUES (NEW.id, auth.uid(), 'UPDATE', 'profiles', _column_name, _old_value, _new_value,
          CONCAT(_column_name, ' alterado de "', COALESCE(_old_value, 'vazio'), '" para "', COALESCE(_new_value, 'vazio'), '"'));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para profiles
DROP TRIGGER IF EXISTS trigger_audit_profile_changes ON public.profiles;
CREATE TRIGGER trigger_audit_profile_changes
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.audit_profile_changes();

-- Função para registrar auditoria ao modificar contatos
CREATE OR REPLACE FUNCTION public.audit_contact_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, description, old_value, new_value)
    VALUES (NEW.profile_id, auth.uid(), 'CREATE', 'profile_contatos',
      CONCAT('Novo contato adicionado: ', NEW.tipo, ' - ', NEW.valor), NULL, CONCAT(NEW.tipo, ': ', NEW.valor));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.valor IS DISTINCT FROM NEW.valor OR OLD.tipo IS DISTINCT FROM NEW.tipo THEN
      INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, description, old_value, new_value)
      VALUES (NEW.profile_id, auth.uid(), 'UPDATE', 'profile_contatos',
        CONCAT('Contato alterado de ', OLD.tipo, ' para ', NEW.tipo),
        CONCAT(OLD.tipo, ': ', OLD.valor), CONCAT(NEW.tipo, ': ', NEW.valor));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, description, old_value, new_value)
    VALUES (OLD.profile_id, auth.uid(), 'DELETE', 'profile_contatos',
      CONCAT('Contato removido: ', OLD.tipo, ' - ', OLD.valor),
      CONCAT(OLD.tipo, ': ', OLD.valor), NULL);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para profile_contatos
DROP TRIGGER IF EXISTS trigger_audit_contact_changes ON public.profile_contatos;
CREATE TRIGGER trigger_audit_contact_changes
AFTER INSERT OR UPDATE OR DELETE ON public.profile_contatos
FOR EACH ROW
EXECUTE FUNCTION public.audit_contact_changes();
