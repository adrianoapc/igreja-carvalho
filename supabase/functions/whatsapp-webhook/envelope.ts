/**
 * Normalização do envelope de webhook da Meta WhatsApp Cloud API
 * (ADR-033 PR3) — separado de index.ts (que roda `serve()`) pra dar pra
 * testar com `deno test` puro, sem subir servidor nem depender de
 * Supabase client (mesmo padrão de getnet-sftp/getnetExtratoParser.ts).
 *
 * Escopo desta PR: só parsing/normalização. NÃO despacha pra nenhum
 * chatbot, não grava em whatsapp_wamid_dedup, não decide roteamento —
 * isso é PR4 (docs/automacoes/PLANO_REMOCAO_MAKE_WHATSAPP.md).
 */

export interface NormalizedMessage {
  wamid: string;
  phoneNumberId: string;
  whatsappNumber: string | null;
  telefone: string;
  nomePerfil: string | null;
  tipo: string;
  tipoMensagem: string;
  metaTimestamp: number;
  seq: number;
  conteudoTexto?: string;
  mensagem?: string;
  mediaId?: string;
}

/**
 * Allowlist GLOBAL de tipos suportados nesta PR. O plano original prevê
 * allowlist POR ROTA (ex.: {text,audio} pra triagem, {text,image,
 * document} pra financeiro) — mas essa distinção só faz sentido depois
 * que o roteamento existir (PR4). Até lá, filtra pelo superset das duas
 * rotas; tipos fora disso (interactive, button, reaction, location,
 * contacts, sticker, system) são descartados aqui e nunca chegam a PR4.
 */
const SUPPORTED_TYPES = new Set(["text", "audio", "image", "document"]);

function extrairMediaId(
  tipo: string,
  // deno-lint-ignore no-explicit-any
  msg: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): string | undefined {
  const media = msg?.[tipo];
  return typeof media?.id === "string" && media.id ? media.id : undefined;
}

/**
 * Itera todo `entry[].changes[].value.messages[]` do payload (um POST da
 * Meta pode trazer mais de uma mensagem, de mais de um `entry`/`change`
 * em lote) e devolve uma lista plana e normalizada, na ordem de
 * travessia do array (campo `seq`, usado como desempate de FIFO por
 * PR4+ depois do `meta_timestamp`).
 *
 * Correlação com `contacts[]` é SEMPRE por `wa_id === messages[].from`
 * — nunca por índice posicional (a Meta não garante a mesma ordem/
 * tamanho entre os dois arrays; ver PLANO_REMOCAO_MAKE_WHATSAPP.md).
 *
 * Mensagens sem `id`/`from`/`phone_number_id`, ou de tipo fora da
 * allowlist, são descartadas silenciosamente (avisadas via console.warn
 * pra observabilidade, mas sem interromper o resto do lote).
 */
export function normalizarEnvelope(
  // deno-lint-ignore no-explicit-any
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): NormalizedMessage[] {
  const mensagens: NormalizedMessage[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  let seq = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      if (!value) continue;

      const phoneNumberId = value?.metadata?.phone_number_id ?? null;
      const whatsappNumber = value?.metadata?.display_phone_number ?? null;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const msg of messages) {
        const tipo = msg?.type;
        if (typeof tipo !== "string" || !SUPPORTED_TYPES.has(tipo)) {
          console.warn(
            `[whatsapp-webhook] mensagem tipo="${tipo}" fora da allowlist, descartada`,
          );
          continue;
        }

        const wamid = msg?.id;
        const telefone = msg?.from;
        if (!wamid || !telefone || !phoneNumberId) {
          console.warn(
            "[whatsapp-webhook] mensagem sem wamid/telefone/phone_number_id, descartada",
          );
          continue;
        }

        const contato = contacts.find(
          // deno-lint-ignore no-explicit-any
          (c: any) => c?.wa_id === telefone, // eslint-disable-line @typescript-eslint/no-explicit-any
        );

        const normalizada: NormalizedMessage = {
          wamid,
          phoneNumberId,
          whatsappNumber,
          telefone,
          nomePerfil: contato?.profile?.name ?? null,
          tipo,
          tipoMensagem: tipo,
          metaTimestamp: Number(msg?.timestamp) || 0,
          seq: seq++,
        };

        if (tipo === "text") {
          const texto = msg?.text?.body ?? "";
          normalizada.conteudoTexto = texto;
          normalizada.mensagem = texto;
        } else {
          const mediaId = extrairMediaId(tipo, msg);
          if (mediaId) normalizada.mediaId = mediaId;
        }

        mensagens.push(normalizada);
      }
    }
  }

  return mensagens;
}
