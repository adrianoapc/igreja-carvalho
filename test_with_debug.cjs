const https = require('https');
require('dotenv').config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const integracaoId = process.env.SANTANDER_INTEGRACAO_ID;
const bancoId = process.env.SANTANDER_BANCO_ID;
const agencia = process.env.SANTANDER_AGENCIA;
const conta = process.env.SANTANDER_CONTA;

console.log('🧪 Chamando edge function com DEBUG...\n');

const payload = JSON.stringify({
  integracao_id: integracaoId,
  banco_id: bancoId,
  agencia: agencia,
  conta: conta
});

const options = {
  hostname: new URL(supabaseUrl).hostname,
  port: 443,
  path: '/functions/v1/test-santander',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📊 Resposta da edge function:\n');
    console.log('Status:', res.statusCode);
    console.log('─'.repeat(60));
    
    try {
      const body = JSON.parse(data);
      console.log(JSON.stringify(body, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (err) => {
  console.error('Erro:', err);
});

req.write(payload);
req.end();
