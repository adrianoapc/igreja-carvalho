-- Corrigir foreign key constraint de created_by em sessoes_contagem
-- O problema: created_by usa auth.uid() mas a FK aponta para profiles.id em vez de profiles.user_id
-- 
-- Na tabela profiles:
--   - id: PK interna (UUID gerado pelo banco)
--   - user_id: FK para auth.users.id (UUID do Supabase Auth)
--
-- A função open_sessao_contagem usa auth.uid() que retorna o user_id do auth,
-- então a constraint deve apontar para profiles.user_id, não profiles.id

-- 1. Remover a constraint incorreta
ALTER TABLE public.sessoes_contagem 
DROP CONSTRAINT IF EXISTS sessoes_contagem_created_by_fkey;

-- 2. Adicionar constraint correta apontando para profiles.user_id
ALTER TABLE public.sessoes_contagem 
ADD CONSTRAINT sessoes_contagem_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.profiles(user_id) 
ON DELETE SET NULL;

-- 3. Atualizar comentário
COMMENT ON COLUMN public.sessoes_contagem.created_by IS 
'UUID do usuário que criou a sessão (auth.uid). Referencia profiles.user_id.';