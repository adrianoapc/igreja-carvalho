import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Janela de rate-limiting: max 3 códigos a cada 5 minutos por número
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MIN = 5;

// Expiração do OTP
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Gera 6 dígitos com CSPRNG e rejection sampling para distribuição uniforme.
// Rejeita valores acima do maior múltiplo de 1 000 000 que cabe em Uint32,
// eliminando o módulo bias que apareceria sem essa precaução.
function gerarCodigo(): string {
  const LIMIT = 1_000_000;
  const UINT32_MAX = 0xFFFF_FFFF;
  const THRESHOLD = UINT32_MAX - (UINT32_MAX % LIMIT);
  const buf = new Uint32Array(1);
  let v: number;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v > THRESHOLD);
  return String(v % LIMIT).padStart(6, "0");
}

async function hashCodigo(codigo: string): Promise<string> {
  const data = new TextEncoder().encode(codigo);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Alerta via canal independente (Slack-compatible webhook ou qualquer HTTP POST).
// NUNCA use Meta/WhatsApp aqui — se a Meta falhou, este canal também falharia.
async function alertarFalha(contexto: string, detalhe: string): Promise<void> {
  const url = Deno.env.get("ALERT_WEBHOOK_URL");
  if (!url) {
    console.error("[send-otp][alerta] ALERT_WEBHOOK_URL não configurado — falha silenciosa:", contexto, detalhe);
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *send-otp falhou*\n*Contexto:* ${contexto}\n*Detalhe:* ${detalhe}`,
      }),
    });
  } catch (err) {
    console.error("[send-otp][alerta] Falha ao disparar alerta:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { telefone, igreja_id, profile_id } = await req.json();

    if (!telefone || !igreja_id) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: telefone, igreja_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const telefoneLimpo = telefone.replace(/\D/g, "");
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 15) {
      return new Response(
        JSON.stringify({ error: "Número de telefone inválido (use formato internacional sem +)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN");
    if (!whatsappToken) {
      console.error("[send-otp] Secret WHATSAPP_TOKEN não configurado");
      return new Response(
        JSON.stringify({ error: "Configuração de WhatsApp ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const templateName = Deno.env.get("WHATSAPP_OTP_TEMPLATE") ?? "authentication_otp";
    const templateLang = Deno.env.get("WHATSAPP_OTP_TEMPLATE_LANG") ?? "pt_BR";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Resolver phone_number_id da igreja na tabela whatsapp_numeros
    const { data: numero, error: numError } = await supabase
      .from("whatsapp_numeros")
      .select("phone_number_id, display_phone_number")
      .eq("igreja_id", igreja_id)
      .eq("provider", "meta")
      .eq("enabled", true)
      .not("phone_number_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (numError || !numero?.phone_number_id) {
      console.error("[send-otp] phone_number_id não encontrado para igreja", igreja_id, numError);
      return new Response(
        JSON.stringify({ error: "Número WhatsApp não configurado para esta igreja" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phoneNumberId = numero.phone_number_id;

    // 2–4. Gerar código + reservar atomicamente via RPC.
    // A função reservar_otp_whatsapp usa pg_try_advisory_xact_lock para serializar
    // requisições concorrentes do mesmo número, eliminando a race TOCTOU entre
    // o check de rate-limit e a inserção do novo registro.
    const codigo = gerarCodigo();
    const hash = await hashCodigo(codigo);
    const expiraEm = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { data: reserva, error: reservaError } = await supabase.rpc(
      "reservar_otp_whatsapp",
      {
        p_telefone:    telefoneLimpo,
        p_codigo_hash: hash,
        p_expira_em:   expiraEm,
        p_igreja_id:   igreja_id,
        p_profile_id:  profile_id ?? null,
        p_rate_max:    RATE_LIMIT_MAX,
        p_janela_min:  RATE_LIMIT_WINDOW_MIN,
      },
    );

    if (reservaError) {
      console.error("[send-otp] Erro na RPC reservar_otp_whatsapp:", reservaError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (reserva.status === "rate_limited") {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos antes de solicitar um novo código." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (reserva.status === "lock_timeout") {
      // Outro request para o mesmo número está em andamento agora; retornar 429 é seguro
      return new Response(
        JSON.stringify({ error: "Requisição em andamento para este número. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const otpId: string = reserva.otp_id;

    // 5. Enviar via WhatsApp Cloud API
    // Código entra duas vezes: body (parâmetro do texto) e botão copy-code (sub_type url, index 0)
    const waPayload = {
      messaging_product: "whatsapp",
      to: telefoneLimpo,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: codigo }],
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: codigo }],
          },
        ],
      },
    };

    const waRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(waPayload),
      },
    );

    const waBody = await waRes.json().catch(() => ({})) as Record<string, unknown>;

    if (!waRes.ok) {
      // Extrair código de erro da Meta para observabilidade
      const metaError = JSON.stringify(
        (waBody as { error?: unknown })?.error ?? waBody,
      );
      console.error("[send-otp] Meta API error:", waRes.status, metaError);

      // Registrar erro no registro e invalidar o OTP
      await supabase
        .from("otp_verificacao")
        .update({ usado: true, meta_error: metaError })
        .eq("id", otpId);

      // Alerta por canal independente (não pode depender da Meta)
      await alertarFalha(
        `telefone=${telefoneLimpo} igreja=${igreja_id} phone_number_id=${phoneNumberId}`,
        `HTTP ${waRes.status}: ${metaError}`,
      );

      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem WhatsApp" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sucesso — registrar wamid para rastreabilidade
    const wamid = (waBody as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? null;
    console.log("[send-otp] Mensagem enviada wamid:", wamid);

    await supabase
      .from("otp_verificacao")
      .update({ wamid })
      .eq("id", otpId);

    return new Response(
      JSON.stringify({ success: true, message: "Código enviado via WhatsApp" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-otp] Erro não tratado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
