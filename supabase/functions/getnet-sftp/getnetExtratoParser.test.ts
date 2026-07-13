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
import { selecionarEspelhoTipo5, type FinResumoRecord } from "./getnetExtratoParser.ts";

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
    codigoArranjo: "01",
    chaveUr: "20260710004XX6598YY000199",
    linhaNum: 1,
    rawLine: "",
    ...overrides,
  };
}

Deno.test("selecionarEspelhoTipo5: PG com numero_operacao vazio gera item sem quebrar", () => {
  const linha = linhaFin5({ numeroOperacao: "" });
  const itens = selecionarEspelhoTipo5([linha], "integ-1", "arquivo1.txt");
  assertEquals(itens.length, 1);
  assertEquals(itens[0].numero_documento, null);
  assertEquals(itens[0].external_id, "getnet_fin5:integ-1:arquivo1.txt:1");
  assertEquals(itens[0].tipo, "credito");
  assertEquals(itens[0].valor, 600);
});

Deno.test("selecionarEspelhoTipo5: duas linhas PG no mesmo arquivo geram external_id distintos", () => {
  const linha1 = linhaFin5({ linhaNum: 1, valorLiquidoOperacao: 600 });
  const linha2 = linhaFin5({ linhaNum: 2, valorLiquidoOperacao: 150 });
  const itens = selecionarEspelhoTipo5([linha1, linha2], "integ-1", "arquivo1.txt");
  assertEquals(itens.length, 2);
  assertEquals(itens[0].external_id, "getnet_fin5:integ-1:arquivo1.txt:1");
  assertEquals(itens[1].external_id, "getnet_fin5:integ-1:arquivo1.txt:2");
});

Deno.test("selecionarEspelhoTipo5: filtra fora operações que não são PG", () => {
  const tipos = ["CS", "CF", "AC", "CL", "GL", "GF", "AL"];
  const linhas = tipos.map((tipoOperacao, i) => linhaFin5({ tipoOperacao, linhaNum: i + 1 }));
  const itens = selecionarEspelhoTipo5(linhas, "integ-1", "arquivo1.txt");
  assertEquals(itens.length, 0);
});

Deno.test("selecionarEspelhoTipo5: reimportação do mesmo arquivo gera external_id idêntico", () => {
  const linha = linhaFin5({ linhaNum: 3 });
  const primeira = selecionarEspelhoTipo5([linha], "integ-1", "arquivo1.txt");
  const segunda = selecionarEspelhoTipo5([linha], "integ-1", "arquivo1.txt");
  assertEquals(primeira[0].external_id, segunda[0].external_id);
});

Deno.test("selecionarEspelhoTipo5: fallback de data usa dataOperacao quando dataCreditoOperacao é nula", () => {
  const linha = linhaFin5({ dataCreditoOperacao: null, dataOperacao: "2026-07-05" });
  const itens = selecionarEspelhoTipo5([linha], "integ-1", "arquivo1.txt");
  assertEquals(itens.length, 1);
  assertEquals(itens[0].data_transacao, "2026-07-05");
});

Deno.test("selecionarEspelhoTipo5: descarta linha PG sem nenhuma data (dataCreditoOperacao e dataOperacao nulas)", () => {
  const linha = linhaFin5({ dataCreditoOperacao: null, dataOperacao: null });
  const itens = selecionarEspelhoTipo5([linha], "integ-1", "arquivo1.txt");
  assertEquals(itens.length, 0);
});
