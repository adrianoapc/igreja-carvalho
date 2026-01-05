import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      igreja_id: igrejaId,
      filial_origem_id: filialOrigemId,
      filial_destino_ids: filialDestinoIds,
      tabelas,
      overwrite,
    } = await req.json()

    if (!igrejaId || !filialOrigemId || !Array.isArray(filialDestinoIds) || filialDestinoIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!Array.isArray(tabelas) || tabelas.length === 0) {
      return new Response(JSON.stringify({ error: 'Informe as tabelas para replicar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roles, error: rolesError } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', authData.user.id)
      .eq('igreja_id', igrejaId)

    if (rolesError) {
      return new Response(JSON.stringify({ error: 'Erro ao validar permissões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const hasPermission = (roles || []).some((r) =>
      ['admin', 'admin_igreja', 'super_admin'].includes(r.role)
    )

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabaseService.rpc('replicar_cadastros_para_filiais', {
      p_igreja_id: igrejaId,
      p_filial_origem_id: filialOrigemId,
      p_filiais_destino_ids: filialDestinoIds,
      p_tabelas: tabelas,
      p_overwrite: Boolean(overwrite),
      p_user_id: authData.user.id,
    })

    if (error) {
      console.error('Erro ao replicar cadastros:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, resultado: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro na replicação:', error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
