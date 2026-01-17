import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

interface PixWebhookPayload {
  // Estrutura típica de webhook PIX do Santander
  idNotificacao?: string;
  tipoNotificacao?: string;
  pixId?: string;
  
  // Dados da transação
  valor: number;
  calendario?: {
    criacao: string;
  };
  devedor?: {
    cpf?: string;
    cnpj?: string;
    nome?: string;
  };
  infoAdicionais?: string;
  
  // Timestamp
  horario?: string;
  
  // Pode variar conforme a instituição
  [key: string]: any;
}

interface ProcessedPixWebhook {
  pix_id: string;
  valor: number;
  pagador_cpf_cnpj?: string;
  pagador_nome?: string;
  descricao?: string;
  data_pix: string;
  banco_id?: string;
  igreja_id: string;
  webhook_payload: Record<string, unknown>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-igreja-id',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse do payload
    const payload: PixWebhookPayload = await req.json();
    console.log("[pix-webhook] Recebido payload:", JSON.stringify(payload));

    // Extrair dados do PIX (variar conforme instituição bancária)
    const pixId = payload.pixId || payload.idNotificacao || crypto.randomUUID();
    const valor = payload.valor;
    
    if (!valor || valor <= 0) {
      return new Response(
        JSON.stringify({ error: "Valor inválido ou não informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Header customizado para identificar a igreja (deve ser enviado pelo webhook)
    const igrejaId = req.headers.get("X-Igreja-ID") || null;
    
    if (!igrejaId) {
      return new Response(
        JSON.stringify({ error: "X-Igreja-ID header obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Data/hora do PIX (usar timestamp real do banco)
    const dataPix = payload.calendario?.criacao 
      || payload.horario 
      || new Date().toISOString();

    // Extrai informações do pagador
    const pagadorCpfCnpj = payload.devedor?.cpf || payload.devedor?.cnpj;
    const pagadorNome = payload.devedor?.nome;
    const descricao = payload.infoAdicionais || "PIX Recebido";

    // Banco (pode variar - aqui assumindo Santander como padrão)
    const bancoId = payload.banco_id || "90400888000142"; // Santander CNPJ

    // Montar dados para inserção
    const dadosInserir: ProcessedPixWebhook = {
      pix_id: pixId,
      valor,
      pagador_cpf_cnpj: pagadorCpfCnpj,
      pagador_nome: pagadorNome,
      descricao,
      data_pix: new Date(dataPix).toISOString(),
      banco_id: bancoId,
      igreja_id: igrejaId,
      webhook_payload: payload,
    };

    console.log("[pix-webhook] Insertando:", JSON.stringify(dadosInserir));

    // Inserir na tabela temporária
    const { data, error } = await supabase
      .from("pix_webhook_temp")
      .insert([
        {
          pix_id: dadosInserir.pix_id,
          valor: dadosInserir.valor,
          pagador_cpf_cnpj: dadosInserir.pagador_cpf_cnpj,
          pagador_nome: dadosInserir.pagador_nome,
          descricao: dadosInserir.descricao,
          data_pix: dadosInserir.data_pix,
          banco_id: dadosInserir.banco_id,
          igreja_id: dadosInserir.igreja_id,
          webhook_payload: dadosInserir.webhook_payload,
          status: "recebido",
        },
      ])
      .select();

    if (error) {
      console.error("[pix-webhook] Erro ao inserir:", error);
      return new Response(
        JSON.stringify({
          error: "Falha ao processar webhook",
          detail: error.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[pix-webhook] Sucesso:", JSON.stringify(data));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook PIX recebido e armazenado",
        pixId: dadosInserir.pix_id,
        valor: dadosInserir.valor,
      }),
      {
        status: 200,
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
});
