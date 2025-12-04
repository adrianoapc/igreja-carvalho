-- VIEW 1: Ocupação das Salas em Tempo Real
-- Conta crianças com check-in ativo (checkout_at IS NULL) por sala
CREATE OR REPLACE VIEW public.view_room_occupancy AS
SELECT 
  s.id as sala_id,
  s.nome as room_name,
  s.capacidade as capacity,
  s.idade_min,
  s.idade_max,
  COUNT(pa.id) as current_count,
  CASE 
    WHEN s.capacidade > 0 THEN ROUND((COUNT(pa.id)::numeric / s.capacidade::numeric) * 100, 1)
    ELSE 0
  END as occupancy_rate
FROM public.salas s
LEFT JOIN public.aulas a ON s.id = a.sala_id AND a.data_inicio::date = CURRENT_DATE
LEFT JOIN public.presencas_aula pa ON a.id = pa.aula_id AND pa.checkout_at IS NULL
WHERE s.ativo = true AND s.tipo = 'kids'
GROUP BY s.id, s.nome, s.capacidade, s.idade_min, s.idade_max;

-- VIEW 2: Crianças "Sumidas" (Ausentes há mais de 14 dias mas que vieram nos últimos 60)
-- Busca crianças (menores de 13 anos) que frequentavam mas pararam
CREATE OR REPLACE VIEW public.view_absent_kids AS
SELECT 
  p.id as child_id,
  p.nome as full_name,
  p.data_nascimento,
  p.alergias,
  p.telefone as parent_phone,
  -- Busca responsável da família
  (
    SELECT pr.nome 
    FROM public.profiles pr 
    WHERE pr.familia_id = p.familia_id 
      AND pr.responsavel_legal = true
    LIMIT 1
  ) as parent_name,
  MAX(pa.checkin_at) as last_visit,
  EXTRACT(DAY FROM (NOW() - MAX(pa.checkin_at))) as days_absent
FROM public.profiles p
JOIN public.presencas_aula pa ON p.id = pa.aluno_id
WHERE 
  p.data_nascimento IS NOT NULL
  AND DATE_PART('year', AGE(p.data_nascimento)) < 13
GROUP BY p.id, p.nome, p.data_nascimento, p.alergias, p.telefone, p.familia_id
HAVING 
  MAX(pa.checkin_at) < NOW() - INTERVAL '14 days' 
  AND MAX(pa.checkin_at) > NOW() - INTERVAL '60 days';