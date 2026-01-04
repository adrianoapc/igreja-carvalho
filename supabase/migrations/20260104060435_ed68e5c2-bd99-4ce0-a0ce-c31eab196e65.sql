
-- =====================================================
-- MIGRAÇÃO: Completar escopo igreja_id/filial_id e RLS
-- =====================================================

-- 1. Adicionar igreja_id e filial_id às tabelas operacionais que faltam

-- inscricoes_jornada (herda de jornada, mas precisa ter para RLS direto)
ALTER TABLE public.inscricoes_jornada 
  ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id),
  ADD COLUMN IF NOT EXISTS filial_id UUID DEFAULT public.get_current_user_filial_id();

-- Backfill inscricoes_jornada via jornada
UPDATE public.inscricoes_jornada ij
SET 
  igreja_id = j.igreja_id,
  filial_id = j.filial_id
FROM public.jornadas j
WHERE ij.jornada_id = j.id
  AND ij.igreja_id IS NULL;

-- itens_template_culto (herda de template)
ALTER TABLE public.itens_template_culto 
  ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id),
  ADD COLUMN IF NOT EXISTS filial_id UUID DEFAULT public.get_current_user_filial_id();

UPDATE public.itens_template_culto itc
SET 
  igreja_id = tc.igreja_id,
  filial_id = tc.filial_id
FROM public.templates_culto tc
WHERE itc.template_id = tc.id
  AND itc.igreja_id IS NULL;

-- kids_diario (herda de criança)
ALTER TABLE public.kids_diario 
  ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id),
  ADD COLUMN IF NOT EXISTS filial_id UUID DEFAULT public.get_current_user_filial_id();

UPDATE public.kids_diario kd
SET 
  igreja_id = p.igreja_id,
  filial_id = p.filial_id
FROM public.profiles p
WHERE kd.crianca_id = p.id
  AND kd.igreja_id IS NULL;

-- logs_auditoria_chat (herda de sessao)
ALTER TABLE public.logs_auditoria_chat 
  ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id),
  ADD COLUMN IF NOT EXISTS filial_id UUID DEFAULT public.get_current_user_filial_id();

UPDATE public.logs_auditoria_chat lac
SET 
  igreja_id = ab.igreja_id,
  filial_id = ab.filial_id
FROM public.atendimentos_bot ab
WHERE lac.sessao_id = ab.id
  AND lac.igreja_id IS NULL;

-- respostas_quiz (herda de inscricao)
ALTER TABLE public.respostas_quiz 
  ADD COLUMN IF NOT EXISTS igreja_id UUID REFERENCES public.igrejas(id),
  ADD COLUMN IF NOT EXISTS filial_id UUID DEFAULT public.get_current_user_filial_id();

UPDATE public.respostas_quiz rq
SET 
  igreja_id = ij.igreja_id,
  filial_id = ij.filial_id
FROM public.inscricoes_jornada ij
WHERE rq.inscricao_id = ij.id
  AND rq.igreja_id IS NULL;

-- 2. Criar índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_inscricoes_jornada_igreja_id ON public.inscricoes_jornada(igreja_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_jornada_filial_id ON public.inscricoes_jornada(filial_id);
CREATE INDEX IF NOT EXISTS idx_itens_template_culto_igreja_id ON public.itens_template_culto(igreja_id);
CREATE INDEX IF NOT EXISTS idx_itens_template_culto_filial_id ON public.itens_template_culto(filial_id);
CREATE INDEX IF NOT EXISTS idx_kids_diario_igreja_id ON public.kids_diario(igreja_id);
CREATE INDEX IF NOT EXISTS idx_kids_diario_filial_id ON public.kids_diario(filial_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_chat_igreja_id ON public.logs_auditoria_chat(igreja_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_chat_filial_id ON public.logs_auditoria_chat(filial_id);
CREATE INDEX IF NOT EXISTS idx_respostas_quiz_igreja_id ON public.respostas_quiz(igreja_id);
CREATE INDEX IF NOT EXISTS idx_respostas_quiz_filial_id ON public.respostas_quiz(filial_id);

-- 3. Tabelas de configuração global (notificacao_eventos, notificacao_regras) não precisam de igreja_id
-- Elas são configurações de sistema compartilhadas entre todas as igrejas

-- 4. FK de filial_id para novas tabelas
ALTER TABLE public.inscricoes_jornada 
  ADD CONSTRAINT inscricoes_jornada_filial_id_fkey 
  FOREIGN KEY (filial_id) REFERENCES public.filiais(id);

ALTER TABLE public.itens_template_culto 
  ADD CONSTRAINT itens_template_culto_filial_id_fkey 
  FOREIGN KEY (filial_id) REFERENCES public.filiais(id);

ALTER TABLE public.kids_diario 
  ADD CONSTRAINT kids_diario_filial_id_fkey 
  FOREIGN KEY (filial_id) REFERENCES public.filiais(id);

ALTER TABLE public.logs_auditoria_chat 
  ADD CONSTRAINT logs_auditoria_chat_filial_id_fkey 
  FOREIGN KEY (filial_id) REFERENCES public.filiais(id);

ALTER TABLE public.respostas_quiz 
  ADD CONSTRAINT respostas_quiz_filial_id_fkey 
  FOREIGN KEY (filial_id) REFERENCES public.filiais(id);
