/**
 * Parser do Extrato Eletrônico Getnet — Layout V10.1 (registros posicionais de 400 bytes)
 * -------------------------------------------------------------------------------------
 * Cobre os 7 tipos de registro: 0 (header), 1 (resumo transacional), 2 (analítico/CV),
 * 3 (ajustes), 5 (resumo financeiro), 6 (detalhe financeiro), 9 (trailer).
 *
 * Sem dependências externas. Todas as posições são 1-based, como no manual.
 * Valores monetários: 12 dígitos = centavos (2 casas) -> retornados em reais (number).
 * Datas no layout: DDMMAAAA -> retornadas em ISO 'YYYY-MM-DD' (ou null).
 */

type FieldKind = "text" | "int" | "amount" | "rate" | "date" | "sign" | "raw";

interface FieldDef {
  name: string;
  start: number;
  len: number;
  kind: FieldKind;
  decimals?: number;
}

function pad400(line: string): string {
  return line.length >= 400 ? line.slice(0, 400) : line.padEnd(400, " ");
}

function slice1(line: string, start: number, len: number): string {
  return line.slice(start - 1, start - 1 + len);
}

function parseAmount(raw: string, decimals = 2): number {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  return parseInt(digits, 10) / Math.pow(10, decimals);
}

function parseInteger(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits === "" ? 0 : parseInt(digits, 10);
}

/** DDMMAAAA -> 'YYYY-MM-DD'. Retorna null se zerado/branco/inválido. */
function parseDateDDMMAAAA(raw: string): string | null {
  const s = raw.trim();
  if (!/^\d{8}$/.test(s) || s === "00000000") return null;
  const dd = s.slice(0, 2);
  const mm = s.slice(2, 4);
  const aaaa = s.slice(4, 8);
  const d = Number(dd), m = Number(mm);
  if (m < 1 || m > 12 || d < 1 || d > 31 || aaaa === "0000") return null;
  return `${aaaa}-${mm}-${dd}`;
}

function parseSign(raw: string): "+" | "-" | null {
  const c = raw.trim();
  if (c === "+") return "+";
  if (c === "-") return "-";
  return null;
}

export function applySign(value: number, sign: "+" | "-" | null): number {
  return sign === "-" ? -Math.abs(value) : Math.abs(value);
}

function parseField(line: string, f: FieldDef): unknown {
  const raw = slice1(line, f.start, f.len);
  switch (f.kind) {
    case "text":  return raw.trim();
    case "raw":   return raw;
    case "int":   return parseInteger(raw);
    case "amount": return parseAmount(raw, f.decimals ?? 2);
    case "rate":  return parseAmount(raw, f.decimals ?? 7);
    case "date":  return parseDateDDMMAAAA(raw);
    case "sign":  return parseSign(raw);
  }
}

function parseRecord<T>(line: string, layout: FieldDef[]): T {
  const padded = pad400(line);
  const out: Record<string, unknown> = {};
  for (const f of layout) out[f.name] = parseField(padded, f);
  return out as T;
}

// ----------------------------------------------------------------------------
// Layouts por tipo de registro (offsets do manual V10.1)
// ----------------------------------------------------------------------------

const LAYOUT_HEADER: FieldDef[] = [
  { name: "tipoRegistro",         start: 1,  len: 1,  kind: "text" },
  { name: "dataCriacao",          start: 2,  len: 8,  kind: "date" },
  { name: "horaCriacao",          start: 10, len: 6,  kind: "text" },
  { name: "dataReferencia",       start: 16, len: 8,  kind: "date" },
  { name: "arquivoVersao",        start: 24, len: 8,  kind: "text" },
  { name: "codigoEstabelecimento",start: 32, len: 15, kind: "text" },
  { name: "cnpjAdquirente",       start: 47, len: 14, kind: "text" },
  { name: "nomeAdquirente",       start: 61, len: 20, kind: "text" },
  { name: "sequenciaRemessa",     start: 81, len: 9,  kind: "int"  },
  { name: "codigoAdquirente",     start: 90, len: 2,  kind: "text" },
  { name: "versaoLayout",         start: 92, len: 25, kind: "text" },
];

const LAYOUT_RESUMO: FieldDef[] = [
  { name: "tipoRegistro",           start: 1,   len: 1,  kind: "text"   },
  { name: "codigoEstabelecimento",  start: 2,   len: 15, kind: "text"   },
  { name: "codigoProduto",          start: 17,  len: 2,  kind: "text"   },
  { name: "formaCaptura",           start: 19,  len: 3,  kind: "text"   },
  { name: "rv",                     start: 22,  len: 9,  kind: "text"   },
  { name: "dataRv",                 start: 31,  len: 8,  kind: "date"   },
  { name: "dataPagamentoRv",        start: 39,  len: 8,  kind: "date"   },
  { name: "banco",                  start: 47,  len: 3,  kind: "text"   },
  { name: "agencia",                start: 50,  len: 6,  kind: "text"   },
  { name: "numCvsAceitos",          start: 67,  len: 9,  kind: "int"    },
  { name: "numCvsRejeitados",       start: 76,  len: 9,  kind: "int"    },
  { name: "valorBruto",             start: 85,  len: 12, kind: "amount" },
  { name: "valorLiquido",           start: 97,  len: 12, kind: "amount" },
  { name: "valorTarifa",            start: 109, len: 12, kind: "amount" },
  { name: "valorTaxaDesconto",      start: 121, len: 12, kind: "amount" },
  { name: "valorRejeitado",         start: 133, len: 12, kind: "amount" },
  { name: "valorCredito",           start: 145, len: 12, kind: "amount" },
  { name: "indicadorTipoPagamento", start: 169, len: 2,  kind: "text"   },
  { name: "numParcelaRv",           start: 171, len: 2,  kind: "int"    },
  { name: "qtdParcelasRv",          start: 173, len: 2,  kind: "int"    },
  { name: "centralizador",          start: 175, len: 15, kind: "text"   },
  { name: "dataVencimentoOriginal", start: 205, len: 8,  kind: "date"   },
  { name: "valorLiquidoCobranca",   start: 255, len: 12, kind: "amount" },
  { name: "moeda",                  start: 282, len: 3,  kind: "text"   },
  { name: "idBaixaCobrancaServico", start: 285, len: 1,  kind: "text"   },
  { name: "sinal",                  start: 286, len: 1,  kind: "sign"   },
  { name: "tipoConta",              start: 287, len: 2,  kind: "text"   },
  { name: "contaCorrente",          start: 289, len: 20, kind: "text"   },
  { name: "chaveUr",                start: 309, len: 25, kind: "text"   },
];

const LAYOUT_ANALITICO: FieldDef[] = [
  { name: "tipoRegistro",        start: 1,   len: 1,  kind: "text"   },
  { name: "codigoEstabelecimento", start: 2, len: 15, kind: "text"   },
  { name: "rv",                  start: 17,  len: 9,  kind: "text"   },
  { name: "nsuCv",               start: 26,  len: 12, kind: "text"   },
  { name: "dataTransacao",       start: 38,  len: 8,  kind: "date"   },
  { name: "horaTransacao",       start: 46,  len: 6,  kind: "text"   },
  { name: "cartaoTruncado",      start: 52,  len: 19, kind: "text"   },
  { name: "valorTransacao",      start: 71,  len: 12, kind: "amount" },
  { name: "valorSaque",          start: 83,  len: 12, kind: "amount" },
  { name: "valorTaxaEmbarque",   start: 95,  len: 12, kind: "amount" },
  { name: "numeroParcelas",      start: 107, len: 2,  kind: "int"    },
  { name: "parcelaDoCv",         start: 109, len: 2,  kind: "int"    },
  { name: "valorParcela",        start: 111, len: 12, kind: "amount" },
  { name: "dataPagamento",       start: 123, len: 8,  kind: "date"   },
  { name: "codigoAutorizacao",   start: 131, len: 10, kind: "text"   },
  { name: "formaCaptura",        start: 141, len: 3,  kind: "text"   },
  { name: "status",              start: 144, len: 1,  kind: "text"   },
  { name: "centralizador",       start: 145, len: 15, kind: "text"   },
  { name: "codigoTerminal",      start: 160, len: 8,  kind: "text"   },
  { name: "moeda",               start: 168, len: 3,  kind: "text"   },
  { name: "origemEmissor",       start: 171, len: 1,  kind: "text"   },
  { name: "sinal",               start: 172, len: 1,  kind: "sign"   },
  { name: "carteiraDigital",     start: 173, len: 3,  kind: "text"   },
  { name: "valorComissao",       start: 176, len: 12, kind: "amount" },
];

const LAYOUT_AJUSTE: FieldDef[] = [
  { name: "tipoRegistro",            start: 1,   len: 1,  kind: "text"   },
  { name: "codigoEstabelecimento",   start: 2,   len: 15, kind: "text"   },
  { name: "rvAjustado",              start: 17,  len: 9,  kind: "text"   },
  { name: "dataRv",                  start: 26,  len: 8,  kind: "date"   },
  { name: "dataPagamentoRv",         start: 34,  len: 8,  kind: "date"   },
  { name: "identificadorAjuste",     start: 42,  len: 20, kind: "text"   },
  { name: "sinal",                   start: 63,  len: 1,  kind: "sign"   },
  { name: "valorAjuste",             start: 64,  len: 12, kind: "amount" },
  { name: "motivoAjuste",            start: 76,  len: 2,  kind: "text"   },
  { name: "dataCarta",               start: 78,  len: 8,  kind: "date"   },
  { name: "cartaoTruncado",          start: 86,  len: 19, kind: "text"   },
  { name: "rvOriginal",              start: 105, len: 9,  kind: "text"   },
  { name: "nsuCv",                   start: 114, len: 12, kind: "text"   },
  { name: "dataTransacaoOriginal",   start: 126, len: 8,  kind: "date"   },
  { name: "indicadorTipoPagamento",  start: 134, len: 2,  kind: "text"   },
  { name: "numeroTerminal",          start: 136, len: 8,  kind: "text"   },
  { name: "dataPagamentoOriginal",   start: 144, len: 8,  kind: "date"   },
  { name: "moeda",                   start: 152, len: 3,  kind: "text"   },
  { name: "valorComissao",           start: 155, len: 12, kind: "amount" },
];

const LAYOUT_FIN_RESUMO: FieldDef[] = [
  { name: "tipoRegistro",               start: 1,   len: 1,  kind: "text"   },
  { name: "codigoEstabelecimento",      start: 2,   len: 15, kind: "text"   },
  { name: "dataOperacao",               start: 17,  len: 8,  kind: "date"   },
  { name: "dataCreditoOperacao",        start: 25,  len: 8,  kind: "date"   },
  { name: "numeroOperacao",             start: 33,  len: 20, kind: "text"   },
  { name: "tipoOperacao",               start: 53,  len: 2,  kind: "text"   },
  { name: "valorBrutoOperacao",         start: 67,  len: 12, kind: "amount" },
  { name: "valorCustoOperacao",         start: 79,  len: 12, kind: "amount" },
  { name: "valorLiquidoOperacao",       start: 91,  len: 12, kind: "amount" },
  { name: "taxaMensalOperacao",         start: 103, len: 11, kind: "rate", decimals: 7 },
  { name: "tipoContaEstabelecimento",   start: 114, len: 2,  kind: "text"   },
  { name: "banco",                      start: 116, len: 3,  kind: "text"   },
  { name: "agencia",                    start: 119, len: 6,  kind: "text"   },
  { name: "contaCorrente",              start: 125, len: 20, kind: "text"   },
  { name: "canalOperacao",              start: 145, len: 3,  kind: "text"   },
  { name: "tipoMovimento",              start: 148, len: 1,  kind: "text"   },
  { name: "codigoArranjo",             start: 256, len: 2,  kind: "text"   },
  { name: "chaveUr",                    start: 258, len: 25, kind: "text"   },
];

const LAYOUT_FIN_DETALHE: FieldDef[] = [
  { name: "tipoRegistro",               start: 1,   len: 1,  kind: "text"   },
  { name: "codigoEstabelecimento",      start: 2,   len: 15, kind: "text"   },
  { name: "dataOperacao",               start: 17,  len: 8,  kind: "date"   },
  { name: "numeroOperacao",             start: 25,  len: 20, kind: "text"   },
  { name: "tipoOperacao",               start: 45,  len: 2,  kind: "text"   },
  { name: "codigoProduto",              start: 65,  len: 2,  kind: "text"   },
  { name: "dataVencimentoUr",           start: 67,  len: 8,  kind: "date"   },
  { name: "valorLiquidoUr",             start: 87,  len: 12, kind: "amount" },
  { name: "valorCustoUr",              start: 99,  len: 12, kind: "amount" },
  { name: "valorBrutoUr",              start: 111, len: 12, kind: "amount" },
  { name: "tipoContaEstabelecimento",   start: 123, len: 2,  kind: "text"   },
  { name: "tipoMovimento",              start: 154, len: 1,  kind: "text"   },
  { name: "chaveUr",                    start: 262, len: 25, kind: "text"   },
];

const LAYOUT_TRAILER: FieldDef[] = [
  { name: "tipoRegistro",        start: 1, len: 1, kind: "text" },
  { name: "quantidadeRegistros", start: 2, len: 9, kind: "int"  },
];

// ----------------------------------------------------------------------------
// Interfaces de saída
// ----------------------------------------------------------------------------

export interface HeaderRecord {
  tipoRegistro: string; dataCriacao: string | null; horaCriacao: string;
  dataReferencia: string | null; arquivoVersao: string; codigoEstabelecimento: string;
  cnpjAdquirente: string; nomeAdquirente: string; sequenciaRemessa: number;
  codigoAdquirente: string; versaoLayout: string;
}

export interface ResumoRecord {
  tipoRegistro: string; codigoEstabelecimento: string; codigoProduto: string;
  formaCaptura: string; rv: string; dataRv: string | null; dataPagamentoRv: string | null;
  banco: string; agencia: string; numCvsAceitos: number; numCvsRejeitados: number;
  valorBruto: number; valorLiquido: number; valorTarifa: number; valorTaxaDesconto: number;
  valorRejeitado: number; valorCredito: number; indicadorTipoPagamento: string;
  numParcelaRv: number; qtdParcelasRv: number; centralizador: string;
  dataVencimentoOriginal: string | null; valorLiquidoCobranca: number; moeda: string;
  idBaixaCobrancaServico: string; sinal: "+" | "-" | null; tipoConta: string;
  contaCorrente: string; chaveUr: string;
}

export interface AnaliticoRecord {
  tipoRegistro: string; codigoEstabelecimento: string; rv: string; nsuCv: string;
  dataTransacao: string | null; horaTransacao: string; cartaoTruncado: string;
  valorTransacao: number; valorSaque: number; valorTaxaEmbarque: number;
  numeroParcelas: number; parcelaDoCv: number; valorParcela: number;
  dataPagamento: string | null; codigoAutorizacao: string; formaCaptura: string;
  status: string; centralizador: string; codigoTerminal: string; moeda: string;
  origemEmissor: string; sinal: "+" | "-" | null; carteiraDigital: string;
  valorComissao: number;
}

export interface AjusteRecord {
  tipoRegistro: string; codigoEstabelecimento: string; rvAjustado: string;
  dataRv: string | null; dataPagamentoRv: string | null; identificadorAjuste: string;
  sinal: "+" | "-" | null; valorAjuste: number; motivoAjuste: string;
  dataCarta: string | null; cartaoTruncado: string; rvOriginal: string; nsuCv: string;
  dataTransacaoOriginal: string | null; indicadorTipoPagamento: string;
  numeroTerminal: string; dataPagamentoOriginal: string | null; moeda: string;
  valorComissao: number;
}

export interface FinResumoRecord {
  tipoRegistro: string; codigoEstabelecimento: string; dataOperacao: string | null;
  dataCreditoOperacao: string | null; numeroOperacao: string; tipoOperacao: string;
  valorBrutoOperacao: number; valorCustoOperacao: number; valorLiquidoOperacao: number;
  taxaMensalOperacao: number; tipoContaEstabelecimento: string; banco: string;
  agencia: string; contaCorrente: string; canalOperacao: string; tipoMovimento: string;
  codigoArranjo: string; chaveUr: string;
}

/**
 * Trava a origem do espelho por arquivo (fix P1, review PR #52): a origem
 * usada na 1a importação de um arquivo NUNCA pode mudar em reprocessamentos
 * posteriores, mesmo que `espelho_tipo5_desde` seja setado/alterado depois
 * cobrindo retroativamente a data desse arquivo — senão o external_id muda
 * (`getnet_rv:...` -> `getnet_fin5:...`), o dedupe `(conta_id, external_id)`
 * não reconhece as duas linhas como o mesmo crédito, e o valor é duplicado
 * em `extratos_bancarios`.
 *
 * `arquivoAnterior` vem de `getnet_arquivos` (SELECT espelho_origem WHERE
 * integracao_id/arquivo_nome). Três estados, não dois — a distinção entre
 * "nunca importado" e "importado antes da coluna existir" importa:
 *  - `null`/`undefined` (nenhuma linha): 1a importação — decide fresco pela
 *    config (`usarTipo5PorConfig`).
 *  - `{ espelho_origem: null }` (linha existe, coluna vazia): arquivo
 *    importado antes desta coluna existir, ou seja, antes da F6 — travado
 *    em tipo 1, já que a origem tipo5 não existia antes.
 *  - `{ espelho_origem: "getnet_sftp_tipo5" | "getnet_sftp_txt" }`: travado
 *    no valor já registrado.
 */
export function resolverUsoTipo5(
  arquivoAnterior: { espelho_origem: string | null } | null | undefined,
  usarTipo5PorConfig: boolean,
): boolean {
  if (!arquivoAnterior) {
    return usarTipo5PorConfig;
  }
  return arquivoAnterior.espelho_origem === "getnet_sftp_tipo5";
}

export interface ItemEspelhoGetnet {
  data_transacao: string;
  valor: number;
  tipo: "credito" | "debito";
  descricao: string;
  numero_documento: string | null;
  external_id: string;
}

/**
 * Seleciona, dentre as linhas do registro tipo 5 (`getnet_financeiro_resumo`),
 * as que representam dinheiro NOVO creditado na conta do lojista — Regra
 * Geral #10 do Manual Extrato Eletrônico V10.1/V6.2024 (pg. 56): só
 * `tipo_operacao === "PG"` (Pagamento de Agenda Livre) é "valores livres
 * creditado na conta do estabelecimento". Os demais tipos (CS/CF/AC/CL/GL/
 * GF/AL) são liquidação contábil de dinheiro já adiantado em data anterior
 * (contrato de cessão/antecipação/gravame), não crédito novo — confirmado
 * pelo exemplo numérico do manual (pg. 44-45).
 *
 * `external_id` usa `arquivoNome:linhaNum` em vez de `numeroOperacao` (o
 * manual, pg. 38, afirma explicitamente que PG não tem número de operação)
 * ou `chaveUr` (preenchida para PG, mas pode consolidar múltiplas URs
 * liquidadas numa única linha — não é garantida 1:1). `linhaNum` é sempre
 * presente e estável entre reimportações do mesmo arquivo, o que é o que o
 * dedupe `(conta_id, external_id)` de `fin_ingerir_extratos` precisa.
 */
export function selecionarEspelhoTipo5(
  financeirosResumo: Array<FinResumoRecord & { linhaNum: number; rawLine: string }>,
  integracaoId: string,
  arquivoNome: string,
): ItemEspelhoGetnet[] {
  return financeirosResumo
    .filter((f) => f.tipoOperacao === "PG" && (f.dataCreditoOperacao || f.dataOperacao))
    .map((f) => ({
      data_transacao: (f.dataCreditoOperacao || f.dataOperacao) as string,
      valor: f.valorLiquidoOperacao,
      tipo: "credito" as const,
      descricao: `Getnet PG ${f.chaveUr || f.numeroOperacao || f.linhaNum}`,
      numero_documento: f.numeroOperacao || null,
      external_id: `getnet_fin5:${integracaoId}:${arquivoNome}:${f.linhaNum}`,
    }));
}

export interface FinDetalheRecord {
  tipoRegistro: string; codigoEstabelecimento: string; dataOperacao: string | null;
  numeroOperacao: string; tipoOperacao: string; codigoProduto: string;
  dataVencimentoUr: string | null; valorLiquidoUr: number; valorCustoUr: number;
  valorBrutoUr: number; tipoContaEstabelecimento: string; tipoMovimento: string;
  chaveUr: string;
}

export interface TrailerRecord { tipoRegistro: string; quantidadeRegistros: number; }

export interface ValidationResult {
  ok: boolean;
  erros: string[];
  qtdRegistrosDeclarada: number | null;
  qtdRegistrosLidos: number;
}

export interface ParsedExtrato {
  header: HeaderRecord | null;
  trailer: TrailerRecord | null;
  resumos: Array<ResumoRecord & { linhaNum: number; rawLine: string }>;
  analiticos: Array<AnaliticoRecord & { linhaNum: number; rawLine: string }>;
  ajustes: Array<AjusteRecord & { linhaNum: number; rawLine: string }>;
  financeirosResumo: Array<FinResumoRecord & { linhaNum: number; rawLine: string }>;
  financeirosDetalhe: Array<FinDetalheRecord & { linhaNum: number; rawLine: string }>;
  validacao: ValidationResult;
  desconhecidos: Array<{ linhaNum: number; tipo: string; raw: string }>;
}

// ----------------------------------------------------------------------------
// Parser principal
// ----------------------------------------------------------------------------

export function parseExtrato(conteudo: string): ParsedExtrato {
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.length > 0);

  const out: ParsedExtrato = {
    header: null, trailer: null,
    resumos: [], analiticos: [], ajustes: [],
    financeirosResumo: [], financeirosDetalhe: [],
    validacao: { ok: false, erros: [], qtdRegistrosDeclarada: null, qtdRegistrosLidos: linhas.length },
    desconhecidos: [],
  };

  linhas.forEach((linha, i) => {
    const linhaNum = i + 1;
    const tipo = linha.charAt(0);
    const rawLine = linha;
    switch (tipo) {
      case "0":
        out.header = parseRecord<HeaderRecord>(linha, LAYOUT_HEADER);
        break;
      case "1":
        out.resumos.push({ ...parseRecord<ResumoRecord>(linha, LAYOUT_RESUMO), linhaNum, rawLine });
        break;
      case "2":
        out.analiticos.push({ ...parseRecord<AnaliticoRecord>(linha, LAYOUT_ANALITICO), linhaNum, rawLine });
        break;
      case "3":
        out.ajustes.push({ ...parseRecord<AjusteRecord>(linha, LAYOUT_AJUSTE), linhaNum, rawLine });
        break;
      case "5":
        out.financeirosResumo.push({ ...parseRecord<FinResumoRecord>(linha, LAYOUT_FIN_RESUMO), linhaNum, rawLine });
        break;
      case "6":
        out.financeirosDetalhe.push({ ...parseRecord<FinDetalheRecord>(linha, LAYOUT_FIN_DETALHE), linhaNum, rawLine });
        break;
      case "9":
        out.trailer = parseRecord<TrailerRecord>(linha, LAYOUT_TRAILER);
        break;
      default:
        out.desconhecidos.push({ linhaNum, tipo, raw: linha });
    }
  });

  const erros: string[] = [];
  if (!out.header) erros.push("Header (registro 0) ausente.");
  if (!out.trailer) erros.push("Trailer (registro 9) ausente.");
  const declarada = out.trailer ? out.trailer.quantidadeRegistros : null;
  if (declarada !== null && declarada !== linhas.length) {
    erros.push(`Trailer declara ${declarada} registros, mas o arquivo tem ${linhas.length}.`);
  }
  if (out.desconhecidos.length > 0) {
    erros.push(`Linhas com tipo desconhecido: ${out.desconhecidos.map((d) => d.linhaNum).join(", ")}.`);
  }
  out.validacao = { ok: erros.length === 0, erros, qtdRegistrosDeclarada: declarada, qtdRegistrosLidos: linhas.length };

  return out;
}

export function checarSequencia(
  ultimaSequencia: number | null,
  atual: number,
): { ok: boolean; faltando: number[] } {
  if (ultimaSequencia === null) return { ok: true, faltando: [] };
  const faltando: number[] = [];
  for (let s = ultimaSequencia + 1; s < atual; s++) faltando.push(s);
  return { ok: faltando.length === 0 && atual === ultimaSequencia + 1, faltando };
}

export const STATUS_PAGAMENTO: Record<string, string> = {
  PF: "Previsão de Pagamento Futuro",
  LQ: "Baixa por Liquidação",
  PD: "Pagamento Pendente",
  CI: "Cobrança Interna",
  PG: "Pagamento Realizado",
};

export const MOTIVO_AJUSTE: Record<string, string> = {
  "01": "Ajuste a crédito ou a débito", "02": "Aluguel de POS",
  "03": "Cancelamento", "04": "Chargeback", "05": "Recarga Telecom",
  "06": "Bilhetagem", "07": "Consulta Serasa", "08": "Aluguel de Verticais",
  "09": "Carga e Recarga Cartão Pré Pago", "10": "Manutenção de Cartão",
  "11": "Venda de Cartão", "12": "Cancelamento com motivo de Estorno",
  "13": "Recarga com cartão", "14": "Plataforma Digital", "15": "GetData",
  "16": "Reversão de Chargeback", "17": "Liquidação de Gravame",
  "18": "Débito de Cessão", "19": "Estorno de Cessão",
  "20": "Débito de Antecipação", "21": "Estorno de Antecipação",
  "22": "Cashback Conv Moedas (DCC)",
};
