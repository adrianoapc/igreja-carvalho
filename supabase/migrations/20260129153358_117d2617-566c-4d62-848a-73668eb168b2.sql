-- ============================================================================
-- Migração: Webhooks e WhatsApp com suporte a configurações globais do sistema
-- ============================================================================

-- 1. WEBHOOKS: permitir registros globais do sistema (igreja_id NULL)
ALTER TABLE webhooks ALTER COLUMN igreja_id DROP NOT NULL;

-- 2. WEBHOOKS: adicionar coluna para vincular número WhatsApp remetente
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS whatsapp_numero_id uuid REFERENCES whatsapp_numeros(id);

-- 3. WHATSAPP_NUMEROS: permitir números globais do sistema
ALTER TABLE whatsapp_numeros ALTER COLUMN igreja_id DROP NOT NULL;

-- 4. Índices para otimizar consultas com fallback
CREATE INDEX IF NOT EXISTS idx_webhooks_global_sistema ON webhooks(tipo) 
  WHERE igreja_id IS NULL AND filial_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhooks_global_igreja ON webhooks(igreja_id, tipo) 
  WHERE filial_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhooks_whatsapp_numero ON webhooks(whatsapp_numero_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_numeros_global_sistema ON whatsapp_numeros(provider) 
  WHERE igreja_id IS NULL AND filial_id IS NULL;

-- 5. Comentários documentando a hierarquia
COMMENT ON COLUMN webhooks.igreja_id IS 
  'NULL = webhook global do sistema (fallback final para todas as igrejas)';

COMMENT ON COLUMN webhooks.whatsapp_numero_id IS 
  'Número WhatsApp remetente padrão quando este webhook é acionado';

COMMENT ON COLUMN whatsapp_numeros.igreja_id IS 
  'NULL = número global do sistema (fallback final para todas as igrejas)';

-- ============================================================================
-- 6. Atualizar políticas RLS para WEBHOOKS
-- ============================================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Igreja pode ver webhooks" ON webhooks;
DROP POLICY IF EXISTS "Admins podem atualizar webhooks" ON webhooks;
DROP POLICY IF EXISTS "Admins podem inserir webhooks" ON webhooks;
DROP POLICY IF EXISTS "Admins podem deletar webhooks" ON webhooks;
DROP POLICY IF EXISTS "Super admin pode gerenciar webhooks" ON webhooks;

-- Leitura: inclui configs da própria igreja + globais do sistema
CREATE POLICY "Igreja pode ver webhooks" ON webhooks FOR SELECT
USING (
  igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
  OR igreja_id IS NULL
);

-- Edição: apenas registros da própria igreja (globais são read-only)
CREATE POLICY "Admins podem atualizar webhooks" ON webhooks FOR UPDATE
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
);

-- Inserção: apenas com igreja_id preenchido
CREATE POLICY "Admins podem inserir webhooks" ON webhooks FOR INSERT
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
);

-- Deleção: apenas registros da própria igreja
CREATE POLICY "Admins podem deletar webhooks" ON webhooks FOR DELETE
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
);

-- Super Admin pode tudo (incluindo globais do sistema)
CREATE POLICY "Super admin pode gerenciar webhooks" ON webhooks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE p.id = auth.uid() AND ur.role = 'super_admin'
  )
);

-- ============================================================================
-- 7. Atualizar políticas RLS para WHATSAPP_NUMEROS
-- ============================================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Igreja pode ver whatsapp numeros" ON whatsapp_numeros;
DROP POLICY IF EXISTS "Admins podem atualizar whatsapp numeros" ON whatsapp_numeros;
DROP POLICY IF EXISTS "Admins podem inserir whatsapp numeros" ON whatsapp_numeros;
DROP POLICY IF EXISTS "Admins podem remover whatsapp numeros" ON whatsapp_numeros;
DROP POLICY IF EXISTS "Super admin pode gerenciar whatsapp numeros" ON whatsapp_numeros;
DROP POLICY IF EXISTS "Users can view whatsapp numbers for their church" ON whatsapp_numeros;
DROP POLICY IF EXISTS "Admins can manage whatsapp numbers" ON whatsapp_numeros;

-- Leitura: inclui números da própria igreja + globais do sistema
CREATE POLICY "Igreja pode ver whatsapp numeros" ON whatsapp_numeros FOR SELECT
USING (
  igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
  OR igreja_id IS NULL
);

-- Edição: apenas registros da própria igreja (globais são read-only)
CREATE POLICY "Admins podem atualizar whatsapp numeros" ON whatsapp_numeros FOR UPDATE
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
);

-- Inserção: apenas com igreja_id preenchido
CREATE POLICY "Admins podem inserir whatsapp numeros" ON whatsapp_numeros FOR INSERT
WITH CHECK (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
);

-- Deleção: apenas registros da própria igreja
CREATE POLICY "Admins podem remover whatsapp numeros" ON whatsapp_numeros FOR DELETE
USING (
  igreja_id IS NOT NULL
  AND igreja_id IN (
    SELECT igreja_id FROM profiles WHERE id = auth.uid()
  )
);

-- Super Admin pode tudo (incluindo globais do sistema)
CREATE POLICY "Super admin pode gerenciar whatsapp numeros" ON whatsapp_numeros
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE p.id = auth.uid() AND ur.role = 'super_admin'
  )
);