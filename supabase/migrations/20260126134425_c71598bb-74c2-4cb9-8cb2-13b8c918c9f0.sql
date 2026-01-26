-- ==========================================
-- MÓDULO DE LOTES DE INGRESSOS PARA EVENTOS
-- ==========================================

-- 1. Criar tabela de lotes de eventos
CREATE TABLE IF NOT EXISTS evento_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, -- Ex: "Lote 1", "Promocional", "Infantil", "Casal"
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  vigencia_inicio TIMESTAMP WITH TIME ZONE,
  vigencia_fim TIMESTAMP WITH TIME ZONE,
  vagas_limite INTEGER DEFAULT NULL, -- null = ilimitado
  vagas_utilizadas INTEGER DEFAULT 0,
  ordem INTEGER DEFAULT 0, -- Para ordenação na interface
  ativo BOOLEAN DEFAULT true,
  igreja_id UUID REFERENCES igrejas(id),
  filial_id UUID REFERENCES filiais(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Adicionar campo lote_id na tabela de inscrições
ALTER TABLE inscricoes_eventos 
ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES evento_lotes(id),
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2) DEFAULT 0.00;

-- 3. Trigger para updated_at
CREATE TRIGGER update_evento_lotes_updated_at
  BEFORE UPDATE ON evento_lotes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Habilitar RLS
ALTER TABLE evento_lotes ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de segurança

-- Admins podem gerenciar todos os lotes
CREATE POLICY "Admins podem gerenciar evento_lotes"
  ON evento_lotes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Usuários autenticados podem visualizar lotes ativos
CREATE POLICY "Usuarios podem ver lotes ativos"
  ON evento_lotes FOR SELECT
  USING (ativo = true);

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_evento_lotes_evento ON evento_lotes(evento_id);
CREATE INDEX IF NOT EXISTS idx_evento_lotes_vigencia ON evento_lotes(vigencia_inicio, vigencia_fim);
CREATE INDEX IF NOT EXISTS idx_inscricoes_eventos_lote ON inscricoes_eventos(lote_id);

-- 7. Função para atualizar vagas_utilizadas
CREATE OR REPLACE FUNCTION update_lote_vagas_utilizadas()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.lote_id IS NOT NULL THEN
    UPDATE evento_lotes 
    SET vagas_utilizadas = vagas_utilizadas + 1 
    WHERE id = NEW.lote_id;
  ELSIF TG_OP = 'DELETE' AND OLD.lote_id IS NOT NULL THEN
    UPDATE evento_lotes 
    SET vagas_utilizadas = GREATEST(0, vagas_utilizadas - 1) 
    WHERE id = OLD.lote_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.lote_id IS DISTINCT FROM NEW.lote_id THEN
      IF OLD.lote_id IS NOT NULL THEN
        UPDATE evento_lotes 
        SET vagas_utilizadas = GREATEST(0, vagas_utilizadas - 1) 
        WHERE id = OLD.lote_id;
      END IF;
      IF NEW.lote_id IS NOT NULL THEN
        UPDATE evento_lotes 
        SET vagas_utilizadas = vagas_utilizadas + 1 
        WHERE id = NEW.lote_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Trigger para atualizar vagas automaticamente
CREATE TRIGGER trigger_update_lote_vagas
  AFTER INSERT OR UPDATE OR DELETE ON inscricoes_eventos
  FOR EACH ROW
  EXECUTE FUNCTION update_lote_vagas_utilizadas();

-- 9. Função helper para verificar disponibilidade de lote
CREATE OR REPLACE FUNCTION check_lote_disponivel(p_lote_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_lote RECORD;
BEGIN
  SELECT * INTO v_lote FROM evento_lotes WHERE id = p_lote_id;
  
  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT v_lote.ativo THEN RETURN false; END IF;
  
  -- Verificar vigência
  IF v_lote.vigencia_inicio IS NOT NULL AND now() < v_lote.vigencia_inicio THEN
    RETURN false;
  END IF;
  IF v_lote.vigencia_fim IS NOT NULL AND now() > v_lote.vigencia_fim THEN
    RETURN false;
  END IF;
  
  -- Verificar vagas
  IF v_lote.vagas_limite IS NOT NULL AND v_lote.vagas_utilizadas >= v_lote.vagas_limite THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;