/**
 * Script de Teste para Biometric Login com Access Token Fallback
 * 
 * Como executar:
 * 1. Abrir DevTools no navegador (F12)
 * 2. Ir para Console
 * 3. Colar este script
 * 4. Executar
 */

// ============ TEST 1: Verificar tokens armazenados após login ============
console.log('=== TEST 1: Verificando Tokens Armazenados ===');

const refreshToken = localStorage.getItem('biometric_refresh_token') || 
                     sessionStorage.getItem('biometric_refresh_token');
const accessToken = localStorage.getItem('biometric_access_token') || 
                    sessionStorage.getItem('biometric_access_token');

function isValidJWT(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}

console.log('Refresh Token:', {
  exists: !!refreshToken,
  length: refreshToken?.length || 0,
  isJWT: isValidJWT(refreshToken),
  preview: refreshToken ? refreshToken.substring(0, 50) + '...' : 'N/A'
});

console.log('Access Token:', {
  exists: !!accessToken,
  length: accessToken?.length || 0,
  isJWT: isValidJWT(accessToken),
  preview: accessToken ? accessToken.substring(0, 50) + '...' : 'N/A'
});

// ============ TEST 2: Verificar dados biométricos ============
console.log('\n=== TEST 2: Verificando Dados Biométricos ===');

const biometricEnabled = localStorage.getItem('biometric_enabled');
const biometricUserId = localStorage.getItem('biometric_user_id');
const biometricCredentialId = localStorage.getItem('biometric_credential_id');
const lastEmail = localStorage.getItem('last_login_email');

console.log('Biometric Setup:', {
  enabled: biometricEnabled === 'true',
  userId: biometricUserId ? biometricUserId.substring(0, 10) + '...' : 'N/A',
  credentialId: biometricCredentialId ? 'yes' : 'no',
  lastEmail: lastEmail || 'N/A'
});

// ============ TEST 3: Simular Biometric Login ============
console.log('\n=== TEST 3: Testando Fallback Logic (SEM executar de verdade) ===');

console.log('Cenário 1: Ambos tokens disponíveis');
console.log('- Tentar refreshSession com refresh_token');
console.log('- ✅ Se falhar, fallback para setSession com access_token');

console.log('\nCenário 2: Apenas access_token válido (refresh_token inválido)');
console.log('- refreshSession falha (refresh_token = "jljgvgeud4yz")');
console.log('- ✅ Fallback para setSession com access_token funciona');

console.log('\nCenário 3: Nenhum token disponível');
console.log('- ❌ Fallback para /auth com mensagem de erro');

// ============ TEST 4: Verificar localStorage para debug ============
console.log('\n=== TEST 4: Estado Completo do localStorage ===');

const relevantKeys = [
  'biometric_enabled',
  'biometric_user_id',
  'biometric_credential_id',
  'biometric_refresh_token',
  'biometric_access_token',
  'last_login_email',
];

const state = {};
relevantKeys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    if (value.length > 50) {
      state[key] = value.substring(0, 30) + '...' + value.substring(value.length - 20);
    } else {
      state[key] = value;
    }
  }
});

console.table(state);

// ============ TEST 5: Verificar sessão atual ============
console.log('\n=== TEST 5: Sessão Atual do Supabase ===');

(async () => {
  try {
    // @ts-ignore - Supabase client está injetado globalmente
    const supabaseClient = window.__supabaseClient || window.supabase;
    
    if (!supabaseClient) {
      console.error('Supabase client não encontrado. Verifique se a App está carregada.');
      return;
    }

    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.error('Erro ao obter sessão:', error);
      return;
    }

    if (session) {
      console.log('✅ Sessão ativa:', {
        userId: session.user?.id?.substring(0, 10) + '...',
        email: session.user?.email,
        expiresIn: session.expires_in,
        hasRefreshToken: !!session.refresh_token,
        hasAccessToken: !!session.access_token,
      });
    } else {
      console.log('⚠️ Nenhuma sessão ativa no momento');
    }
  } catch (err) {
    console.error('Erro ao verificar sessão:', err);
  }
})();

console.log('\n✅ Testes completados! Verifique os logs acima.');
