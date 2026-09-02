/**
 * Comparação tempo-constante de strings — evita vazar por timing side-
 * channel em quantos caracteres iniciais de um segredo batem (ex.:
 * validação de x-webhook-secret). Duplicada historicamente em
 * receber-pedido-make/pix-webhook (não tocados aqui — fora do escopo
 * desta PR); chatbot-triagem/chatbot-financeiro migradas pra esta cópia
 * compartilhada em vez de manter uma 3ª cópia local (achado real de
 * /code-review local).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ba.length ^ bb.length;
  const len = Math.max(ba.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/**
 * Verifica um header `X-Hub-Signature-256` (Meta/WhatsApp Cloud API):
 * HMAC-SHA256 do corpo RAW da requisição (bytes exatos, antes de
 * qualquer JSON.parse) usando o app secret como chave, hex-encoded,
 * prefixado com "sha256=". Sem precedente nesta base — os HMACs
 * existentes (receber-pedido-make, pix-webhook) são comparação direta
 * de segredo compartilhado, não HMAC sobre o corpo. Primeiro consumidor:
 * whatsapp-webhook (ADR-033 PR3).
 *
 * `rawBody` precisa ser a STRING exata recebida (ex.: `await
 * req.text()`) — reserializar um objeto já parseado produz bytes
 * diferentes (ordem de chaves, espaçamento) e quebra a verificação.
 */
export async function verificarAssinaturaMetaHmac(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const providedHex = signatureHeader.slice("sha256=".length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedHex, providedHex);
}
