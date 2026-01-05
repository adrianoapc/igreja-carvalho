import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiturgiaNotification {
  culto_id: string;
  culto_titulo: string;
  culto_data: string;
  itens: Array<{
    tipo: string;
    titulo: string;
    responsavel_nome?: string;
    responsavel_telefone?: string;
    responsavel_externo?: string;
    duracao_minutos?: number;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { culto_id, igreja_id: igrejaId }: { culto_id: string; igreja_id?: string } = await req.json();

    if (!igrejaId) {
      throw new Error('igreja_id é obrigatório');
    }

    console.log('Processing liturgy notification for culto:', culto_id);

    // Buscar dados do evento (antes era cultos, agora é eventos)
    const { data: evento, error: eventoError } = await supabaseClient
      .from('eventos')
      .select('titulo, data_evento, igreja_id')
      .eq('id', culto_id)
      .eq('igreja_id', igrejaId)
      .maybeSingle();

    if (eventoError) {
      console.error('Error fetching evento:', eventoError);
      throw new Error('Erro ao buscar dados do evento');
    }

    if (!evento) {
      throw new Error('Evento não encontrado');
    }

    if (!evento?.igreja_id) {
      throw new Error('Evento sem igreja associada');
    }

    // Buscar configuração do webhook por igreja
    const { data: config, error: configError } = await supabaseClient
      .from('webhooks')
      .select('url, enabled')
      .eq('igreja_id', evento.igreja_id)
      .eq('tipo', 'make_liturgia')
      .maybeSingle();

    if (configError) {
      console.error('Error fetching config:', configError);
      throw new Error('Erro ao buscar configuração');
    }

    if (!config?.url || !config.enabled) {
      console.log('Webhook not configured, skipping notification');
      return new Response(
        JSON.stringify({ message: 'Webhook não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Buscar itens da liturgia com responsáveis (tabela renomeada para liturgias)
    const { data: itens, error: itensError } = await supabaseClient
      .from('liturgias')
      .select(`
        tipo,
        titulo,
        duracao_minutos,
        responsavel_externo,
        responsavel_id,
        profiles:responsavel_id (
          nome,
          telefone
        )
      `)
      .eq('evento_id', culto_id)
      .eq('igreja_id', evento.igreja_id)
      .order('ordem');

    if (itensError) {
      console.error('Error fetching liturgia items:', itensError);
      throw new Error('Erro ao buscar itens da liturgia');
    }

    // Formatar dados para o Make
    interface LiturgiaItem {
      tipo: string;
      titulo: string;
      duracao_minutos?: number;
      responsavel_externo?: string;
      profiles?: { nome?: string; telefone?: string } | null;
    }

    const notification: LiturgiaNotification = {
      culto_id,
      culto_titulo: String(evento.titulo || ''),
      culto_data: String(evento.data_evento || ''),
      itens: (itens as LiturgiaItem[]).map((item) => ({
        tipo: String(item.tipo || ''),
        titulo: String(item.titulo || ''),
        responsavel_nome: item.profiles?.nome || item.responsavel_externo,
        responsavel_telefone: item.profiles?.telefone,
        responsavel_externo: item.responsavel_externo,
        duracao_minutos: item.duracao_minutos,
      })),
    };

    console.log('Sending notification to Make webhook:', notification);

    // Enviar para o webhook do Make
    const makeResponse = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    if (!makeResponse.ok) {
      console.error('Make webhook error:', await makeResponse.text());
      throw new Error('Erro ao enviar para webhook do Make');
    }

    console.log('Notification sent successfully to Make');

    return new Response(
      JSON.stringify({ message: 'Notificação enviada com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in notificar-liturgia-make:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
