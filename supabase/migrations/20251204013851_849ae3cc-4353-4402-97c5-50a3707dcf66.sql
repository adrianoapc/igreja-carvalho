-- Garante que uma criança só pode ter UM registro com checkout_at NULL por vez.
-- Se tentar fazer check-in de novo, o banco rejeita.
CREATE UNIQUE INDEX idx_one_active_checkin_per_child 
ON public.presencas_aula (aluno_id) 
WHERE checkout_at IS NULL;