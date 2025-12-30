import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('[liturgy-player] Iniciando geração de playlist...')

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Receber o ID do Evento
    const { evento_id } = await req.json()

    if (!evento_id) {
      throw new Error("Evento ID é obrigatório")
    }

    console.log(`[liturgy-player] Buscando liturgia para evento: ${evento_id}`)

    // 2. Buscar a "Estrutura Mestra" (Liturgia)
    const { data: liturgia, error: errLiturgia } = await supabaseClient
      .from('liturgias')
      .select('*')
      .eq('evento_id', evento_id)
      .order('ordem')

    if (errLiturgia) {
      console.error('[liturgy-player] Erro ao buscar liturgia:', errLiturgia.message)
      throw errLiturgia
    }

    if (!liturgia || liturgia.length === 0) {
      console.log('[liturgy-player] Nenhuma liturgia encontrada, retornando vazio')
      return new Response(JSON.stringify({ slides: [] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[liturgy-player] Encontrados ${liturgia.length} itens de liturgia`)

    // 3. Processar / Hidratar a Playlist
    const slidesFinais = await Promise.all(liturgia.map(async (item: any) => {
      
      // CASO A: Blocos Estáticos (Passam direto)
      if (['VIDEO', 'VERSICULO', 'AVISO', 'TIMER', 'IMAGEM', 'ATO_PRESENCIAL'].includes(item.tipo_conteudo || item.tipo)) {
        return item
      }

      // CASO B: Blocos Dinâmicos (A Edge busca os dados)
      
      // --- TESTEMUNHOS ---
      if (item.tipo_conteudo === 'BLOCO_TESTEMUNHO' || item.tipo === 'BLOCO_TESTEMUNHO') {
        console.log('[liturgy-player] Hidratando bloco TESTEMUNHOS')
        const { data: testemunhos } = await supabaseClient
          .from('testemunhos')
          .select('id, titulo, mensagem, categoria, anonimo')
          .eq('status', 'publico')
          .order('created_at', { ascending: false })
          .limit(3)
        
        return {
          ...item,
          tipo_conteudo: 'TESTEMUNHOS',
          conteudo_config: {
            ...(item.conteudo_config || {}),
            data: testemunhos || []
          }
        }
      }

      // --- SENTIMENTOS / ALERTA ---
      if (item.tipo_conteudo === 'BLOCO_SENTIMENTO' || item.tipo === 'BLOCO_SENTIMENTO') {
        console.log('[liturgy-player] Hidratando bloco SENTIMENTO')
        const ontem = new Date()
        ontem.setDate(ontem.getDate() - 1)
        
        const { data: sentimentos } = await supabaseClient
          .from('sentimentos_membros')
          .select('sentimento, analise_ia_motivo')
          .gte('created_at', ontem.toISOString())

        let alerta = null
        if (sentimentos && sentimentos.length > 0) {
          const negativos = sentimentos.filter((s: any) => 
            ['triste', 'cansado', 'ansioso', 'desanimado', 'luto', 'angustiado', 'sozinho', 'doente', 'com_pouca_fe', 'com_medo'].includes(s.sentimento)
          ).length
          const ratio = negativos / sentimentos.length
          const motivo = sentimentos.find((s: any) => s.analise_ia_motivo)?.analise_ia_motivo || "Fortalecimento da fé"
          
          alerta = {
            tipo: ratio > 0.3 ? 'CLAMOR' : 'GRATIDAO',
            titulo: ratio > 0.3 ? 'Alerta de Intercessão' : 'Celebração',
            mensagem: ratio > 0.3 
              ? `Muitos irmãos estão abatidos. Oremos por: ${motivo}.`
              : `A igreja está alegre! Agradeça por: ${motivo}.`,
            totalSentimentos: sentimentos.length,
            percentualNegativos: Math.round(ratio * 100)
          }
        }
        
        return {
          ...item,
          tipo_conteudo: 'ALERTA_ESPIRITUAL',
          conteudo_config: {
            ...(item.conteudo_config || {}),
            data: alerta
          }
        }
      }

      // --- VISITANTES ---
      if (item.tipo_conteudo === 'BLOCO_VISITANTE' || item.tipo === 'BLOCO_VISITANTE') {
        console.log('[liturgy-player] Hidratando bloco VISITANTES')
        const semanaPassada = new Date()
        semanaPassada.setDate(semanaPassada.getDate() - 7)
        
        const { data: visitantes } = await supabaseClient
          .from('visitantes_leads')
          .select('id, nome, estagio_funil, origem')
          .gte('created_at', semanaPassada.toISOString())
          .order('created_at', { ascending: false })
          .limit(5)

        return {
          ...item,
          tipo_conteudo: 'VISITANTES',
          conteudo_config: {
            ...(item.conteudo_config || {}),
            data: visitantes || []
          }
        }
      }

      // --- PEDIDOS DE ORAÇÃO ---
      if (item.tipo_conteudo === 'BLOCO_PEDIDOS' || item.tipo === 'BLOCO_PEDIDOS' || item.tipo_conteudo === 'PEDIDOS') {
        console.log('[liturgy-player] Hidratando bloco PEDIDOS')
        
        // Pode parametrizar via conteudo_config.classificacao
        const classificacao = item.conteudo_config?.classificacao || null
        
        let query = supabaseClient
          .from('pedidos_oracao')
          .select('id, pedido, tipo, nome_solicitante, analise_ia_gravidade, analise_ia_titulo, anonimo')
          .eq('status', 'em_oracao')
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (classificacao) {
          query = query.eq('classificacao', classificacao)
        }
        
        const { data: pedidos } = await query
          
        return {
          ...item,
          tipo_conteudo: 'PEDIDOS',
          conteudo_config: {
            ...(item.conteudo_config || {}),
            data: (pedidos || []).map((p: any) => ({
              ...p,
              nome_solicitante: p.anonimo ? 'Anônimo' : p.nome_solicitante
            }))
          }
        }
      }

      return item // Fallback
    }))

    const executionTime = Date.now() - startTime
    console.log(`[liturgy-player] Playlist gerada em ${executionTime}ms com ${slidesFinais.length} slides`)

    return new Response(JSON.stringify({ 
      slides: slidesFinais,
      evento_id,
      geradoEm: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[liturgy-player] Erro fatal:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
