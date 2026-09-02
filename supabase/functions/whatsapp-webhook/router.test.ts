// Testes de handleGet/handlePost/handleRequest (ADR-033 PR3).
//
// Cobre o comportamento HTTP-facing que envelope.test.ts não cobre:
// handshake da Meta (status/headers/corpo do challenge), fail-closed do
// HMAC quando META_APP_SECRET/assinatura estão ausentes ou errados, e
// que um POST válido não despacha pra nenhum chatbot (só devolve a
// contagem).
//
// Cada teste seta/limpa as env vars que usa e restaura no fim (bloco
// try/finally dentro do próprio corpo async do teste — nada de wrapper
// genérico que devolva antes do `await` interno terminar, que já foi um
// bug real numa versão anterior deste arquivo: a env var era restaurada
// ANTES do código sob teste chegar a lê-la).
//
// Rodar: deno test --allow-env supabase/functions/whatsapp-webhook/router.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleGet, handlePost, handleRequest } from "./router.ts";

const VERIFY_TOKEN = "verify-token-teste";
const APP_SECRET = "app-secret-teste";

async function assinar(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

Deno.test("handleGet: hub.mode ausente devolve 200 (health-check simples)", () => {
  const res = handleGet(new Request("https://x.test/webhook"));
  assertEquals(res.status, 200);
});

Deno.test("handleGet: handshake com token correto devolve 200, text/plain, corpo = challenge cru", async () => {
  Deno.env.set("WHATSAPP_VERIFY_TOKEN", VERIFY_TOKEN);
  try {
    const res = handleGet(
      new Request(
        `https://x.test/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=CHALLENGE-XYZ`,
      ),
    );
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Content-Type"), "text/plain");
    assertEquals(await res.text(), "CHALLENGE-XYZ");
  } finally {
    Deno.env.delete("WHATSAPP_VERIFY_TOKEN");
  }
});

Deno.test("handleGet: handshake com token errado devolve 403, não ecoa o challenge", async () => {
  Deno.env.set("WHATSAPP_VERIFY_TOKEN", VERIFY_TOKEN);
  try {
    const res = handleGet(
      new Request(
        "https://x.test/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=CHALLENGE-XYZ",
      ),
    );
    assertEquals(res.status, 403);
    const corpo = await res.text();
    assertEquals(corpo.includes("CHALLENGE-XYZ"), false);
  } finally {
    Deno.env.delete("WHATSAPP_VERIFY_TOKEN");
  }
});

Deno.test("handleGet: WHATSAPP_VERIFY_TOKEN não configurado falha fechado (403), mesmo com token certo no request", () => {
  Deno.env.delete("WHATSAPP_VERIFY_TOKEN");
  const res = handleGet(
    new Request(
      "https://x.test/webhook?hub.mode=subscribe&hub.verify_token=qualquer&hub.challenge=X",
    ),
  );
  assertEquals(res.status, 403);
});

Deno.test("handlePost: META_APP_SECRET ausente devolve 401 (fail-closed), antes de checar assinatura", async () => {
  Deno.env.delete("META_APP_SECRET");
  const res = await handlePost(
    new Request("https://x.test/webhook", { method: "POST", body: "{}" }),
  );
  assertEquals(res.status, 401);
});

Deno.test("handlePost: assinatura ausente devolve 401", async () => {
  Deno.env.set("META_APP_SECRET", APP_SECRET);
  try {
    const res = await handlePost(
      new Request("https://x.test/webhook", { method: "POST", body: "{}" }),
    );
    assertEquals(res.status, 401);
  } finally {
    Deno.env.delete("META_APP_SECRET");
  }
});

Deno.test("handlePost: assinatura válida + envelope real devolve 200 com a contagem certa, sem despachar nada", async () => {
  Deno.env.set("META_APP_SECRET", APP_SECRET);
  try {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "1",
          changes: [
            {
              value: {
                metadata: { phone_number_id: "1000", display_phone_number: "5511999990000" },
                contacts: [{ wa_id: "5511988887777" }],
                messages: [
                  { id: "wamid.R1", from: "5511988887777", timestamp: "1", type: "text", text: { body: "oi" } },
                ],
              },
            },
          ],
        },
      ],
    });
    const assinatura = await assinar(body, APP_SECRET);
    const res = await handlePost(
      new Request("https://x.test/webhook", {
        method: "POST",
        headers: { "x-hub-signature-256": assinatura },
        body,
      }),
    );
    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json, { ok: true, mensagens: 1 });
  } finally {
    Deno.env.delete("META_APP_SECRET");
  }
});

Deno.test("handlePost: assinatura válida mas corpo não é JSON devolve 400", async () => {
  Deno.env.set("META_APP_SECRET", APP_SECRET);
  try {
    const body = "não é json";
    const assinatura = await assinar(body, APP_SECRET);
    const res = await handlePost(
      new Request("https://x.test/webhook", {
        method: "POST",
        headers: { "x-hub-signature-256": assinatura },
        body,
      }),
    );
    assertEquals(res.status, 400);
  } finally {
    Deno.env.delete("META_APP_SECRET");
  }
});

Deno.test("handleRequest: OPTIONS devolve headers de CORS", async () => {
  const res = await handleRequest(new Request("https://x.test/webhook", { method: "OPTIONS" }));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("handleRequest: método não suportado (ex.: DELETE) devolve 405", async () => {
  const res = await handleRequest(new Request("https://x.test/webhook", { method: "DELETE" }));
  assertEquals(res.status, 405);
});
