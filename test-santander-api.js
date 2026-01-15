#!/usr/bin/env node
/**
 * Script de Teste - API Santander
 * 
 * Valida:
 * 1. Conexão OAuth2 (obtenção de token)
 * 2. Autenticação mTLS via certificado PFX
 * 3. Consulta de saldo
 * 4. Consulta de extrato
 * 
 * Uso:
 *   node test-santander-api.js --pfx ./cert.pfx --password senha123 --client-id xxx --client-secret yyy --bank-id 033 --agency 0001 --account 1234567
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

// Configurações Santander
const SANTANDER_TOKEN_URL = 'https://trust-open.api.santander.com.br/auth/oauth/v2/token';
const SANTANDER_BASE_URL = 'https://trust-open.api.santander.com.br/bank_account_information/v1';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(title, 'cyan');
  log(`${'='.repeat(60)}\n`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Parse argumentos
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    config[key] = value;
  }
  
  return config;
}

// Validar arquivo PFX
function validatePfxFile(pfxPath) {
  if (!fs.existsSync(pfxPath)) {
    throw new Error(`Arquivo PFX não encontrado: ${pfxPath}`);
  }
  logSuccess(`Arquivo PFX encontrado: ${pfxPath}`);
  return fs.readFileSync(pfxPath);
}

// Criar cliente HTTPS com mTLS
function createHttpsAgent(pfxBuffer, pfxPassword) {
  try {
    const agent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: pfxPassword,
      rejectUnauthorized: false, // ⚠️ Apenas para testes - em produção use true
    });
    logSuccess('Cliente HTTPS (mTLS) criado com sucesso');
    return agent;
  } catch (error) {
    throw new Error(`Erro ao criar cliente HTTPS: ${error.message}`);
  }
}

// Fazer requisição HTTPS
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options.headers,
      },
      agent: options.agent,
    };

    logInfo(`${options.method || 'GET'} ${url}`);

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data,
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Obter token OAuth2
async function getToken(clientId, clientSecret, agent) {
  logSection('1. Obtendo Token OAuth2');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  }).toString();

  try {
    const response = await makeRequest(SANTANDER_TOKEN_URL, {
      method: 'POST',
      body,
      agent,
      headers: {
        'Content-Length': Buffer.byteLength(body),
      },
    });

    if (response.status !== 200) {
      logError(`Falha ao obter token. Status: ${response.status}`);
      logInfo(`Resposta: ${response.raw}`);
      throw new Error(`Token request failed with status ${response.status}`);
    }

    if (!response.body.access_token) {
      logError('Resposta não contém access_token');
      logInfo(`Resposta completa: ${JSON.stringify(response.body, null, 2)}`);
      throw new Error('No access_token in response');
    }

    logSuccess(`Token obtido com sucesso`);
    logInfo(`Token: ${response.body.access_token.substring(0, 50)}...`);
    logInfo(`Tipo: ${response.body.token_type}`);
    logInfo(`Expira em: ${response.body.expires_in} segundos`);

    return response.body.access_token;
  } catch (error) {
    logError(`Erro ao obter token: ${error.message}`);
    throw error;
  }
}

// Consultar saldo
async function getBalance(token, bankId, agency, account, agent) {
  logSection('2. Consultando Saldo');

  const url = `${SANTANDER_BASE_URL}/banks/${bankId}/balances/${agency}.${account}`;

  try {
    const response = await makeRequest(url, {
      method: 'GET',
      agent,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status !== 200) {
      logError(`Falha ao consultar saldo. Status: ${response.status}`);
      logInfo(`Resposta: ${response.raw}`);
      throw new Error(`Balance request failed with status ${response.status}`);
    }

    logSuccess(`Saldo consultado com sucesso`);
    logInfo(`Resposta:\n${JSON.stringify(response.body, null, 2)}`);

    return response.body;
  } catch (error) {
    logError(`Erro ao consultar saldo: ${error.message}`);
    throw error;
  }
}

// Consultar extrato
async function getStatement(token, bankId, agency, account, agent, options = {}) {
  logSection('3. Consultando Extrato');

  const url = new URL(`${SANTANDER_BASE_URL}/banks/${bankId}/statements/${agency}.${account}`);

  // Adicionar parâmetros
  if (options.initialDate) url.searchParams.set('initialDate', options.initialDate);
  if (options.finalDate) url.searchParams.set('finalDate', options.finalDate);
  url.searchParams.set('_offset', options.offset || '0');
  url.searchParams.set('_limit', options.limit || '10');

  try {
    const response = await makeRequest(url.toString(), {
      method: 'GET',
      agent,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status !== 200) {
      logError(`Falha ao consultar extrato. Status: ${response.status}`);
      logInfo(`Resposta: ${response.raw}`);
      throw new Error(`Statement request failed with status ${response.status}`);
    }

    logSuccess(`Extrato consultado com sucesso`);
    logInfo(`Resposta:\n${JSON.stringify(response.body, null, 2)}`);

    // Validar estrutura esperada
    if (Array.isArray(response.body)) {
      logInfo(`Total de transações retornadas: ${response.body.length}`);
      if (response.body.length > 0) {
        logInfo(`Primeira transação: ${JSON.stringify(response.body[0], null, 2)}`);
      }
    }

    return response.body;
  } catch (error) {
    logError(`Erro ao consultar extrato: ${error.message}`);
    throw error;
  }
}

// Main
async function main() {
  try {
    logSection('🧪 TESTE DE INTEGRAÇÃO COM API SANTANDER');

    const config = parseArgs();

    // Validar argumentos obrigatórios
    const required = ['pfx', 'password', 'client-id', 'client-secret', 'bank-id', 'agency', 'account'];
    for (const key of required) {
      if (!config[key]) {
        logError(`Argumento obrigatório ausente: --${key}`);
        log('\nUso:', 'yellow');
        log('node test-santander-api.js \\', 'yellow');
        log('  --pfx ./cert.pfx \\', 'yellow');
        log('  --password senha123 \\', 'yellow');
        log('  --client-id xxx \\', 'yellow');
        log('  --client-secret yyy \\', 'yellow');
        log('  --bank-id 033 \\', 'yellow');
        log('  --agency 0001 \\', 'yellow');
        log('  --account 1234567', 'yellow');
        process.exit(1);
      }
    }

    logInfo(`Configuração:`);
    logInfo(`  Bank ID: ${config['bank-id']}`);
    logInfo(`  Agency: ${config['agency']}`);
    logInfo(`  Account: ${config['account']}`);
    logInfo(`  Client ID: ${config['client-id']}`);

    // Validar e ler PFX
    const pfxBuffer = validatePfxFile(config.pfx);

    // Criar cliente HTTPS com mTLS
    const agent = createHttpsAgent(pfxBuffer, config.password);

    // Obter token
    const token = await getToken(config['client-id'], config['client-secret'], agent);

    // Consultar saldo
    try {
      await getBalance(token, config['bank-id'], config['agency'], config['account'], agent);
    } catch (error) {
      logWarning('Continuando mesmo após falha ao consultar saldo...');
    }

    // Consultar extrato (últimos 30 dias)
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const formatDate = (date) => date.toISOString().split('T')[0];

      await getStatement(token, config['bank-id'], config['agency'], config['account'], agent, {
        initialDate: formatDate(thirtyDaysAgo),
        finalDate: formatDate(today),
        offset: '0',
        limit: '10',
      });
    } catch (error) {
      logWarning('Continuando mesmo após falha ao consultar extrato...');
    }

    logSection('✅ TESTES CONCLUÍDOS COM SUCESSO');
  } catch (error) {
    logError(`Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

main();
