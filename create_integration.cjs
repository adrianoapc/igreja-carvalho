const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const integracaoId = process.env.SANTANDER_INTEGRACAO_ID;
const bancoId = process.env.SANTANDER_BANCO_ID;
const agencia = process.env.SANTANDER_AGENCIA;
const conta = process.env.SANTANDER_CONTA;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    console.log('🔍 Buscando filial para criar integração...\n');
    
    // Buscar uma filial
    const { data: filiais, error: filiaisError } = await supabase
      .from('filiais')
      .select('id, name, igreja_id')
      .limit(1);
      
    if (filiaisError || !filiais?.length) {
      console.error('❌ Erro ao buscar filiais:', filiaisError);
      return;
    }
    
    const filial = filiais[0];
    console.log(`✓ Filial: ${filial.name} (${filial.id})`);
    console.log(`✓ Igreja: ${filial.igreja_id}\n`);
    
    // Criar integração com o ID do .env.local
    console.log(`📝 Criando integração Santander...\n`);
    const { data: integracao, error: integracaoError } = await supabase
      .from('integracoes_financeiras')
      .insert([{
        id: integracaoId,
        filial_id: filial.id,
        igreja_id: filial.igreja_id,
        provedor: 'santander',
        status: 'ativo',
        descricao: 'Integração Santander com mTLS',
        banco_id: bancoId,
        agencia: agencia,
        conta: conta
      }])
      .select()
      .single();
      
    if (integracaoError) {
      console.error('❌ Erro ao criar integração:', integracaoError.message);
      return;
    }
    
    console.log(`✓ Integração criada: ${integracao.id}\n`);
    
    // Criar secrets
    console.log(`🔐 Criando secrets (dados de teste)...\n`);
    const { data: secrets, error: secretsError } = await supabase
      .from('integracoes_financeiras_secrets')
      .insert([{
        integracao_id: integracao.id,
        client_id: 'test_client_id_placeholder',
        client_secret: 'test_client_secret_placeholder'
      }])
      .select()
      .single();
      
    if (secretsError) {
      console.error('❌ Erro ao criar secrets:', secretsError.message);
      return;
    }
    
    console.log(`✓ Secrets criados\n`);
    
    console.log('✅ INTEGRAÇÃO CRIADA COM SUCESSO!');
    console.log(`\n📌 Dados:
    ID: ${integracao.id}
    Filial: ${filial.id}
    Igreja: ${filial.igreja_id}
    Provedor: santander
    Status: ativo`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
})();
