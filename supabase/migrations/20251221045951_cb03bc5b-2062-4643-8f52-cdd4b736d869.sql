-- Adiciona a coluna de configuração de agenda no perfil
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS disponibilidade_agenda jsonb DEFAULT '{"padrao": true}'::jsonb;

-- Comentário para documentação da estrutura esperada:
-- O campo disponibilidade_agenda pode conter:
-- { "padrao": true } - usa horário padrão (qualquer horário)
-- ou objeto com dias da semana (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab):
-- {
--   "1": { "inicio": "19:00", "fim": "22:00" },
--   "3": { "inicio": "19:00", "fim": "22:00" }
-- }