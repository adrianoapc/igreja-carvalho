-- Normalizar telefones existentes na tabela profiles
-- Remove código de país 55 e caracteres não numéricos, mantendo apenas DDD + número (10-11 dígitos)

UPDATE profiles
SET telefone = 
  CASE 
    -- Telefone com 55 no início e mais de 11 dígitos numéricos: remove 55
    WHEN LENGTH(REGEXP_REPLACE(telefone, '\D', '', 'g')) > 11 
     AND REGEXP_REPLACE(telefone, '\D', '', 'g') LIKE '55%'
    THEN SUBSTRING(REGEXP_REPLACE(telefone, '\D', '', 'g') FROM 3)
    -- Caso contrário: apenas remove caracteres não numéricos
    ELSE REGEXP_REPLACE(telefone, '\D', '', 'g')
  END
WHERE telefone IS NOT NULL
  AND telefone != '';

-- Criar comentário para documentar o padrão
COMMENT ON COLUMN profiles.telefone IS 'Telefone normalizado: apenas DDD + número (10-11 dígitos). Ex: 17996486580';