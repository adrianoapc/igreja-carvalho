import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { culto_id } = await req.json();

    if (!culto_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'culto_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar configurações da igreja para validar se WhatsApp está ativo
    const { data: configIgreja, error: configError } = await supabase
      .from('configuracoes_igreja')
      .select('whatsapp_provider, whatsapp_token, whatsapp_instance_id')
      .limit(1)
      .single();

    if (configError) {
      console.error('Erro ao buscar configurações:', configError);
    }

    // Verificar se WhatsApp está configurado
    const whatsappProvider = configIgreja?.whatsapp_provider;
    if (!whatsappProvider || whatsappProvider === 'nenhum') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Envio de WhatsApp desativado nas configurações da igreja' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar URL do webhook (env var ou poderia vir da config)
    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_ESCALAS');

    if (!webhookUrl) {
      console.error('MAKE_WEBHOOK_ESCALAS não configurado');
      return new Response(
        JSON.stringify({ success: false, message: 'Webhook de escalas não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Buscar dados do culto
    const { data: culto, error: cultoError } = await supabase
      .from('cultos')
      .select('id, titulo, data_culto')
      .eq('id', culto_id)
      .single();

    if (cultoError || !culto) {
      console.error('Erro ao buscar culto:', cultoError);
      return new Response(
        JSON.stringify({ success: false, message: 'Culto não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar data: "Domingo, 12/10 às 19h"
    const dataCulto = new Date(culto.data_culto);
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const diaSemana = diasSemana[dataCulto.getDay()];
    const dia = dataCulto.getDate().toString().padStart(2, '0');
    const mes = (dataCulto.getMonth() + 1).toString().padStart(2, '0');
    const hora = dataCulto.getHours();
    const minutos = dataCulto.getMinutes();
    const horaFormatada = minutos > 0 ? `${hora}h${minutos.toString().padStart(2, '0')}` : `${hora}h`;
    const dataFormatada = `${diaSemana}, ${dia}/${mes} às ${horaFormatada}`;

    console.log(`Culto: ${culto.titulo} - ${dataFormatada}`);

    // 3. Buscar todos os escalados
    const { data: escalas, error: escalasError } = await supabase
      .from('escalas_culto')
      .select(`
        id,
        pessoa_id,
        time_id,
        posicao_id,
        observacoes,
        profiles:pessoa_id (nome, telefone),
        times_culto:time_id (nome),
        posicoes_time:posicao_id (nome)
      `)
      .eq('culto_id', culto_id);

    if (escalasError) {
      console.error('Erro ao buscar escalas:', escalasError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao buscar escalados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!escalas || escalas.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum escalado encontrado', enviados: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Total de escalados: ${escalas.length}`);

    // 4. Loop de envio
    let enviados = 0;
    let erros = 0;
    const detalhes: string[] = [];
    const escalaIdsEnviados: string[] = [];

    for (const escala of escalas) {
      const profileData = escala.profiles as { nome?: string; telefone?: string } | { nome?: string; telefone?: string }[] | null;
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      const timeData = escala.times_culto as { nome?: string } | { nome?: string }[] | null;
      const time = Array.isArray(timeData) ? timeData[0] : timeData;
      const posicaoData = escala.posicoes_time as { nome?: string } | { nome?: string }[] | null;
      const posicao = Array.isArray(posicaoData) ? posicaoData[0] : posicaoData;

      const nome = profile?.nome || 'Voluntário';
      const telefone = profile?.telefone;

      if (!telefone) {
        console.log(`Pulando ${nome} - sem telefone cadastrado`);
        detalhes.push(`${nome}: sem telefone`);
        continue;
      }

      // Limpar telefone (apenas números)
      const telefoneLimpo = String(telefone).replace(/\D/g, '');
      const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

      // Determinar função/posição
      const funcaoEscala = posicao?.nome || time?.nome || 'Voluntário';
      
      // Incluir observações se existirem (contém itens da liturgia, etc.)
      const observacoesEscala = escala.observacoes || '';

      const payload = {
        telefone: telefoneFormatado,
        nome_voluntario: nome,
        data_culto: dataFormatada,
        funcao_escala: funcaoEscala,
        observacoes: observacoesEscala,
        // Campo completo com função + observações para facilitar uso no Make
        descricao_completa: observacoesEscala ? `${funcaoEscala}: ${observacoesEscala}` : funcaoEscala
      };

      console.log(`Enviando para ${nome} (${telefoneFormatado}): ${funcaoEscala}`);

      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (webhookResponse.ok) {
          enviados++;
          detalhes.push(`${nome}: enviado`);
          escalaIdsEnviados.push(escala.id);
          console.log(`✓ Enviado para ${nome}`);
        } else {
          erros++;
          const errorText = await webhookResponse.text();
          detalhes.push(`${nome}: erro - ${webhookResponse.status}`);
          console.error(`✗ Erro ao enviar para ${nome}:`, errorText);
        }
      } catch (err) {
        erros++;
        detalhes.push(`${nome}: erro de conexão`);
        console.error(`✗ Erro de conexão para ${nome}:`, err);
      }
    }

    // 5. Atualizar ultimo_aviso_em para escalas enviadas com sucesso
    if (escalaIdsEnviados.length > 0) {
      const { error: updateError } = await supabase
        .from('escalas_culto')
        .update({ ultimo_aviso_em: new Date().toISOString() })
        .in('id', escalaIdsEnviados);

      if (updateError) {
        console.error('Erro ao atualizar ultimo_aviso_em:', updateError);
      } else {
        console.log(`✓ Atualizado ultimo_aviso_em para ${escalaIdsEnviados.length} escalas`);
      }
    }

    console.log(`Resumo: ${enviados} enviados, ${erros} erros`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notificações enviadas: ${enviados} de ${escalas.length}`,
        enviados,
        erros,
        total: escalas.length,
        detalhes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
