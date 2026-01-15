const https = require('https');
require('dotenv').config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const response = new Promise((resolve, reject) => {
  const options = {
    hostname: new URL(supabaseUrl).hostname,
    port: 443,
    path: '/rest/v1/integracoes_financeiras?select=id,provedor,status,created_at',
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

(async () => {
  const result = await response;
  console.log('Status:', result.status);
  console.log('\n📋 Integrações encontradas:');
  console.log('─'.repeat(60));
  
  if (Array.isArray(result.body)) {
    result.body.forEach((int, idx) => {
      console.log(`${idx + 1}. ${int.id}`);
      console.log(`   Provedor: ${int.provedor}`);
      console.log(`   Status: ${int.status}`);
      console.log();
    });
  } else {
    console.log(result.body);
  }
})();
