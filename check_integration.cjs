const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const integracaoId = process.env.SANTANDER_INTEGRACAO_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 Verificando integração:', integracaoId);
  
  const { data: integracao, error } = await supabase
    .from('integracoes_financeiras')
    .select('*')
    .eq('id', integracaoId)
    .single();
    
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log('\n✅ Integração encontrada:');
  console.log(JSON.stringify(integracao, null, 2));
  
  console.log('\n🔑 Verificando secrets...');
  const { data: secrets, error: secretsError } = await supabase
    .from('integracoes_financeiras_secrets')
    .select('*')
    .eq('integracao_id', integracaoId)
    .single();
    
  if (secretsError) {
    console.error('❌ Erro ao buscar secrets:', secretsError);
    return;
  }
  
  console.log('\n✅ Secrets encontrados:');
  console.log('- client_id:', secrets.client_id ? '✓ presente' : '✗ ausente');
  console.log('- client_secret:', secrets.client_secret ? '✓ presente' : '✗ ausente');
  console.log('- pfx_blob:', secrets.pfx_blob ? '✓ presente' : '✗ ausente');
  console.log('- pfx_password:', secrets.pfx_password ? '✓ presente' : '✗ ausente');
})();
