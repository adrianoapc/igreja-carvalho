-- Cria tabela para links encurtados contextualizados por igreja/filial
CREATE TABLE IF NOT EXISTS public.short_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  target_url text not null,
  igreja_id uuid not null references public.igrejas(id) on delete cascade,
  filial_id uuid references public.filiais(id) on delete set null,
  is_all_filiais boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint short_links_slug_len check (char_length(slug) >= 4)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS short_links_igreja_id_idx ON public.short_links (igreja_id);
CREATE INDEX IF NOT EXISTS short_links_created_by_idx ON public.short_links (created_by);
CREATE INDEX IF NOT EXISTS short_links_target_url_idx ON public.short_links (target_url);
CREATE INDEX IF NOT EXISTS short_links_slug_idx ON public.short_links (slug);

-- Habilitar RLS
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

-- Políticas RLS

-- Leitura pública para resolver links (qualquer pessoa pode acessar um link curto)
CREATE POLICY "short_links_select_public"
ON public.short_links
FOR SELECT
TO anon, authenticated
USING (
  expires_at IS NULL OR expires_at > now()
);

-- Inserção restrita a usuários autenticados da mesma igreja
CREATE POLICY "short_links_insert_authenticated"
ON public.short_links
FOR INSERT
TO authenticated
WITH CHECK (
  igreja_id = public.get_current_user_igreja_id()
  AND created_by = auth.uid()
);

-- Atualização restrita ao criador ou admin
CREATE POLICY "short_links_update_owner_admin"
ON public.short_links
FOR UPDATE
TO authenticated
USING (
  igreja_id = public.get_current_user_igreja_id()
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  igreja_id = public.get_current_user_igreja_id()
);

-- Deleção restrita ao criador ou admin
CREATE POLICY "short_links_delete_owner_admin"
ON public.short_links
FOR DELETE
TO authenticated
USING (
  igreja_id = public.get_current_user_igreja_id()
  AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
);

COMMENT ON TABLE public.short_links IS 'Links encurtados contextualizados por igreja/filial para compartilhamento de cadastros e outros recursos';