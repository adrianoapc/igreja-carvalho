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

  // Aceitar evento_id opcional no body para disparo manual
  let eventoIdManual: string | null = null;
  try {
    const body = await req.json();
    eventoIdManual = body?.evento_id || null;
  } catch {
    // Body vazio (chamada do cron) — segue fluxo padrão
  }

  let eventos: any[] = [];

  if (eventoIdManual) {
    // Disparo manual: buscar apenas o evento específico
    const { data, error } = await supabase
      .from("eventos")
      .select("id, titulo, data_evento, local, igreja_id, requer_pagamento, status")
      .eq("id", eventoIdManual)
      .neq("status", "cancelado")
      .single();

    if (error || !data) {
      console.error("Erro ao buscar evento:", error);
      return new Response(
        JSON.stringify({ success: false, error: error?.message || "Evento não encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }
    eventos = [data];
  } else {
    // Disparo automático (cron): janela 24-48h
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("eventos")
      .select("id, titulo, data_evento, local, igreja_id, requer_pagamento, status")
      .gte("data_evento", in24h)
      .lte("data_evento", in48h)
      .neq("status", "cancelado");

    if (error) {
      console.error("Erro ao buscar eventos:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    eventos = data || [];
  }

  if (eventos.length === 0) {
    console.log("Nenhum evento encontrado.");
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

  console.log(`Encontrados ${eventos.length} evento(s) para processar`);

  let lembretesEnviados = 0;
  let erros = 0;
  const now = new Date();

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
      query = query.in("status_pagamento", ["pago", "isento"]);
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
    const dataEvento = new Date(evento.data_evento);
    const dataFormatada = dataEvento.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const horaFormatada = dataEvento.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });

    const localTexto = evento.local ? `, na ${evento.local}` : "";

    // Determinar se o evento é hoje ou amanhã
    const hoje = new Date();
    const hojeStr = hoje.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const eventoStr = dataEvento.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const quandoTexto = hojeStr === eventoStr ? "hoje" : "amanhã";

    for (const inscricao of inscricoes) {
      const nome = inscricao.pessoa?.nome || "Inscrito";
      const mensagem = `Lembrete: o evento "${evento.titulo}" acontece ${quandoTexto}, dia ${dataFormatada} às ${horaFormatada}${localTexto}. Nos vemos lá!`;

      try {
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
              igreja_id: evento.igreja_id,
            },
            user_id_alvo: inscricao.pessoa_id,
          },
        });

        if (alertaError) {
          console.error(`Erro ao disparar alerta para ${inscricao.pessoa_id}:`, alertaError);
          erros++;
          continue;
        }

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
      manual: !!eventoIdManual,
    }),
  });

  console.log(`Concluido: ${lembretesEnviados} lembretes enviados, ${erros} erros`);

  return new Response(
    JSON.stringify({ success: true, lembretesEnviados, erros }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
