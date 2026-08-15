// Testes de resolverContaPix (F5 fatia 2 — ingestão de PIX).
//
// Esta função teve 3 rodadas de bug de precisão em review (ambiguidade
// multi-integração, prioridade filial×igreja, filial desconhecida
// descartando a única conta escopada). Um teste automatizado real é mais
// confiável do que reler o código manualmente a cada rodada.
//
// Rodar: deno test supabase/functions/_shared/financeiro-core.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolverContaPix,
  resolverIgrejaEFilialWhatsApp,
  extrairDataHoraUtcDoEndToEndId,
  resolverDataHoraPixUtc,
} from "./financeiro-core.ts";

// deno-lint-ignore no-explicit-any
type AnyClient = any;

/**
 * Mock mínimo do client Supabase — implementa só a cadeia exata que
 * resolverContaPix usa: `.from("integracoes_financeiras").select(...).eq(...).maybeSingle()`
 * e `.from("contas").select(...).eq(...).eq(...).eq(...)` (thenable direto, sem terminal).
 */
function mockSupabase(opts: {
  integracao?: { filial_id: string | null } | null;
  contas?: Array<{ id: string; filial_id: string | null }>;
  contasError?: { message: string };
}): AnyClient {
  return {
    from(_table: string) {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        async maybeSingle() {
          return { data: opts.integracao ?? null };
        },
        // torna a cadeia "awaitable" diretamente (consulta de contas, sem terminal)
        then(resolve: (v: unknown) => void) {
          resolve({ data: opts.contas ?? [], error: opts.contasError ?? null });
        },
      };
      return chain;
    },
  };
}

const baseInput = {
  igreja_id: "igreja-1",
  pix_id: "pix-1",
  valor: 10,
  data_pix: "2026-01-01",
  descricao: "PIX teste",
};

Deno.test("conta_id explícito tem prioridade máxima (sem consultar nada)", async () => {
  const supabase = mockSupabase({});
  const result = await resolverContaPix(supabase, { ...baseInput, conta_id: "conta-explicita" });
  assertEquals(result, { contaId: "conta-explicita", filialId: null });
});

Deno.test("filial conhecida com conta específica da filial: usa a conta da filial", async () => {
  const supabase = mockSupabase({
    integracao: { filial_id: "filial-A" },
    contas: [
      { id: "conta-A", filial_id: "filial-A" },
      { id: "conta-igreja", filial_id: null },
    ],
  });
  const result = await resolverContaPix(supabase, { ...baseInput, integracao_id: "integ-1" });
  assertEquals(result, { contaId: "conta-A", filialId: "filial-A" });
});

Deno.test("filial conhecida sem conta específica: cai para a conta de nível-igreja", async () => {
  const supabase = mockSupabase({
    integracao: { filial_id: "filial-B" },
    contas: [{ id: "conta-igreja", filial_id: null }],
  });
  const result = await resolverContaPix(supabase, { ...baseInput, integracao_id: "integ-1" });
  assertEquals(result, { contaId: "conta-igreja", filialId: null });
});

Deno.test("filial conhecida sem conta específica NEM de nível-igreja: não usa conta de outra filial", async () => {
  const supabase = mockSupabase({
    integracao: { filial_id: "filial-B" },
    contas: [{ id: "conta-outra-filial", filial_id: "filial-C" }],
  });
  const result = await resolverContaPix(supabase, { ...baseInput, integracao_id: "integ-1" });
  assertEquals(result, { ingerido: false, motivo: "conta_santander_nao_encontrada" });
});

Deno.test("filial DESCONHECIDA (ex.: pix-webhook) com única conta escopada a uma filial: usa essa conta", () => {
  const supabase = mockSupabase({
    contas: [{ id: "conta-unica-filial", filial_id: "filial-X" }],
  });
  return resolverContaPix(supabase, baseInput).then((result) => {
    assertEquals(result, { contaId: "conta-unica-filial", filialId: "filial-X" });
  });
});

Deno.test("filial desconhecida com única conta de nível-igreja: usa essa conta", async () => {
  const supabase = mockSupabase({
    contas: [{ id: "conta-igreja", filial_id: null }],
  });
  const result = await resolverContaPix(supabase, baseInput);
  assertEquals(result, { contaId: "conta-igreja", filialId: null });
});

Deno.test("filial desconhecida com múltiplas contas (qualquer filial): ambíguo", async () => {
  const supabase = mockSupabase({
    contas: [
      { id: "conta-1", filial_id: "filial-A" },
      { id: "conta-2", filial_id: "filial-B" },
    ],
  });
  const result = await resolverContaPix(supabase, baseInput);
  assertEquals(result, { ingerido: false, motivo: "multiplas_contas_santander" });
});

Deno.test("nenhuma conta Santander encontrada", async () => {
  const supabase = mockSupabase({ contas: [] });
  const result = await resolverContaPix(supabase, baseInput);
  assertEquals(result, { ingerido: false, motivo: "conta_santander_nao_encontrada" });
});

Deno.test("erro na consulta de contas é propagado como conta_santander_nao_encontrada", async () => {
  const supabase = mockSupabase({ contasError: { message: "boom" } });
  const result = await resolverContaPix(supabase, baseInput);
  assertEquals(result, {
    ingerido: false,
    motivo: "conta_santander_nao_encontrada",
    detalhe: "boom",
  });
});

// --- resolverIgrejaEFilialWhatsApp (bot financeiro) ---
//
// Cobre o bug real registrado em docs/arquitetura-financeiro.md §11: o
// lookup em whatsapp_numeros era pulado inteiro quando igreja_id já vinha
// no payload do Make, deixando filial_id sempre null nesse caso (payload
// documentado do Make manda os dois campos juntos).

/** Mock mínimo pra `.from("whatsapp_numeros").select().eq().eq().maybeSingle()`. */
function mockSupabaseWhatsapp(opts: {
  rota?: { igreja_id: string; filial_id: string | null } | null;
  error?: { message: string };
}): AnyClient {
  return {
    from(_table: string) {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        async maybeSingle() {
          return { data: opts.rota ?? null, error: opts.error ?? null };
        },
      };
      return chain;
    },
  };
}

Deno.test("sem whatsapp_number: retorna igreja_id explícito, filial sempre null", async () => {
  const supabase = mockSupabaseWhatsapp({});
  const result = await resolverIgrejaEFilialWhatsApp(supabase, "igreja-1", "");
  assertEquals(result, { igrejaId: "igreja-1", filialId: null });
});

Deno.test("sem igreja_id explícito: resolve igreja E filial pelo whatsapp_number (caminho pré-existente)", async () => {
  const supabase = mockSupabaseWhatsapp({
    rota: { igreja_id: "igreja-1", filial_id: "filial-A" },
  });
  const result = await resolverIgrejaEFilialWhatsApp(supabase, null, "5511999999999");
  assertEquals(result, { igrejaId: "igreja-1", filialId: "filial-A" });
});

Deno.test("com igreja_id explícito E whatsapp_number da MESMA igreja: resolve filial (bug corrigido)", async () => {
  const supabase = mockSupabaseWhatsapp({
    rota: { igreja_id: "igreja-1", filial_id: "filial-A" },
  });
  const result = await resolverIgrejaEFilialWhatsApp(supabase, "igreja-1", "5511999999999");
  assertEquals(result, { igrejaId: "igreja-1", filialId: "filial-A" });
});

Deno.test("com igreja_id explícito e whatsapp_number de OUTRA igreja: ignora filial do lookup", async () => {
  const supabase = mockSupabaseWhatsapp({
    rota: { igreja_id: "igreja-2", filial_id: "filial-B" },
  });
  const result = await resolverIgrejaEFilialWhatsApp(supabase, "igreja-1", "5511999999999");
  assertEquals(result, { igrejaId: "igreja-1", filialId: null });
});

Deno.test("whatsapp_number sem rota cadastrada: mantém igreja_id explícito, filial null", async () => {
  const supabase = mockSupabaseWhatsapp({ rota: null });
  const result = await resolverIgrejaEFilialWhatsApp(supabase, "igreja-1", "5511999999999");
  assertEquals(result, { igrejaId: "igreja-1", filialId: null });
});

Deno.test("erro na consulta de whatsapp_numeros: mantém igreja_id explícito, filial null", async () => {
  const supabase = mockSupabaseWhatsapp({ error: { message: "boom" } });
  const result = await resolverIgrejaEFilialWhatsApp(supabase, "igreja-1", "5511999999999");
  assertEquals(result, { igrejaId: "igreja-1", filialId: null });
});

// --- extrairDataHoraUtcDoEndToEndId / resolverDataHoraPixUtc ---
//
// Achado real em produção (2026-08-15): o campo `horario` que a API de
// CONSULTA (polling) do Santander devolve vem com os números do horário de
// Brasília rotulados como UTC — 3h atrasado do instante real. Confirmado
// comparando, pro MESMO endToEndId, o `horario` que o WEBHOOK mandou
// (correto) contra o que a consulta manual devolveu depois (errado).
// endToEndId é padrão BACEN (E + ISPB(8) + AAAAMMDDHHmm(12) + sequencial),
// sempre UTC, não depende do provedor nem do canal.

Deno.test("extrai data/hora UTC de um endToEndId real (BACEN)", () => {
  const result = extrairDataHoraUtcDoEndToEndId("E31872495202608152000p1ivIXRFUNk");
  assertEquals(result, "2026-08-15T20:00:00.000Z");
});

Deno.test("extrai data/hora UTC — outro endToEndId real, minuto diferente", () => {
  const result = extrairDataHoraUtcDoEndToEndId("E31872495202608151726htzhabAFpLI");
  assertEquals(result, "2026-08-15T17:26:00.000Z");
});

Deno.test("endToEndId fora do formato BACEN esperado: retorna null", () => {
  assertEquals(extrairDataHoraUtcDoEndToEndId("nao-e-um-e2e-id"), null);
  assertEquals(extrairDataHoraUtcDoEndToEndId(""), null);
});

Deno.test("resolverDataHoraPixUtc prioriza o endToEndId sobre o horario informado", () => {
  // horario (do Santander) diz 17:00 — 3h atrasado do real (bug achado em
  // produção); endToEndId diz 20:00 — este é o valor que deve prevalecer.
  const result = resolverDataHoraPixUtc(
    "E31872495202608152000p1ivIXRFUNk",
    "2026-08-15T17:00:31Z",
  );
  assertEquals(result, "2026-08-15T20:00:00.000Z");
});

Deno.test("resolverDataHoraPixUtc cai pro horario quando endToEndId não é BACEN válido", () => {
  const result = resolverDataHoraPixUtc("id-invalido", "2026-08-15T17:00:31Z");
  assertEquals(result, "2026-08-15T17:00:31.000Z");
});
