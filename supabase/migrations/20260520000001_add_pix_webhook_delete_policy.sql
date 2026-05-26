-- Adicionar policy de DELETE para pix_webhook_temp
-- Bug: Usuários não conseguiam deletar PIX recebidos via webhook

-- Policy de deleção: usuários da mesma igreja podem deletar
CREATE POLICY "pix_webhook_temp_delete" ON pix_webhook_temp
FOR DELETE
USING (
  igreja_id IN (
    SELECT p.igreja_id FROM profiles p WHERE p.user_id = auth.uid()
  )
);

COMMENT ON POLICY "pix_webhook_temp_delete" ON pix_webhook_temp IS 
'Permite que usuários autenticados da mesma igreja deletem PIX recebidos via webhook';
