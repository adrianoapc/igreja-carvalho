-- 1. Atualizar a tabela de JORNADAS (Cursos)
-- Adiciona campos para definir se é pago e o valor
ALTER TABLE jornadas 
ADD COLUMN IF NOT EXISTS requer_pagamento BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2) DEFAULT 0.00;

-- 2. Atualizar a tabela de INSCRIÇÕES
-- Adiciona status do pagamento e link com a transação financeira
ALTER TABLE inscricoes_jornada 
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'isento' CHECK (status_pagamento IN ('isento', 'pendente', 'pago')),
ADD COLUMN IF NOT EXISTS transacao_id UUID REFERENCES transacoes_financeiras(id);

-- 3. Garantir Categoria Financeira para cursos pagos
INSERT INTO categorias_financeiras (nome, tipo, secao_dre, ativo)
VALUES ('Cursos e Treinamentos', 'entrada', 'Receitas', true)
ON CONFLICT DO NOTHING;