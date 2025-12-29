/**
 * Edge Function: verificar-escalas-pendentes
 * 
 * Verifica escalas pendentes de confirmação e envia lembretes automáticos
 * para voluntários cujos cultos acontecerão entre 24h e 48h.
 * 
 * ANTI-SPAM: Só envia se ultimo_aviso_em é NULL ou > 24h atrás.
 * 
 * ============================================================================
 * SQL PARA AGENDAR CRON (rodar no SQL Editor do Supabase):
 * ============================================================================
 * 
 * -- Habilitar extensões necessárias (se ainda não estiverem habilitadas)
 * CREATE EXTENSION IF NOT EXISTS pg_cron;
 * CREATE EXTENSION IF NOT EXISTS pg_net;
 * 
 * -- Agendar execução diária às 09:00 AM (horário UTC, ajuste conforme timezone)
 * -- Para Brasil (UTC-3), use '0 12 * * *' para rodar às 09:00 BRT
 * SELECT cron.schedule(
 *   'lembrete-diario-escalas',
 *   '0 12 * * *',
 *   $$
 *   SELECT net.http_post(
 *       url:='https://mcomwaelbwvyotvudnzt.supabase.co/functions/v1/verificar-escalas-pendentes',
 *       headers:=jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
 *       ),
 *       body:='{}'::jsonb
 *   ) as request_id;
 *   $$
 * );
 * 
 * -- Alternativa com chave hardcoded (menos seguro, mas funcional):
 * -- SELECT cron.schedule(
 * --   'lembrete-diario-escalas',
 * --   '0 12 * * *',
 * --   $$
 * --   SELECT net.http_post(
 * --       url:='https://mcomwaelbwvyotvudnzt.supabase.co/functions/v1/verificar-escalas-pendentes',
 * --       headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
 * --       body:='{}'::jsonb
 * --   ) as request_id;
 * --   $$
 * -- );
 * 
 * -- Para verificar jobs agendados:
 * -- SELECT * FROM cron.job;
 * 
 * -- Para remover o job:
 * -- SELECT cron.unschedule('lembrete-diario-escalas');
 * 
 * ============================================================================
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🔔 Iniciando verificação de escalas pendentes...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar configuração de WhatsApp na igreja
    const { data: configIgreja, error: configError } = await supabase
      .from('configuracoes_igreja')
      .select('whatsapp_provider')
      .limit(1)
      .single();

    if (configError) {
      console.error('Erro ao buscar configurações:', configError);
    }

    const whatsappProvider = configIgreja?.whatsapp_provider;
    if (!whatsappProvider || whatsappProvider === 'nenhum') {
      console.log('⚠️ WhatsApp desativado nas configurações - abortando envio');
      return new Response(
        JSON.stringify({
          sucesso: false,
          mensagem: "WhatsApp desativado nas configurações da igreja",
          lembretes_enviados: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calcular janela de tempo: entre 24h e 48h a partir de agora
    const agora = new Date();
    const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const em48h = new Date(agora.getTime() + 48 * 60 * 60 * 1000);
    
    // Calcular timestamp de 24h atrás para filtro anti-spam
    const ha24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    console.log(`📅 Buscando cultos entre ${em24h.toISOString()} e ${em48h.toISOString()}`);
    console.log(`🛡️ Filtro anti-spam: ultimo_aviso_em < ${ha24h.toISOString()}`);

    // Buscar escalas pendentes cujos cultos estão na janela de 24-48h
    // COM FILTRO ANTI-SPAM: só onde ultimo_aviso_em é NULL ou > 24h atrás
    const { data: escalasPendentes, error: escalasError } = await supabase
      .from("escalas_culto")
      .select(`
        id,
        pessoa_id,
        culto_id,
        time_id,
        status_confirmacao,
        ultimo_aviso_em,
        culto:cultos!escalas_culto_culto_id_fkey (
          id,
          titulo,
          data_culto,
          local
        ),
        time:times_culto!escalas_culto_time_id_fkey (
          id,
          nome
        ),
        pessoa:profiles!escalas_culto_pessoa_id_fkey (
          id,
          nome,
          user_id
        )
      `)
      .eq("status_confirmacao", "pendente")
      .gte("culto.data_culto", em24h.toISOString())
      .lte("culto.data_culto", em48h.toISOString());

    if (escalasError) {
      console.error("Erro ao buscar escalas pendentes:", escalasError);
      throw new Error(`Erro ao buscar escalas: ${escalasError.message}`);
    }

    // Filtrar registros válidos E aplicar filtro anti-spam no código
    // (Supabase não suporta OR com IS NULL em .or() facilmente)
    const escalasValidas = (escalasPendentes || []).filter((e: Record<string, unknown>) => {
      if (!e.culto || !e.pessoa || !e.time) return false;
      
      // Filtro anti-spam: só enviar se ultimo_aviso_em é NULL ou > 24h atrás
      if (e.ultimo_aviso_em) {
        const ultimoAviso = new Date(e.ultimo_aviso_em);
        if (ultimoAviso >= ha24h) {
          console.log(`⏳ Pulando ${e.pessoa?.nome} - notificado recentemente em ${e.ultimo_aviso_em}`);
          return false;
        }
      }
      
      return true;
    });

    console.log(`📋 Encontradas ${escalasValidas.length} escala(s) pendente(s) elegíveis para lembrete`);

    if (escalasValidas.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: true,
          mensagem: "Nenhuma escala pendente encontrada ou todas já foram notificadas nas últimas 24h",
          lembretes_enviados: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let lembretes_enviados = 0;
    const erros: string[] = [];
    const escalaIdsEnviados: string[] = [];

    // Processar cada escala pendente
    for (const escalaRaw of escalasValidas) {
      try {
        // Cast para Record para evitar problemas com tipos do Supabase
        const escala = escalaRaw as Record<string, unknown>;
        const pessoa = escala.pessoa;
        const culto = escala.culto;
        const time = escala.time;

        // Verificar se a pessoa tem user_id (é um usuário autenticado)
        if (!pessoa?.user_id) {
          console.log(`⚠️ Pessoa ${pessoa?.nome || 'desconhecida'} não tem user_id, pulando...`);
          continue;
        }

        // Calcular se é amanhã ou depois
        const dataCulto = new Date(culto.data_culto);
        const horasAteEvento = Math.round((dataCulto.getTime() - agora.getTime()) / (1000 * 60 * 60));
        const tempoTexto = horasAteEvento <= 24 ? "amanhã" : "em breve";

        // Formatar data para exibição
        const dataFormatada = dataCulto.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        // Montar mensagem personalizada
        const primeiroNome = pessoa.nome?.split(" ")[0] || "voluntário";
        const mensagem = `Olá, ${primeiroNome}! 👋\n\n` +
          `O culto "${culto.titulo}" é ${tempoTexto} (${dataFormatada}) ` +
          `e ainda não recebemos sua confirmação para o time ${time.nome}.\n\n` +
          `Pode confirmar sua presença pelo App? 🙏`;

        console.log(`📨 Enviando lembrete para ${pessoa.nome} (${pessoa.id})`);

        // Chamar disparar-alerta
        const { error: alertaError } = await supabase.functions.invoke("disparar-alerta", {
          body: {
            evento: "lembrete_escala",
            dados: {
              culto_titulo: culto.titulo,
              culto_data: dataFormatada,
              time_nome: time.nome,
              pessoa_nome: pessoa.nome,
              mensagem: mensagem,
            },
            user_id_alvo: pessoa.id,
          },
        });

        if (alertaError) {
          console.error(`Erro ao enviar alerta para ${pessoa.nome}:`, alertaError);
          erros.push(`${pessoa.nome}: ${alertaError.message}`);
        } else {
          console.log(`✅ Lembrete enviado para ${pessoa.nome}`);
          lembretes_enviados++;
          escalaIdsEnviados.push(escala.id);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
        console.error(`Erro ao processar escala ${escalaRaw.id}:`, errorMsg);
        erros.push(`Escala ${escalaRaw.id}: ${errorMsg}`);
      }
    }

    // Atualizar ultimo_aviso_em para escalas enviadas com sucesso
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

    console.log(`\n✨ Verificação concluída: ${lembretes_enviados} lembrete(s) enviado(s)`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        escalas_verificadas: escalasValidas.length,
        lembretes_enviados,
        erros: erros.length > 0 ? erros : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
