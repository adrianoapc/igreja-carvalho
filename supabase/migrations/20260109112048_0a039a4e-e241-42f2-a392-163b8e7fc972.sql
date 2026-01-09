-- Tabela para armazenar extratos bancários importados
CREATE TABLE IF NOT EXISTS extratos_bancarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  filial_id UUID REFERENCES filiais(id) ON DELETE SET NULL,
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  saldo NUMERIC(14,2),
  numero_documento TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  reconciliado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_conta ON extratos_bancarios(conta_id);
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_data ON extratos_bancarios(data_transacao);
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_igreja ON extratos_bancarios(igreja_id);
CREATE INDEX IF NOT EXISTS idx_extratos_bancarios_filial ON extratos_bancarios(filial_id);

-- Enable RLS
ALTER TABLE extratos_bancarios ENABLE ROW LEVEL SECURITY;

-- Policy: Users with admin or tesoureiro role can view bank statements
CREATE POLICY "Ver extratos bancarios"
ON extratos_bancarios FOR SELECT
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
);

-- Policy: Admin/Treasurer can insert bank statements
CREATE POLICY "Inserir extratos bancarios"
ON extratos_bancarios FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
);

-- Policy: Admin/Treasurer can update bank statements
CREATE POLICY "Atualizar extratos bancarios"
ON extratos_bancarios FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
)
WITH CHECK (
  (public.has_role(auth.uid(), 'admin'::app_role) OR 
   public.has_role(auth.uid(), 'tesoureiro'::app_role))
  AND igreja_id = public.get_jwt_igreja_id()
);

-- Policy: Only admin can delete bank statements
CREATE POLICY "Deletar extratos bancarios"
ON extratos_bancarios FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND igreja_id = public.get_jwt_igreja_id()
);