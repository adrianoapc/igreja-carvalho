// Testes de resolverUsoTipo5/parseExtrato (F6/C2-5).
//
// A extração de campos do registro posicional tem histórico de bug de
// precisão nesse projeto (ver resolverContaPix na F5); um teste
// automatizado real é mais confiável do que reler o código manualmente a
// cada revisão.
//
// Rodar: deno test supabase/functions/getnet-sftp/getnetExtratoParser.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolverUsoTipo5,
  parseExtrato,
} from "./getnetExtratoParser.ts";

// resolverUsoTipo5 continua travando espelho_origem por arquivo em
// getnet_arquivos (consumido por getnet_credito_disponivel_view, C2-6) —
// mesmo depois da C2-8 ter parado de espelhar em extratos_bancarios.
//
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
