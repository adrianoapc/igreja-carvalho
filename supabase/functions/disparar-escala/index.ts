import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_ESCALAS');

    if (!webhookUrl) {
      console.error('MAKE_WEBHOOK_ESCALAS não configurado');
      return new Response(
        JSON.stringify({ success: false, message: 'Webhook de escalas não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar dados do culto
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

    // 2. Buscar todos os escalados
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

    // 3. Loop de envio
    let enviados = 0;
    let erros = 0;
    const detalhes: string[] = [];

    for (const escala of escalas) {
      const profile = escala.profiles as any;
      const time = escala.times_culto as any;
      const posicao = escala.posicoes_time as any;

      const nome = profile?.nome || 'Voluntário';
      const telefone = profile?.telefone;

      if (!telefone) {
        console.log(`Pulando ${nome} - sem telefone cadastrado`);
        detalhes.push(`${nome}: sem telefone`);
        continue;
      }

      // Limpar telefone (apenas números)
      const telefoneLimpo = telefone.replace(/\D/g, '');
      const telefoneFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

      // Determinar função/posição
      const funcaoEscala = posicao?.nome || time?.nome || 'Voluntário';

      const payload = {
        telefone: telefoneFormatado,
        nome_voluntario: nome,
        data_culto: dataFormatada,
        funcao_escala: funcaoEscala
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
