-- Adiciona filial_id nas tabelas de reembolsos e atualiza a view para multi-filial

-- solicitacoes_reembolso: coluna filial_id + FK + indice
ALTER TABLE public.solicitacoes_reembolso ADD COLUMN IF NOT EXISTS filial_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_reembolso_filial_id_fkey'
  ) THEN
    ALTER TABLE public.solicitacoes_reembolso
      ADD CONSTRAINT solicitacoes_reembolso_filial_id_fkey
      FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_solicitacoes_reembolso_filial_id ON public.solicitacoes_reembolso(filial_id);

-- itens_reembolso: coluna filial_id + FK + indice (mantem alinhamento com solicitacao)
ALTER TABLE public.itens_reembolso ADD COLUMN IF NOT EXISTS filial_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'itens_reembolso_filial_id_fkey'
  ) THEN
    ALTER TABLE public.itens_reembolso
      ADD CONSTRAINT itens_reembolso_filial_id_fkey
      FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_itens_reembolso_filial_id ON public.itens_reembolso(filial_id);

-- Atualiza view para expor igreja_id/filial_id e manter security invoker
DROP VIEW IF EXISTS public.view_solicitacoes_reembolso;
CREATE VIEW public.view_solicitacoes_reembolso WITH (security_invoker = true) AS
SELECT 
  sr.id,
  sr.solicitante_id,
  sr.status,
  sr.data_solicitacao,
  sr.data_vencimento,
  sr.data_pagamento,
  sr.forma_pagamento_preferida,
  sr.dados_bancarios,
  sr.observacoes,
  sr.valor_total,
  sr.comprovante_pagamento_url,
  sr.created_at,
  sr.updated_at,
  sr.igreja_id,
  sr.filial_id,
  p.nome AS solicitante_nome,
  p.email AS solicitante_email,
  p.telefone AS solicitante_telefone,
  p.avatar_url AS solicitante_avatar,
  (
    SELECT COUNT(*)
    FROM public.transacoes_financeiras tf
    WHERE tf.solicitacao_reembolso_id = sr.id
  ) AS quantidade_itens
FROM public.solicitacoes_reembolso sr
JOIN public.profiles p ON p.id = sr.solicitante_id
ORDER BY sr.created_at DESC;

COMMENT ON VIEW public.view_solicitacoes_reembolso IS 'Solicitações de reembolso com dados do solicitante (multi-igreja/filial)';
