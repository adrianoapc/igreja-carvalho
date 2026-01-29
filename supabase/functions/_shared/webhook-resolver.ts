/**
 * Webhook Resolver com Fallback em 3 Níveis
 * 
 * Hierarquia de resolução:
 * 1. Filial específica (igreja_id + filial_id)
 * 2. Igreja global (igreja_id, filial_id = NULL)
 * 3. Sistema global (igreja_id = NULL, filial_id = NULL)
 * 
 * Também resolve o número WhatsApp remetente com hierarquia similar.
 */

// Usando any para compatibilidade com diferentes versões do Supabase client
// deno-lint-ignore no-explicit-any
type SupabaseClientAny = any;

export interface WebhookResolucao {
  webhookUrl: string;
  webhookNivel: 'filial' | 'igreja' | 'sistema';
  whatsappRemetente: string | null;
  whatsappSenderId: string | null;
  secret?: string | null;
}

interface WebhookRecord {
  url: string;
  whatsapp_numero_id: string | null;
  secret_encrypted?: string | null;
}

interface WhatsAppNumeroRecord {
  display_phone_number: string;
  phone_number_id: string | null;
}

/**
 * Resolve webhook com fallback em 3 níveis + número remetente
 * 
 * @param supabase - Cliente Supabase com service role
 * @param igrejaId - UUID da igreja (obrigatório)
 * @param filialId - UUID da filial (opcional)
 * @param tipoWebhook - Tipo do webhook (ex: whatsapp_make, make_escalas)
 * @returns Objeto com URL, nível e dados do remetente, ou null se não encontrado
 */
export async function resolverWebhookComRemetente(
  supabase: SupabaseClientAny,
  igrejaId: string,
  filialId: string | null,
  tipoWebhook: string
): Promise<WebhookResolucao | null> {
  
  // NÍVEL 1: Webhook específico da filial
  if (filialId) {
    const webhook = await buscarWebhook(supabase, igrejaId, filialId, tipoWebhook);
    if (webhook?.url) {
      console.log(`[Resolver] Webhook encontrado: nível FILIAL`);
      const remetente = await resolverRemetente(supabase, webhook.whatsapp_numero_id, igrejaId, filialId);
      return { 
        webhookUrl: webhook.url, 
        webhookNivel: 'filial', 
        ...remetente 
      };
    }
  }
  
  // NÍVEL 2: Webhook global da igreja
  const webhookIgreja = await buscarWebhook(supabase, igrejaId, null, tipoWebhook);
  if (webhookIgreja?.url) {
    console.log(`[Resolver] Webhook encontrado: nível IGREJA`);
    const remetente = await resolverRemetente(supabase, webhookIgreja.whatsapp_numero_id, igrejaId, filialId);
    return { 
      webhookUrl: webhookIgreja.url, 
      webhookNivel: 'igreja', 
      ...remetente 
    };
  }
  
  // NÍVEL 3: Webhook GLOBAL DO SISTEMA
  const webhookSistema = await buscarWebhook(supabase, null, null, tipoWebhook);
  if (webhookSistema?.url) {
    console.log(`[Resolver] Webhook encontrado: nível SISTEMA (global)`);
    // Para webhook global do sistema, remetente ainda vem da hierarquia da igreja
    const remetente = await resolverRemetente(supabase, webhookSistema.whatsapp_numero_id, igrejaId, filialId);
    return { 
      webhookUrl: webhookSistema.url, 
      webhookNivel: 'sistema', 
      ...remetente 
    };
  }
  
  console.warn(`[Resolver] Nenhum webhook encontrado para tipo "${tipoWebhook}"`);
  return null;
}

/**
 * Busca webhook com filtros específicos
 */
async function buscarWebhook(
  supabase: SupabaseClientAny,
  igrejaId: string | null,
  filialId: string | null,
  tipo: string
): Promise<WebhookRecord | null> {
  let query = supabase
    .from('webhooks')
    .select('url, whatsapp_numero_id')
    .eq('tipo', tipo)
    .eq('enabled', true);
  
  // Filtrar por igreja_id
  if (igrejaId === null) {
    query = query.is('igreja_id', null);
  } else {
    query = query.eq('igreja_id', igrejaId);
  }
  
  // Filtrar por filial_id
  if (filialId === null) {
    query = query.is('filial_id', null);
  } else {
    query = query.eq('filial_id', filialId);
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error) {
    console.error(`[Resolver] Erro ao buscar webhook:`, error.message);
    return null;
  }
  
  return data as WebhookRecord | null;
}

/**
 * Resolve número WhatsApp remetente com hierarquia
 * 
 * Ordem de prioridade:
 * 1. Número vinculado ao webhook (whatsapp_numero_id)
 * 2. Número da filial
 * 3. Número global da igreja
 * 4. Número global do sistema
 */
async function resolverRemetente(
  supabase: SupabaseClientAny,
  whatsappNumeroId: string | null,
  igrejaId: string,
  filialId: string | null
): Promise<{ whatsappRemetente: string | null; whatsappSenderId: string | null }> {
  
  // 1. Número vinculado ao webhook
  if (whatsappNumeroId) {
    const numero = await buscarNumeroPorId(supabase, whatsappNumeroId);
    if (numero) {
      console.log(`[Resolver] Remetente: vinculado ao webhook`);
      return {
        whatsappRemetente: numero.display_phone_number,
        whatsappSenderId: numero.phone_number_id,
      };
    }
  }
  
  // 2. Número da filial
  if (filialId) {
    const numero = await buscarNumero(supabase, igrejaId, filialId);
    if (numero) {
      console.log(`[Resolver] Remetente: nível FILIAL`);
      return {
        whatsappRemetente: numero.display_phone_number,
        whatsappSenderId: numero.phone_number_id,
      };
    }
  }
  
  // 3. Número global da igreja
  const numeroIgreja = await buscarNumero(supabase, igrejaId, null);
  if (numeroIgreja) {
    console.log(`[Resolver] Remetente: nível IGREJA`);
    return {
      whatsappRemetente: numeroIgreja.display_phone_number,
      whatsappSenderId: numeroIgreja.phone_number_id,
    };
  }
  
  // 4. Número global do SISTEMA
  const numeroSistema = await buscarNumero(supabase, null, null);
  if (numeroSistema) {
    console.log(`[Resolver] Remetente: nível SISTEMA (global)`);
    return {
      whatsappRemetente: numeroSistema.display_phone_number,
      whatsappSenderId: numeroSistema.phone_number_id,
    };
  }
  
  console.warn(`[Resolver] Nenhum número remetente encontrado`);
  return { whatsappRemetente: null, whatsappSenderId: null };
}

/**
 * Busca número WhatsApp por ID
 */
async function buscarNumeroPorId(
  supabase: SupabaseClientAny,
  numeroId: string
): Promise<WhatsAppNumeroRecord | null> {
  const { data, error } = await supabase
    .from('whatsapp_numeros')
    .select('display_phone_number, phone_number_id')
    .eq('id', numeroId)
    .eq('enabled', true)
    .maybeSingle();
  
  if (error) {
    console.error(`[Resolver] Erro ao buscar número por ID:`, error.message);
    return null;
  }
  
  return data as WhatsAppNumeroRecord | null;
}

/**
 * Busca número WhatsApp por igreja/filial
 */
async function buscarNumero(
  supabase: SupabaseClientAny,
  igrejaId: string | null,
  filialId: string | null
): Promise<WhatsAppNumeroRecord | null> {
  let query = supabase
    .from('whatsapp_numeros')
    .select('display_phone_number, phone_number_id')
    .eq('enabled', true);
  
  // Filtrar por igreja_id
  if (igrejaId === null) {
    query = query.is('igreja_id', null);
  } else {
    query = query.eq('igreja_id', igrejaId);
  }
  
  // Filtrar por filial_id
  if (filialId === null) {
    query = query.is('filial_id', null);
  } else {
    query = query.eq('filial_id', filialId);
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error) {
    console.error(`[Resolver] Erro ao buscar número:`, error.message);
    return null;
  }
  
  return data as WhatsAppNumeroRecord | null;
}

/**
 * Verifica se há algum webhook configurado (qualquer nível)
 * Útil para verificar se deve pular envio
 */
export async function temWebhookConfigurado(
  supabase: SupabaseClientAny,
  igrejaId: string,
  filialId: string | null,
  tipoWebhook: string
): Promise<boolean> {
  const resolucao = await resolverWebhookComRemetente(supabase, igrejaId, filialId, tipoWebhook);
  return resolucao !== null;
}

/**
 * Busca provedores WhatsApp ativos usando fallback em 3 níveis
 * Retorna o primeiro webhook WhatsApp habilitado
 */
export async function getActiveWhatsAppProviderWithFallback(
  supabase: SupabaseClientAny,
  igrejaId: string,
  filialId: string | null = null
): Promise<{ tipo: string; resolucao: WebhookResolucao } | null> {
  const tiposWhatsApp = ["whatsapp_make", "whatsapp_meta", "whatsapp_evolution"];
  
  for (const tipo of tiposWhatsApp) {
    const resolucao = await resolverWebhookComRemetente(supabase, igrejaId, filialId, tipo);
    if (resolucao) {
      console.log(`[Resolver] Provedor WhatsApp ativo: ${tipo} (nível: ${resolucao.webhookNivel})`);
      return { tipo, resolucao };
    }
  }
  
  console.warn(`[Resolver] Nenhum provedor WhatsApp encontrado para igreja ${igrejaId}`);
  return null;
}
