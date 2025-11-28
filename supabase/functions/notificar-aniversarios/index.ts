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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar todas as pessoas com pelo menos uma data preenchida
    const { data: pessoas, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('id, nome, data_nascimento, data_casamento, data_batismo, status')
      .or('data_nascimento.not.is.null,data_casamento.not.is.null,data_batismo.not.is.null')

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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
