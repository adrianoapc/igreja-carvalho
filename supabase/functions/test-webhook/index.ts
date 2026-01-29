import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webhook_url, payload } = await req.json();

    if (!webhook_url) {
      return new Response(
        JSON.stringify({ success: false, error: "webhook_url é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-webhook] Enviando para: ${webhook_url}`);
    console.log(`[test-webhook] Payload:`, JSON.stringify(payload));

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {
        teste: true,
        timestamp: new Date().toISOString(),
        mensagem: "Teste de conexão Lovable"
      })
    });

    const responseText = await response.text();
    console.log(`[test-webhook] Resposta: ${response.status} - ${responseText}`);

    return new Response(
      JSON.stringify({
        success: response.ok,
        status: response.status,
        response: responseText,
        webhook_url,
        payload_enviado: payload
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-webhook] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
