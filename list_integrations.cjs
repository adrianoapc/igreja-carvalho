const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('📋 Listando todas as integrações...\n');
  
  const { data: integracoes, error } = await supabase
    .from('integracoes_financeiras')
    .select('id, provedor, status, created_at')
    .limit(10);
    
  if (error) {
    console.error('❌ Erro:', error);
    return;
  }
  
  console.log(`Encontradas ${integracoes?.length || 0} integrações:`);
  integracoes?.forEach((int, idx) => {
    console.log(`${idx + 1}. ${int.id} - ${int.provedor} (${int.status})`);
  });
})();
