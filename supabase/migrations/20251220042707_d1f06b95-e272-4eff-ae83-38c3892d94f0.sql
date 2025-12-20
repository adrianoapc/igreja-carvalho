-- Corrigir view para usar SECURITY INVOKER (respeitará RLS do usuário)
DROP VIEW IF EXISTS view_agenda_secretaria;

CREATE VIEW view_agenda_secretaria
WITH (security_invoker = true) AS
SELECT 
  ap.id,
  ap.created_at,
  ap.status,
  ap.data_agendamento,
  ap.local_atendimento,
  ap.pastor_responsavel_id,
  p_pastor.nome AS pastor_nome,
  COALESCE(p_pessoa.nome, vl.nome, 'Anônimo') AS pessoa_nome,
  'CONFIDENCIAL' AS conteudo
FROM atendimentos_pastorais ap
LEFT JOIN profiles p_pastor ON p_pastor.id = ap.pastor_responsavel_id
LEFT JOIN profiles p_pessoa ON p_pessoa.id = ap.pessoa_id
LEFT JOIN visitantes_leads vl ON vl.id = ap.visitante_id;