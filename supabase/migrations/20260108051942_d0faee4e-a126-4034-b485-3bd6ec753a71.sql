-- Reclassificacao em lote: jobs e itens
CREATE TABLE IF NOT EXISTS reclass_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    igreja_id uuid NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    filial_id uuid REFERENCES filiais(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
    filtros_aplicados jsonb,
    campos_alterados jsonb,
    total_linhas integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'undone')),
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    error_reason text
);

CREATE TABLE IF NOT EXISTS reclass_job_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES reclass_jobs(id) ON DELETE CASCADE,
    transacao_id uuid REFERENCES transacoes_financeiras(id) ON DELETE CASCADE,
    antes jsonb,
    depois jsonb,
    status text NOT NULL DEFAULT 'updated' CHECK (status IN ('updated', 'failed', 'reverted')),
    error_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reclass_jobs_igreja ON reclass_jobs(igreja_id);
CREATE INDEX IF NOT EXISTS idx_reclass_jobs_status ON reclass_jobs(status);
CREATE INDEX IF NOT EXISTS idx_reclass_jobs_created ON reclass_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reclass_job_items_job ON reclass_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_reclass_job_items_transacao ON reclass_job_items(transacao_id);

-- Enable RLS
ALTER TABLE reclass_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclass_job_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reclass_jobs
CREATE POLICY "Users can view reclass jobs from their igreja"
ON reclass_jobs FOR SELECT
USING (has_filial_access(igreja_id, filial_id));

CREATE POLICY "Users can insert reclass jobs"
ON reclass_jobs FOR INSERT
WITH CHECK (user_id = auth.uid() AND has_filial_access(igreja_id, filial_id));

CREATE POLICY "Users can update their own reclass jobs"
ON reclass_jobs FOR UPDATE
USING (user_id = auth.uid());

-- RLS Policies for reclass_job_items
CREATE POLICY "Users can view reclass job items"
ON reclass_job_items FOR SELECT
USING (EXISTS (
    SELECT 1 FROM reclass_jobs rj 
    WHERE rj.id = reclass_job_items.job_id 
    AND has_filial_access(rj.igreja_id, rj.filial_id)
));

CREATE POLICY "Users can insert reclass job items"
ON reclass_job_items FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM reclass_jobs rj 
    WHERE rj.id = job_id 
    AND rj.user_id = auth.uid()
));