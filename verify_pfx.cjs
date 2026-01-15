const { createClient } = require('@supabase/supabase-js');
const https = require('https');

require('dotenv').config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const integracaoId = process.env.SANTANDER_INTEGRACAO_ID;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    console.log('🔍 Buscando dados da integração...\n');
    
    // Usar service role para ter acesso aos secrets
    const { data: integracao, error: intError } = await supabase
      .from('integracoes_financeiras')
      .select('*')
      .eq('id', integracaoId)
      .single();
    
    if (intError) {
      console.error('❌ Erro ao buscar integração:', intError);
      return;
    }
    
    console.log('✅ Integração encontrada:');
    console.log(`   ID: ${integracao.id}`);
    console.log(`   Provedor: ${integracao.provedor}`);
    console.log(`   Status: ${integracao.status}\n`);
    
    // Fazer requisição direto ao Supabase REST API com Service Role Key
    // para conseguir ler os secrets (bypass de RLS)
    console.log('🔐 Buscando secrets com Service Role Key...\n');
    
    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: new URL(supabaseUrl).hostname,
        port: 443,
        path: `/rest/v1/integracoes_financeiras_secrets?integracao_id=eq.${integracaoId}`,
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              body: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              body: data
            });
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
    
    if (response.status !== 200) {
      console.error(`❌ Erro ${response.status}:`, response.body);
      return;
    }
    
    const secrets = response.body[0];
    if (!secrets) {
      console.error('❌ Nenhum secret encontrado');
      return;
    }
    
    console.log('✅ Secrets encontrados\n');
    
    console.log('📊 ANÁLISE DO PFX_BLOB:');
    console.log('─'.repeat(60));
    
    const pfxBlob = secrets.pfx_blob;
    console.log(`Tipo: ${typeof pfxBlob}`);
    console.log(`Tamanho total: ${pfxBlob.length} caracteres`);
    console.log(`Primeiros 100 chars: ${pfxBlob.substring(0, 100)}`);
    console.log();
    
    // Tenta identificar o formato
    if (pfxBlob.startsWith('{')) {
      console.log('📋 Formato: JSON');
      try {
        const parsed = JSON.parse(pfxBlob);
        if (parsed.data && Array.isArray(parsed.data)) {
          console.log(`   Array de bytes: ${parsed.data.length} bytes`);
          
          // Converte para Uint8Array
          const uint8 = new Uint8Array(parsed.data);
          
          // Verifica magic number de PFX
          console.log(`   Magic bytes: ${Array.from(uint8.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
          
          // Tenta converter para base64
          const base64 = Buffer.from(uint8).toString('base64');
          console.log(`   ✓ Convertido para base64: ${base64.substring(0, 50)}...`);
          console.log(`   ✓ Base64 tamanho: ${base64.length} caracteres`);
          
          // Salva em arquivo para debug
          require('fs').writeFileSync('/tmp/test_pfx.bin', uint8);
          console.log(`   ✓ Salvo em: /tmp/test_pfx.bin`);
        }
      } catch (e) {
        console.error('   ❌ Erro ao fazer parse JSON:', e.message);
      }
    } else if (/^[A-Za-z0-9+/]*={0,2}$/.test(pfxBlob)) {
      console.log('📋 Formato: Base64 válido');
      console.log(`   ✓ Base64 válido (usa apenas chars permitidos)`);
      
      try {
        const decoded = Buffer.from(pfxBlob, 'base64');
        console.log(`   ✓ Decodificado: ${decoded.length} bytes`);
        
        // Verifica magic number
        console.log(`   Magic bytes: ${Array.from(decoded.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        
        // Salva em arquivo
        require('fs').writeFileSync('/tmp/test_pfx.bin', decoded);
        console.log(`   ✓ Salvo em: /tmp/test_pfx.bin`);
      } catch (e) {
        console.error('   ❌ Erro ao decodificar base64:', e.message);
      }
    } else {
      console.log('📋 Formato: Desconhecido/Inválido');
      console.log(`   ❌ Não é JSON nem base64 válido`);
    }
    
    console.log();
    console.log('📊 ANÁLISE DO CLIENT_ID:');
    console.log('─'.repeat(60));
    console.log(`Valor: ${secrets.client_id.substring(0, 50)}...`);
    console.log(`Tamanho: ${secrets.client_id.length} caracteres`);
    
    console.log();
    console.log('📊 ANÁLISE DO CLIENT_SECRET:');
    console.log('─'.repeat(60));
    console.log(`Valor: ${secrets.client_secret.substring(0, 50)}...`);
    console.log(`Tamanho: ${secrets.client_secret.length} caracteres`);
    
    if (secrets.pfx_password) {
      console.log();
      console.log('📊 ANÁLISE DO PFX_PASSWORD:');
      console.log('─'.repeat(60));
      console.log(`Valor: ${secrets.pfx_password.substring(0, 50)}...`);
      console.log(`Tamanho: ${secrets.pfx_password.length} caracteres`);
    } else {
      console.log();
      console.log('⚠️  PFX_PASSWORD: Não definido');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
})();
