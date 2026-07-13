// Testes de resolverContaPix (F5 fatia 2 — ingestão de PIX).
//
// Esta função teve 3 rodadas de bug de precisão em review (ambiguidade
// multi-integração, prioridade filial×igreja, filial desconhecida
// descartando a única conta escopada). Um teste automatizado real é mais
// confiável do que reler o código manualmente a cada rodada.
//
// Rodar: deno test supabase/functions/_shared/financeiro-core.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolverContaPix } from "./financeiro-core.ts";

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
