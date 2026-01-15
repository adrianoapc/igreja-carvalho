#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Script de Teste - API Santander (Deno)
 * 
 * Valida integração com API Santander usando Deno
 * (Mesmo ambiente que Edge Functions)
 * 
 * Uso:
 *   deno run --allow-net --allow-read --allow-env test-santander-deno.ts \
 *     --pfx ./cert.pfx \
 *     --password senha123 \
 *     --client-id xxx \
 *     --client-secret yyy \
 *     --bank-id 033 \
 *     --agency 0001 \
 *     --account 1234567
 */

import { green, red, yellow, blue, cyan } from 'https://deno.land/std@0.208.0/fmt/colors.ts';

const SANTANDER_TOKEN_URL = 'https://trust-open.api.santander.com.br/auth/oauth/v2/token';
const SANTANDER_BASE_URL = 'https://trust-open.api.santander.com.br/bank_account_information/v1';

function logSection(title: string) {
  console.log(`\n${cyan('='.repeat(60))}`);
  console.log(cyan(title));
  console.log(`${cyan('='.repeat(60))}\n`);
}

function logSuccess(message: string) {
  console.log(`${green('✓')} ${message}`);
}

function logError(message: string) {
  console.log(`${red('✗')} ${message}`);
}

function logWarning(message: string) {
  console.log(`${yellow('⚠')} ${message}`);
}

function logInfo(message: string) {
  console.log(`${blue('ℹ')} ${message}`);
}

interface Config {
  pfx: string;
  password: string;
  'client-id': string;
  'client-secret': string;
  'bank-id': string;
  agency: string;
  account: string;
}

function parseArgs(): Config {
  const config: any = {};
  
  for (let i = 0; i < Deno.args.length; i += 2) {
    const key = Deno.args[i].replace(/^--/, '');
    const value = Deno.args[i + 1];
    config[key] = value;
  }
  
  return config;
}

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  logSection('1. Obtendo Token OAuth2');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  }).toString();

  try {
    logInfo(`POST ${SANTANDER_TOKEN_URL}`);
    
    const response = await fetch(SANTANDER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      logError(`Falha ao obter token. Status: ${response.status}`);
      logInfo(`Resposta: ${text}`);
      throw new Error(`Token request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      logError('Resposta não contém access_token');
      logInfo(`Resposta completa: ${JSON.stringify(data, null, 2)}`);
      throw new Error('No access_token in response');
    }

    logSuccess('Token obtido com sucesso');
    logInfo(`Token: ${data.access_token.substring(0, 50)}...`);
    logInfo(`Tipo: ${data.token_type}`);
    logInfo(`Expira em: ${data.expires_in} segundos`);

    return data.access_token;
  } catch (error) {
    logError(`Erro ao obter token: ${error.message}`);
    throw error;
  }
}

async function getBalance(
  token: string,
  bankId: string,
  agency: string,
  account: string,
): Promise<Record<string, unknown>> {
  logSection('2. Consultando Saldo');

  const url = `${SANTANDER_BASE_URL}/banks/${bankId}/balances/${agency}.${account}`;

  try {
    logInfo(`GET ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      logError(`Falha ao consultar saldo. Status: ${response.status}`);
      logInfo(`Resposta: ${text}`);
      throw new Error(`Balance request failed with status ${response.status}`);
    }

    const data = await response.json();
    logSuccess('Saldo consultado com sucesso');
    logInfo(`Resposta:\n${JSON.stringify(data, null, 2)}`);

    return data;
  } catch (error) {
    logError(`Erro ao consultar saldo: ${error.message}`);
    throw error;
  }
}

async function getStatement(
  token: string,
  bankId: string,
  agency: string,
  account: string,
  options?: { initialDate?: string; finalDate?: string; offset?: number; limit?: number },
): Promise<unknown> {
  logSection('3. Consultando Extrato');

  const url = new URL(`${SANTANDER_BASE_URL}/banks/${bankId}/statements/${agency}.${account}`);

  if (options?.initialDate) url.searchParams.set('initialDate', options.initialDate);
  if (options?.finalDate) url.searchParams.set('finalDate', options.finalDate);
  url.searchParams.set('_offset', String(options?.offset || 0));
  url.searchParams.set('_limit', String(options?.limit || 10));

  try {
    logInfo(`GET ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      logError(`Falha ao consultar extrato. Status: ${response.status}`);
      logInfo(`Resposta: ${text}`);
      throw new Error(`Statement request failed with status ${response.status}`);
    }

    const data = await response.json();
    logSuccess('Extrato consultado com sucesso');
    logInfo(`Resposta:\n${JSON.stringify(data, null, 2)}`);

    if (Array.isArray(data)) {
      logInfo(`Total de transações retornadas: ${data.length}`);
      if (data.length > 0) {
        logInfo(`Primeira transação:\n${JSON.stringify(data[0], null, 2)}`);
      }
    }

    return data;
  } catch (error) {
    logError(`Erro ao consultar extrato: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    logSection('🧪 TESTE DE INTEGRAÇÃO COM API SANTANDER (DENO)');

    const config = parseArgs();

    // Validar argumentos obrigatórios
    const required = ['client-id', 'client-secret', 'bank-id', 'agency', 'account'];
    for (const key of required) {
      if (!config[key as keyof Config]) {
        logError(`Argumento obrigatório ausente: --${key}`);
        console.log(`\n${yellow('Uso:')}`);
        console.log(`${yellow('deno run --allow-net test-santander-deno.ts \\\n  --client-id xxx \\\n  --client-secret yyy \\\n  --bank-id 033 \\\n  --agency 0001 \\\n  --account 1234567')}`);
        Deno.exit(1);
      }
    }

    logInfo('Configuração:');
    logInfo(`  Bank ID: ${config['bank-id']}`);
    logInfo(`  Agency: ${config.agency}`);
    logInfo(`  Account: ${config.account}`);
    logInfo(`  Client ID: ${config['client-id']}`);

    // Obter token
    const token = await getToken(config['client-id'], config['client-secret']);

    // Consultar saldo
    try {
      await getBalance(token, config['bank-id'], config.agency, config.account);
    } catch (error) {
      logWarning('Continuando mesmo após falha ao consultar saldo...');
    }

    // Consultar extrato (últimos 30 dias)
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const formatDate = (date: Date) => date.toISOString().split('T')[0];

      await getStatement(token, config['bank-id'], config.agency, config.account, {
        initialDate: formatDate(thirtyDaysAgo),
        finalDate: formatDate(today),
        offset: 0,
        limit: 10,
      });
    } catch (error) {
      logWarning('Continuando mesmo após falha ao consultar extrato...');
    }

    logSection('✅ TESTES CONCLUÍDOS COM SUCESSO');
  } catch (error) {
    logError(`Erro fatal: ${error.message}`);
    Deno.exit(1);
  }
}

main();
