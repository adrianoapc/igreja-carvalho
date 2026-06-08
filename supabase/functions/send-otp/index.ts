import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gera código numérico de 6 dígitos com padding zero
function gerarCodigo(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
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

    if (!telefone) {
      return new Response(JSON.stringify({ error: "Campo obrigatório: telefone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const telefoneLimpo = telefone.replace(/\D/g, "");

    // Número no formato internacional sem '+' (ex: 5511999998888)
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 15) {
      return new Response(JSON.stringify({ error: "Número de telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("PHONE_NUMBER_ID");
    const templateName = Deno.env.get("WHATSAPP_OTP_TEMPLATE") ?? "authentication_otp";
    const templateLang = Deno.env.get("WHATSAPP_OTP_TEMPLATE_LANG") ?? "pt_BR";

    if (!whatsappToken || !phoneNumberId) {
      console.error("[send-otp] Secrets WHATSAPP_TOKEN ou PHONE_NUMBER_ID não configurados");
      return new Response(JSON.stringify({ error: "Configuração de WhatsApp ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Invalidar OTPs anteriores do mesmo telefone ainda ativos
    await supabase
      .from("otp_verificacao")
      .update({ usado: true })
      .eq("telefone", telefoneLimpo)
      .eq("tipo", "whatsapp")
      .eq("usado", false);

    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

    const { error: insertError } = await supabase.from("otp_verificacao").insert({
      telefone: telefoneLimpo,
      codigo,
      tipo: "whatsapp",
      expira_em: expiraEm,
      usado: false,
      tentativas: 0,
      ...(profile_id ? { profile_id } : {}),
      ...(igreja_id ? { igreja_id } : {}),
    });

    if (insertError) {
      console.error("[send-otp] Erro ao inserir OTP:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao gerar código" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payload WhatsApp Cloud API — template de autenticação com copy-code button
    // O código vai em body.parameters[0] e no botão (sub_type: url, index: 0)
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
            // Botão copy-code gerado automaticamente pela Meta para templates Authentication
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

    if (!waRes.ok) {
      const waBody = await waRes.text();
      console.error("[send-otp] Erro WhatsApp API:", waRes.status, waBody);

      // Invalidar o OTP criado pois o envio falhou
      await supabase
        .from("otp_verificacao")
        .update({ usado: true })
        .eq("telefone", telefoneLimpo)
        .eq("codigo", codigo);

      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem WhatsApp", detail: waBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const waData = await waRes.json();
    console.log("[send-otp] Mensagem enviada:", waData?.messages?.[0]?.id);

    return new Response(
      JSON.stringify({ success: true, message: "Código enviado via WhatsApp" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-otp] Erro não tratado:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
