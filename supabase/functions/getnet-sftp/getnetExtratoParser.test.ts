// Testes de selecionarEspelhoTipo5 (F6 — espelho Getnet migra de tipo 1/LQ
// para tipo 5/PG, decisão D5).
//
// A extração de campos do registro posicional e a construção do
// external_id de dedupe têm histórico de bug de precisão nesse projeto
// (ver resolverContaPix na F5); um teste automatizado real é mais
// confiável do que reler o código manualmente a cada revisão.
//
// Rodar: deno test supabase/functions/getnet-sftp/getnetExtratoParser.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  selecionarEspelhoTipo5,
  resolverUsoTipo5,
  parseExtrato,
  type FinResumoRecord,
} from "./getnetExtratoParser.ts";

type Linha = FinResumoRecord & { linhaNum: number; rawLine: string };

function linhaFin5(overrides: Partial<Linha>): Linha {
  return {
    tipoRegistro: "5",
    codigoEstabelecimento: "123456789012345",
    dataOperacao: "2026-07-10",
    dataCreditoOperacao: "2026-07-10",
    numeroOperacao: "",
    tipoOperacao: "PG",
    valorBrutoOperacao: 600,
    valorCustoOperacao: 0,
    valorLiquidoOperacao: 600,
    taxaMensalOperacao: 0,
    tipoContaEstabelecimento: "CC",
    banco: "033",
    agencia: "1234",
    contaCorrente: "12345678",
    canalOperacao: "SIT",
    tipoMovimento: "L",
    participanteCnpjCpf: "",
    participanteBanco: "",
    participanteAgencia: "",
    participanteContaCorrente: "",
    participanteRazaoSocial: "",
    codigoArranjo: "01",
    chaveUr: "20260710004XX6598YY000199",
    linhaNum: 1,
    rawLine: "",
    ...overrides,
  };
}

Deno.test("selecionarEspelhoTipo5: PG com numero_operacao vazio gera item sem quebrar", () => {
  const linha = linhaFin5({ numeroOperacao: "" });
  const itens = selecionarEspelhoTipo5([linha]);
  assertEquals(itens.length, 1);
  assertEquals(itens[0].numero_documento, null);
  assertEquals(itens[0].external_id, "getnet_fin5:2026-07-10:01:20260710004XX6598YY000199:600");
  assertEquals(itens[0].tipo, "credito");
  assertEquals(itens[0].valor, 600);
});

Deno.test("selecionarEspelhoTipo5: duas linhas PG com chave/valor diferentes geram external_id distintos", () => {
  const linha1 = linhaFin5({ linhaNum: 1, chaveUr: "20260710004XX6598YY000199", valorLiquidoOperacao: 600 });
  const linha2 = linhaFin5({ linhaNum: 2, chaveUr: "20260710004XX6598YY000200", valorLiquidoOperacao: 150 });
  const itens = selecionarEspelhoTipo5([linha1, linha2]);
  assertEquals(itens.length, 2);
  assertEquals(itens[0].external_id !== itens[1].external_id, true);
});

Deno.test("selecionarEspelhoTipo5: filtra fora operações que não são PG", () => {
  const tipos = ["CS", "CF", "AC", "CL", "GL", "GF", "AL"];
  const linhas = tipos.map((tipoOperacao, i) => linhaFin5({ tipoOperacao, linhaNum: i + 1 }));
  const itens = selecionarEspelhoTipo5(linhas);
  assertEquals(itens.length, 0);
});

Deno.test("selecionarEspelhoTipo5: reimportação do mesmo arquivo gera external_id idêntico", () => {
  const linha = linhaFin5({ linhaNum: 3 });
  const primeira = selecionarEspelhoTipo5([linha]);
  const segunda = selecionarEspelhoTipo5([linha]);
  assertEquals(primeira[0].external_id, segunda[0].external_id);
});

Deno.test("selecionarEspelhoTipo5: mesmo PG sob nome de arquivo DIFERENTE gera external_id idêntico (fix P2 — dedupe não pode depender do nome do arquivo)", () => {
  // Simula a Getnet reenviando/reprocessando o mesmo dia sob outro nome de
  // arquivo — getnet_arquivos trataria isso como arquivo novo, mas o
  // external_id (baseado só no conteúdo da linha) tem que ser o mesmo, ou o
  // dedupe (conta_id, external_id) deixaria o mesmo crédito passar 2x.
  const linhaArquivoA = linhaFin5({ linhaNum: 1 });
  const linhaArquivoB = linhaFin5({ linhaNum: 1 }); // mesmo conteúdo, "outro arquivo"
  const itensA = selecionarEspelhoTipo5([linhaArquivoA]);
  const itensB = selecionarEspelhoTipo5([linhaArquivoB]);
  assertEquals(itensA[0].external_id, itensB[0].external_id);
});

Deno.test("selecionarEspelhoTipo5: não recebe integracao_id (fix P2 — integração excluída/recriada pra mesma conta não pode duplicar crédito histórico)", () => {
  // A função não aceita mais integracaoId como parâmetro (era o P2 anterior:
  // conta_id não muda numa substituição de integração, mas integracao.id
  // muda — incluí-lo na chave duplicaria o histórico reimportado sob a nova
  // integração). O teste em si é a assinatura: chamar com só o array já
  // prova que não há como variar a chave por integração.
  const linha = linhaFin5({ linhaNum: 1 });
  const itens = selecionarEspelhoTipo5([linha]);
  assertEquals(itens[0].external_id.includes("integ-"), false);
});

Deno.test("selecionarEspelhoTipo5: chaveUr vazia cai pra numeroOperacao na composição do external_id", () => {
  const linha = linhaFin5({ chaveUr: "", numeroOperacao: "OP123" });
  const itens = selecionarEspelhoTipo5([linha]);
  assertEquals(itens.length, 1);
  assertEquals(itens[0].external_id, "getnet_fin5:2026-07-10:01:OP123:600");
});

Deno.test("selecionarEspelhoTipo5: fallback de data usa dataOperacao quando dataCreditoOperacao é nula", () => {
  const linha = linhaFin5({ dataCreditoOperacao: null, dataOperacao: "2026-07-05" });
  const itens = selecionarEspelhoTipo5([linha]);
  assertEquals(itens.length, 1);
  assertEquals(itens[0].data_transacao, "2026-07-05");
});

Deno.test("selecionarEspelhoTipo5: descarta linha PG sem nenhuma data (dataCreditoOperacao e dataOperacao nulas)", () => {
  const linha = linhaFin5({ dataCreditoOperacao: null, dataOperacao: null });
  const itens = selecionarEspelhoTipo5([linha]);
  assertEquals(itens.length, 0);
});

// resolverUsoTipo5 — fix P1 (review PR #52): trava a origem por arquivo em
// reprocessamento, para não duplicar crédito se espelho_tipo5_desde mudar
// depois de um arquivo já ter sido importado.

Deno.test("resolverUsoTipo5: arquivo nunca importado (nenhuma linha) decide fresco pela config — true", () => {
  assertEquals(resolverUsoTipo5(null, true), true);
});

Deno.test("resolverUsoTipo5: arquivo nunca importado (nenhuma linha) decide fresco pela config — false", () => {
  assertEquals(resolverUsoTipo5(undefined, false), false);
});

Deno.test("resolverUsoTipo5: arquivo já importado ANTES da coluna existir (espelho_origem NULL) trava em tipo 1, mesmo com corte retroativo cobrindo a data (cenário exato do P1)", () => {
  assertEquals(resolverUsoTipo5({ espelho_origem: null }, true), false);
});

Deno.test("resolverUsoTipo5: arquivo já importado como tipo5 trava em tipo5, mesmo se a config mudar depois", () => {
  assertEquals(resolverUsoTipo5({ espelho_origem: "getnet_sftp_tipo5" }, false), true);
});

Deno.test("resolverUsoTipo5: arquivo já importado como tipo1 (explícito, pós-fix) trava em tipo1, mesmo com corte cobrindo a data", () => {
  assertEquals(resolverUsoTipo5({ espelho_origem: "getnet_sftp_txt" }, true), false);
});

// Campos de participante (C2-5) — byte-exact contra o manual V10.1. Sem
// amostra real disponível (produção sem nenhuma linha tipo5/6 ainda);
// testa só que o parser lê a posição CERTA declarada em LAYOUT_FIN_RESUMO/
// LAYOUT_FIN_DETALHE, não que o dado capturado bate com produção real.
function montarLinha400(campos: Array<{ start: number; len: number; valor: string }>): string {
  const chars = new Array(400).fill(" ");
  for (const { start, len, valor } of campos) {
    const v = valor.padEnd(len, " ").slice(0, len);
    for (let i = 0; i < len; i++) chars[start - 1 + i] = v[i];
  }
  return chars.join("");
}

Deno.test("parseExtrato: tipo5 (LAYOUT_FIN_RESUMO) lê CNPJ/CPF, banco, agência, conta e razão social do participante nas posições do manual, sem deslocar codigoArranjo/chaveUr", () => {
  const linha = montarLinha400([
    { start: 1, len: 1, valor: "5" },
    { start: 171, len: 14, valor: "12345678000199" },
    { start: 187, len: 3, valor: "341" },
    { start: 190, len: 6, valor: "123456" },
    { start: 196, len: 20, valor: "1234567890" },
    { start: 231, len: 25, valor: "EMPRESA PARTICIPANTE LTDA" },
    { start: 256, len: 2, valor: "01" },
    { start: 258, len: 25, valor: "20260710004XX6598YY000199" },
  ]);
  const { financeirosResumo } = parseExtrato(linha);
  assertEquals(financeirosResumo.length, 1);
  const f = financeirosResumo[0];
  assertEquals(f.participanteCnpjCpf, "12345678000199");
  assertEquals(f.participanteBanco, "341");
  assertEquals(f.participanteAgencia, "123456");
  assertEquals(f.participanteContaCorrente, "1234567890");
  assertEquals(f.participanteRazaoSocial, "EMPRESA PARTICIPANTE LTDA");
  // Campos vizinhos não deslocados pelos campos novos inseridos antes deles.
  assertEquals(f.codigoArranjo, "01");
  assertEquals(f.chaveUr, "20260710004XX6598YY000199");
});

Deno.test("parseExtrato: tipo6 (LAYOUT_FIN_DETALHE) lê CNPJ/CPF e razão social do participante em posições PRÓPRIAS (diferentes do tipo5), sem banco/agência/conta (deprecados nessa posição pelo manual)", () => {
  const linha = montarLinha400([
    { start: 1, len: 1, valor: "6" },
    { start: 177, len: 14, valor: "98765432000188" },
    { start: 237, len: 25, valor: "OUTRA EMPRESA LTDA" },
    { start: 262, len: 25, valor: "20260710004XX6598YY000200" },
  ]);
  const { financeirosDetalhe } = parseExtrato(linha);
  assertEquals(financeirosDetalhe.length, 1);
  const f = financeirosDetalhe[0];
  assertEquals(f.participanteCnpjCpf, "98765432000188");
  assertEquals(f.participanteRazaoSocial, "OUTRA EMPRESA LTDA");
  assertEquals(f.chaveUr, "20260710004XX6598YY000200");
  // FinDetalheRecord não declara participanteBanco/Agencia/ContaCorrente —
  // manual documenta essas posições (bytes 191-221) como ZEROS/ESPAÇO
  // (deprecado) no tipo6, diferente do tipo5 onde são campos vivos.
  assertEquals("participanteBanco" in f, false);
});
