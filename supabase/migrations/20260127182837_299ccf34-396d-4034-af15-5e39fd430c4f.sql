-- Derived view of faltas based on inscrições e checkins (correção: status_pagamento)
CREATE OR REPLACE VIEW public.view_faltas_evento AS
SELECT
  ie.evento_id,
  ie.pessoa_id,
  ie.status_pagamento AS inscricao_status,
  c.id AS checkin_id,
  (c.id IS NULL) AS faltou
FROM public.inscricoes_eventos ie
LEFT JOIN public.checkins c
  ON c.evento_id = ie.evento_id
  AND c.pessoa_id = ie.pessoa_id;