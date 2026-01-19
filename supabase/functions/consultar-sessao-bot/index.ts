import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  telefone: string;
  whatsapp_number?: string;
  display_phone_number?: string;
  phone_number_id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = (await req.json()) as RequestBody;
    const { telefone, phone_number_id } = body;

    // Extrair whatsapp_number (padrão das outras functions de bot)
    const whatsappNumber = body.whatsapp_number ?? body.display_phone_number ?? null;
    
    // Normalizar número WhatsApp (remover formatação)
    const normalizeDisplayPhone = (tel?: string | null) => (tel || "").replace(/\D/g, "");
    const whatsappNumeroNormalizado = normalizeDisplayPhone(whatsappNumber);

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: "Telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!whatsappNumeroNormalizado && !phone_number_id) {
      return new Response(
        JSON.stringify({ error: "whatsapp_number ou phone_number_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Consultar Sessão] Telefone: ${telefone}, WhatsApp Number: ${whatsappNumeroNormalizado}, Phone Number ID: ${phone_number_id}`);

    // 1. VALIDAÇÃO MULTI-TENANT: Consultar igreja_id/filial_id a partir do whatsapp_number ou phone_number_id
    let whatsappNumero = null;
    
    // Priorizar busca por display_phone_number (padrão das outras functions)
    if (whatsappNumeroNormalizado) {
      console.log(`[Consultar Sessão] Buscando igreja pelo display_phone_number: ${whatsappNumeroNormalizado}`);
      
      const { data: rota, error: rotaError } = await supabase
        .from("whatsapp_numeros")
        .select("id, igreja_id, filial_id, enabled, phone_number_id")
        .eq("display_phone_number", whatsappNumeroNormalizado)
        .eq("enabled", true)
        .maybeSingle();
      
      if (rotaError) {
        console.error(`[Consultar Sessão] Erro ao buscar whatsapp_numeros:`, rotaError);
      }
      
      if (rota) {
        whatsappNumero = rota;
      }
    }
    
    // Fallback: buscar por phone_number_id se não encontrou pelo display_phone_number
    if (!whatsappNumero && phone_number_id) {
      console.log(`[Consultar Sessão] Buscando igreja pelo phone_number_id: ${phone_number_id}`);
      
      const { data: rota, error: rotaError } = await supabase
        .from("whatsapp_numeros")
        .select("id, igreja_id, filial_id, enabled, phone_number_id")
        .eq("phone_number_id", phone_number_id)
        .eq("enabled", true)
        .maybeSingle();
      
      if (rotaError) {
        console.error(`[Consultar Sessão] Erro ao buscar whatsapp_numeros por phone_number_id:`, rotaError);
      }
      
      if (rota) {
        whatsappNumero = rota;
      }
    }

    if (!whatsappNumero) {
      console.error("[Consultar Sessão] ❌ Número WhatsApp não encontrado ou desativado");
      return new Response(
        JSON.stringify({ error: "Número WhatsApp inválido ou desativado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const igreja_id = whatsappNumero.igreja_id;
    const filial_id = whatsappNumero.filial_id;
    const resolvedPhoneNumberId = whatsappNumero.phone_number_id;

    console.log(`[Consultar Sessão] ✅ WhatsApp validado para Igreja ${igreja_id} (Filial: ${filial_id || "matriz"})`);

    // 2. Buscar ÚLTIMA sessão ativa (mais recente por updated_at)
    let query = supabase
      .from("atendimentos_bot")
      .select("id, telefone, origem_canal, status, meta_dados, updated_at, created_at, igreja_id, filial_id")
      .eq("telefone", telefone)
      .eq("igreja_id", igreja_id)
      .neq("status", "CONCLUIDO")
      .order("updated_at", { ascending: false });

    // Filtrar por phone_number_id nos meta_dados
    if (resolvedPhoneNumberId) {
      query = query.contains("meta_dados", { phone_number_id: resolvedPhoneNumberId });
      console.log(`[Consultar Sessão] Filtrando por phone_number_id: ${resolvedPhoneNumberId}`);
    }

    const { data: sessoes, error } = await query.limit(1);

    if (error) {
      console.error("[Consultar Sessão] Erro ao buscar sessões:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar sessão", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Se encontrou sessão ativa
    if (sessoes && sessoes.length > 0) {
      const sessao = sessoes[0];
      console.log(`[Consultar Sessão] ✅ Sessão encontrada: ${sessao.id} (${sessao.origem_canal})`);

      return new Response(
        JSON.stringify({
          encontrada: true,
          sessao_id: sessao.id,
          telefone: sessao.telefone,
          origem_canal: sessao.origem_canal,
          status: sessao.status,
          meta_dados: sessao.meta_dados,
          updated_at: sessao.updated_at,
          created_at: sessao.created_at,
          igreja_id: igreja_id,
          filial_id: filial_id,
          pode_continuar: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Se NÃO encontrou sessão ativa
    console.log(`[Consultar Sessão] ℹ️ Nenhuma sessão ativa para ${telefone}`);

    return new Response(
      JSON.stringify({
        encontrada: false,
        sessao_id: null,
        telefone: telefone,
        origem_canal: null,
        status: null,
        meta_dados: null,
        updated_at: null,
        created_at: null,
        igreja_id: igreja_id,
        filial_id: filial_id,
        pode_continuar: false
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Consultar Sessão] Erro crítico:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
