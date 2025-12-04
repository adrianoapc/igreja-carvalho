-- Adiciona constraint única para permitir upsert de presenças
ALTER TABLE public.presencas_aula 
ADD CONSTRAINT presencas_aula_unique_aluno 
UNIQUE (aula_id, aluno_id);