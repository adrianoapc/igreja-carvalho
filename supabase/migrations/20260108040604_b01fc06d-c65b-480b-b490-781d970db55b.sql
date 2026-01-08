-- Create import_jobs table for tracking imports
CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id uuid NOT NULL REFERENCES filiais(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo varchar(50) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  file_name varchar(255) NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  imported_rows int NOT NULL DEFAULT 0,
  rejected_rows int NOT NULL DEFAULT 0,
  status varchar(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'undone')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  undone_at timestamptz
);

-- Create import_job_items table for tracking individual transactions
CREATE TABLE IF NOT EXISTS import_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  transacao_id uuid REFERENCES transacoes_financeiras(id) ON DELETE SET NULL,
  row_index int NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'rejected', 'deleted')),
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create import_presets table for saving column mappings
CREATE TABLE IF NOT EXISTS import_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id uuid NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id uuid NOT NULL REFERENCES filiais(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo varchar(50) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  name varchar(255) NOT NULL,
  description text,
  mapping jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(igreja_id, filial_id, user_id, tipo, name)
);

-- Create indexes for faster queries
CREATE INDEX idx_import_jobs_igreja_id ON import_jobs(igreja_id);
CREATE INDEX idx_import_jobs_filial_id ON import_jobs(filial_id);
CREATE INDEX idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON import_jobs(status);
CREATE INDEX idx_import_jobs_created_at ON import_jobs(created_at DESC);
CREATE INDEX idx_import_job_items_job_id ON import_job_items(job_id);
CREATE INDEX idx_import_job_items_transacao_id ON import_job_items(transacao_id);
CREATE INDEX idx_import_job_items_status ON import_job_items(status);
CREATE INDEX idx_import_presets_igreja_id ON import_presets(igreja_id);
CREATE INDEX idx_import_presets_filial_id ON import_presets(filial_id);
CREATE INDEX idx_import_presets_user_id ON import_presets(user_id);
CREATE INDEX idx_import_presets_tipo ON import_presets(tipo);

-- Enable RLS
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for import_jobs
CREATE POLICY "Users can view import jobs from their igreja"
ON import_jobs FOR SELECT
USING (public.has_filial_access(igreja_id, filial_id));

CREATE POLICY "Users can insert import jobs"
ON import_jobs FOR INSERT
WITH CHECK (
  public.has_filial_access(igreja_id, filial_id)
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update their own import jobs"
ON import_jobs FOR UPDATE
USING (user_id = auth.uid());

-- RLS Policies for import_job_items
CREATE POLICY "Users can view import job items"
ON import_job_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM import_jobs ij
    WHERE ij.id = import_job_items.job_id
    AND public.has_filial_access(ij.igreja_id, ij.filial_id)
  )
);

CREATE POLICY "Users can insert import job items"
ON import_job_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_jobs ij
    WHERE ij.id = job_id
    AND ij.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update import job items"
ON import_job_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM import_jobs ij
    WHERE ij.id = import_job_items.job_id
    AND ij.user_id = auth.uid()
  )
);

-- RLS Policies for import_presets
CREATE POLICY "Users can view presets"
ON import_presets FOR SELECT
USING (
  user_id = auth.uid()
  OR public.has_filial_access(igreja_id, filial_id)
);

CREATE POLICY "Users can create presets"
ON import_presets FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND public.has_filial_access(igreja_id, filial_id)
);

CREATE POLICY "Users can update their own presets"
ON import_presets FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own presets"
ON import_presets FOR DELETE
USING (user_id = auth.uid());