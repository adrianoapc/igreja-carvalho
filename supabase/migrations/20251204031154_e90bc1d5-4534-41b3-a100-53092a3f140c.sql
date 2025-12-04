-- Add unique constraint for etapa_id + aluno_id to allow proper upsert for course progress
CREATE UNIQUE INDEX IF NOT EXISTS presencas_aula_etapa_aluno_unique 
ON public.presencas_aula (etapa_id, aluno_id) 
WHERE etapa_id IS NOT NULL;