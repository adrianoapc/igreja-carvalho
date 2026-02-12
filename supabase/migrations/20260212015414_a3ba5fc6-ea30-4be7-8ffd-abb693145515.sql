
-- Migration: profile_contatos

CREATE TABLE IF NOT EXISTS public.profile_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('telefone', 'email', 'instagram', 'outro')),
  valor TEXT NOT NULL,
  rotulo TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  is_login BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS
ALTER TABLE public.profile_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contacts from same church"
ON public.profile_contatos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.igreja_id = p2.igreja_id
    WHERE p1.id = profile_contatos.profile_id
    AND p2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage their own contacts"
ON public.profile_contatos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = profile_contatos.profile_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own contacts"
ON public.profile_contatos FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = profile_contatos.profile_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own contacts"
ON public.profile_contatos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = profile_contatos.profile_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all contacts"
ON public.profile_contatos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Migração dos dados atuais
INSERT INTO public.profile_contatos (
  profile_id, tipo, valor, rotulo, is_primary, is_whatsapp, is_login, created_at, updated_at
)
SELECT
  id, 'telefone', telefone, 'Pessoal', TRUE, TRUE, FALSE, now(), now()
FROM public.profiles
WHERE telefone IS NOT NULL AND telefone <> '';

INSERT INTO public.profile_contatos (
  profile_id, tipo, valor, rotulo, is_primary, is_whatsapp, is_login, created_at, updated_at
)
SELECT
  id, 'email', email, 'Pessoal', TRUE, FALSE, TRUE, now(), now()
FROM public.profiles
WHERE email IS NOT NULL AND email <> '';

-- Renomear colunas antigas
ALTER TABLE public.profiles RENAME COLUMN telefone TO legacy_telefone;
ALTER TABLE public.profiles RENAME COLUMN email TO legacy_email;
