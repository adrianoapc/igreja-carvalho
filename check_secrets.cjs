const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const integracaoId = process.env.SANTANDER_INTEGRACAO_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 Buscando secrets para:', integracaoId);
  
  const { data: secrets, error } = await supabase
    .from('integracoes_financeiras_secrets')
    .select('*')
    .eq('integracao_id', integracaoId)
    .single();
    
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log('\n✅ Secrets encontrados:');
  console.log('- client_id:', secrets.client_id ? `✓ (${secrets.client_id.substring(0, 30)}...)` : '✗ ausente');
  console.log('- client_secret:', secrets.client_secret ? `✓ (${secrets.client_secret.substring(0, 30)}...)` : '✗ ausente');
  console.log('- pfx_blob:', secrets.pfx_blob ? `✓ (${(secrets.pfx_blob.length)} bytes)` : '✗ ausente');
  console.log('- pfx_password:', secrets.pfx_password ? `✓ presente` : '✗ ausente');
})();
