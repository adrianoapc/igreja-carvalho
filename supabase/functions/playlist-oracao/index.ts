import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('[playlist-oracao] Iniciando geração de playlist...')

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // --- 1. BLOCO ALERTA & GRATIDÃO (Inteligência Espiritual) ---
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)

    console.log('[playlist-oracao] Buscando sentimentos das últimas 24h...')
    const { data: sentimentos, error: errSentimentos } = await supabaseClient
      .from('sentimentos_membros')
      .select('sentimento, analise_ia_motivo')
      .gte('created_at', ontem.toISOString())

    if (errSentimentos) {
      console.error('[playlist-oracao] Erro ao buscar sentimentos:', errSentimentos.message)
    }

    let alertaEspiritual = null
    if (sentimentos && sentimentos.length > 0) {
      const negativos = sentimentos.filter((s: any) => 
        ['triste', 'cansado', 'ansioso', 'desanimado', 'luto', 'angustiado', 'sozinho', 'doente', 'com_pouca_fe', 'com_medo'].includes(s.sentimento)
      ).length
      
      const ratio = negativos / sentimentos.length
      const motivo = sentimentos.find((s: any) => s.analise_ia_motivo)?.analise_ia_motivo || "Fortalecimento da fé"

      alertaEspiritual = {
        tipo: ratio > 0.3 ? 'CLAMOR' : 'GRATIDAO',
        titulo: ratio > 0.3 ? 'Alerta de Intercessão' : 'Celebração',
        mensagem: ratio > 0.3 
          ? `Muitos irmãos estão abatidos. Oremos por: ${motivo}.`
          : `A igreja está alegre! Agradeça por: ${motivo}.`,
        totalSentimentos: sentimentos.length,
        percentualNegativos: Math.round(ratio * 100)
      }
      console.log(`[playlist-oracao] Alerta espiritual: ${alertaEspiritual.tipo} (${alertaEspiritual.percentualNegativos}% negativos)`)
    }

    // --- 2. TESTEMUNHOS (Últimos 3 públicos) ---
    console.log('[playlist-oracao] Buscando testemunhos públicos...')
    const { data: testemunhos, error: errTestemunhos } = await supabaseClient
      .from('testemunhos')
      .select('id, titulo, mensagem, categoria, anonimo')
      .eq('status', 'publico')
      .order('created_at', { ascending: false })
      .limit(3)

    if (errTestemunhos) {
      console.error('[playlist-oracao] Erro ao buscar testemunhos:', errTestemunhos.message)
    }

    // --- 3. BLOCO CRM (Visitantes da Semana) ---
    const semanaPassada = new Date()
    semanaPassada.setDate(semanaPassada.getDate() - 7)

    console.log('[playlist-oracao] Buscando visitantes recentes...')
    const { data: visitantes, error: errVisitantes } = await supabaseClient
      .from('visitantes_leads')
      .select('id, nome, estagio_funil, origem')
      .gte('created_at', semanaPassada.toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    if (errVisitantes) {
      console.error('[playlist-oracao] Erro ao buscar visitantes:', errVisitantes.message)
    }

    // --- 4. BLOCO INTERCESSÃO ---
    // A. Broadcast (Pedidos gerais para toda a igreja)
    console.log('[playlist-oracao] Buscando pedidos BROADCAST...')
    const { data: broadcast, error: errBroadcast } = await supabaseClient
      .from('pedidos_oracao')
      .select('id, pedido, tipo, nome_solicitante, analise_ia_gravidade, analise_ia_titulo, anonimo')
      .eq('status', 'em_oracao')
      .eq('classificacao', 'BROADCAST')
      .order('created_at', { ascending: false })
      .limit(5)

    if (errBroadcast) {
      console.error('[playlist-oracao] Erro ao buscar broadcast:', errBroadcast.message)
    }

    // B. Pessoais (Pedidos individuais)
    console.log('[playlist-oracao] Buscando pedidos PESSOAIS...')
    const { data: pessoais, error: errPessoais } = await supabaseClient
      .from('pedidos_oracao')
      .select('id, pedido, tipo, nome_solicitante, anonimo')
      .eq('status', 'em_oracao')
      .eq('classificacao', 'PESSOAL')
      .order('created_at', { ascending: false })
      .limit(10)

    if (errPessoais) {
      console.error('[playlist-oracao] Erro ao buscar pessoais:', errPessoais.message)
    }

    // --- RESPOSTA FINAL ---
    const playlist = {
      alerta: alertaEspiritual,
      testemunhos: testemunhos || [],
      visitantes: visitantes || [],
      broadcast: (broadcast || []).map((p: any) => ({
        ...p,
        nome_solicitante: p.anonimo ? 'Anônimo' : p.nome_solicitante
      })),
      pessoais: (pessoais || []).map((p: any) => ({
        ...p,
        nome_solicitante: p.anonimo ? 'Anônimo' : p.nome_solicitante
      })),
      geradoEm: new Date().toISOString()
    }

    const executionTime = Date.now() - startTime
    console.log(`[playlist-oracao] Playlist gerada em ${executionTime}ms:`, {
      alertaTipo: alertaEspiritual?.tipo,
      testemunhosCount: testemunhos?.length || 0,
      visitantesCount: visitantes?.length || 0,
      broadcastCount: broadcast?.length || 0,
      pessoaisCount: pessoais?.length || 0
    })

    return new Response(JSON.stringify(playlist), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[playlist-oracao] Erro fatal:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
