import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ingerirExtratoPix, resolverDataHoraPixUtc } from "../_shared/financeiro-core.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// Estrutura real do webhook PIX do Santander (padrão BACEN)
interface PixItemSantander {
  endToEndId: string;
  txid?: string;
  chave?: string;          // Chave PIX (CNPJ da igreja) — nem sempre presente no payload real
  valor: string;           // String no formato "150.00"
  horario: string;
  infoPagador?: string;
  pagador?: {
    cpf?: string;
    cnpj?: string;
    nome?: string;
  };
  devolucoes?: Array<{
    id: string;
    rtrId: string;
    valor: string;
    horario: { solicitacao: string };
    status: string;
  }>;
}

interface PixWebhookPayload {
  pix: PixItemSantander[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Remove formatação do CNPJ (pontos, barras, hífens)
function limparCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

// Busca igreja pelo CNPJ da chave PIX
async function buscarIgrejaPorCnpj(chave: string): Promise<string | null> {
  const cnpjLimpo = limparCnpj(chave);
  
  console.log(`[pix-webhook] Buscando igreja por CNPJ: ${cnpjLimpo}`);
  
  // Buscar pelo CNPJ limpo (sem formatação)
  const { data, error } = await supabase
    .from('igrejas')
    .select('id')
    .eq('cnpj', cnpjLimpo)
    .maybeSingle();
  
  if (error) {
    console.error(`[pix-webhook] Erro ao buscar igreja:`, error);
    return null;
  }
  
  if (data) {
    console.log(`[pix-webhook] Igreja encontrada: ${data.id}`);
    return data.id;
  }
  
  // Tentar busca com CNPJ formatado (XX.XXX.XXX/XXXX-XX)
  const cnpjFormatado = cnpjLimpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
  
  const { data: dataFormatado, error: errorFormatado } = await supabase
    .from('igrejas')
    .select('id')
    .eq('cnpj', cnpjFormatado)
    .maybeSingle();
  
  if (errorFormatado) {
    console.error(`[pix-webhook] Erro ao buscar igreja (formatado):`, errorFormatado);
    return null;
  }
  
  if (dataFormatado) {
    console.log(`[pix-webhook] Igreja encontrada (CNPJ formatado): ${dataFormatado.id}`);
    return dataFormatado.id;
  }
  
  console.warn(`[pix-webhook] Igreja não encontrada para CNPJ: ${chave}`);
  return null;
}

// Último fallback: quando o payload não tem `chave` nem um `txid` vinculado
// a uma cobrança nossa (ex.: chave PIX estática cadastrada direto no portal
// do banco, sem passar por `criar-cobranca-pix`) — achado real em produção,
// 2026-08-15. Cada chave PIX só pode estar associada a UMA URL de webhook
// (regra do próprio Santander), então, HOJE, com uma única integração PIX
// ativa, a URL só pode estar recebendo notificação dela. Se um dia existir
// mais de uma integração Santander (multi-tenant real), isso vira ambíguo
// de propósito — melhor não resolver do que resolver errado.
async function buscarIgrejaIntegracaoSantanderUnica(): Promise<string | null> {
  const { data, error } = await supabase
    .from('integracoes_financeiras')
    .select('igreja_id')
    .eq('provedor', 'santander');

  if (error) {
    console.error('[pix-webhook] Erro ao buscar integração Santander única:', error);
    return null;
  }

  if (data && data.length === 1) {
    return data[0].igreja_id;
  }

  if (data && data.length > 1) {
    console.warn(
      `[pix-webhook] ${data.length} integrações Santander ativas — não dá pra resolver igreja sem chave/txid, ficando null.`
    );
  }

  return null;
}

// Loga TODA requisição recebida (payload cru + resposta devolvida) em
// edge_function_logs — o Santander não expõe um painel de tentativas de
// entrega de webhook no portal do desenvolvedor, então esse é o único jeito
// de confirmar se eles estão de fato chamando esta URL. Sem isso, uma
// notificação que nunca chega é indistinguível (do nosso lado) de uma que
// chega e falha silenciosamente — achado real em 2026-08-14, depois do
// fix do gate de secret (§9.113): mesmo sem 401 nenhum mais, nada apareceu
// em tempo real, sem log nenhum pra confirmar se a causa é "Santander não
// chamou" ou "chamou e algo deu errado antes do log de sucesso".
async function logRequisicao(
  startTime: number,
  method: string,
  requestPayload: unknown,
  response: Response
): Promise<void> {
  try {
    const responseText = await response.clone().text();
    let responsePayload: unknown = responseText;
    try {
      responsePayload = JSON.parse(responseText);
    } catch {
      // corpo não-JSON (ex.: 405 texto puro) — loga como string mesmo
    }

    await supabase.rpc("log_edge_function_with_metrics", {
      p_function_name: "pix-webhook",
      p_status: response.ok ? "success" : "error",
      p_execution_time_ms: Date.now() - startTime,
      p_error_message: response.ok ? null : `HTTP ${response.status}`,
      p_request_payload: { method, body: requestPayload },
      p_response_payload: responsePayload,
    });
  } catch (logErr) {
    console.error("[pix-webhook] Falha ao gravar log da requisição:", logErr);
  }
}

serve(async (req) => {
  const startTime = Date.now();
  const method = req.method;

  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check GET - Requisito Santander
  if (method === 'GET') {
    console.log('[pix-webhook] Health check GET recebido');
    const response = new Response(
      JSON.stringify({ status: 'ok', message: 'Webhook PIX ativo' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    await logRequisicao(startTime, method, null, response);
    return response;
  }

  // Lê o corpo cru ANTES de qualquer parse — garante que o payload fica
  // disponível pro log mesmo se o JSON.parse falhar adiante.
  const rawBody = method === "POST" ? await req.text().catch(() => null) : null;

  const igrejaIdDaUrl = new URL(req.url).searchParams.get("igreja_id");
  const response = await processarRequisicao(method, rawBody, igrejaIdDaUrl);
  await logRequisicao(startTime, method, rawBody ? tryParseJson(rawBody) : null, response);
  return response;
});

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function processarRequisicao(
  method: string,
  rawBody: string | null,
  igrejaIdDaUrl: string | null
): Promise<Response> {
  try {
    // Validar método POST para notificações PIX
    if (method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido. Use GET ou POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEM auth por header: o Santander/BACEN não suporta enviar um shared
    // secret customizado nas notificações PIX (confirmado na documentação
    // oficial do webhook — "é necessário que a URL aceite qualquer chamada,
    // ignore os headers que encaminhamos"; já era a decisão original do
    // ADR-024). Um gate de X-Webhook-Secret aqui rejeitaria 100% das
    // notificações reais com 401 — achado real em 2026-08-14, nunca
    // detectado porque o polling (buscar-pix-cron/buscar-pix-recebidos)
    // sempre cobriu a ingestão na prática. Segurança fica por validação de
    // estrutura do payload (abaixo) + idempotência por `pix_id` (UNIQUE) no
    // banco — mitigação já documentada no ADR-024.

    // Parse do payload
    const payload: PixWebhookPayload = JSON.parse(rawBody ?? "{}");
    console.log("[pix-webhook] Recebido payload:", JSON.stringify(payload));



    // Validar estrutura do payload
    if (!payload.pix || !Array.isArray(payload.pix) || payload.pix.length === 0) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: array 'pix' obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit array size to prevent abuse
    if (payload.pix.length > 100) {
      return new Response(
        JSON.stringify({ error: "Payload excede limite de 100 itens" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: Array<{ pixId: string; valor: number; status: string }> = [];
    const erros: Array<{ pixId: string; erro: string }> = [];

    // Processar cada PIX do array
    for (const pixItem of payload.pix) {
      try {
        const pixId = pixItem.endToEndId;
        const valor = parseFloat(pixItem.valor);
        
        if (!pixId || typeof pixId !== 'string' || pixId.length > 100) {
          erros.push({ pixId: 'unknown', erro: 'endToEndId ausente ou inválido' });
          continue;
        }

        // Validate endToEndId format (BACEN E2E format: E + 8 digits ISPB + date + id)
        if (!/^E\d{8,}/.test(pixId) && !/^[A-Za-z0-9]{20,50}$/.test(pixId)) {
          erros.push({ pixId, erro: 'Formato de endToEndId inválido' });
          continue;
        }
        
        if (isNaN(valor) || valor <= 0 || valor > 999999999) {
          erros.push({ pixId, erro: 'Valor inválido' });
          continue;
        }

        // Validate horario
        if (!pixItem.horario || isNaN(Date.parse(pixItem.horario))) {
          erros.push({ pixId, erro: 'Horário ausente ou inválido' });
          continue;
        }

        // Prioriza o endToEndId (padrão BACEN, sempre UTC) sobre `horario` —
        // achado real: `horario` do canal de consulta do Santander vem com
        // os números do horário de Brasília rotulados como UTC, 3h atrasado
        // do instante real (ver resolverDataHoraPixUtc).
        const dataPixUtc = resolverDataHoraPixUtc(pixId, pixItem.horario);

        // Tentar vincular com cobrança (se txid presente) — feito ANTES de
        // resolver igreja: cob_pix.igreja_id (gravado na criação da
        // cobrança) é uma fonte mais confiável que a chave PIX do payload.
        // Achado real em produção (2026-08-15, log de edge_function_logs):
        // a notificação real do Santander pro webhook NÃO manda o campo
        // `chave` (só endToEndId/txid/valor/horario) — um `chave` obrigatório
        // rejeitava 100% das notificações reais com cobrança vinculada.
        let cobPixId: string | null = null;
        let cobPixContaId: string | null = null;
        let igrejaIdDaCobranca: string | null = null;
        if (pixItem.txid) {
          const { data: cobranca } = await supabase
            .from('cob_pix')
            .select('id, sessao_item_id, conta_id, igreja_id')
            .eq('txid', pixItem.txid)
            .maybeSingle();

          if (cobranca) {
            cobPixId = cobranca.id;
            cobPixContaId = cobranca.conta_id ?? null;
            igrejaIdDaCobranca = cobranca.igreja_id ?? null;
            console.log(`[pix-webhook] PIX ${pixId} vinculado à cobrança ${pixItem.txid}`);

            // Atualizar status da cobrança para CONCLUIDA
            await supabase
              .from('cob_pix')
              .update({
                status: 'CONCLUIDA',
                data_conclusao: dataPixUtc,
              })
              .eq('id', cobPixId);
          }
        }

        // Ordem de resolução: (1) igreja_id no query string da própria URL
        // do webhook — cada chave PIX só pode estar associada a UMA URL no
        // Santander (doc oficial do banco), então a URL registrada já é,
        // na prática, a chave de roteamento por igreja; nós escolhemos essa
        // URL ao registrar (`?igreja_id=...`), então é a fonte MAIS
        // confiável, sem depender de nada no payload. (2) igreja da
        // cobrança vinculada por txid. (3) CNPJ da chave PIX, quando
        // presente. (4) única integração Santander ativa, se só existir
        // uma — fallbacks pra quando a URL ainda não foi re-registrada com
        // o parâmetro (ou pra uma chave PIX estática sem cobrança nossa).
        const igrejaId =
          igrejaIdDaUrl ??
          igrejaIdDaCobranca ??
          (pixItem.chave ? await buscarIgrejaPorCnpj(pixItem.chave) : null) ??
          (await buscarIgrejaIntegracaoSantanderUnica());

        if (!igrejaId) {
          console.warn(`[pix-webhook] PIX ${pixId} sem igreja vinculada (txid: ${pixItem.txid ?? "—"}, chave: ${pixItem.chave ?? "—"})`);
          // Continua processando mas registra sem igreja_id
        }

        // Montar dados para inserção
        const dadosInserir = {
          pix_id: pixId,
          txid: pixItem.txid || null,
          cob_pix_id: cobPixId,
          valor: valor,
          pagador_cpf_cnpj: pixItem.pagador?.cpf || pixItem.pagador?.cnpj || null,
          pagador_nome: pixItem.pagador?.nome || null,
          descricao: pixItem.infoPagador || "PIX Recebido",
          data_pix: dataPixUtc,
          banco_id: "90400888000142", // Santander CNPJ
          igreja_id: igrejaId,
          webhook_payload: pixItem,
          status: "recebido",
        };

        console.log(`[pix-webhook] Inserindo PIX ${pixId}:`, JSON.stringify(dadosInserir));

        // Inserir na tabela temporária
        const { error } = await supabase
          .from("pix_webhook_temp")
          .insert([dadosInserir]);

        if (error) {
          console.error(`[pix-webhook] Erro ao inserir PIX ${pixId}:`, error);
          erros.push({ pixId, erro: error.message });
        } else {
          console.log(`[pix-webhook] PIX ${pixId} inserido com sucesso`);
          resultados.push({ pixId, valor, status: 'recebido' });

          // Espelha em extratos_bancarios (F5 fatia 2) — só quando a igreja foi
          // resolvida e a conta puder ser determinada (cob_pix.conta_id da
          // cobrança vinculada, ou a conta Santander ativa da igreja via
          // contas.cnpj_banco). Não bloqueia o registro do PIX se a conta não
          // puder ser resolvida (log apenas).
          if (igrejaId) {
            const pixResult = await ingerirExtratoPix(supabase, {
              igreja_id: igrejaId,
              pix_id: pixId,
              valor,
              data_pix: dadosInserir.data_pix,
              descricao: dadosInserir.descricao,
              conta_id: cobPixContaId,
            });
            if (!pixResult.ingerido) {
              console.log(`[pix-webhook] PIX ${pixId} não espelhado em extratos_bancarios: ${pixResult.motivo}`);
            }
          }
        }
      } catch (itemErr) {
        console.error(`[pix-webhook] Exceção ao processar item:`, itemErr);
        erros.push({ 
          pixId: pixItem.endToEndId || 'unknown', 
          erro: itemErr instanceof Error ? itemErr.message : String(itemErr) 
        });
      }
    }

    // Retornar resultado consolidado
    const resultadoFinal = {
      success: resultados.length > 0,
      message: `${resultados.length} PIX processados, ${erros.length} erros`,
      processados: resultados,
      erros: erros.length > 0 ? erros : undefined,
    };

    console.log("[pix-webhook] Resposta:", JSON.stringify(resultadoFinal));

    return new Response(
      JSON.stringify(resultadoFinal),
      {
        status: erros.length === payload.pix.length ? 400 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[pix-webhook] Exceção:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
