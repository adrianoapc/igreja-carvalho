import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando notificação diária de sentimentos...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se a função está ativa
    const { data: config, error: configError } = await supabaseClient
      .from('edge_function_config')
      .select('enabled')
      .eq('function_name', 'notificar-sentimentos-diario')
      .single();

    if (configError) {
      console.error('Erro ao buscar configuração:', configError);
    }

    if (config && !config.enabled) {
      console.log('Função desativada, pulando execução');
      await supabaseClient.rpc('log_edge_function_execution', {
        p_function_name: 'notificar-sentimentos-diario',
        p_status: 'skipped',
        p_details: 'Função desativada'
      });
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Função desativada',
          count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os membros ativos
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, nome, user_id')
      .eq('status', 'membro')
      .not('user_id', 'is', null);

    if (profilesError) {
      console.error('Erro ao buscar membros:', profilesError);
      throw profilesError;
    }

    console.log(`Encontrados ${profiles?.length || 0} membros para notificar`);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum membro encontrado para notificar',
          count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar notificações para cada membro
    const notifications = profiles.map(profile => ({
      user_id: profile.user_id,
      title: 'Como você está se sentindo hoje?',
      message: 'Compartilhe conosco como você está. Sua igreja se importa com você!',
      type: 'sentimento_diario',
      metadata: {
        action: 'registrar_sentimento',
        timestamp: new Date().toISOString()
      }
    }));

    const { data: insertedNotifications, error: notificationError } = await supabaseClient
      .from('notifications')
      .insert(notifications)
      .select();

    if (notificationError) {
      console.error('Erro ao criar notificações:', notificationError);
      throw notificationError;
    }

    console.log(`${insertedNotifications?.length || 0} notificações criadas com sucesso`);

    // Registrar execução bem-sucedida
    await supabaseClient.rpc('log_edge_function_execution', {
      p_function_name: 'notificar-sentimentos-diario',
      p_status: 'success',
      p_details: `${insertedNotifications?.length || 0} notificações criadas`
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificações enviadas com sucesso',
        count: insertedNotifications?.length || 0,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função de notificação de sentimentos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Registrar erro
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseClient.rpc('log_edge_function_execution', {
        p_function_name: 'notificar-sentimentos-diario',
        p_status: 'error',
        p_details: errorMessage
      });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});