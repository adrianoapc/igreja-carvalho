-- Adicionar campo cnpj_banco na tabela contas
ALTER TABLE public.contas 
ADD COLUMN cnpj_banco TEXT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.contas.cnpj_banco IS 'CNPJ do banco para integrações bancárias (ex: 90400888000142 para Santander)';