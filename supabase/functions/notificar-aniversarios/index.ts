import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Pessoa {
  id: string
  nome: string
  data_nascimento: string | null
  data_casamento: string | null
  data_batismo: string | null
  status: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Iniciando verificação de aniversários...')

    const requestBody = await req.json().catch(() => ({} as Record<string, unknown>));
    const igrejaId =
      (requestBody as { igreja_id?: string }).igreja_id ??
      new URL(req.url).searchParams.get('igreja_id');

    if (!igrejaId) {
      return new Response(
        JSON.stringify({ error: 'igreja_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar se a função está ativa
    const { data: config, error: configError } = await supabaseClient
      .from('edge_function_config')
      .select('enabled')
      .eq('function_name', 'notificar-aniversarios')
      .eq('igreja_id', igrejaId)
      .single();

    if (configError) {
      console.error('Erro ao buscar configuração:', configError);
    }

    if (config && !config.enabled) {
      console.log('Função desativada, pulando execução');
      await supabaseClient.rpc('log_edge_function_execution', {
        p_function_name: 'notificar-aniversarios',
        p_status: 'skipped',
        p_details: 'Função desativada'
      });
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Função desativada',
          aniversarios_encontrados: 0 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Buscar todas as pessoas com pelo menos uma data preenchida
    const { data: pessoas, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('id, nome, data_nascimento, data_casamento, data_batismo, status')
      .or('data_nascimento.not.is.null,data_casamento.not.is.null,data_batismo.not.is.null')
      .eq('igreja_id', igrejaId)

    if (fetchError) {
      console.error('Erro ao buscar pessoas:', fetchError)
      throw fetchError
    }

    console.log(`Encontradas ${pessoas?.length || 0} pessoas com datas cadastradas`)

    // Data de amanhã
    const amanha = new Date()
    amanha.setDate(amanha.getDate() + 1)
    const diaAmanha = amanha.getDate()
    const mesAmanha = amanha.getMonth() + 1

    const notificacoes: Array<{
      nome: string
      tipo: string
      idade?: number
    }> = []

    // Verificar aniversários de amanhã
    pessoas?.forEach((pessoa: Pessoa) => {
      // Aniversário de nascimento
      if (pessoa.data_nascimento) {
        const dataNasc = new Date(pessoa.data_nascimento)
        if (dataNasc.getDate() === diaAmanha && (dataNasc.getMonth() + 1) === mesAmanha) {
          const idade = amanha.getFullYear() - dataNasc.getFullYear()
          notificacoes.push({
            nome: pessoa.nome,
            tipo: 'nascimento',
            idade,
          })
        }
      }

      // Aniversário de casamento
      if (pessoa.data_casamento) {
        const dataCas = new Date(pessoa.data_casamento)
        if (dataCas.getDate() === diaAmanha && (dataCas.getMonth() + 1) === mesAmanha) {
          const anos = amanha.getFullYear() - dataCas.getFullYear()
          notificacoes.push({
            nome: pessoa.nome,
            tipo: 'casamento',
            idade: anos,
          })
        }
      }

      // Aniversário de batismo
      if (pessoa.data_batismo) {
        const dataBat = new Date(pessoa.data_batismo)
        if (dataBat.getDate() === diaAmanha && (dataBat.getMonth() + 1) === mesAmanha) {
          const anos = amanha.getFullYear() - dataBat.getFullYear()
          notificacoes.push({
            nome: pessoa.nome,
            tipo: 'batismo',
            idade: anos,
          })
        }
      }
    })

    console.log(`Encontrados ${notificacoes.length} aniversários para amanhã`)

    // Criar notificações para os admins
    if (notificacoes.length > 0) {
      for (const notif of notificacoes) {
        const tipoLabel = notif.tipo === 'nascimento' 
          ? 'Aniversário' 
          : notif.tipo === 'casamento' 
          ? 'Aniversário de Casamento' 
          : 'Aniversário de Batismo'

        const idadeTexto = notif.idade ? ` (${notif.idade} anos)` : ''
        
        const message = `${notif.nome} faz ${tipoLabel.toLowerCase()} amanhã${idadeTexto}`

        const { error: notifyError } = await supabaseClient.rpc('notify_admins', {
          p_title: `${tipoLabel} Amanhã`,
          p_message: message,
          p_type: 'aniversario',
          p_metadata: {
            nome: notif.nome,
            tipo: notif.tipo,
            idade: notif.idade,
            data: amanha.toISOString(),
          },
        })

        if (notifyError) {
          console.error('Erro ao criar notificação:', notifyError)
        } else {
          console.log(`Notificação criada: ${message}`)
        }
      }
    }

    // Registrar execução bem-sucedida
    await supabaseClient.rpc('log_edge_function_execution', {
      p_function_name: 'notificar-aniversarios',
      p_status: 'success',
      p_details: `${notificacoes.length} aniversário(s) encontrado(s)`
    });

    return new Response(
      JSON.stringify({
        success: true,
        aniversarios_encontrados: notificacoes.length,
        detalhes: notificacoes,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro na função:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    
    // Registrar erro
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseClient.rpc('log_edge_function_execution', {
        p_function_name: 'notificar-aniversarios',
        p_status: 'error',
        p_details: errorMessage
      });
    } catch (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
