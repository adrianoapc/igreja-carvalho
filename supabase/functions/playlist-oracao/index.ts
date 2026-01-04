import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[playlist-oracao] Iniciando geração de playlist...");

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Pega o body da requisição para ver se tem evento_id
    const { evento_id, igreja_id: igrejaId } = await req.json().catch(() => ({ evento_id: null }));
    const igrejaIdFromQuery = new URL(req.url).searchParams.get("igreja_id");
    const resolvedIgrejaId = igrejaId ?? igrejaIdFromQuery;

    if (!resolvedIgrejaId) {
      return new Response(
        JSON.stringify({ error: "igreja_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[playlist-oracao] evento_id recebido:", evento_id);

    // --- 1. BLOCO ALERTA & GRATIDÃO (Inteligência Espiritual) ---
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    console.log("[playlist-oracao] Buscando sentimentos das últimas 24h...");
    const { data: sentimentos, error: errSentimentos } = await supabaseClient
      .from("sentimentos_membros")
      .select("sentimento, analise_ia_motivo")
      .eq("igreja_id", resolvedIgrejaId)
      .gte("created_at", ontem.toISOString());

    if (errSentimentos) {
      console.error(
        "[playlist-oracao] Erro ao buscar sentimentos:",
        errSentimentos.message
      );
    }

    let alertaEspiritual = null;
    if (sentimentos && sentimentos.length > 0) {
      const negativos = sentimentos.filter((s: any) =>
        [
          "triste",
          "cansado",
          "ansioso",
          "desanimado",
          "luto",
          "angustiado",
          "sozinho",
          "doente",
          "com_pouca_fe",
          "com_medo",
        ].includes(s.sentimento)
      ).length;

      const ratio = negativos / sentimentos.length;
      const motivo =
        sentimentos.find((s: any) => s.analise_ia_motivo)?.analise_ia_motivo ||
        "Fortalecimento da fé";

      alertaEspiritual = {
        tipo: ratio > 0.3 ? "CLAMOR" : "GRATIDAO",
        titulo: ratio > 0.3 ? "Alerta de Intercessão" : "Celebração",
        mensagem:
          ratio > 0.3
            ? `Muitos irmãos estão abatidos. Oremos por: ${motivo}.`
            : `A igreja está alegre! Agradeça por: ${motivo}.`,
        totalSentimentos: sentimentos.length,
        percentualNegativos: Math.round(ratio * 100),
      };
      console.log(
        `[playlist-oracao] Alerta espiritual: ${alertaEspiritual.tipo} (${alertaEspiritual.percentualNegativos}% negativos)`
      );
    }

    // --- 2. TESTEMUNHOS (Últimos 3 públicos) ---
    console.log("[playlist-oracao] Buscando testemunhos públicos...");
    const { data: testemunhos, error: errTestemunhos } = await supabaseClient
      .from("testemunhos")
      .select("id, titulo, mensagem, categoria, anonimo")
      .eq("status", "publico")
      .eq("igreja_id", resolvedIgrejaId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (errTestemunhos) {
      console.error(
        "[playlist-oracao] Erro ao buscar testemunhos:",
        errTestemunhos.message
      );
    }

    // --- 3. BLOCO CRM (Visitantes da Semana) ---
    const semanaPassada = new Date();
    semanaPassada.setDate(semanaPassada.getDate() - 7);

    console.log("[playlist-oracao] Buscando visitantes recentes...");
    const { data: visitantes, error: errVisitantes } = await supabaseClient
      .from("visitantes_leads")
      .select("id, nome, estagio_funil, origem")
      .eq("igreja_id", resolvedIgrejaId)
      .gte("created_at", semanaPassada.toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    if (errVisitantes) {
      console.error(
        "[playlist-oracao] Erro ao buscar visitantes:",
        errVisitantes.message
      );
    }

    // --- 4. BLOCO INTERCESSÃO ---
    // A. Broadcast (Pedidos gerais para toda a igreja)
    console.log("[playlist-oracao] Buscando pedidos BROADCAST...");
    const { data: broadcast, error: errBroadcast } = await supabaseClient
      .from("pedidos_oracao")
      .select(
        "id, pedido, tipo, nome_solicitante, analise_ia_gravidade, analise_ia_titulo, anonimo"
      )
      .eq("status", "em_oracao")
      .eq("classificacao", "BROADCAST")
      .eq("igreja_id", resolvedIgrejaId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (errBroadcast) {
      console.error(
        "[playlist-oracao] Erro ao buscar broadcast:",
        errBroadcast.message
      );
    }

    // B. Pessoais (Pedidos individuais)
    console.log("[playlist-oracao] Buscando pedidos PESSOAIS...");
    const { data: pessoais, error: errPessoais } = await supabaseClient
      .from("pedidos_oracao")
      .select("id, pedido, tipo, nome_solicitante, anonimo")
      .eq("status", "em_oracao")
      .eq("classificacao", "PESSOAL")
      .eq("igreja_id", resolvedIgrejaId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (errPessoais) {
      console.error(
        "[playlist-oracao] Erro ao buscar pessoais:",
        errPessoais.message
      );
    }

    // --- 5. BUSCAR LITURGIA SE evento_id FOI FORNECIDO ---
    let slides = null;
    if (evento_id) {
      console.log("[playlist-oracao] Buscando liturgia do evento:", evento_id);
      const { data: liturgiaData, error: errLiturgia } = await supabaseClient
        .from("liturgias")
        .select("*")
        .eq("evento_id", evento_id)
        .eq("igreja_id", resolvedIgrejaId)
        .order("ordem", { ascending: true });

      if (errLiturgia) {
        console.error(
          "[playlist-oracao] Erro ao buscar liturgia:",
          errLiturgia.message
        );
      }

      if (liturgiaData && liturgiaData.length > 0) {
        console.log(
          `[playlist-oracao] Liturgia encontrada: ${liturgiaData.length} itens`
        );

        // Mapeia liturgia para formato de slides
        slides = liturgiaData.map((item: any) => ({
          id: item.id,
          tipo: item.tipo || "AVISO",
          titulo: item.titulo || "Momento de Oração",
          conteudo: item.descricao || "",
          duracao_sugerida_min: item.duracao_minutos || 5,
          ordem: item.ordem,
        }));

        // Adiciona slides inteligentes ao roteiro
        const slidesInteligentes: any[] = [];

        // A. TESTEMUNHOS
        if (testemunhos && testemunhos.length > 0) {
          slidesInteligentes.push({
            id: "gratidao-auto",
            tipo: "CUSTOM_TESTEMUNHO",
            titulo: "Tempo de Gratidão",
            conteudo: JSON.stringify(testemunhos),
            duracao_sugerida_min: 3,
            ordem: 1.1,
          });
        }

        // B. ALERTA ESPIRITUAL
        if (alertaEspiritual) {
          slidesInteligentes.push({
            id: "insight-auto",
            tipo: "CUSTOM_SENTIMENTO",
            titulo: "Termômetro Espiritual",
            conteudo: JSON.stringify([alertaEspiritual]),
            duracao_sugerida_min: 2,
            ordem: 1.2,
          });
        }

        // C. VISITANTES
        if (visitantes && visitantes.length > 0) {
          slidesInteligentes.push({
            id: "visitantes-auto",
            tipo: "CUSTOM_VISITANTES",
            titulo: "Vidas Novas",
            conteudo: JSON.stringify(visitantes),
            duracao_sugerida_min: 3,
            ordem: 1.3,
          });
        }

        // D. BROADCAST
        if (broadcast && broadcast.length > 0) {
          slidesInteligentes.push({
            id: "broadcast-auto",
            tipo: "PEDIDOS",
            titulo: "Prioridades do Reino",
            conteudo: JSON.stringify(broadcast),
            duracao_sugerida_min: 5,
            ordem: 1.4,
          });
        }

        // E. PESSOAIS
        if (pessoais && pessoais.length > 0) {
          slidesInteligentes.push({
            id: "pessoais-auto",
            tipo: "PEDIDOS",
            titulo: "Carga de Intercessão",
            conteudo: JSON.stringify(pessoais),
            duracao_sugerida_min: 10,
            ordem: 1.5,
          });
        }

        // Combina liturgia + slides inteligentes e reordena
        slides = [...slides, ...slidesInteligentes].sort(
          (a, b) => a.ordem - b.ordem
        );
        console.log(
          `[playlist-oracao] Slides totais (liturgia + inteligentes): ${slides.length}`
        );
      }
    }

    // --- RESPOSTA FINAL ---
    const playlist = {
      alerta: alertaEspiritual,
      testemunhos: testemunhos || [],
      visitantes: visitantes || [],
      broadcast: (broadcast || []).map((p: any) => ({
        ...p,
        nome_solicitante: p.anonimo ? "Anônimo" : p.nome_solicitante,
      })),
      pessoais: (pessoais || []).map((p: any) => ({
        ...p,
        nome_solicitante: p.anonimo ? "Anônimo" : p.nome_solicitante,
      })),
      slides: slides, // Slides prontos se evento_id foi fornecido
      geradoEm: new Date().toISOString(),
    };

    const executionTime = Date.now() - startTime;
    console.log(`[playlist-oracao] Playlist gerada em ${executionTime}ms:`, {
      alertaTipo: alertaEspiritual?.tipo,
      testemunhosCount: testemunhos?.length || 0,
      visitantesCount: visitantes?.length || 0,
      broadcastCount: broadcast?.length || 0,
      pessoaisCount: pessoais?.length || 0,
      slidesCount: slides?.length || 0,
      comLiturgia: !!slides,
    });

    return new Response(JSON.stringify(playlist), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[playlist-oracao] Erro fatal:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
