import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import QRCode from "npm:qrcode@1.5.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://appcarvalho.lovable.app";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Token não informado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[QRCode] Gerando QR Code para token: ${token}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar inscrição para validar token
    const { data: inscricao, error } = await supabase
      .from("inscricoes_eventos")
      .select(`
        id,
        status_pagamento,
        pessoa:profiles!inscricoes_eventos_pessoa_id_fkey(nome),
        evento:eventos!inscricoes_eventos_evento_id_fkey(titulo, data_evento)
      `)
      .eq("qr_token", token)
      .maybeSingle();

    if (error) {
      console.error("[QRCode] Erro ao buscar inscrição:", error);
      return new Response(JSON.stringify({ error: "Erro ao buscar inscrição" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!inscricao) {
      console.warn(`[QRCode] Token não encontrado: ${token}`);
      return new Response(JSON.stringify({ error: "Inscrição não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar URL da página pública (onde operador pode fazer check-in)
    const checkinUrl = `${APP_URL}/inscricao/${token}`;

    console.log(`[QRCode] Gerando imagem para URL: ${checkinUrl}`);

    // Gerar QR Code como buffer PNG
    const qrBuffer = await QRCode.toBuffer(checkinUrl, {
      type: "png",
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });

    console.log(`[QRCode] Imagem gerada com sucesso, tamanho: ${qrBuffer.length} bytes`);

    // Retornar imagem PNG
    return new Response(qrBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400", // Cache por 24h
        "Content-Disposition": `inline; filename="qrcode-${token.slice(0, 8)}.png"`,
      },
    });
  } catch (err) {
    console.error("[QRCode] Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
