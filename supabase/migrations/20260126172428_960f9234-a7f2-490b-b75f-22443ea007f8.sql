-- Criar tabela evento_lista_espera
CREATE TABLE public.evento_lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nome varchar(255) NOT NULL,
  telefone varchar(50) NOT NULL,
  email varchar(255),
  posicao_fila integer NOT NULL DEFAULT 1,
  status varchar(20) DEFAULT 'aguardando',
  visitante_lead_id uuid REFERENCES visitantes_leads(id),
  pessoa_id uuid REFERENCES profiles(id),
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid REFERENCES filiais(id),
  created_at timestamptz DEFAULT now(),
  contatado_em timestamptz,
  observacoes text,
  
  UNIQUE(evento_id, telefone)
);

-- Índices para performance
CREATE INDEX idx_lista_espera_evento_status ON evento_lista_espera(evento_id, status);
CREATE INDEX idx_lista_espera_posicao ON evento_lista_espera(evento_id, posicao_fila);

-- Habilitar RLS
ALTER TABLE evento_lista_espera ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Igreja members can view lista espera" ON evento_lista_espera
  FOR SELECT USING (
    igreja_id IN (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Igreja members can insert lista espera" ON evento_lista_espera
  FOR INSERT WITH CHECK (
    igreja_id IN (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Igreja members can update lista espera" ON evento_lista_espera
  FOR UPDATE USING (
    igreja_id IN (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Igreja members can delete lista espera" ON evento_lista_espera
  FOR DELETE USING (
    igreja_id IN (SELECT igreja_id FROM profiles WHERE id = auth.uid())
  );

-- Service role pode fazer tudo (para edge functions)
CREATE POLICY "Service role full access lista espera" ON evento_lista_espera
  FOR ALL USING (auth.role() = 'service_role');

-- Adicionar campo mostrar_posicao_fila na tabela eventos
ALTER TABLE public.eventos
ADD COLUMN mostrar_posicao_fila boolean DEFAULT false;