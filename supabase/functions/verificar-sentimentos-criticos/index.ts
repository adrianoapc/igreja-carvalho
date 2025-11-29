import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SentimentoRegistro {
  data_registro: string;
  sentimento: string;
  pessoa_id: string;
}

interface PessoaInfo {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Iniciando verificação de sentimentos críticos...');

    // Buscar todos os sentimentos dos últimos 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const { data: sentimentos, error: sentimentosError } = await supabase
      .from('sentimentos_membros')
      .select('pessoa_id, sentimento, data_registro')
      .gte('data_registro', seteDiasAtras.toISOString())
      .order('pessoa_id', { ascending: true })
      .order('data_registro', { ascending: true });

    if (sentimentosError) {
      console.error('Erro ao buscar sentimentos:', sentimentosError);
      throw sentimentosError;
    }

    console.log(`Total de sentimentos encontrados: ${sentimentos?.length || 0}`);

    // Sentimentos considerados negativos
    const sentimentosNegativos = ['angustiado', 'sozinho', 'triste', 'doente', 'com_pouca_fe'];

    // Agrupar por pessoa
    const sentimentosPorPessoa: Record<string, SentimentoRegistro[]> = {};
    sentimentos?.forEach((s) => {
      if (!sentimentosPorPessoa[s.pessoa_id]) {
        sentimentosPorPessoa[s.pessoa_id] = [];
      }
      sentimentosPorPessoa[s.pessoa_id].push(s);
    });

    const pessoasEmRisco: string[] = [];

    // Verificar cada pessoa
    for (const [pessoaId, registros] of Object.entries(sentimentosPorPessoa)) {
      // Ordenar por data
      registros.sort((a, b) => new Date(a.data_registro).getTime() - new Date(b.data_registro).getTime());

      // Verificar dias consecutivos com sentimentos negativos
      let diasConsecutivos = 0;
      let ultimaData: Date | null = null;

      for (const registro of registros) {
        const dataAtual = new Date(registro.data_registro);
        const dataAtualSemHora = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dataAtual.getDate());

        // Verificar se é sentimento negativo
        if (sentimentosNegativos.includes(registro.sentimento)) {
          // Se é o primeiro ou é consecutivo ao anterior
          if (ultimaData === null) {
            diasConsecutivos = 1;
          } else {
            const ultimaDataSemHora = new Date(ultimaData.getFullYear(), ultimaData.getMonth(), ultimaData.getDate());
            const diffDias = Math.floor((dataAtualSemHora.getTime() - ultimaDataSemHora.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDias === 1) {
              // Dia consecutivo
              diasConsecutivos++;
            } else if (diffDias === 0) {
              // Mesmo dia, não conta como novo dia
              continue;
            } else {
              // Quebrou a sequência
              diasConsecutivos = 1;
            }
          }

          ultimaData = dataAtual;

          // Se atingiu 3 ou mais dias consecutivos
          if (diasConsecutivos >= 3) {
            pessoasEmRisco.push(pessoaId);
            break; // Não precisa verificar mais registros dessa pessoa
          }
        } else {
          // Sentimento positivo quebra a sequência
          diasConsecutivos = 0;
          ultimaData = null;
        }
      }
    }

    console.log(`Pessoas em risco detectadas: ${pessoasEmRisco.length}`);

    // Buscar informações das pessoas em risco
    if (pessoasEmRisco.length > 0) {
      const { data: pessoas, error: pessoasError } = await supabase
        .from('profiles')
        .select('id, nome, email, telefone')
        .in('id', pessoasEmRisco);

      if (pessoasError) {
        console.error('Erro ao buscar informações das pessoas:', pessoasError);
        throw pessoasError;
      }

      // Criar notificações para cada pessoa em risco
      for (const pessoa of pessoas || []) {
        console.log(`Notificando sobre ${pessoa.nome}...`);

        // Usar a função notify_admins para criar notificações
        const { error: notifyError } = await supabase.rpc('notify_admins', {
          p_title: 'Alerta: Membro com Sentimentos Negativos Repetidos',
          p_message: `${pessoa.nome} registrou sentimentos negativos por 3 ou mais dias consecutivos. Considere fazer um acompanhamento pastoral.`,
          p_type: 'alerta_sentimento_critico',
          p_related_user_id: null,
          p_metadata: {
            pessoa_id: pessoa.id,
            pessoa_nome: pessoa.nome,
            pessoa_email: pessoa.email,
            pessoa_telefone: pessoa.telefone,
            data_alerta: new Date().toISOString()
          }
        });

        if (notifyError) {
          console.error(`Erro ao notificar sobre ${pessoa.nome}:`, notifyError);
        } else {
          console.log(`Notificação criada com sucesso para ${pessoa.nome}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pessoasVerificadas: Object.keys(sentimentosPorPessoa).length,
        pessoasEmRisco: pessoasEmRisco.length,
        message: `Verificação concluída. ${pessoasEmRisco.length} pessoa(s) em risco detectada(s).`
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Erro na verificação de sentimentos críticos:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
