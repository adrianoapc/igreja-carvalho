
-- MIGRATION: Fase 1 - Deduplicação de Pessoas
-- Data: 11/02/2026

-- 1. Tabela para suspeitas de duplicidade
CREATE TABLE IF NOT EXISTS public.pessoas_duplicatas_suspeitas (
    id BIGSERIAL PRIMARY KEY,
    pessoa_id_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pessoa_id_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score_similaridade NUMERIC(5,4) NOT NULL,
    campos_conflitantes JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'pendente',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revisado_em TIMESTAMP WITH TIME ZONE,
    revisado_por UUID REFERENCES public.profiles(id)
);

COMMENT ON TABLE public.pessoas_duplicatas_suspeitas IS 'Pares de pessoas suspeitas de duplicidade com score de similaridade';
COMMENT ON COLUMN public.pessoas_duplicatas_suspeitas.status IS 'pendente, revisado, descartado';

-- 2. Tabela para histórico de mesclagens
CREATE TABLE IF NOT EXISTS public.pessoas_mesclagens_historico (
    id BIGSERIAL PRIMARY KEY,
    pessoa_origem_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pessoa_destino_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    campos_mesclados JSONB,
    realizado_por UUID REFERENCES public.profiles(id),
    realizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.pessoas_mesclagens_historico IS 'Histórico de operações de mesclagem de registros duplicados';

-- 3. Campos de controle na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.profiles(id);

-- 4. RLS
ALTER TABLE public.pessoas_duplicatas_suspeitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoas_mesclagens_historico ENABLE ROW LEVEL SECURITY;

-- Políticas: apenas usuários autenticados com papel admin podem acessar
CREATE POLICY "Admin pode visualizar suspeitas de duplicidade"
ON public.pessoas_duplicatas_suspeitas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode inserir suspeitas de duplicidade"
ON public.pessoas_duplicatas_suspeitas FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode atualizar suspeitas de duplicidade"
ON public.pessoas_duplicatas_suspeitas FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode deletar suspeitas de duplicidade"
ON public.pessoas_duplicatas_suspeitas FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode visualizar histórico de mesclagens"
ON public.pessoas_mesclagens_historico FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode inserir histórico de mesclagens"
ON public.pessoas_mesclagens_historico FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_duplicatas_pessoa1 ON public.pessoas_duplicatas_suspeitas(pessoa_id_1);
CREATE INDEX IF NOT EXISTS idx_duplicatas_pessoa2 ON public.pessoas_duplicatas_suspeitas(pessoa_id_2);
CREATE INDEX IF NOT EXISTS idx_duplicatas_status ON public.pessoas_duplicatas_suspeitas(status);
CREATE INDEX IF NOT EXISTS idx_mesclagens_origem ON public.pessoas_mesclagens_historico(pessoa_origem_id);
CREATE INDEX IF NOT EXISTS idx_mesclagens_destino ON public.pessoas_mesclagens_historico(pessoa_destino_id);
CREATE INDEX IF NOT EXISTS idx_profiles_merged ON public.profiles(is_merged) WHERE is_merged = true;
