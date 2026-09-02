/**
 * Idempotência de ENTRADA por wamid, compartilhada por chatbot-triagem/
 * chatbot-financeiro (ADR-033 PR2a-1) — ver
 * supabase/migrations/20260901000000_chatbot_wamid_claim_entrada.sql.
 *
 * Aditivo/dark: só ativa quando `body.wamid` vem preenchido. Sem ele
 * (nenhum caller manda hoje), `processFn()` roda direto, comportamento
 * idêntico a antes desta PR existir.
 *
 * Extraído pra um módulo só (achado real de /code-review local): os 2
 * chatbots tinham essa lógica quase idêntica copiada, incluindo a
 * extração de telefone que alimenta o vínculo de segurança
 * (telefone_match) — 2 cópias divergindo silenciosamente enfraqueceria
 * essa proteção sem nenhum teste acusando.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface WamidClaimRow {
  owned: boolean;
  status: "processing" | "completed";
  telefone_match: boolean;
  response_payload: unknown;
  response_status: number | null;
}

const CLAIM_LEASE_SECONDS = 150;

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Envolve `processFn` com o claim de idempotência por wamid. Se
 * `body.wamid` estiver ausente, chama `processFn()` direto. Presente:
 * reclama um claim (registro próprio deste chatbot, separado do
 * dedup/lease do orquestrador em whatsapp_wamid_dedup — que ainda não
 * tem nenhum caller, ver PR1) e só chama `processFn()` se conseguir a
 * posse; caso contrário devolve a resposta cacheada (só se o telefone
 * bater, ver claim_whatsapp_chatbot_wamid) ou 409.
 *
 * Falha no processamento (exceção OU resposta HTTP >= 400) libera o
 * claim imediatamente em vez de cachear — nem sucesso pra guardar, nem
 * "ainda processando" de verdade; sem isso um redelivery legítimo
 * levaria 409 até o lease de 150s vencer (achado real de /code-review
 * local, 2 ângulos independentes).
 */
export async function withWamidClaim(
  supabase: SupabaseClientAny,
  chatbot: "triagem" | "financeiro",
  // deno-lint-ignore no-explicit-any
  body: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  telefone: string | null,
  corsHeaders: Record<string, string>,
  processFn: () => Promise<Response>,
): Promise<Response> {
  // Usa o valor JÁ TRIMADO, não o cru (achado real de /code-review
  // local): checar truthiness do trim mas guardar/comparar o original
  // deixaria 2 entregas do mesmo wamid com espaço incidental diferente
  // (ex.: "abc" vs "abc ") virarem chaves diferentes, furando o dedup.
  const wamidTrimmed =
    typeof body?.wamid === "string" ? body.wamid.trim() : "";
  const wamid = wamidTrimmed ? wamidTrimmed : null;
  if (!wamid) {
    return await processFn();
  }

  const ownerToken = crypto.randomUUID();
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "claim_whatsapp_chatbot_wamid",
    {
      p_wamid: wamid,
      p_chatbot: chatbot,
      p_owner_token: ownerToken,
      p_telefone: telefone,
      p_lease_seconds: CLAIM_LEASE_SECONDS,
    },
  );

  if (claimError) {
    // Claim é defesa em profundidade, não a única proteção existente —
    // falha nele não deve impedir o processamento de uma mensagem real.
    console.error(
      `[${chatbot}] Falha no claim de idempotência, processando sem proteção:`,
      claimError.message,
    );
    return await processFn();
  }

  const claim = claimRows?.[0] as WamidClaimRow | undefined;
  if (!claim?.owned) {
    if (claim?.status === "completed" && claim.telefone_match) {
      return jsonResponse(
        claim.response_payload ?? {},
        claim.response_status ?? 200,
        corsHeaders,
      );
    }
    if (claim?.status === "completed" && !claim.telefone_match) {
      // wamid já processado, mas pra OUTRO telefone — a RPC já suprime
      // response_payload nesse caso; nunca reprocessar aqui (mudaria o
      // dono do wamid) nem devolver 200 (esconderia a anomalia).
      console.error(
        `[${chatbot}] wamid ${wamid} já completed com telefone diferente do desta requisição — possível replay/colisão`,
      );
    }
    // processing com lease ainda válida noutra invocação: não
    // reprocessa, não devolve 200 (deixa o caller/Meta reentregar).
    return jsonResponse(
      { error: "Processamento em andamento para este wamid" },
      409,
      corsHeaders,
    );
  }

  let response: Response;
  try {
    response = await processFn();
  } catch (err) {
    const { error: releaseError } = await supabase.rpc(
      "release_whatsapp_chatbot_wamid",
      { p_wamid: wamid, p_chatbot: chatbot, p_owner_token: ownerToken },
    );
    if (releaseError) {
      console.error(
        `[${chatbot}] Falha ao liberar claim após erro de processamento:`,
        releaseError.message,
      );
    }
    throw err;
  }

  if (response.status >= 400) {
    // Erro HTTP não é sucesso — não cacheia como completed (ficaria
    // servindo o mesmo erro até a janela de cache vencer); libera o
    // lease pra um redelivery real poder tentar de novo, já.
    const { error: releaseError } = await supabase.rpc(
      "release_whatsapp_chatbot_wamid",
      { p_wamid: wamid, p_chatbot: chatbot, p_owner_token: ownerToken },
    );
    if (releaseError) {
      console.error(
        `[${chatbot}] Falha ao liberar claim após resposta de erro:`,
        releaseError.message,
      );
    }
    return response;
  }

  try {
    const responseBodyJson = JSON.parse(await response.clone().text());
    const { error: completeError } = await supabase.rpc(
      "complete_whatsapp_chatbot_wamid",
      {
        p_wamid: wamid,
        p_chatbot: chatbot,
        p_owner_token: ownerToken,
        p_response_payload: responseBodyJson,
        p_response_status: response.status,
      },
    );
    if (completeError) {
      console.error(
        `[${chatbot}] Falha ao marcar claim de idempotência como completed:`,
        completeError.message,
      );
    }
  } catch (parseErr) {
    // Resposta não-JSON não deveria acontecer (todo retorno destes
    // handlers usa JSON.stringify) — se acontecer, não cacheia; um
    // replay do mesmo wamid reprocessa depois que o lease expirar.
    console.error(
      `[${chatbot}] Resposta não-JSON, claim de idempotência não marcado completed:`,
      parseErr,
    );
  }

  return response;
}
