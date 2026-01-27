import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter by IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 20; // Max 20 requests per minute per IP

// Security: Per-contact cooldown to prevent attendance manipulation
const contactCooldownMap = new Map<string, number>();
const CONTACT_COOLDOWN_MS = 300000; // 5 minutes cooldown per contact after successful check-in

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

// Security: Check if this contact has a recent check-in cooldown
function checkContactCooldown(contactKey: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const lastCheckin = contactCooldownMap.get(contactKey);
  
  // Clean up old entries
  if (contactCooldownMap.size > 5000) {
    for (const [key, value] of contactCooldownMap.entries()) {
      if (value + CONTACT_COOLDOWN_MS < now) {
        contactCooldownMap.delete(key);
      }
    }
  }
  
  if (lastCheckin && lastCheckin + CONTACT_COOLDOWN_MS > now) {
    const retryAfter = Math.ceil((lastCheckin + CONTACT_COOLDOWN_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  return { allowed: true };
}

function setContactCooldown(contactKey: string): void {
  contactCooldownMap.set(contactKey, Date.now());
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         req.headers.get("x-real-ip") ||
         req.headers.get("cf-connecting-ip") ||
         "unknown";
}

// deno-lint-ignore no-explicit-any
async function logAudit(
  supabase: any,
  endpoint: string,
  action: string,
  clientIP: string,
  success: boolean,
  errorMessage?: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    await supabase.from('audit_public_endpoints').insert({
      endpoint_name: endpoint,
      action,
      client_ip: clientIP,
      success,
      error_message: errorMessage || null,
      request_metadata: metadata || {}
    })
  } catch (err) {
    console.error('[checkin-evento] Failed to log audit:', err)
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  
  // Initialize Supabase client early for security checks
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Security: Check if IP is blocked
  const { data: isBlocked } = await supabase.rpc('is_ip_blocked', { p_ip: clientIP });
  if (isBlocked) {
    console.log(`[checkin-evento] Blocked IP attempted access: ${clientIP}`);
    return new Response(
      JSON.stringify({ success: false, message: "Acesso temporariamente bloqueado." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limiting check
  const rateCheck = checkRateLimit(clientIP);
  
  if (!rateCheck.allowed) {
    console.log(`[checkin-evento] Rate limit exceeded for IP: ${clientIP}`);
    // Log violation and potentially auto-block
    await supabase.rpc('log_rate_limit_violation', { p_ip: clientIP, p_endpoint: 'checkin-evento' });
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

    // Security: Log all check-in attempts with IP for audit
    console.log(`[checkin-evento] Attempt - Tipo: ${tipo}, Evento: ${evento_id}, Contato: ${contato?.substring(0, 3)}***, IP: ${clientIP}`);

    if (!tipo || !evento_id || !contato) {
      await logAudit(supabase, 'checkin-evento', 'checkin', clientIP, false, 'Dados incompletos');
      return new Response(
        JSON.stringify({ success: false, message: "Dados incompletos" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Security: Per-contact cooldown to prevent manipulation
    const contactKey = `${evento_id}:${contato.toLowerCase().trim()}`;
    const cooldownCheck = checkContactCooldown(contactKey);
    
    if (!cooldownCheck.allowed) {
      console.log(`[checkin-evento] Cooldown active for contact at evento ${evento_id}`);
      await logAudit(supabase, 'checkin-evento', 'checkin', clientIP, false, 'Cooldown active', { evento_id });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Check-in recente detectado. Aguarde alguns minutos antes de tentar novamente." 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(cooldownCheck.retryAfter || 300)
          } 
        }
      );
    }

    // Limpar contato (remover formatação)
    const contatoLimpo = contato.replace(/[^\d@a-zA-Z.]/g, "");
    const isEmail = contato.includes("@");

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
      console.log(`[checkin-evento] Person not found for contact, IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ success: false, not_found: true, message: "Cadastro não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[checkin-evento] Person found: ${pessoa.nome} (${pessoa.id}), IP: ${clientIP}`);

    // Registrar presença baseado no tipo
    if (tipo === "culto") {
      // Verificar se já existe presença consolidada
      const { data: existente } = await supabase
        .from("checkins")
        .select("id")
        .eq("evento_id", evento_id)
        .eq("pessoa_id", pessoa.id)
        .maybeSingle();

      if (existente) {
        console.log(`[checkin-evento] Attendance already registered for person ${pessoa.id}`);
        return new Response(
          JSON.stringify({ success: true, nome: pessoa.nome, message: "Presença já registrada" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Inserir presença consolidada no evento
      const { error: insertError } = await supabase
        .from("checkins")
        .insert({
          evento_id: evento_id,
          pessoa_id: pessoa.id,
          metodo: "qrcode",
          tipo_registro: "qrcode",
        });

      if (insertError) {
        console.error("[checkin-evento] Erro ao inserir presença culto:", insertError);
        throw insertError;
      }
      
      // Security: Set cooldown after successful check-in
      setContactCooldown(contactKey);
      console.log(`[checkin-evento] SUCCESS - Culto attendance for ${pessoa.id}, IP: ${clientIP}`);

    } else if (tipo === "aula") {
      // Verificar se já existe presença na aula
      const { data: existente } = await supabase
        .from("presencas_aula")
        .select("id")
        .eq("aula_id", evento_id)
        .eq("aluno_id", pessoa.id)
        .maybeSingle();

      if (existente) {
        console.log(`[checkin-evento] Attendance already registered for person ${pessoa.id}`);
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

      // Security: Set cooldown after successful check-in
      setContactCooldown(contactKey);
      console.log(`[checkin-evento] SUCCESS - Aula attendance for ${pessoa.id}, IP: ${clientIP}`);
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
