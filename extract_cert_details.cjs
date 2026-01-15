const https = require('https');
require('dotenv').config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const integracaoId = process.env.SANTANDER_INTEGRACAO_ID;

// Usando uma query que não restrinja por RLS
const query = `/rest/v1/integracoes_financeiras_secrets?integracao_id=eq.${integracaoId}&select=pfx_blob,pfx_password`;

console.log(`Tentando acessar: ${query}\n`);

const options = {
  hostname: new URL(supabaseUrl).hostname,
  port: 443,
  path: query,
  method: 'GET',
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  }
};

https.request(options, (res) => {
  let data = '';
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('─'.repeat(60));
    
    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        if (Array.isArray(result) && result.length > 0) {
          const secrets = result[0];
          
          console.log('\n✅ Secrets encontrados!\n');
          
          if (secrets.pfx_blob) {
            console.log('📊 PFX_BLOB:');
            console.log(`  Tamanho: ${secrets.pfx_blob.length} caracteres`);
            console.log(`  Primeiros 100 chars: ${secrets.pfx_blob.substring(0, 100)}`);
            console.log(`  Primeiros 50 bytes (hex): ${secrets.pfx_blob.substring(0, 50)}`);
            
            // Tenta decodificar se for base64
            if (/^[A-Za-z0-9+/]*={0,2}$/.test(secrets.pfx_blob.substring(0, 100))) {
              console.log(`  ✓ Parece ser base64 válido`);
            } else if (secrets.pfx_blob.startsWith('{')) {
              console.log(`  ℹ Parece ser JSON`);
            } else {
              console.log(`  ⚠️  Formato desconhecido`);
            }
          }
          
          if (secrets.pfx_password) {
            console.log('\n🔐 PFX_PASSWORD:');
            console.log(`  Tamanho: ${secrets.pfx_password.length} caracteres`);
            console.log(`  Primeiros 50 chars: ${secrets.pfx_password.substring(0, 50)}`);
          } else {
            console.log('\n⚠️  PFX_PASSWORD: Não encontrado');
          }
        } else {
          console.log('❌ Nenhum resultado encontrado');
          console.log('Resposta:', data);
        }
      } catch (e) {
        console.error('Erro ao fazer parse:', e.message);
        console.log('Resposta bruta:', data.substring(0, 200));
      }
    } else {
      console.log('Resposta:', data);
    }
  });
}).end();
