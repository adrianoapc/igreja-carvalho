-- Linter Supabase (public_bucket_allows_listing): 5 buckets públicos
-- (avatars, banner-images, comunicados, igreja-logo, midias) têm uma
-- policy de SELECT ampla (role public/authenticated, sem filtro de path)
-- em storage.objects, que permite LISTAR todos os arquivos do bucket via
-- API (`.storage.from(bucket).list()`), não só buscar por URL direta.
--
-- Confirmado antes de tocar:
--   * Os 5 buckets têm `public = true` em storage.buckets — acesso direto
--     por URL pública (`/storage/v1/object/public/<bucket>/<path>`) NÃO
--     depende de policy nenhuma em storage.objects, só da flag `public`.
--     Dropar a policy de SELECT pública não afeta esse caminho.
--   * grep em src/ e supabase/functions/: nenhum call site usa
--     `.storage.from(...).list(...)` para nenhum dos 5 buckets — só
--     `.getPublicUrl(...)` (string local, sem rede) em
--     AvatarUpload.tsx (x2), ComunicadoDialog.tsx, MidiaDialog.tsx.
--     Nenhum uso de `.createSignedUrl(...)` nesses buckets tampouco.
--
-- NÃO basta dropar o SELECT: StorageFileApi.remove() (e upsert/update)
-- exige SELECT + DELETE/UPDATE no mesmo objeto. Call sites que
-- substituem avatar/logo ou apagam mídia/comunicado
-- (AvatarUpload.tsx, ConfiguracoesIgreja.tsx, MidiaDialog.tsx,
-- MidiasGeral.tsx, Comunicados.tsx, Publicacao.tsx) falhariam em
-- silêncio sem policy de SELECT de reposição — o registro no banco
-- muda e o arquivo antigo continua público. Recria SELECT só para
-- authenticated, com o mesmo escopo das policies de escrita já
-- existentes (path do próprio user em avatars; admin nos demais).
-- Isso fecha listagem anônima (o achado do linter) sem quebrar mutações.

DROP POLICY IF EXISTS "Avatars são visíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Logo público para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Públicas podem ver mídias" ON storage.objects;
DROP POLICY IF EXISTS "Todos podem ver imagens de banners" ON storage.objects;
DROP POLICY IF EXISTS "comunicados_public_access" ON storage.objects;

-- avatars: mesmo predicado de INSERT/UPDATE/DELETE (pasta = auth.uid())
CREATE POLICY "Usuarios podem ver seus proprios avatares"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- igreja-logo: mesmo predicado de INSERT/UPDATE/DELETE (admin)
CREATE POLICY "Admins podem ver logo"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'igreja-logo'
    AND has_role(auth.uid(), 'admin')
  );

-- midias: mesmo predicado de INSERT/UPDATE/DELETE (admin)
CREATE POLICY "Admins podem ver midias storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'midias'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- banner-images: mesmo predicado de INSERT/DELETE (admin)
CREATE POLICY "Admins podem ver imagens de banners storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'banner-images'
    AND has_role(auth.uid(), 'admin')
  );

-- comunicados: mesmo predicado das policies de escrita (admin),
-- endurecidas em 20260602195254
CREATE POLICY "comunicados_admin_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comunicados'
    AND has_role(auth.uid(), 'admin'::app_role)
  );
