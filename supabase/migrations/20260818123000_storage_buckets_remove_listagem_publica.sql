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
--     Dropar a policy de SELECT não afeta esse caminho.
--   * grep em src/ e supabase/functions/: nenhum call site usa
--     `.storage.from(...).list(...)` para nenhum dos 5 buckets — só
--     `.getPublicUrl(...)` (string local, sem rede) em
--     AvatarUpload.tsx (x2), ComunicadoDialog.tsx, MidiaDialog.tsx.
--     Nenhum uso de `.createSignedUrl(...)` nesses buckets tampouco.
--   * Ou seja: remover a policy de SELECT fecha a listagem pública sem
--     quebrar upload/exibição de avatar, logo, banners, mídias ou
--     comunicados.
DROP POLICY IF EXISTS "Avatars são visíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Logo público para leitura" ON storage.objects;
DROP POLICY IF EXISTS "Públicas podem ver mídias" ON storage.objects;
DROP POLICY IF EXISTS "Todos podem ver imagens de banners" ON storage.objects;
DROP POLICY IF EXISTS "comunicados_public_access" ON storage.objects;
