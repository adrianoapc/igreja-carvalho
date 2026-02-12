
-- Adicionar colunas numero e complemento
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS complemento TEXT;

-- Normalizar dados: extrair numero e complemento do campo endereco
-- Padrão: "Rua XYZ, 511, Casa" → endereco="Rua XYZ", numero="511", complemento="Casa"
-- Padrão: "Avenida Belvedere, 550, J10" → endereco="Avenida Belvedere", numero="550", complemento="J10"
-- Padrão: "Rua das Primaveras, 487" → endereco="Rua das Primaveras", numero="487"

UPDATE public.profiles
SET
  numero = split_part(endereco, ', ', 2),
  complemento = CASE 
    WHEN array_length(string_to_array(endereco, ', '), 1) >= 3 
    THEN split_part(endereco, ', ', 3)
    ELSE NULL 
  END,
  endereco = split_part(endereco, ', ', 1)
WHERE endereco IS NOT NULL 
  AND endereco <> ''
  AND endereco LIKE '%, %'
  AND split_part(endereco, ', ', 2) ~ '^\d+';
