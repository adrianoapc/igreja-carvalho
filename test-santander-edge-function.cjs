#!/usr/bin/env node
/**
 * Script para testar API Santander usando Edge Function
 *
 * Variáveis de ambiente (via .env.local):
 *   SUPABASE_URL
 *   SUPABASE_KEY
 *   SANTANDER_INTEGRACAO_ID
 *   SANTANDER_BANCO_ID
 *   SANTANDER_AGENCIA
 *   SANTANDER_CONTA
 *
 * Uso:
 *   node test-santander-edge-function.js
 *
 * Ou com argumentos CLI:
 *   node test-santander-edge-function.js \
 *     --supabase-url https://xxx.supabase.co \
 *     --supabase-key eyJ... \
 *     --integracao-id uuid \
 *     --banco-id 033 \
 *     --agencia 0001 \
 *     --conta 1234567
 */

// Load .env.local se existir
require("dotenv").config({ path: ".env.local", override: true });

const https = require("https");
const { URL } = require("url");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${"=".repeat(60)}`, "cyan");
  log(title, "cyan");
  log(`${"=".repeat(60)}\n`, "cyan");
}

function logSuccess(message) {
  log(`✓ ${message}`, "green");
}

function logError(message) {
  log(`✗ ${message}`, "red");
}

function logWarning(message) {
  log(`⚠ ${message}`, "yellow");
}

function logInfo(message) {
  log(`ℹ ${message}`, "blue");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {};

  // Primeiro, carregar variáveis de ambiente (com suporte a prefixos VITE_)
  const envVars = {
    "supabase-url": process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    "supabase-key":
      process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    "integracao-id": process.env.SANTANDER_INTEGRACAO_ID,
    "banco-id": process.env.SANTANDER_BANCO_ID,
    agencia: process.env.SANTANDER_AGENCIA,
    conta: process.env.SANTANDER_CONTA,
  };

  // Depois sobrescrever com argumentos CLI
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    const value = args[i + 1];
    config[key] = value;
  }

  // Mesclar: CLI tem prioridade sobre env vars
  return { ...envVars, ...config };
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            body: parsed,
            raw: data,
          });
        } catch (err) {
          resolve({
            status: res.statusCode,
            body: null,
            raw: data,
          });
        }
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function main() {
  try {
    logSection("🧪 TESTE DE API SANTANDER VIA EDGE FUNCTION");

    const config = parseArgs();

    // Validar argumentos
    const required = [
      "supabase-url",
      "supabase-key",
      "integracao-id",
      "banco-id",
      "agencia",
      "conta",
    ];
    for (const key of required) {
      if (!config[key]) {
        logError(`Argumento obrigatório ausente: --${key}`);
        log("\n📋 Opções:", "yellow");
        log("1️⃣  Criar arquivo .env.local:", "yellow");
        log("    cp .env.local.example .env.local", "yellow");
        log("    # Editar .env.local com seus dados", "yellow");
        log("    node test-santander-edge-function.js", "yellow");
        log("\n2️⃣  Usar argumentos CLI:", "yellow");
        log("    node test-santander-edge-function.js \\", "yellow");
        log("      --supabase-url https://xxx.supabase.co \\", "yellow");
        log("      --supabase-key eyJ... \\", "yellow");
        log("      --integracao-id uuid \\", "yellow");
        log("      --banco-id 033 \\", "yellow");
        log("      --agencia 0001 \\", "yellow");
        log("      --conta 1234567", "yellow");
        process.exit(1);
      }
    }
    logInfo("Configuração:");
    logInfo(
      `  Supabase: ${config["supabase-url"]} ${
        config["supabase-url"] === process.env.SUPABASE_URL ? "(env)" : "(CLI)"
      }`
    );
    logInfo(
      `  Integração ID: ${config["integracao-id"]} ${
        config["integracao-id"] === process.env.SANTANDER_INTEGRACAO_ID
          ? "(env)"
          : "(CLI)"
      }`
    );
    logInfo(
      `  Banco ID: ${config["banco-id"]} ${
        config["banco-id"] === process.env.SANTANDER_BANCO_ID
          ? "(env)"
          : "(CLI)"
      }`
    );
    logInfo(
      `  Agência: ${config["agencia"]} ${
        config["agencia"] === process.env.SANTANDER_AGENCIA ? "(env)" : "(CLI)"
      }`
    );
    logInfo(
      `  Conta: ${config["conta"]} ${
        config["conta"] === process.env.SANTANDER_CONTA ? "(env)" : "(CLI)"
      }`
    );

    // Mostrar como usar com .env.local
    if (!process.env.SUPABASE_URL && !process.env.SUPABASE_KEY) {
      logWarning(
        "\n💡 Dica: Crie um arquivo .env.local baseado em .env.local.example"
      );
      logWarning("Depois é só rodar: node test-santander-edge-function.js");
    }

    // Chamar Edge Function
    logSection("Chamando Edge Function...");

    const functionUrl = `${config["supabase-url"]}/functions/v1/test-santander`;

    logInfo(`POST ${functionUrl}`);

    const response = await makeRequest(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config["supabase-key"]}`,
      },
      body: {
        integracao_id: config["integracao-id"],
        banco_id: config["banco-id"],
        agencia: config["agencia"],
        conta: config["conta"],
      },
    });

    logInfo(`Status: ${response.status}`);

    if (response.status !== 200) {
      logError(`Falha na requisição. Status: ${response.status}`);
      logInfo(`Resposta: ${JSON.stringify(response.body, null, 2)}`);
      process.exit(1);
    }

    const result = response.body;

    if (!result.success) {
      logError(`Teste falhou: ${result.error}`);
      if (result.detail) logInfo(`Detalhe: ${result.detail}`);
      process.exit(1);
    }

    logSuccess("Teste realizado com sucesso!");

    logSection("📊 RESULTADOS");

    logInfo("Integração:");
    logInfo(`  ID: ${result.teste.integracao_id}`);
    logInfo(`  Provedor: ${result.teste.provedor}`);
    logInfo(`  Timestamp: ${result.teste.timestamp}`);

    logInfo("\nAutenticação:");
    logInfo(`  Token obtido: ${result.token.obtained ? "Sim" : "Não"}`);
    if (result.token.obtained) {
      logInfo(`  Tipo: ${result.token.type}`);
      logInfo(`  Expira em: ${result.token.expires_in}s`);
    }

    logInfo("\nSaldo:");
    if (result.balance.obtained) {
      logSuccess("Saldo consultado com sucesso");
      logInfo(`Dados:\n${JSON.stringify(result.balance.data, null, 2)}`);
    } else {
      logWarning("Falha ao consultar saldo");
      if (result.balance.error) {
        logInfo(`Status: ${result.balance.error.status}`);
        logInfo(`Detalhe: ${result.balance.error.detail}`);
      }
    }

    logInfo("\nExtrato:");
    if (result.statement.obtained) {
      logSuccess(
        `Extrato consultado com sucesso (${result.statement.count} transações)`
      );
      logInfo(`Dados:\n${JSON.stringify(result.statement.data, null, 2)}`);
    } else {
      logWarning("Falha ao consultar extrato");
      if (result.statement.error) {
        logInfo(`Status: ${result.statement.error.status}`);
        logInfo(`Detalhe: ${result.statement.error.detail}`);
      }
    }

    logSection("✅ TESTE CONCLUÍDO");
  } catch (error) {
    logError(`Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

main();
