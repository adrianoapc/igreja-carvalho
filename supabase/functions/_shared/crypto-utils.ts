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
