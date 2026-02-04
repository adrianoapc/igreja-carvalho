/**
 * Edge Function para gerar sugestões ML de conciliação
 * 
 * Chama gerar_candidatos_conciliacao() e salva em conciliacao_ml_sugestoes
 * 
 * POST /functions/v1/gerar-sugestoes-ml
 * Body: {
 *   igreja_id: string
 *   conta_id?: string
 *   mes_inicio?: string  // YYYY-MM-DD, default: 3 meses atrás
 *   mes_fim?: string     // YYYY-MM-DD, default: hoje
 *   score_minimo?: number // default: 0.7
 * }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { 
      igreja_id, 
      conta_id, 
      mes_inicio, 
      mes_fim, 
      score_minimo = 0.7 
    } = body

    if (!igreja_id) {
      return new Response(JSON.stringify({ error: 'igreja_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default: 3 meses atrás até hoje
    const dataInicio = mes_inicio || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dataFim = mes_fim || new Date().toISOString().split('T')[0]

    console.log('[gerar-sugestoes-ml] Gerando candidatos:', { 
      igreja_id, 
      conta_id, 
      dataInicio, 
      dataFim, 
      score_minimo 
    })

    // Chamar RPC para gerar candidatos
    const { data: candidatos, error: rpcError } = await supabase.rpc('gerar_candidatos_conciliacao', {
      p_igreja_id: igreja_id,
      p_conta_id: conta_id || null,
      p_mes_inicio: dataInicio,
      p_mes_fim: dataFim,
      p_score_minimo: score_minimo,
    })

    if (rpcError) {
      console.error('[gerar-sugestoes-ml] RPC error:', rpcError)
      throw rpcError
    }

    if (!candidatos || candidatos.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        candidatos: 0,
        message: 'Nenhum candidato encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[gerar-sugestoes-ml] Candidatos gerados:', candidatos.length)

    // Buscar filial_id do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('filial_id')
      .eq('user_id', user.id)
      .single()

    const filialId = profile?.filial_id || null

    // Limpar sugestões antigas pendentes dessa igreja/conta
    const deleteQuery = supabase
      .from('conciliacao_ml_sugestoes')
      .delete()
      .eq('igreja_id', igreja_id)
      .eq('status', 'pendente')

    if (conta_id) {
      deleteQuery.eq('conta_id', conta_id)
    }

    await deleteQuery

    // Inserir novos candidatos
    const sugestoes = candidatos.map((c: any) => ({
      igreja_id,
      filial_id: filialId,
      conta_id: conta_id || null,
      tipo_match: c.tipo_match,
      extrato_ids: c.extrato_ids,
      transacao_ids: c.transacao_ids,
      score: c.score,
      features: c.features || {},
      origem: 'regra',
      modelo_versao: 'v1',
      status: 'pendente',
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('conciliacao_ml_sugestoes')
      .insert(sugestoes)
      .select()

    if (insertError) {
      console.error('[gerar-sugestoes-ml] Insert error:', insertError)
      throw insertError
    }

    console.log('[gerar-sugestoes-ml] Sugestões inseridas:', inserted?.length || 0)

    return new Response(JSON.stringify({ 
      success: true,
      candidatos: candidatos.length,
      sugestoes_criadas: inserted?.length || 0,
      periodo: { inicio: dataInicio, fim: dataFim },
      score_minimo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('[gerar-sugestoes-ml] Error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
