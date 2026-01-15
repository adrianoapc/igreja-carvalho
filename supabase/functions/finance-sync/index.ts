// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Esqueleto de sincronização financeira
// Integra com provedores externos conforme `financeiro_config.sync_strategy`
// e snapshot da sessão em `sessoes_contagem`.

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") ?? "unknown";
    const op = url.searchParams.get("op") ?? "pull"; // pull|push

    // Placeholder: validar assinatura se necessário (webhooks infra existente)
    // TODO: integrar com view/tabela de webhooks seguros

    if (req.method === "POST") {
      const payload = await req.json().catch(() => ({}));
      console.log("finance-sync POST", { provider, op, payload });
      return new Response(JSON.stringify({ ok: true, provider, op }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }

    // GET para teste com mock de itens
    const items = [
      {
        id: "pix-001",
        pessoa_id: null,
        forma_pagamento_id: "pix",
        valor: 350.0,
        status: "conciliado",
        origem: "api",
      },
      {
        id: "card-visa-002",
        pessoa_id: null,
        forma_pagamento_id: "cartao_credito",
        valor: 820.5,
        status: "conciliado",
        origem: "api",
      },
    ];
    return new Response(JSON.stringify({ ok: true, provider, op, items }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("finance-sync error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { "content-type": "application/json" },
      status: 500,
    });
  }
});
