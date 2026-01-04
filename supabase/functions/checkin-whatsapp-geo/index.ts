import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Função para verificar assinatura do webhook
const verifyWebhookSecret = (req: Request): { valid: boolean; error?: string } => {
  const webhookSecret = Deno.env.get('MAKE_WEBHOOK_SECRET');
  
  // SECURITY: Secret MUST be configured - no fallback allowed
  if (!webhookSecret) {
    console.error('❌ MAKE_WEBHOOK_SECRET não configurado - requisição rejeitada por segurança');
    return { valid: false, error: 'Webhook secret not configured on server' };
  }
  
  const requestSecret = req.headers.get('x-webhook-secret');
  
  if (!requestSecret) {
    console.error('❌ Header x-webhook-secret não fornecido');
    return { valid: false, error: 'Missing x-webhook-secret header' };
  }
  
  // Comparação segura de strings (timing-safe comparison)
  if (webhookSecret.length !== requestSecret.length) {
    return { valid: false, error: 'Invalid webhook secret' };
  }
  
  let result = 0;
  for (let i = 0; i < webhookSecret.length; i++) {
    result |= webhookSecret.charCodeAt(i) ^ requestSecret.charCodeAt(i);
  }
  
  if (result !== 0) {
    return { valid: false, error: 'Invalid webhook secret' };
  }
  
  return { valid: true };
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 15; // Max 15 requests per minute per IP

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
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  const rateCheck = checkRateLimit(clientIP);
  
  if (!rateCheck.allowed) {
    console.log(`[checkin-whatsapp-geo] Rate limit exceeded for IP: ${clientIP}`);
    
    // Log rate limit violation (may trigger auto-block)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.rpc('log_rate_limit_violation', { p_ip: clientIP, p_endpoint: 'checkin-whatsapp-geo' });
    } catch (e) {
      console.error('Failed to log rate limit violation:', e);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Muitas requisições. Tente novamente em alguns segundos.' 
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter || 60)
        } 
      }
    );
  }

  try {
    console.log('=== Check-in WhatsApp Geolocalização ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Helper function to log audit events
    const logAudit = async (action: string, success: boolean, errorMessage?: string, metadata?: Record<string, unknown>) => {
      try {
        await supabase.from('audit_public_endpoints').insert({
          endpoint_name: 'checkin-whatsapp-geo',
          action,
          client_ip: clientIP,
          success,
          error_message: errorMessage || null,
          request_metadata: metadata || null,
        });
      } catch (e) {
        console.error('Failed to log audit:', e);
      }
    };

    // Check if IP is blocked
    const { data: isBlocked } = await supabase.rpc('is_ip_blocked', { p_ip: clientIP });
    if (isBlocked) {
      console.log(`[checkin-whatsapp-geo] Blocked IP attempted access: ${clientIP}`);
      await logAudit('blocked_ip_access', false, 'IP is blocked');
      return new Response(
        JSON.stringify({ success: false, message: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verificar autenticação do webhook
    const secretCheck = verifyWebhookSecret(req);
    if (!secretCheck.valid) {
      console.error('❌ Falha na verificação do webhook secret:', secretCheck.error);
      await logAudit('webhook_auth_failed', false, secretCheck.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: secretCheck.error,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Parse request body
    const body = await req.json();
    console.log('Dados recebidos (telefone masked):', `IP: ${clientIP}`);

    const { telefone, latitude, longitude, lat, long } = body;

    // Suporte para diferentes formatos de coordenadas
    const finalLat = latitude ?? lat;
    const finalLong = longitude ?? long;

    // Validação dos campos obrigatórios
    if (!telefone) {
      console.error('Telefone não fornecido');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Campo telefone é obrigatório' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (finalLat === undefined || finalLong === undefined) {
      console.error('Coordenadas não fornecidas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Coordenadas (latitude/longitude) são obrigatórias' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processando check-in para telefone: ${telefone}`);
    console.log(`Coordenadas: lat=${finalLat}, long=${finalLong}`);

    // Chamar a função de check-in por localização
    const { data, error } = await supabase.rpc('checkin_por_localizacao', {
      p_telefone: telefone,
      p_lat: parseFloat(finalLat),
      p_long: parseFloat(finalLong)
    });

    if (error) {
      console.error('Erro ao processar check-in:', error);
      await logAudit('checkin_failed', false, error.message, { telefone_masked: telefone ? `***${telefone.slice(-4)}` : 'N/A' });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Erro ao processar check-in'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Resultado do check-in:', data?.success ? 'success' : 'failed');
    await logAudit('checkin_processed', data?.success || false, data?.success ? undefined : 'Check-in validation failed');

    // Retornar resposta da função
    return new Response(
      JSON.stringify(data),
      { 
        status: data?.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Erro interno do servidor'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
