// Testes de normalizarEnvelope (ADR-033 PR3).
//
// O caso que mais importa aqui é a correlação contacts[]<->messages[]
// por wa_id, não por índice — a Meta não garante ordem/tamanho iguais
// entre os dois arrays, e um bug de correlação posicional atribuiria o
// nome de perfil (ou, num bug mais grave, o contexto) da pessoa errada.
//
// Rodar: deno test supabase/functions/whatsapp-webhook/envelope.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizarEnvelope } from "./envelope.ts";

function envelopeComMensagens(
  messages: unknown[],
  contacts: unknown[],
  metadata: Record<string, unknown> = {
    phone_number_id: "1000",
    display_phone_number: "5511999990000",
  },
) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            value: { metadata, contacts, messages },
            field: "messages",
          },
        ],
      },
    ],
  };
}

Deno.test("normalizarEnvelope: mensagem de texto única, extrai todos os campos", () => {
  const payload = envelopeComMensagens(
    [
      {
        id: "wamid.AAA",
        from: "5511988887777",
        timestamp: "1717000000",
        type: "text",
        text: { body: "Olá" },
      },
    ],
    [{ wa_id: "5511988887777", profile: { name: "Fulano" } }],
  );

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 1);
  assertEquals(resultado[0].wamid, "wamid.AAA");
  assertEquals(resultado[0].telefone, "5511988887777");
  assertEquals(resultado[0].phoneNumberId, "1000");
  assertEquals(resultado[0].whatsappNumber, "5511999990000");
  assertEquals(resultado[0].nomePerfil, "Fulano");
  assertEquals(resultado[0].tipo, "text");
  assertEquals(resultado[0].conteudoTexto, "Olá");
  assertEquals(resultado[0].mensagem, "Olá");
  assertEquals(resultado[0].metaTimestamp, 1717000000);
  assertEquals(resultado[0].seq, 0);
});

Deno.test("normalizarEnvelope: correlaciona contacts[] por wa_id, NÃO por índice, mesmo fora de ordem", () => {
  const payload = envelopeComMensagens(
    [
      { id: "wamid.M1", from: "5511111111111", timestamp: "1", type: "text", text: { body: "a" } },
      { id: "wamid.M2", from: "5522222222222", timestamp: "2", type: "text", text: { body: "b" } },
    ],
    [
      // Ordem PROPOSITALMENTE trocada em relação a messages[] — se a
      // correlação fosse por índice, M1 receberia o nome de "Segunda" e
      // M2 receberia "Primeira".
      { wa_id: "5522222222222", profile: { name: "Segunda" } },
      { wa_id: "5511111111111", profile: { name: "Primeira" } },
    ],
  );

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 2);
  const m1 = resultado.find((m) => m.wamid === "wamid.M1");
  const m2 = resultado.find((m) => m.wamid === "wamid.M2");
  assertEquals(m1?.nomePerfil, "Primeira");
  assertEquals(m2?.nomePerfil, "Segunda");
});

Deno.test("normalizarEnvelope: sem contato correspondente, nomePerfil vem null (não quebra)", () => {
  const payload = envelopeComMensagens(
    [{ id: "wamid.X", from: "5511000000000", timestamp: "1", type: "text", text: { body: "oi" } }],
    [],
  );
  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 1);
  assertEquals(resultado[0].nomePerfil, null);
});

Deno.test("normalizarEnvelope: batch com múltiplos entry[]/changes[], seq incrementa através de todos", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1000", display_phone_number: "5511999990000" },
              contacts: [{ wa_id: "5511111111111" }],
              messages: [{ id: "wamid.A", from: "5511111111111", timestamp: "1", type: "text", text: { body: "a" } }],
            },
          },
        ],
      },
      {
        id: "entry-2",
        changes: [
          {
            value: {
              metadata: { phone_number_id: "2000", display_phone_number: "5511888880000" },
              contacts: [{ wa_id: "5522222222222" }],
              messages: [{ id: "wamid.B", from: "5522222222222", timestamp: "2", type: "text", text: { body: "b" } }],
            },
          },
        ],
      },
    ],
  };

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 2);
  assertEquals(resultado[0].wamid, "wamid.A");
  assertEquals(resultado[0].seq, 0);
  assertEquals(resultado[0].phoneNumberId, "1000");
  assertEquals(resultado[1].wamid, "wamid.B");
  assertEquals(resultado[1].seq, 1);
  assertEquals(resultado[1].phoneNumberId, "2000");
});

Deno.test("normalizarEnvelope: tipos audio/image/document extraem mediaId, sem conteudoTexto", () => {
  const payload = envelopeComMensagens(
    [
      { id: "wamid.AU", from: "5511000000000", timestamp: "1", type: "audio", audio: { id: "media-audio-1", mime_type: "audio/ogg" } },
      { id: "wamid.IM", from: "5511000000000", timestamp: "2", type: "image", image: { id: "media-image-1", mime_type: "image/jpeg" } },
      { id: "wamid.DO", from: "5511000000000", timestamp: "3", type: "document", document: { id: "media-doc-1", filename: "nota.pdf" } },
    ],
    [{ wa_id: "5511000000000" }],
  );

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 3);
  assertEquals(resultado[0].mediaId, "media-audio-1");
  assertEquals(resultado[0].conteudoTexto, undefined);
  assertEquals(resultado[1].mediaId, "media-image-1");
  assertEquals(resultado[2].mediaId, "media-doc-1");
});

Deno.test("normalizarEnvelope: tipos fora da allowlist (interactive/reaction/sticker) são descartados", () => {
  const payload = envelopeComMensagens(
    [
      { id: "wamid.INT", from: "5511000000000", timestamp: "1", type: "interactive", interactive: {} },
      { id: "wamid.REA", from: "5511000000000", timestamp: "2", type: "reaction", reaction: {} },
      { id: "wamid.STK", from: "5511000000000", timestamp: "3", type: "sticker", sticker: {} },
      { id: "wamid.OK", from: "5511000000000", timestamp: "4", type: "text", text: { body: "sobrevive" } },
    ],
    [{ wa_id: "5511000000000" }],
  );

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 1);
  assertEquals(resultado[0].wamid, "wamid.OK");
});

Deno.test("normalizarEnvelope: mensagem sem id (wamid) é descartada, resto do lote sobrevive", () => {
  const payload = envelopeComMensagens(
    [
      { from: "5511000000000", timestamp: "1", type: "text", text: { body: "sem id" } },
      { id: "wamid.OK", from: "5511000000000", timestamp: "2", type: "text", text: { body: "com id" } },
    ],
    [{ wa_id: "5511000000000" }],
  );

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 1);
  assertEquals(resultado[0].wamid, "wamid.OK");
});

Deno.test("normalizarEnvelope: mensagem sem from (telefone) é descartada, resto do lote sobrevive", () => {
  const payload = envelopeComMensagens(
    [
      { id: "wamid.SEMFROM", timestamp: "1", type: "text", text: { body: "sem from" } },
      { id: "wamid.OK", from: "5511000000000", timestamp: "2", type: "text", text: { body: "com from" } },
    ],
    [{ wa_id: "5511000000000" }],
  );

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 1);
  assertEquals(resultado[0].wamid, "wamid.OK");
});

Deno.test("normalizarEnvelope: metadata sem phone_number_id descarta todas as mensagens daquele change", () => {
  const payload = envelopeComMensagens(
    [{ id: "wamid.SEMPNID", from: "5511000000000", timestamp: "1", type: "text", text: { body: "oi" } }],
    [{ wa_id: "5511000000000" }],
    { display_phone_number: "5511999990000" },
  );

  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 0);
});

Deno.test("normalizarEnvelope: payload de status (sem messages[], só statuses[]) devolve lista vazia", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1000", display_phone_number: "5511999990000" },
              statuses: [{ id: "wamid.S1", status: "delivered" }],
            },
          },
        ],
      },
    ],
  };
  const resultado = normalizarEnvelope(payload);
  assertEquals(resultado.length, 0);
});

Deno.test("normalizarEnvelope: payload vazio/malformado não lança exceção", () => {
  assertEquals(normalizarEnvelope({}).length, 0);
  assertEquals(normalizarEnvelope(null).length, 0);
  assertEquals(normalizarEnvelope(undefined).length, 0);
  assertEquals(normalizarEnvelope({ entry: "not-an-array" }).length, 0);
});
