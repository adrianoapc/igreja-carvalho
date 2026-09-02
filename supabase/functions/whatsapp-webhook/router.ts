/**
 * Lógica HTTP do whatsapp-webhook (ADR-033 PR3) — separada de index.ts
 * (que roda `serve()`) pra dar pra testar com `deno test` puro, sem
 * subir servidor (mesmo padrão de envelope.ts/getnet-sftp/
 * getnetExtratoParser.ts).
 */

import { timingSafeEqual, verificarAssinaturaMetaHmac } from "../_shared/crypto-utils.ts";
import { normalizarEnvelope } from "./envelope.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * GET: handshake de verificação da Meta (hub.mode/hub.verify_token/
 * hub.challenge). Falha fechado — sem WHATSAPP_VERIFY_TOKEN configurado
 * ou com token incorreto, 403, nunca ecoa o challenge.
 */
export function handleGet(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expectedToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  if (!mode) {
    // Health-check simples (sem query params de handshake) — não é um
    // caso da Meta, mas útil pra confirmar que a function está no ar.
    return new Response("ok", { status: 200 });
  }

  if (mode === "subscribe" && expectedToken && token && timingSafeEqual(token, expectedToken)) {
    // A Meta exige o challenge de volta cru, texto puro — não em JSON.
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(
    "[whatsapp-webhook] handshake GET falhou (hub.verify_token ausente/incorreto ou WHATSAPP_VERIFY_TOKEN não configurado)",
  );
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST: valida X-Hub-Signature-256 sobre o corpo RAW, normaliza o
 * envelope e responde 200 com a contagem de mensagens — SEM despachar
 * pra nenhum chatbot (PR4).
 */
export async function handlePost(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const appSecret = Deno.env.get("META_APP_SECRET");

  if (!appSecret) {
    console.error(
      "[whatsapp-webhook] META_APP_SECRET não configurado — recusando POST (fail-closed)",
    );
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const signatureHeader = req.headers.get("x-hub-signature-256");
  const assinaturaValida = await verificarAssinaturaMetaHmac(
    rawBody,
    signatureHeader,
    appSecret,
  );
  if (!assinaturaValida) {
    console.warn("[whatsapp-webhook] X-Hub-Signature-256 ausente ou inválida");
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("[whatsapp-webhook] corpo POST não é JSON válido (após HMAC OK)");
    return jsonResponse({ error: "Payload inválido" }, 400);
  }

  const mensagens = normalizarEnvelope(payload);
  console.log(
    `[whatsapp-webhook] ${mensagens.length} mensagem(ns) normalizada(s) neste POST (dedup/roteamento chega na PR4, nenhum chatbot é chamado aqui)`,
  );

  return jsonResponse({ ok: true, mensagens: mensagens.length }, 200);
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return handleGet(req);
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    return await handlePost(req);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[whatsapp-webhook] ERRO FATAL:", msg);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
}
