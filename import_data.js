#!/usr/bin/env node
// import_data.js — importa todos os CSVs de ./imports/ para o projeto Supabase linkado.
// Usa SET session_replication_role = replica para ignorar FK e triggers.
// Uso: node import_data.js [--dry-run]
//
// Requer: supabase CLI linkado ao projeto destino (supabase db query --linked)

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORTS_DIR = path.join(__dirname, "imports");
const TMP_SQL = "/tmp/import_chunk.sql";
const DRY_RUN = process.argv.includes("--dry-run");

// ── Colunas geradas pelo banco que nunca devem aparecer no INSERT ─────────────
const SKIP_COLUMNS = {
  conciliacoes_lote: ["diferenca"],
};

// ── Extrai nome da tabela do nome do arquivo ─────────────────────────────────
function tableName(filename) {
  return filename.replace(/-export-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/, "");
}

// ── Parser CSV com suporte a campos quoted multiline (Supabase Studio export) ─
function parseCSV(content) {
  const sep = ";";

  // Percorre o conteúdo caractere a caractere para respeitar campos com
  // quebras de linha dentro de aspas.
  const rows = [];
  let curField = "";
  let curRow = [];
  let inQ = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const nx = content[i + 1];

    if (ch === '"') {
      if (inQ && nx === '"') {
        // Aspas escapadas dentro do campo
        curField += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === sep && !inQ) {
      curRow.push(curField);
      curField = "";
    } else if ((ch === "\n" || (ch === "\r" && nx === "\n")) && !inQ) {
      // Fim de linha fora de campo quoted
      if (ch === "\r") i++; // consome o \n do \r\n
      curRow.push(curField);
      curField = "";
      if (curRow.some((f) => f !== "")) rows.push(curRow);
      curRow = [];
    } else {
      curField += ch;
    }
  }
  // Última linha sem \n final
  if (curField !== "" || curRow.length > 0) {
    curRow.push(curField);
    if (curRow.some((f) => f !== "")) rows.push(curRow);
  }

  if (rows.length < 1) return { headers: [], rows: [] };

  const headers = rows[0];
  const dataRows = rows.slice(1).map((row) => {
    while (row.length < headers.length) row.push("");
    return row.slice(0, headers.length);
  });

  return { headers, rows: dataRows };
}

// ── Converte valor CSV para literal SQL ───────────────────────────────────────
function toSQL(raw) {
  if (raw === null || raw === undefined || raw === "") return "NULL";
  if (raw === "true") return "TRUE";
  if (raw === "false") return "FALSE";

  // Detecta arrays JSON (["a","b"] ou [uuid1,uuid2]) → literal PostgreSQL
  // Se os elementos forem objetos (JSONB), passa como string JSON pura.
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        const hasObjects = arr.some((el) => el !== null && typeof el === "object");
        if (hasObjects) {
          // JSONB: passa o JSON como string
          return "'" + raw.replace(/'/g, "''") + "'";
        }
        // Array de scalares → literal PostgreSQL {el1,el2,...}
        const elements = arr.map((el) =>
          el === null ? "NULL" : `"${String(el).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        );
        return "'" + "{" + elements.join(",") + "}'";
      }
    } catch {
      // Não é JSON válido — trata como string normal
    }
  }

  return "'" + raw.replace(/'/g, "''") + "'";
}

// ── Gera SQL de INSERT para uma tabela e executa via supabase CLI ─────────────
function importTable(table, { headers, rows }) {
  if (rows.length === 0) {
    console.log(`  [skip] ${table}: sem dados`);
    return { ok: 0, errors: 0 };
  }

  // Filtra colunas geradas que não podem ser inseridas
  const skipCols = new Set(SKIP_COLUMNS[table] || []);
  const colIndexes = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => !skipCols.has(h));
  const filteredHeaders = colIndexes.map(({ h }) => h);

  const colList = filteredHeaders.map((h) => `"${h}"`).join(", ");
  const CHUNK = 500;
  let ok = 0;
  let errors = 0;

  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    const chunk = rows.slice(offset, offset + CHUNK);

    const valueRows = chunk.map((row) => {
      const vals = colIndexes.map(({ i }) => toSQL(row[i]));
      return "  (" + vals.join(", ") + ")";
    });

    const sql = [
      "SET session_replication_role = replica;",
      `INSERT INTO public."${table}" (${colList}) VALUES`,
      valueRows.join(",\n"),
      "ON CONFLICT DO NOTHING;",
      "SET session_replication_role = DEFAULT;",
    ].join("\n");

    if (DRY_RUN) {
      console.log(`  [dry-run] ${table}: chunk ${offset}–${offset + chunk.length}`);
      ok += chunk.length;
      continue;
    }

    fs.writeFileSync(TMP_SQL, sql, "utf-8");
    try {
      execSync(`supabase db query --linked -f "${TMP_SQL}"`, {
        stdio: "pipe",
        encoding: "utf-8",
      });
      ok += chunk.length;
    } catch (err) {
      const msg = (err.stderr || err.stdout || String(err))
        .split("\n")
        .find((l) => l.includes("ERROR") || l.includes("error")) || err.message;
      console.error(`  [erro] ${table} chunk ${offset}: ${msg}`);
      errors += chunk.length;
    }
  }

  return { ok, errors };
}

// ── Ordem de importação (pai antes de filho) ──────────────────────────────────
const IMPORT_ORDER = [
  // Sem dependências
  "igrejas",
  "app_roles",
  "app_permissions",
  "app_config",
  "module_permissions",
  "notificacao_regras",
  "posicoes_time",
  "bases_ministeriais",
  "midia_tags",
  "edge_function_config",
  "evento_subtipos",
  // Dependem de igrejas
  "filiais",
  "contas",
  "categorias_financeiras",
  "centros_custo",
  "fornecedores",
  "formas_pagamento",
  "funcoes_igreja",
  "jornadas",
  "times",
  "categorias_times",
  "salas",
  "configuracoes_financeiro",
  "financeiro_config",
  "configuracoes_igreja",
  "chatbot_configs",
  "integracoes_financeiras",
  // Dependem de auth.users (já migrados)
  "profiles",
  // Dependem de igrejas + profiles
  "role_permissions",
  "user_roles",
  "user_app_roles",
  // Dependem de categorias
  "subcategorias_financeiras",
  "solicitacoes_reembolso",
  "itens_reembolso",
  "forma_pagamento_contas",
  "membro_funcoes",
  "membros_time",
  "familias",
  "profile_contatos",
  "etapas_jornada",
  "tags_midias",
  // Dependem de integracoes
  "integracoes_financeiras_secrets",
  // Transacionais
  "conciliacoes_lote",
  "extratos_bancarios",
  "transacoes_financeiras",
  "transferencias_contas",
  "conciliacoes_lote_extratos",
  "short_links",
  "notificacao_eventos",
];

// ── Main ──────────────────────────────────────────────────────────────────────
const files = fs
  .readdirSync(IMPORTS_DIR)
  .filter((f) => f.endsWith(".csv"))
  .sort();

// Deduplica: mesma tabela com dois exports → usa o mais recente (maior nome)
const byTable = new Map();
for (const f of files) {
  const t = tableName(f);
  if (!byTable.has(t) || f > byTable.get(t)) byTable.set(t, f);
}

console.log(`\n=== Import Data — ${byTable.size} tabelas encontradas ===`);
if (DRY_RUN) console.log("  MODO DRY-RUN: SQL gerado mas NÃO executado\n");
else console.log("  FK e triggers desativados via session_replication_role\n");

// Monta a ordem: listadas primeiro, resto no final
const ordered = [
  ...IMPORT_ORDER.filter((t) => byTable.has(t)),
  ...[...byTable.keys()].filter((t) => !IMPORT_ORDER.includes(t)),
];

let totalOk = 0;
let totalErrors = 0;

for (const table of ordered) {
  const file = byTable.get(table);
  const content = fs.readFileSync(path.join(IMPORTS_DIR, file), "utf-8");
  const parsed = parseCSV(content);

  process.stdout.write(`  ${table} (${parsed.rows.length} linhas)... `);
  const { ok, errors } = importTable(table, parsed);
  console.log(errors === 0 ? `✓ ${ok}` : `✓ ${ok}  ✗ ${errors} erros`);

  totalOk += ok;
  totalErrors += errors;
}

// Remove arquivo temporário
if (fs.existsSync(TMP_SQL)) fs.unlinkSync(TMP_SQL);

console.log(`\n=== Concluído: ${totalOk} linhas importadas, ${totalErrors} com erro ===`);
