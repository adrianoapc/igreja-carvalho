/**
 * Utilitário para buscar secrets de webhooks criptografados
 * Usado por Edge Functions para obter tokens de API de forma segura
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

export interface WebhookSecret {
  secret: string | null;
  url: string | null;
  enabled: boolean;
}

/**
 * Busca o secret descriptografado de um webhook por igreja e tipo
 * Requer WEBHOOK_ENCRYPTION_KEY configurada como secret do projeto
 * 
 * @param supabase - Cliente Supabase com service role
 * @param igrejaId - UUID da igreja
 * @param tipo - Tipo do webhook (whatsapp_meta, whatsapp_make, whatsapp_evolution, etc)
 * @returns Secret descriptografado ou null se não encontrado
 */
export async function getWebhookSecret(
  supabase: SupabaseClient,
  igrejaId: string,
  tipo: string
): Promise<string | null> {
  const encryptionKey = Deno.env.get("WEBHOOK_ENCRYPTION_KEY");
  
  if (!encryptionKey) {
    console.error("[Secrets] WEBHOOK_ENCRYPTION_KEY não configurada");
    return null;
  }
  
  try {
    const { data, error } = await supabase.rpc("get_webhook_secret", {
      p_igreja_id: igrejaId,
      p_tipo: tipo,
      p_encryption_key: encryptionKey
    });
    
    if (error) {
      console.error(`[Secrets] Erro ao buscar secret para ${tipo}:`, error.message);
      return null;
    }
    
    return data as string | null;
  } catch (err) {
    console.error(`[Secrets] Exceção ao buscar secret:`, err);
    return null;
  }
}

/**
 * Busca configuração completa do webhook (URL + secret descriptografado)
 * 
 * @param supabase - Cliente Supabase com service role
 * @param igrejaId - UUID da igreja
 * @param tipo - Tipo do webhook
 * @returns Objeto com url, secret e status enabled
 */
export async function getWebhookConfig(
  supabase: SupabaseClient,
  igrejaId: string,
  tipo: string
): Promise<WebhookSecret> {
  const encryptionKey = Deno.env.get("WEBHOOK_ENCRYPTION_KEY");
  
  // Buscar URL e enabled da tabela diretamente
  const { data: webhook, error: webhookError } = await supabase
    .from("webhooks")
    .select("url, enabled")
    .eq("igreja_id", igrejaId)
    .eq("tipo", tipo)
    .eq("enabled", true)
    .maybeSingle();
  
  if (webhookError || !webhook) {
    console.log(`[Secrets] Webhook ${tipo} não encontrado para igreja ${igrejaId}`);
    return { secret: null, url: null, enabled: false };
  }
  
  // Buscar secret descriptografado via RPC
  let secret: string | null = null;
  
  if (encryptionKey) {
    try {
      const { data } = await supabase.rpc("get_webhook_secret", {
        p_igreja_id: igrejaId,
        p_tipo: tipo,
        p_encryption_key: encryptionKey
      });
      secret = data as string | null;
    } catch (err) {
      console.warn(`[Secrets] Não foi possível descriptografar secret:`, err);
    }
  }
  
  return {
    secret,
    url: webhook.url,
    enabled: webhook.enabled ?? false
  };
}

/**
 * Busca o provedor WhatsApp ativo para uma igreja
 * Retorna o primeiro webhook WhatsApp habilitado
 */
export async function getActiveWhatsAppProvider(
  supabase: SupabaseClient,
  igrejaId: string
): Promise<{ tipo: string; config: WebhookSecret } | null> {
  const tipos = ["whatsapp_meta", "whatsapp_evolution", "whatsapp_make"];
  
  for (const tipo of tipos) {
    const config = await getWebhookConfig(supabase, igrejaId, tipo);
    if (config.enabled && (config.secret || config.url)) {
      console.log(`[Secrets] Provedor WhatsApp ativo: ${tipo}`);
      return { tipo, config };
    }
  }
  
  console.log(`[Secrets] Nenhum provedor WhatsApp ativo para igreja ${igrejaId}`);
  return null;
}
