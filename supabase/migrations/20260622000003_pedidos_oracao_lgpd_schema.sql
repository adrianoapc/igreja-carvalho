-- =====================================================================
-- Pedidos de Oração — Adequação LGPD (Lei 13.709/2018)
-- Base legal: Art. 7º II (consentimento), Art. 11 (dados sensíveis),
--             Art. 46 (medidas técnicas e administrativas de segurança)
-- =====================================================================

-- 1. Coluna confidencial
-- Quando true: o pedido só é visível a admin e pastor.
-- O intercessor designado NÃO vê pedidos confidenciais.
-- Difere de `anonimo` (exibição de identidade): `confidencial` age na camada
-- de acesso RLS — nem o intercessor enxerga o registro.
-- Indicado: saúde mental, abuso, situação de risco, assunto eclesiástico sensível.
ALTER TABLE public.pedidos_oracao
  ADD COLUMN IF NOT EXISTS confidencial BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pedidos_oracao.confidencial IS
  'LGPD: quando true, restringe leitura a admin/pastor via RLS. '
  'Diferente de anonimo (display): confidencial bloqueia a linha inteira para intercessores. '
  'Usar para conteúdo de alto grau de sensibilidade (saúde, abuso, risco).';

-- 2. Registro de consentimento (LGPD art. 7º II)
-- NULL para registros legados (pré-implantação deste controle).
-- Novas inserções via site DEVEM preencher com now() no momento do envio.
-- A política RLS de inserção anon EXIGE consentimento_em IS NOT NULL.
ALTER TABLE public.pedidos_oracao
  ADD COLUMN IF NOT EXISTS consentimento_em TIMESTAMPTZ;

COMMENT ON COLUMN public.pedidos_oracao.consentimento_em IS
  'LGPD art. 7º II: timestamp do consentimento explícito do titular. '
  'Obrigatório para novas inserções via site (política RLS rejeita NULL). '
  'NULL em registros anteriores a esta migração (tratamento legítimo anterior).';

-- 3. Constraint de canal de origem
-- Aceita o valor legado ''APP'' (uppercase, default histórico) via lower().
-- Novos canais aceitos: ''site'', ''whatsapp'', ''app''.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_origem_canal'
  ) THEN
    ALTER TABLE public.pedidos_oracao
      ADD CONSTRAINT check_origem_canal
      CHECK (lower(origem) IN ('site', 'whatsapp', 'app'));
  END IF;
END $$;

COMMENT ON COLUMN public.pedidos_oracao.origem IS
  'Canal de entrada: ''site'' (formulário público) | ''whatsapp'' (Make/n8n) | ''app'' (interno). '
  'Legado: ''APP'' (uppercase) aceito via lower() no CHECK. '
  'AÇÃO PENDENTE: atualizar Edge Function receber-pedido-make para enviar '
  'origem=''whatsapp'' e consentimento_em=now() explicitamente.';

-- 4. Índice para queries de expurgo (minimização de dados — LGPD art. 6º III)
CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_expurgo
  ON public.pedidos_oracao (created_at, confidencial)
  WHERE status <> 'arquivado';

-- 5. Comentário institucional (LGPD art. 37 — registro de operações de tratamento)
COMMENT ON TABLE public.pedidos_oracao IS
  'Dados pessoais sensíveis — LGPD Lei 13.709/2018. '
  'Base legal: consentimento (art. 7º II) para origem=''site''; '
  'legítimo interesse no ministério de intercessão (art. 10) para demais canais. '
  'Prazo de retenção: 12 meses após created_at. '
  'Após prazo: registros confidenciais são EXCLUÍDOS; não-confidenciais são ANONIMIZADOS. '
  'Responsável pelo tratamento: administração da igreja (ver tabela igrejas).';
