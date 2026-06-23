/**
 * receber-pedido-make
 *
 * Dois caminhos em uma única função:
 *
 * A) SERVIDOR-A-SERVIDOR (WhatsApp / Make)
 *    · Detectado pela presença do header `x-webhook-secret`
 *    · Autenticado por timing-safe compare contra MAKE_WEBHOOK_SECRET
 *    · Não exige Turnstile
 *
 * B) FORMULÁRIO PÚBLICO (site institucional)
 *    · Detectado pela ausência de `x-webhook-secret`
 *    · Pipeline: honeypot → Turnstile → rate-limit → consentimento → gravação
 *
 * Variáveis de ambiente necessárias:
 *   SUPABASE_URL                    — injetado automaticamente pelo Supabase
 *   SUPABASE_SERVICE_ROLE_KEY       — injetado automaticamente pelo Supabase
 *   MAKE_WEBHOOK_SECRET             — segredo compartilhado com Make/n8n
 *   CLOUDFLARE_TURNSTILE_SECRET_KEY — chave secreta do Turnstile (painel Cloudflare)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { z }            from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// ─── Utilitários ──────────────────────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip')                          ??
    req.headers.get('x-real-ip')                                 ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim()     ??
    'unknown'
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function makeServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ─── Rate limiter (Deno KV) ───────────────────────────────────────────────────
// Sem tabela extra: estado persistido no KV nativo do runtime com TTL automático.

const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 60; // segundos

async function checkRateLimit(ip: string): Promise<boolean> {
  const kv  = await Deno.openKv();
  const key = ['rl', 'pedido_site', ip] as const;
  const now = Math.floor(Date.now() / 1_000);

  const entry = await kv.get<{ count: number; windowStart: number }>(key);

  if (!entry.value || now - entry.value.windowStart >= RATE_LIMIT_WINDOW) {
    await kv.set(key, { count: 1, windowStart: now }, { expireIn: RATE_LIMIT_WINDOW * 1_000 });
    return true;
  }

  if (entry.value.count >= RATE_LIMIT_MAX) return false;

  await kv.set(
    key,
    { count: entry.value.count + 1, windowStart: entry.value.windowStart },
    { expireIn: RATE_LIMIT_WINDOW * 1_000 },
  );
  return true;
}

// ─── Turnstile ────────────────────────────────────────────────────────────────

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('[turnstile] CLOUDFLARE_TURNSTILE_SECRET_KEY não configurado');
    return false;
  }

  const res  = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json();

  if (!data.success) console.warn('[turnstile] Falhou:', data['error-codes']);
  return data.success === true;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const schemaWhatsapp = z.object({
  nome:       z.string().trim().min(1).max(255),
  telefone:   z.string().trim().min(1).max(20),
  mensagem:   z.string().trim().min(1).max(5_000),
  tema:       z.string().trim().optional(),
  urgente:    z.boolean().optional(),
  dataPedido: z.string().optional(),
});

const schemaSite = z.object({
  mensagem:           z.string().trim().min(10, 'Descreva um pouco mais o pedido.').max(5_000),
  nome:               z.string().trim().max(255).optional(),
  anonimo:            z.boolean().default(false),
  contato:            z.string().trim().max(200).optional(),
  confidencial:       z.boolean().default(false),
  consentimento:      z.literal(true, {
    errorMap: () => ({ message: 'O consentimento é obrigatório.' }),
  }),
  cf_turnstile_token: z.string().min(1, 'Token de verificação ausente.'),
  website:            z.string().optional(), // honeypot — deve estar vazio
});

// ─── Mapeamento tema → enum tipo_pedido ───────────────────────────────────────

function mapTema(tema?: string): string {
  if (!tema) return 'outro';
  const t = tema.toLowerCase();
  if (t.includes('saúde')         || t.includes('saude'))    return 'saude';
  if (t.includes('família')       || t.includes('familia'))  return 'familia';
  if (t.includes('financeiro')    || t.includes('dinheiro')) return 'financeiro';
  if (t.includes('trabalho')      || t.includes('emprego'))  return 'trabalho';
  if (t.includes('espiritual')    || t.includes('fé'))       return 'espiritual';
  if (t.includes('agradecimento') || t.includes('gratidão')) return 'agradecimento';
  return 'outro';
}

// ─── Entry point ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const requestSecret = req.headers.get('x-webhook-secret');

    if (requestSecret !== null) {
      // ── Caminho A: servidor a servidor (WhatsApp / Make) ────────────
      const webhookSecret = Deno.env.get('MAKE_WEBHOOK_SECRET');
      if (!webhookSecret) {
        console.error('[s2s] MAKE_WEBHOOK_SECRET não configurado');
        return json({ error: 'Serviço indisponível.' }, 503);
      }
      if (!timingSafeEqual(webhookSecret, requestSecret)) {
        console.warn('[s2s] Falha na verificação do segredo');
        return json({ error: 'Não autorizado.' }, 401);
      }
      return await handleWhatsapp(req);
    } else {
      // ── Caminho B: formulário público do site ────────────────────────
      return await handleSite(req);
    }
  } catch (err) {
    console.error('[receber-pedido-make] Erro inesperado:', err);
    return json({ error: 'Erro interno. Tente novamente.' }, 500);
  }
});

// ─── Caminho A ────────────────────────────────────────────────────────────────

async function handleWhatsapp(req: Request): Promise<Response> {
  const body   = await req.json();
  console.log('[s2s] Recebido:', { ...body, mensagem: '[redacted]' });

  const parsed = schemaWhatsapp.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Dados inválidos.', details: parsed.error.errors }, 400);
  }

  const { nome, telefone, mensagem, tema, urgente } = parsed.data;
  const supabase = makeServiceClient();

  // Tenta vincular a uma pessoa existente pelo telefone
  const { data: pessoaId } = await supabase.rpc('buscar_pessoa_por_contato', {
    p_telefone: telefone,
    p_nome:     nome,
  });

  const payload: Record<string, unknown> = {
    pedido:           mensagem,
    tipo:             mapTema(tema),
    status:           'pendente',
    anonimo:          false,
    confidencial:     false,
    origem:           'whatsapp',
    consentimento_em: new Date().toISOString(), // consentiu ao enviar a mensagem
    classificacao:    'PESSOAL',
  };

  if (pessoaId) {
    payload.pessoa_id = pessoaId;
  } else {
    payload.nome_solicitante     = nome;
    payload.telefone_solicitante = telefone;
  }

  if (urgente) {
    payload.observacoes_intercessor = `URGENTE: ${tema ?? 'pedido urgente'}`;
  }

  const { data: pedido, error } = await supabase
    .from('pedidos_oracao')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('[s2s] Erro ao salvar:', error);
    throw error;
  }

  console.log('[s2s] Pedido salvo:', pedido.id);
  return json({
    success:           true,
    pedido_id:         pedido.id,
    pessoa_encontrada: !!pessoaId,
    tipo_identificado: payload.tipo,
  });
}

// ─── Caminho B ────────────────────────────────────────────────────────────────

async function handleSite(req: Request): Promise<Response> {
  const ip   = clientIp(req);
  const body = await req.json();

  // 1. HONEYPOT — campo isca preenchido → bot; 200 falso para não revelar detecção
  if (body.website) {
    console.log(`[honeypot] IP ${ip} descartado silenciosamente`);
    return json({ success: true, message: 'Pedido de oração recebido com amor.' });
  }

  // 2. Schema + consentimento obrigatório (literal true)
  const parsed = schemaSite.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { mensagem, nome, anonimo, contato, confidencial, cf_turnstile_token } = parsed.data;

  // 3. TURNSTILE — verificação remota com Cloudflare
  const turnstileOk = await verifyTurnstile(cf_turnstile_token, ip);
  if (!turnstileOk) {
    return json({ error: 'Verificação anti-bot falhou. Tente novamente.' }, 403);
  }

  // 4. RATE LIMIT — máx. 5 por minuto por IP (Deno KV, TTL automático)
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    console.warn(`[rate-limit] IP ${ip} excedeu o limite`);
    return json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
  }

  // 5. Gravação (service_role bypassa RLS; segurança garantida nas etapas acima)
  const supabase = makeServiceClient();

  const payload: Record<string, unknown> = {
    pedido:           mensagem,
    tipo:             'outro',
    status:           'pendente',
    anonimo:          anonimo,
    confidencial:     confidencial,
    origem:           'site',
    consentimento_em: new Date().toISOString(),
    classificacao:    'PESSOAL',
  };

  // Dados de identidade: só grava se não for anônimo
  if (!anonimo && nome) {
    payload.nome_solicitante = nome;
  }
  if (!anonimo && contato) {
    // Heurística: @ → e-mail; caso contrário → telefone/WhatsApp
    if (contato.includes('@')) {
      payload.email_solicitante = contato;
    } else {
      payload.telefone_solicitante = contato;
    }
  }

  const { data: pedido, error } = await supabase
    .from('pedidos_oracao')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('[site] Erro ao salvar pedido:', error);
    throw error;
  }

  console.log('[site] Pedido salvo:', pedido.id, '| conf:', confidencial, '| anon:', anonimo);
  return json({ success: true, message: 'Pedido de oração recebido com amor.' });
}
