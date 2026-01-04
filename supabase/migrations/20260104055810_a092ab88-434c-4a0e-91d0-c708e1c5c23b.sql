-- Adicionar FKs para filial_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'filial_id'
      AND table_name NOT IN ('filiais')
  LOOP
    -- Adicionar FK se não existir
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = r.table_name || '_filial_id_fkey'
        AND table_name = r.table_name
        AND table_schema = 'public'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (filial_id) REFERENCES public.filiais(id);',
        r.table_name,
        r.table_name || '_filial_id_fkey'
      );
    END IF;
  END LOOP;
END $$;