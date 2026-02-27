import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  // Buscar eventos que acontecem entre 24h e 48h a partir de agora
  const { data: eventos, error: eventosError } = await supabase
    .from("eventos")
    .select("id, titulo, data_inicio, local, igreja_id, requer_pagamento, status")
    .gte("data_inicio", in24h)
    .lte("data_inicio", in48h)
    .neq("status", "cancelado");

  if (eventosError) {
    console.error("Erro ao buscar eventos:", eventosError);
    return new Response(
      JSON.stringify({ success: false, error: eventosError.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  if (!eventos || eventos.length === 0) {
    console.log("Nenhum evento nas proximas 24-48h.");
    await supabase.rpc("log_edge_function_execution", {
      p_function_name: "inscricoes-lembrete-evento",
      p_status: "success",
      p_details: JSON.stringify({ lembretesEnviados: 0, eventosEncontrados: 0 }),
    });
    return new Response(
      JSON.stringify({ success: true, lembretesEnviados: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Encontrados ${eventos.length} evento(s) nas proximas 24-48h`);

  let lembretesEnviados = 0;
  let erros = 0;

  for (const evento of eventos) {
    // Buscar inscricoes confirmadas (ou sem exigência de pagamento) sem lembrete enviado
    let query = supabase
      .from("inscricoes_eventos")
      .select(`
        id,
        pessoa_id,
        igreja_id,
        pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (nome, telefone)
      `)
      .eq("evento_id", evento.id)
      .is("lembrete_evento_em", null);

    if (evento.requer_pagamento) {
      query = query.eq("status_pagamento", "confirmado");
    }

    const { data: inscricoes, error: inscError } = await query;

    if (inscError) {
      console.error(`Erro ao buscar inscricoes do evento ${evento.id}:`, inscError);
      erros++;
      continue;
    }

    if (!inscricoes || inscricoes.length === 0) continue;

    console.log(`Evento "${evento.titulo}": ${inscricoes.length} inscrito(s) para notificar`);

    // Formatar data do evento
    const dataEvento = new Date(evento.data_inicio);
    const dataFormatada = dataEvento.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const horaFormatada = dataEvento.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const localTexto = evento.local ? `, no ${evento.local}` : "";

    for (const inscricao of inscricoes) {
      const nome = inscricao.pessoa?.nome || "Inscrito";
      const mensagem = `Lembrete: o evento "${evento.titulo}" acontece amanha, dia ${dataFormatada} as ${horaFormatada}${localTexto}. Nos vemos la!`;

      try {
        // Disparar alerta via edge function disparar-alerta
        const { error: alertaError } = await supabase.functions.invoke("disparar-alerta", {
          body: {
            evento: "lembrete_evento_inscricao",
            dados: {
              nome,
              evento_titulo: evento.titulo,
              evento_data: dataFormatada,
              evento_hora: horaFormatada,
              evento_local: evento.local || "Local a confirmar",
              mensagem,
            },
            user_id_alvo: inscricao.pessoa_id,
          },
        });

        if (alertaError) {
          console.error(`Erro ao disparar alerta para ${inscricao.pessoa_id}:`, alertaError);
          erros++;
          continue;
        }

        // Marcar lembrete como enviado (anti-spam)
        await supabase
          .from("inscricoes_eventos")
          .update({ lembrete_evento_em: now.toISOString() })
          .eq("id", inscricao.id);

        lembretesEnviados++;
      } catch (err) {
        console.error(`Excecao ao processar inscricao ${inscricao.id}:`, err);
        erros++;
      }
    }
  }

  await supabase.rpc("log_edge_function_execution", {
    p_function_name: "inscricoes-lembrete-evento",
    p_status: erros > 0 ? "partial" : "success",
    p_details: JSON.stringify({
      lembretesEnviados,
      erros,
      eventosEncontrados: eventos.length,
    }),
  });

  console.log(`Concluido: ${lembretesEnviados} lembretes enviados, ${erros} erros`);

  return new Response(
    JSON.stringify({ success: true, lembretesEnviados, erros }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
