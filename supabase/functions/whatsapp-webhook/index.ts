/**
 * Webhook direto da Meta WhatsApp Cloud API (ADR-033 PR3) — substitui o
 * relay via Make.com. Escopo desta PR, deliberadamente limitado:
 *
 *   1. GET: handshake de verificação (hub.mode/hub.verify_token/
 *      hub.challenge), exigido pela Meta ao configurar o webhook.
 *   2. POST: valida X-Hub-Signature-256 (HMAC-SHA256 sobre o corpo RAW,
 *      ver _shared/crypto-utils.ts), normaliza o envelope
 *      (envelope.ts) e responde 200 — SEM despachar pra nenhum chatbot,
 *      SEM gravar em whatsapp_wamid_dedup, SEM decidir roteamento.
 *
 * Dedup/roteamento/dispatch pros chatbot-triagem/chatbot-financeiro
 * ficam pra PR4 (docs/automacoes/PLANO_REMOCAO_MAKE_WHATSAPP.md) — essa
 * PR só prova que parsing+segurança funcionam contra payloads reais
 * antes de acoplar a lógica de negócio em cima.
 *
 * Lógica em router.ts (sem `serve()`, testável com `deno test` puro).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequest } from "./router.ts";

serve(handleRequest);
