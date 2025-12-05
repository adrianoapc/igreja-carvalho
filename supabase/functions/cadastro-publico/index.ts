import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CadastroVisitanteData {
  nome: string
  telefone?: string
  email?: string
  sexo?: string
  data_nascimento?: string
  entrou_por?: string
  necessidades_especiais?: string
  observacoes?: string
  aceitou_jesus?: boolean
  deseja_contato?: boolean
}

interface AtualizarMembroData {
  id: string
  nome: string
  telefone?: string
  sexo?: string
  data_nascimento?: string
  estado_civil?: string
  necessidades_especiais?: string
  cep?: string
  cidade?: string
  bairro?: string
  estado?: string
  endereco?: string
  profissao?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { action, data } = await req.json()
    
    console.log(`[cadastro-publico] Action: ${action}`)
    
    if (action === 'cadastrar_visitante') {
      const visitanteData = data as CadastroVisitanteData
      
      // Validação básica
      if (!visitanteData.nome?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Nome é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (!visitanteData.telefone?.trim() && !visitanteData.email?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Informe pelo menos um contato (telefone ou email)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Normalizar telefone (remover formatação)
      const telefoneNormalizado = visitanteData.telefone?.replace(/\D/g, '') || null
      
      // Verificar se já existe uma pessoa com o mesmo email ou telefone
      let visitanteExistente = null
      
      if (visitanteData.email?.trim()) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('*')
          .in('status', ['visitante', 'frequentador'])
          .eq('email', visitanteData.email.trim().toLowerCase())
          .limit(1)
        
        if (byEmail && byEmail.length > 0) {
          visitanteExistente = byEmail[0]
        }
      }
      
      if (!visitanteExistente && telefoneNormalizado) {
        const { data: byTelefone } = await supabase
          .from('profiles')
          .select('*')
          .in('status', ['visitante', 'frequentador'])
          .eq('telefone', telefoneNormalizado)
          .limit(1)
        
        if (byTelefone && byTelefone.length > 0) {
          visitanteExistente = byTelefone[0]
        }
      }
      
      let resultData
      
      if (visitanteExistente) {
        // Atualizar registro existente
        const novoNumeroVisitas = (visitanteExistente.numero_visitas || 0) + 1
        
        // Promover automaticamente para frequentador após 2 visitas
        let novoStatus = visitanteExistente.status
        if (visitanteExistente.status === 'visitante' && novoNumeroVisitas > 2) {
          novoStatus = 'frequentador'
        }
        
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update({
            numero_visitas: novoNumeroVisitas,
            data_ultima_visita: new Date().toISOString(),
            status: novoStatus,
            aceitou_jesus: visitanteData.aceitou_jesus || visitanteExistente.aceitou_jesus,
            deseja_contato: visitanteData.deseja_contato ?? visitanteExistente.deseja_contato,
            sexo: visitanteData.sexo || visitanteExistente.sexo,
            data_nascimento: visitanteData.data_nascimento || visitanteExistente.data_nascimento,
          })
          .eq('id', visitanteExistente.id)
          .select()
          .single()
        
        if (updateError) throw updateError
        resultData = updated
        
        console.log(`[cadastro-publico] Visitante atualizado: ${resultData.nome}, visitas: ${resultData.numero_visitas}`)
      } else {
        // Inserir novo registro
        const { data: newData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            nome: visitanteData.nome.trim(),
            telefone: telefoneNormalizado,
            email: visitanteData.email?.trim().toLowerCase() || null,
            necessidades_especiais: visitanteData.necessidades_especiais?.trim() || null,
            observacoes: visitanteData.observacoes?.trim() || null,
            aceitou_jesus: visitanteData.aceitou_jesus || false,
            deseja_contato: visitanteData.deseja_contato ?? true,
            sexo: visitanteData.sexo || null,
            data_nascimento: visitanteData.data_nascimento || null,
            entrou_por: visitanteData.entrou_por || null,
            status: 'visitante',
            data_primeira_visita: new Date().toISOString(),
            data_ultima_visita: new Date().toISOString(),
            numero_visitas: 1,
          })
          .select()
          .single()
        
        if (insertError) throw insertError
        resultData = newData
        
        console.log(`[cadastro-publico] Novo visitante cadastrado: ${resultData.nome}`)
      }
      
      return new Response(
        JSON.stringify({ success: true, data: resultData, isUpdate: !!visitanteExistente }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (action === 'buscar_membro') {
      const { email } = data
      
      if (!email?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Email é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, nome, telefone, email, sexo, data_nascimento, estado_civil, necessidades_especiais, cep, cidade, bairro, estado, endereco, profissao, data_batismo')
        .eq('email', email.trim().toLowerCase())
        .eq('status', 'membro')
        .single()
      
      if (error || !profile) {
        return new Response(
          JSON.stringify({ error: 'Membro não encontrado com esse email' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log(`[cadastro-publico] Membro encontrado: ${profile.nome}`)
      
      return new Response(
        JSON.stringify({ success: true, data: profile }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (action === 'atualizar_membro') {
      const membroData = data as AtualizarMembroData
      
      if (!membroData.id || !membroData.nome?.trim()) {
        return new Response(
          JSON.stringify({ error: 'ID e nome são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Buscar dados atuais do perfil
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', membroData.id)
        .eq('status', 'membro')
        .single()
      
      if (fetchError || !currentProfile) {
        return new Response(
          JSON.stringify({ error: 'Membro não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Normalizar telefone e CEP
      const telefoneNormalizado = membroData.telefone?.replace(/\D/g, '') || null
      const cepNormalizado = membroData.cep?.replace(/\D/g, '') || null
      
      // Preparar dados novos
      const dadosNovos = {
        nome: membroData.nome.trim(),
        telefone: telefoneNormalizado,
        sexo: membroData.sexo || null,
        data_nascimento: membroData.data_nascimento || null,
        estado_civil: membroData.estado_civil || null,
        necessidades_especiais: membroData.necessidades_especiais?.trim() || null,
        cep: cepNormalizado,
        cidade: membroData.cidade?.trim() || null,
        bairro: membroData.bairro?.trim() || null,
        estado: membroData.estado || null,
        endereco: membroData.endereco?.trim() || null,
        profissao: membroData.profissao?.trim() || null,
      }
      
      // Preparar dados antigos (apenas os campos que serão comparados)
      const dadosAntigos = {
        nome: currentProfile.nome,
        telefone: currentProfile.telefone,
        sexo: currentProfile.sexo,
        data_nascimento: currentProfile.data_nascimento,
        estado_civil: currentProfile.estado_civil,
        necessidades_especiais: currentProfile.necessidades_especiais,
        cep: currentProfile.cep,
        cidade: currentProfile.cidade,
        bairro: currentProfile.bairro,
        estado: currentProfile.estado,
        endereco: currentProfile.endereco,
        profissao: currentProfile.profissao,
      }
      
      // Verificar se há alterações reais
      const hasChanges = Object.keys(dadosNovos).some(key => {
        const novoValor = dadosNovos[key as keyof typeof dadosNovos]
        const antigoValor = dadosAntigos[key as keyof typeof dadosAntigos]
        return novoValor !== antigoValor
      })
      
      if (!hasChanges) {
        return new Response(
          JSON.stringify({ success: true, message: 'Nenhuma alteração detectada', pending: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Inserir na tabela de alterações pendentes
      const { data: pendingChange, error: insertError } = await supabase
        .from('alteracoes_perfil_pendentes')
        .insert({
          profile_id: membroData.id,
          dados_novos: dadosNovos,
          dados_antigos: dadosAntigos,
          status: 'pendente',
        })
        .select()
        .single()
      
      if (insertError) throw insertError
      
      console.log(`[cadastro-publico] Alteração pendente criada para: ${currentProfile.nome}`)
      
      // Notificar admins sobre nova alteração pendente
      await supabase.rpc('notify_admins', {
        p_title: 'Nova Alteração de Perfil Pendente',
        p_message: `${currentProfile.nome} enviou uma atualização de cadastro via link externo que precisa ser aprovada.`,
        p_type: 'alteracao_perfil_pendente',
        p_related_user_id: currentProfile.user_id,
        p_metadata: {
          profile_id: membroData.id,
          profile_name: currentProfile.nome,
          pending_change_id: pendingChange.id
        }
      })
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Sua solicitação foi enviada e será analisada pela secretaria da igreja.',
          pending: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('[cadastro-publico] Erro:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
