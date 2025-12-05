import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20; // Max 20 requests per minute per IP

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetTime < now) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip") ||
         req.headers.get("cf-connecting-ip") ||
         "unknown";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  const rateCheck = checkRateLimit(clientIP);
  
  if (!rateCheck.allowed) {
    console.log(`[checkin-evento] Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ success: false, message: "Muitas requisições. Tente novamente em alguns segundos." }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfter || 60)
        } 
      }
    );
  }

  try {
    const { tipo, evento_id, contato } = await req.json();

    console.log(`[checkin-evento] Tipo: ${tipo}, Evento: ${evento_id}, Contato: ${contato}, IP: ${clientIP}`);

    if (!tipo || !evento_id || !contato) {
      return new Response(
        JSON.stringify({ success: false, message: "Dados incompletos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Limpar contato (remover formatação)
    const contatoLimpo = contato.replace(/[^\d@a-zA-Z.]/g, "");
    const isEmail = contato.includes("@");

    console.log(`[checkin-evento] Buscando pessoa por ${isEmail ? "email" : "telefone"}: ${contatoLimpo}`);

    // Buscar pessoa por email ou telefone
    let pessoa = null;
    
    if (isEmail) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, telefone")
        .ilike("email", contato.trim())
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error("[checkin-evento] Erro ao buscar por email:", error);
      }
      pessoa = data;
    } else {
      // Buscar por telefone (comparando apenas números)
      const telefoneNumeros = contato.replace(/\D/g, "");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, telefone");
      
      if (error) {
        console.error("[checkin-evento] Erro ao buscar profiles:", error);
      } else if (data) {
        // Comparar telefones removendo formatação
        pessoa = data.find((p) => {
          const telDb = (p.telefone || "").replace(/\D/g, "");
          return telDb === telefoneNumeros || telDb.endsWith(telefoneNumeros) || telefoneNumeros.endsWith(telDb);
        });
      }
    }

    if (!pessoa) {
      console.log("[checkin-evento] Pessoa não encontrada");
      return new Response(
        JSON.stringify({ success: false, not_found: true, message: "Cadastro não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[checkin-evento] Pessoa encontrada: ${pessoa.nome} (${pessoa.id})`);

    // Registrar presença baseado no tipo
    if (tipo === "culto") {
      // Verificar se já existe presença
      const { data: existente } = await supabase
        .from("presencas_culto")
        .select("id")
        .eq("culto_id", evento_id)
        .eq("pessoa_id", pessoa.id)
        .maybeSingle();

      if (existente) {
        console.log("[checkin-evento] Presença já registrada anteriormente");
        return new Response(
          JSON.stringify({ success: true, nome: pessoa.nome, message: "Presença já registrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Inserir presença
      const { error: insertError } = await supabase
        .from("presencas_culto")
        .insert({
          culto_id: evento_id,
          pessoa_id: pessoa.id,
          metodo: "qrcode",
        });

      if (insertError) {
        console.error("[checkin-evento] Erro ao inserir presença culto:", insertError);
        throw insertError;
      }
      
      console.log("[checkin-evento] Presença no culto registrada com sucesso");

    } else if (tipo === "aula") {
      // Verificar se já existe presença na aula
      const { data: existente } = await supabase
        .from("presencas_aula")
        .select("id")
        .eq("aula_id", evento_id)
        .eq("aluno_id", pessoa.id)
        .maybeSingle();

      if (existente) {
        console.log("[checkin-evento] Presença na aula já registrada");
        return new Response(
          JSON.stringify({ success: true, nome: pessoa.nome, message: "Presença já registrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Inserir presença na aula
      const { error: insertError } = await supabase
        .from("presencas_aula")
        .insert({
          aula_id: evento_id,
          aluno_id: pessoa.id,
          status: "presente",
          checkin_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("[checkin-evento] Erro ao inserir presença aula:", insertError);
        throw insertError;
      }

      console.log("[checkin-evento] Presença na aula registrada com sucesso");
    }

    return new Response(
      JSON.stringify({ success: true, nome: pessoa.nome }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[checkin-evento] Erro:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ success: false, message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
