const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const integracaoId = process.env.SANTANDER_INTEGRACAO_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    const { data: secrets, error } = await supabase
      .from('integracoes_financeiras_secrets')
      .select('*')
      .eq('integracao_id', integracaoId)
      .single();
      
    if (error) {
      console.error('❌ Erro:', error);
      return;
    }
    
    console.log('✅ Secrets encontrados\n');
    
    console.log('📊 Analisando pfx_blob:');
    console.log('- Tipo:', typeof secrets.pfx_blob);
    console.log('- Primeiros 100 chars:', secrets.pfx_blob.substring(0, 100));
    console.log('- Tamanho total:', secrets.pfx_blob.length);
    
    // Tenta converter se for JSON
    if (secrets.pfx_blob.startsWith('{')) {
      console.log('\n🔄 Parece ser JSON, tentando fazer parse...');
      const parsed = JSON.parse(secrets.pfx_blob);
      console.log('- Tipo de parsed:', typeof parsed);
      console.log('- Tem campo "data"?', !!parsed.data);
      if (parsed.data) {
        console.log('- Tamanho do array:', parsed.data.length);
        console.log('- Primeiros 10 bytes:', parsed.data.slice(0, 10));
        
        // Converte para Uint8Array e depois para string
        const uint8 = new Uint8Array(parsed.data);
        const str = Buffer.from(uint8).toString('utf-8');
        console.log('- Primeiros 100 chars da conversão:', str.substring(0, 100));
      }
    } else {
      console.log('\n✓ É base64 puro, ok');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
})();
