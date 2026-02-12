
-- Adicionar colunas igreja_id e filial_id
ALTER TABLE public.profile_audit_log
ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id),
ADD COLUMN IF NOT EXISTS filial_id UUID REFERENCES public.filiais(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profile_audit_log_igreja_id ON public.profile_audit_log(igreja_id);
CREATE INDEX IF NOT EXISTS idx_profile_audit_log_filial_id ON public.profile_audit_log(filial_id);

-- Preencher dados existentes a partir de profiles
UPDATE public.profile_audit_log pal
SET
  igreja_id = p.igreja_id,
  filial_id = p.filial_id
FROM public.profiles p
WHERE pal.profile_id = p.id
  AND pal.igreja_id IS NULL;

-- Corrigir RLS: dropar política antiga e criar nova com isolamento por igreja
DROP POLICY IF EXISTS "Users can view audit logs from same church" ON public.profile_audit_log;

CREATE POLICY "Users can view audit logs from same church"
ON public.profile_audit_log FOR SELECT
TO authenticated
USING (
  igreja_id = (SELECT p.igreja_id FROM profiles p WHERE p.user_id = auth.uid())
);

-- Atualizar triggers para incluir igreja_id e filial_id

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
        INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, column_name, old_value, new_value, description, igreja_id, filial_id)
        VALUES (NEW.id, auth.uid(), 'UPDATE', 'profiles', _column_name, _old_value, _new_value,
          CONCAT(_column_name, ' alterado de "', COALESCE(_old_value, 'vazio'), '" para "', COALESCE(_new_value, 'vazio'), '"'),
          NEW.igreja_id, NEW.filial_id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.audit_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
  _igreja_id UUID;
  _filial_id UUID;
BEGIN
  SELECT p.igreja_id, p.filial_id INTO _igreja_id, _filial_id
  FROM profiles p WHERE p.id = COALESCE(NEW.profile_id, OLD.profile_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, description, old_value, new_value, igreja_id, filial_id)
    VALUES (NEW.profile_id, auth.uid(), 'CREATE', 'profile_contatos',
      CONCAT('Novo contato adicionado: ', NEW.tipo, ' - ', NEW.valor), NULL, CONCAT(NEW.tipo, ': ', NEW.valor), _igreja_id, _filial_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.valor IS DISTINCT FROM NEW.valor OR OLD.tipo IS DISTINCT FROM NEW.tipo THEN
      INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, description, old_value, new_value, igreja_id, filial_id)
      VALUES (NEW.profile_id, auth.uid(), 'UPDATE', 'profile_contatos',
        CONCAT('Contato alterado de ', OLD.tipo, ' para ', NEW.tipo),
        CONCAT(OLD.tipo, ': ', OLD.valor), CONCAT(NEW.tipo, ': ', NEW.valor), _igreja_id, _filial_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.profile_audit_log (profile_id, user_id, action, table_name, description, old_value, new_value, igreja_id, filial_id)
    VALUES (OLD.profile_id, auth.uid(), 'DELETE', 'profile_contatos',
      CONCAT('Contato removido: ', OLD.tipo, ' - ', OLD.valor),
      CONCAT(OLD.tipo, ': ', OLD.valor), NULL, _igreja_id, _filial_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
