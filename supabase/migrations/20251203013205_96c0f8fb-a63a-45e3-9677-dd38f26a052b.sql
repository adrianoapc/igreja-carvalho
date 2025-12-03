CREATE OR REPLACE VIEW public.view_health_score AS
SELECT 
    p.id as pessoa_id,
    p.nome,
    p.status,
    p.avatar_url,
    -- Fator 1: Presença (Peso 50)
    (
        SELECT COUNT(*) * 15 -- 15 pontos por culto
        FROM public.presencas_culto pc 
        WHERE pc.pessoa_id = p.id 
        AND pc.created_at > (now() - INTERVAL '30 days')
    ) as score_presenca,
    -- Fator 2: Serviço/Voluntariado (Peso 30)
    (
        SELECT COUNT(*) * 10 -- 10 pontos por escala
        FROM public.escalas_culto ec 
        WHERE ec.pessoa_id = p.id 
        AND ec.created_at > (now() - INTERVAL '30 days')
    ) as score_servico,
    -- Fator 3: Sentimentos (Peso 20 - Penalidade)
    COALESCE((
        SELECT CASE 
            WHEN sentimento IN ('angustiado', 'triste', 'sozinho') THEN -20
            WHEN sentimento IN ('feliz', 'grato') THEN 10
            ELSE 0 
        END
        FROM public.sentimentos_membros sm
        WHERE sm.pessoa_id = p.id
        ORDER BY sm.data_registro DESC LIMIT 1
    ), 0) as score_sentimento
FROM public.profiles p
WHERE p.status IN ('membro', 'frequentador');