import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  telefone: string;
  phone_number_id?: string;
  igreja_id?: string;
  filial_id?: string | null;
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
    const { telefone, phone_number_id, igreja_id, filial_id } = body;

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: "Telefone é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!igreja_id) {
      return new Response(
        JSON.stringify({ error: "Igreja ID é obrigatório para escopo multi-tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Consultar Sessão] Telefone: ${telefone}, Igreja: ${igreja_id}, Filial: ${filial_id || "todas"}, Phone Number ID: ${phone_number_id}`);

    // 1. VALIDAÇÃO MULTI-TENANT: Se phone_number_id foi fornecido, verificar que pertence à Igreja correta
    if (phone_number_id) {
      const { data: whatsappNumero, error: whatsappError } = await supabase
        .from("whatsapp_numeros")
        .select("id, igreja_id, filial_id, enabled")
        .eq("phone_number_id", phone_number_id)
        .single();

      if (whatsappError || !whatsappNumero) {
        console.error("[Consultar Sessão] ❌ Phone number ID inválido ou não encontrado:", phone_number_id);
        return new Response(
          JSON.stringify({ error: "Phone number ID inválido para esta Igreja" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!whatsappNumero.enabled) {
        console.error("[Consultar Sessão] ❌ Phone number ID desativado:", phone_number_id);
        return new Response(
          JSON.stringify({ error: "Número WhatsApp desativado" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validar que phone_number_id pertence à Igreja correta
      if (whatsappNumero.igreja_id !== igreja_id) {
        console.error(
          `[Consultar Sessão] ❌ CROSS-CHURCH ATTEMPT: Phone number ${phone_number_id} belongs to Igreja ${whatsappNumero.igreja_id}, but requesting Igreja ${igreja_id}`
        );
        return new Response(
          JSON.stringify({ error: "Acesso negado: número WhatsApp não pertence a esta Igreja" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se filial_id foi fornecido no request, validar que corresponde
      if (filial_id && whatsappNumero.filial_id !== filial_id) {
        console.warn(
          `[Consultar Sessão] ⚠️ Filial mismatch: Phone number ${phone_number_id} belongs to filial ${whatsappNumero.filial_id}, but requesting filial ${filial_id}`
        );
        // Ainda assim retorna erro para ser seguro
        return new Response(
          JSON.stringify({ error: "Número WhatsApp não pertence à filial solicitada" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[Consultar Sessão] ✅ Phone number ID validado para Igreja ${igreja_id} (Filial: ${whatsappNumero.filial_id || "matriz"})`);
    }

    // 2. Buscar ÚLTIMA sessão ativa (mais recente por updated_at)
    // Com escopo multi-tenant: telefone + igreja_id + filial_id + phone_number_id
    let query = supabase
      .from("atendimentos_bot")
      .select("id, telefone, origem_canal, status, meta_dados, updated_at, created_at, igreja_id, filial_id")
      .eq("telefone", telefone)
      .eq("igreja_id", igreja_id)
      .neq("status", "CONCLUIDO")
      .order("updated_at", { ascending: false });

    // Se phone_number_id foi fornecido, filtrar também por ele
    if (phone_number_id) {
      query = query.contains("meta_dados", { phone_number_id });
      console.log(`[Consultar Sessão] Filtrando por phone_number_id: ${phone_number_id}`);
    }

    // Se filial_id foi fornecido, filtrar por filial específica
    if (filial_id) {
      query = query.eq("filial_id", filial_id);
      console.log(`[Consultar Sessão] Filtrando por filial_id: ${filial_id}`);
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
          // Campo auxiliar para Make decidir se cria nova ou continua
          pode_continuar: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Se NÃO encontrou sessão ativa
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
