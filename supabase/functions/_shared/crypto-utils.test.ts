// Testes de timingSafeEqual/verificarAssinaturaMetaHmac.
//
// verificarAssinaturaMetaHmac é o único mecanismo de autenticação do
// endpoint público whatsapp-webhook (ADR-033 PR3) — sem teste automatizado
// aqui, um bug sutil (off-by-one no slice de "sha256=", maiúsculas vs
// minúsculas no hex, re-encoding de bytes) rejeitaria todo tráfego real da
// Meta OU, pior, aceitaria payload forjado, sem nada no CI acusando.
//
// Rodar: deno test supabase/functions/_shared/crypto-utils.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { timingSafeEqual, verificarAssinaturaMetaHmac } from "./crypto-utils.ts";

async function assinar(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

Deno.test("timingSafeEqual: strings iguais retornam true", () => {
  assertEquals(timingSafeEqual("segredo123", "segredo123"), true);
});

Deno.test("timingSafeEqual: strings diferentes (mesmo tamanho) retornam false", () => {
  assertEquals(timingSafeEqual("segredo123", "segredo124"), false);
});

Deno.test("timingSafeEqual: strings de tamanhos diferentes retornam false", () => {
  assertEquals(timingSafeEqual("curto", "muito-mais-longo"), false);
});

Deno.test("verificarAssinaturaMetaHmac: assinatura válida (calculada com o mesmo secret) é aceita", async () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const secret = "app-secret-de-teste";
  const header = await assinar(body, secret);
  assertEquals(await verificarAssinaturaMetaHmac(body, header, secret), true);
});

Deno.test("verificarAssinaturaMetaHmac: assinatura de outro secret é rejeitada", async () => {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const header = await assinar(body, "secret-errado");
  assertEquals(await verificarAssinaturaMetaHmac(body, header, "app-secret-de-teste"), false);
});

Deno.test("verificarAssinaturaMetaHmac: corpo alterado depois de assinado é rejeitado (garante hash sobre RAW bytes)", async () => {
  const secret = "app-secret-de-teste";
  const bodyOriginal = JSON.stringify({ a: 1 });
  const header = await assinar(bodyOriginal, secret);
  const bodyAdulterado = JSON.stringify({ a: 2 });
  assertEquals(await verificarAssinaturaMetaHmac(bodyAdulterado, header, secret), false);
});

Deno.test("verificarAssinaturaMetaHmac: header ausente é rejeitado", async () => {
  assertEquals(
    await verificarAssinaturaMetaHmac("{}", null, "app-secret-de-teste"),
    false,
  );
});

Deno.test("verificarAssinaturaMetaHmac: header sem prefixo 'sha256=' é rejeitado, mesmo com hex correto", async () => {
  const body = "{}";
  const secret = "app-secret-de-teste";
  const headerComPrefixo = await assinar(body, secret);
  const hexSemPrefixo = headerComPrefixo.replace("sha256=", "");
  assertEquals(await verificarAssinaturaMetaHmac(body, hexSemPrefixo, secret), false);
});

Deno.test("verificarAssinaturaMetaHmac: hex em maiúsculas não bate com o hex minúsculo calculado (case-sensitive)", async () => {
  const body = "{}";
  const secret = "app-secret-de-teste";
  const header = await assinar(body, secret);
  const headerMaiusculo = header.toUpperCase().replace("SHA256=", "sha256=");
  assertEquals(await verificarAssinaturaMetaHmac(body, headerMaiusculo, secret), false);
});
