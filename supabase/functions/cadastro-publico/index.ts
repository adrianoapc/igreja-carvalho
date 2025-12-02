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
            observacoes: visitanteData.observacoes?.trim() || null,
            aceitou_jesus: visitanteData.aceitou_jesus || false,
            deseja_contato: visitanteData.deseja_contato ?? true,
            sexo: visitanteData.sexo || null,
            data_nascimento: visitanteData.data_nascimento || null,
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
        .select('id, nome, telefone, email, sexo, data_nascimento, estado_civil, cep, cidade, bairro, estado, endereco, profissao')
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
      
      // Normalizar telefone e CEP
      const telefoneNormalizado = membroData.telefone?.replace(/\D/g, '') || null
      const cepNormalizado = membroData.cep?.replace(/\D/g, '') || null
      
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          nome: membroData.nome.trim(),
          telefone: telefoneNormalizado,
          sexo: membroData.sexo || null,
          data_nascimento: membroData.data_nascimento || null,
          estado_civil: membroData.estado_civil || null,
          cep: cepNormalizado,
          cidade: membroData.cidade?.trim() || null,
          bairro: membroData.bairro?.trim() || null,
          estado: membroData.estado || null,
          endereco: membroData.endereco?.trim() || null,
          profissao: membroData.profissao?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', membroData.id)
        .eq('status', 'membro')
        .select()
        .single()
      
      if (error) throw error
      
      console.log(`[cadastro-publico] Membro atualizado: ${updated.nome}`)
      
      return new Response(
        JSON.stringify({ success: true, data: updated }),
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
