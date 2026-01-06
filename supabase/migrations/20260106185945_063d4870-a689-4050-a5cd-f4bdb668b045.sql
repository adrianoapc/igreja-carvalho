-- Remove trigger
DROP TRIGGER IF EXISTS on_filial_created_short_links ON filiais;

-- Remove all related functions
DROP FUNCTION IF EXISTS trigger_create_filial_short_links();
DROP FUNCTION IF EXISTS create_filial_short_links(UUID);
DROP FUNCTION IF EXISTS create_igreja_short_links(UUID, UUID);
DROP FUNCTION IF EXISTS generate_filial_slug(TEXT);
DROP FUNCTION IF EXISTS remove_accents(TEXT);

-- Add comment to mark table as deprecated
COMMENT ON TABLE short_links IS 'DEPRECATED: Esta tabela não está mais em uso ativo. Mantida para histórico de dados existentes.';