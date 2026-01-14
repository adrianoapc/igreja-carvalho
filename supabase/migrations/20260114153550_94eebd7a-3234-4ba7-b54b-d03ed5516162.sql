-- Corrigir foreign key constraints - VERSÃO CORRETA
-- 
-- IMPORTANTE: pessoa_id armazena profiles.id (o membro associado)
-- Apenas campos de "ação do usuário" (created_by, approved_by, etc.) usam auth.uid() → profiles.user_id

-- ============================================================================
-- 1. TABELA: sessoes_itens_draft
-- ============================================================================

-- 1.1. pessoa_id deve referenciar profiles.id (o membro associado)
ALTER TABLE public.sessoes_itens_draft 
DROP CONSTRAINT IF EXISTS sessoes_itens_draft_pessoa_id_fkey;

ALTER TABLE public.sessoes_itens_draft 
ADD CONSTRAINT sessoes_itens_draft_pessoa_id_fkey 
FOREIGN KEY (pessoa_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- 1.2. created_by usa auth.uid() → deve referenciar profiles.user_id
ALTER TABLE public.sessoes_itens_draft 
DROP CONSTRAINT IF EXISTS sessoes_itens_draft_created_by_fkey;

ALTER TABLE public.sessoes_itens_draft 
ADD CONSTRAINT sessoes_itens_draft_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

-- ============================================================================
-- 2. TABELA: transacoes_financeiras
-- ============================================================================

-- 2.1. pessoa_id deve referenciar profiles.id (o membro associado)
-- Esta constraint já está correta, apenas garantindo que existe
ALTER TABLE public.transacoes_financeiras 
DROP CONSTRAINT IF EXISTS transacoes_financeiras_pessoa_id_fkey;

ALTER TABLE public.transacoes_financeiras 
ADD CONSTRAINT transacoes_financeiras_pessoa_id_fkey 
FOREIGN KEY (pessoa_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- ============================================================================
-- 3. TABELA: sessoes_contagem
-- ============================================================================

-- 3.1. approved_by usa auth.uid() → deve referenciar profiles.user_id
ALTER TABLE public.sessoes_contagem 
DROP CONSTRAINT IF EXISTS sessoes_contagem_approved_by_fkey;

ALTER TABLE public.sessoes_contagem 
ADD CONSTRAINT sessoes_contagem_approved_by_fkey 
FOREIGN KEY (approved_by) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

-- 3.2. rejection_by usa auth.uid() → deve referenciar profiles.user_id
ALTER TABLE public.sessoes_contagem 
DROP CONSTRAINT IF EXISTS sessoes_contagem_rejection_by_fkey;

ALTER TABLE public.sessoes_contagem 
ADD CONSTRAINT sessoes_contagem_rejection_by_fkey 
FOREIGN KEY (rejection_by) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

-- ============================================================================
-- 4. TABELA: contagens
-- ============================================================================

-- 4.1. contador_id usa auth.uid() → deve referenciar profiles.user_id
ALTER TABLE public.contagens 
DROP CONSTRAINT IF EXISTS contagens_contador_id_fkey;

ALTER TABLE public.contagens 
ADD CONSTRAINT contagens_contador_id_fkey 
FOREIGN KEY (contador_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- ============================================================================
-- 5. Atualizar comentários com esclarecimentos
-- ============================================================================

COMMENT ON COLUMN public.sessoes_itens_draft.pessoa_id IS 
'UUID do membro associado ao lançamento. Referencia profiles.id. NULL para ofertas anônimas.';

COMMENT ON COLUMN public.sessoes_itens_draft.created_by IS 
'UUID do usuário que criou o draft (auth.uid). Referencia profiles.user_id.';

COMMENT ON COLUMN public.transacoes_financeiras.pessoa_id IS 
'UUID do membro associado ao lançamento. Referencia profiles.id. NULL para ofertas anônimas.';

COMMENT ON COLUMN public.sessoes_contagem.created_by IS 
'UUID do usuário que criou a sessão (auth.uid). Referencia profiles.user_id.';

COMMENT ON COLUMN public.sessoes_contagem.approved_by IS 
'UUID do usuário que aprovou a sessão (auth.uid). Referencia profiles.user_id.';

COMMENT ON COLUMN public.sessoes_contagem.rejection_by IS 
'UUID do usuário que rejeitou a sessão (auth.uid). Referencia profiles.user_id.';

COMMENT ON COLUMN public.contagens.contador_id IS 
'UUID do usuário contador (auth.uid). Referencia profiles.user_id.';