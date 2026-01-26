import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_URL = Deno.env.get("APP_URL") || "https://appcarvalho.lovable.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const isYes = (text: string) =>
  ["sim", "s", "ok", "confirmo", "confirmar"].includes(text);

const isNo = (text: string) =>
  ["nao", "não", "n", "corrigir", "errado"].includes(text);

const normalizeText = (text: string | null | undefined) =>
  (text || "").trim().toLowerCase();

const normalizePhone = (telefone: string) => {
  const digits = telefone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }
  return digits;
};

const normalizeDisplayPhone = (telefone?: string | null) =>
  (telefone || "").replace(/\D/g, "");

const extractDestino = (payload: Record<string, unknown>) => {
  const metadata = (payload.metadata || payload.meta || {}) as Record<
    string,
    unknown
  >;
  const messages = Array.isArray(payload.messages)
    ? (payload.messages as Array<Record<string, unknown>>)
    : [];
  const messageMetadata = (messages[0]?.metadata || {}) as Record<
    string,
    unknown
  >;

  const displayPhoneNumber =
    (payload.display_phone_number as string | undefined) ||
    (payload.whatsapp_number as string | undefined) ||
    (metadata.display_phone_number as string | undefined) ||
    (messageMetadata.display_phone_number as string | undefined) ||
    (payload.telefone_destino as string | undefined) ||
    (payload.to as string | undefined) ||
    undefined;

  if (displayPhoneNumber) {
    console.log(
      `[Compartilhe] Número destino identificado: ${displayPhoneNumber}`
    );
  }

  return {
    phoneNumberId:
      (payload.phone_number_id as string | undefined) ||
      (metadata.phone_number_id as string | undefined) ||
      (messageMetadata.phone_number_id as string | undefined) ||
      undefined,
    displayPhoneNumber,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const body = await req.json();
  let igrejaId = body.igreja_id ?? body.igrejaId ?? null;
  let filialId = body.filial_id ?? body.filialId ?? null;
  const destino = extractDestino(body as Record<string, unknown>);
  const destinoDisplay = normalizeDisplayPhone(destino.displayPhoneNumber);
  const telefoneRaw = body.telefone ?? body.from ?? body?.contacts?.[0]?.wa_id;
  const nomePerfil =
    body.nome ?? body.nome_perfil ?? body?.contacts?.[0]?.profile?.name ?? "";
  const mensagem =
    body.mensagem ??
    body.text ??
    body.message ??
    body?.messages?.[0]?.text?.body ??
    "";

  if (!telefoneRaw) {
    return new Response(
      JSON.stringify({ success: false, message: "Telefone nao informado" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!igrejaId) {
    let query = supabase
      .from("whatsapp_numeros")
      .select("igreja_id, filial_id")
      .eq("enabled", true);

    if (destino.phoneNumberId) {
      query = query.eq("phone_number_id", destino.phoneNumberId);
    } else if (destinoDisplay) {
      query = query.eq("display_phone_number", destinoDisplay);
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data: rota } = await query.maybeSingle();
    igrejaId = rota?.igreja_id ?? null;
    filialId = rota?.filial_id ?? null;
  } else if (!filialId && (destino.phoneNumberId || destinoDisplay)) {
    let query = supabase
      .from("whatsapp_numeros")
      .select("filial_id")
      .eq("enabled", true)
      .eq("igreja_id", igrejaId);

    if (destino.phoneNumberId) {
      query = query.eq("phone_number_id", destino.phoneNumberId);
    } else if (destinoDisplay) {
      query = query.eq("display_phone_number", destinoDisplay);
    }

    const { data: rota } = await query.maybeSingle();
    filialId = rota?.filial_id ?? filialId;
  }

  if (!igrejaId) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Nao foi possivel identificar a igreja.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const telefone = normalizePhone(String(telefoneRaw));
  const texto = normalizeText(mensagem);
  const origemCanal = "whatsapp_compartilhe"; // FIXO para não conflitar com triagem

  // Busca sessão de INSCRIÇÃO (origem_canal específico)
  const { data: sessao } = await supabase
    .from("atendimentos_bot")
    .select("*")
    .eq("telefone", telefone)
    .eq("origem_canal", origemCanal)
    .eq("igreja_id", igrejaId)
    // Escopo por número de envio (quando disponível)
    .contains(
      "meta_dados",
      destino.phoneNumberId ? { phone_number_id: destino.phoneNumberId } : {}
    )
    .neq("status", "CONCLUIDO")
    .gt("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();

  let sessaoAtual = sessao;

  if (!sessaoAtual && !texto.includes("compartilhe")) {
    return new Response(
      JSON.stringify({
        reply_message: "Para iniciar a inscricao, envie a palavra COMPARTILHE.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!sessaoAtual) {
    const { data: novaSessao, error } = await supabase
      .from("atendimentos_bot")
      .insert({
        telefone,
        status: "EM_ANDAMENTO",
        origem_canal: origemCanal,
        igreja_id: igrejaId,
        filial_id: filialId,
        meta_dados: {
          flow: "compartilhe",
          step: "confirmacao",
          nome_informado: nomePerfil,
          phone_number_id: destino.phoneNumberId ?? null,
          display_phone_number: destinoDisplay || null,
        },
      })
      .select()
      .single();

    if (error || !novaSessao) {
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao iniciar sessao" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    sessaoAtual = novaSessao;
  }

  const meta = (sessaoAtual.meta_dados as Record<string, unknown>) || {};
  const step = (meta.step as string) || "confirmacao";
  const nomeInformado = (meta.nome_informado as string) || nomePerfil || "";

  if (step === "confirmacao") {
    if (isYes(texto)) {
      // Continue to inscription
    } else if (isNo(texto)) {
      await supabase
        .from("atendimentos_bot")
        .update({ meta_dados: { ...meta, step: "correcao" } })
        .eq("id", sessaoAtual.id);

      return new Response(
        JSON.stringify({
          reply_message: "Qual o nome correto para a inscricao?",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const confirmacao = `Confirme seus dados: Nome ${
        nomeInformado || "(nao informado)"
      }, Telefone ${telefone}. Responda SIM ou NAO.`;
      return new Response(JSON.stringify({ reply_message: confirmacao }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (step === "correcao") {
    const nomeCorrigido = mensagem?.trim();
    if (!nomeCorrigido) {
      return new Response(
        JSON.stringify({ reply_message: "Envie o nome correto, por favor." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("atendimentos_bot")
      .update({
        meta_dados: {
          ...meta,
          step: "confirmacao",
          nome_informado: nomeCorrigido,
        },
      })
      .eq("id", sessaoAtual.id);

    const confirmacao = `Confirme seus dados: Nome ${nomeCorrigido}, Telefone ${telefone}. Responda SIM ou NAO.`;
    return new Response(JSON.stringify({ reply_message: confirmacao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // PASSO 1: Buscar pessoa pelo telefone PRIMEIRO (antes de verificar vagas)
  const nomeFinal = nomeInformado || nomePerfil || "Visitante";
  const telefoneBusca = telefone.slice(-9);

  const { data: candidatos } = await supabase
    .from("profiles")
    .select("id, telefone")
    .eq("igreja_id", igrejaId)
    .ilike("telefone", `%${telefoneBusca}%`)
    .limit(5);

  let pessoaId: string | null = null;
  if (candidatos && candidatos.length > 0) {
    const alvo = candidatos.find(
      (p) => normalizePhone(p.telefone || "") === telefone
    );
    pessoaId = alvo?.id ?? candidatos[0].id ?? null;
  }

  // PASSO 2: Se pessoa existe, verificar inscrição ANTES de validar vagas
  if (pessoaId) {
    const { data: inscricaoExistente } = await supabase
      .from("inscricoes_eventos")
      .select("id, qr_token, status_pagamento")
      .eq("pessoa_id", pessoaId)
      .eq("igreja_id", igrejaId)
      .maybeSingle();

    // Se encontrou inscricao existente, precisamos buscar o evento dela
    if (inscricaoExistente && inscricaoExistente.status_pagamento !== "cancelado") {
      const qrLink = `${APP_URL}/inscricao/${inscricaoExistente.qr_token}`;
      const qrImage = `${SUPABASE_URL}/functions/v1/gerar-qrcode-inscricao?token=${inscricaoExistente.qr_token}`;
      await supabase
        .from("atendimentos_bot")
        .update({ status: "CONCLUIDO" })
        .eq("id", sessaoAtual.id);

      return new Response(
        JSON.stringify({
          reply_message: `Voce ja esta inscrito! Seu QR Code: ${qrLink}`,
          qr_url: qrLink,
          qr_image: qrImage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // PASSO 3: Buscar subtipo e evento
  const { data: subtipo } = await supabase
    .from("evento_subtipos")
    .select("id")
    .eq("nome", "Acao Social")
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (!subtipo) {
    return new Response(
      JSON.stringify({
        reply_message: "Nenhum evento de acao social disponível.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const agoraIso = new Date().toISOString();

  let eventoQuery = supabase
    .from("eventos")
    .select(
      "id, titulo, data_evento, status, requer_pagamento, valor_inscricao, vagas_limite, inscricoes_abertas_ate, igreja_id, mostrar_posicao_fila"
    )
    .eq("igreja_id", igrejaId)
    .eq("subtipo_id", subtipo.id)
    .eq("status", "confirmado")
    .gte("data_evento", agoraIso)
    .order("data_evento", { ascending: true })
    .limit(1);

  if (filialId) {
    eventoQuery = eventoQuery.eq("filial_id", filialId);
  }

  const { data: evento } = await eventoQuery.maybeSingle();

  if (!evento) {
    return new Response(
      JSON.stringify({
        reply_message: "Nenhum evento disponivel para inscricao no momento.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (
    evento.inscricoes_abertas_ate &&
    evento.inscricoes_abertas_ate < agoraIso
  ) {
    return new Response(
      JSON.stringify({
        reply_message: "As inscricoes para este evento estao encerradas.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // PASSO 4: Se pessoa existe e evento encontrado, verificar inscricao para ESSE evento
  if (pessoaId) {
    const { data: inscricaoEvento } = await supabase
      .from("inscricoes_eventos")
      .select("id, qr_token, status_pagamento")
      .eq("evento_id", evento.id)
      .eq("pessoa_id", pessoaId)
      .eq("igreja_id", igrejaId)
      .maybeSingle();

    if (inscricaoEvento && inscricaoEvento.status_pagamento !== "cancelado") {
      const qrLink = `${APP_URL}/inscricao/${inscricaoEvento.qr_token}`;
      const qrImage = `${SUPABASE_URL}/functions/v1/gerar-qrcode-inscricao?token=${inscricaoEvento.qr_token}`;
      await supabase
        .from("atendimentos_bot")
        .update({ status: "CONCLUIDO" })
        .eq("id", sessaoAtual.id);

      return new Response(
        JSON.stringify({
          reply_message: `Voce ja esta inscrito! QR: ${qrLink}`,
          qr_url: qrLink,
          qr_image: qrImage,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reativar inscricao cancelada (se houver vagas)
    if (inscricaoEvento && inscricaoEvento.status_pagamento === "cancelado") {
      // Verificar vagas antes de reativar
      if (evento.vagas_limite) {
        const { count } = await supabase
          .from("inscricoes_eventos")
          .select("id", { count: "exact", head: true })
          .eq("evento_id", evento.id)
          .eq("igreja_id", igrejaId)
          .neq("status_pagamento", "cancelado");

        if ((count || 0) >= evento.vagas_limite) {
          // Vagas esgotadas - adicionar à lista de espera
          return await adicionarListaEsperaCompartilhe(
            supabase,
            sessaoAtual,
            evento,
            telefone,
            nomeFinal,
            pessoaId,
            igrejaId,
            filialId,
            corsHeaders
          );
        }
      }

      const statusPagamento = evento.requer_pagamento ? "pendente" : "isento";
      await supabase
        .from("inscricoes_eventos")
        .update({
          status_pagamento: statusPagamento,
          cancelado_em: null,
          lembrete_pagamento_em: null,
        })
        .eq("id", inscricaoEvento.id);

      const qrLink = `${APP_URL}/inscricao/${inscricaoEvento.qr_token}`;
      const qrImage = `${SUPABASE_URL}/functions/v1/gerar-qrcode-inscricao?token=${inscricaoEvento.qr_token}`;
      await supabase
        .from("atendimentos_bot")
        .update({ status: "CONCLUIDO" })
        .eq("id", sessaoAtual.id);

      const mensagemResposta = evento.requer_pagamento
        ? `Inscricao reativada. Sua vaga esta reservada por 24h. QR: ${qrLink}`
        : `Inscricao confirmada. QR: ${qrLink}`;

      return new Response(
        JSON.stringify({ reply_message: mensagemResposta, qr_url: qrLink, qr_image: qrImage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // PASSO 5: Verificar vagas (usuário não está inscrito)
  if (evento.vagas_limite) {
    const { count } = await supabase
      .from("inscricoes_eventos")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", evento.id)
      .eq("igreja_id", igrejaId)
      .neq("status_pagamento", "cancelado");

    if ((count || 0) >= evento.vagas_limite) {
      // Vagas esgotadas - adicionar à lista de espera
      return await adicionarListaEsperaCompartilhe(
        supabase,
        sessaoAtual,
        evento,
        telefone,
        nomeFinal,
        pessoaId,
        igrejaId,
        filialId,
        corsHeaders
      );
    }
  }

  // PASSO 6: Criar pessoa se necessário
  if (!pessoaId) {
    const { data: novaPessoa, error } = await supabase
      .from("profiles")
      .insert({
        nome: nomeFinal,
        telefone,
        status: "visitante",
        igreja_id: igrejaId,
        filial_id: filialId,
      })
      .select("id")
      .single();

    if (error || !novaPessoa) {
      return new Response(
        JSON.stringify({ reply_message: "Erro ao registrar seus dados." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    pessoaId = novaPessoa.id;
  }

  // PASSO 7: Criar nova inscrição
  const statusPagamento = evento.requer_pagamento ? "pendente" : "isento";
  const { data: novaInscricao, error: inscricaoError } = await supabase
    .from("inscricoes_eventos")
    .insert({
      evento_id: evento.id,
      pessoa_id: pessoaId,
      status_pagamento: statusPagamento,
      responsavel_inscricao_id: pessoaId,
      igreja_id: igrejaId,
      filial_id: filialId,
    })
    .select("id, qr_token")
    .single();

  if (inscricaoError || !novaInscricao) {
    return new Response(
      JSON.stringify({ reply_message: "Erro ao criar inscricao." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const qrLink = `${APP_URL}/inscricao/${novaInscricao.qr_token}`;
  const qrImage = `${SUPABASE_URL}/functions/v1/gerar-qrcode-inscricao?token=${novaInscricao.qr_token}`;
  const mensagemResposta = evento.requer_pagamento
    ? `Inscricao registrada. Sua vaga esta reservada por 24h. QR: ${qrLink}`
    : `Inscricao confirmada. QR: ${qrLink}`;

  await supabase
    .from("atendimentos_bot")
    .update({ status: "CONCLUIDO" })
    .eq("id", sessaoAtual.id);

  return new Response(
    JSON.stringify({ reply_message: mensagemResposta, qr_url: qrLink, qr_image: qrImage }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// Função auxiliar para adicionar à lista de espera interna (Compartilhe)
// deno-lint-ignore no-explicit-any
async function adicionarListaEsperaCompartilhe(
  supabaseClient: any,
  sessao: Record<string, unknown>,
  evento: Record<string, unknown>,
  telefone: string,
  nome: string,
  pessoaId: string | null,
  igrejaId: string,
  filialId: string | null,
  corsHeaders: Record<string, string>
): Promise<Response> {
  console.log(`[ListaEspera] Vagas esgotadas para evento ${evento.id}, adicionando ${telefone} à lista`);

  // Buscar ou criar lead
  let leadId: string | null = null;
  const { data: leadExistente } = await supabaseClient
    .from("visitantes_leads")
    .select("id")
    .eq("telefone", telefone)
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (leadExistente) {
    leadId = leadExistente.id;
  } else {
    const { data: novoLead } = await supabaseClient
      .from("visitantes_leads")
      .insert({
        nome,
        telefone,
        origem: "LISTA_ESPERA",
        igreja_id: igrejaId,
        filial_id: filialId,
      })
      .select("id")
      .single();
    leadId = novoLead?.id ?? null;
  }

  // Verificar se já está na lista de espera
  const { data: jaEspera } = await supabaseClient
    .from("evento_lista_espera")
    .select("id, posicao_fila")
    .eq("evento_id", evento.id)
    .eq("telefone", telefone)
    .maybeSingle();

  if (jaEspera) {
    await supabaseClient
      .from("atendimentos_bot")
      .update({ status: "CONCLUIDO" })
      .eq("id", sessao.id);
    console.log(`[ListaEspera] Usuário já na lista: posição ${jaEspera.posicao_fila}`);
    return new Response(
      JSON.stringify({
        reply_message: `Seu interesse ja foi registrado anteriormente! Caso surja uma vaga, entraremos em contato.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Calcular posição na fila
  const { count: posicaoAtual } = await supabaseClient
    .from("evento_lista_espera")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", evento.id);

  const posicao = (posicaoAtual || 0) + 1;

  // Inserir na lista de espera
  await supabaseClient.from("evento_lista_espera").insert({
    evento_id: evento.id,
    nome,
    telefone,
    posicao_fila: posicao,
    status: "aguardando",
    visitante_lead_id: leadId,
    pessoa_id: pessoaId,
    igreja_id: igrejaId,
    filial_id: filialId,
  });

  await supabaseClient
    .from("atendimentos_bot")
    .update({ status: "CONCLUIDO" })
    .eq("id", sessao.id);

  console.log(`[ListaEspera] Usuário adicionado na posição ${posicao}`);

  // Mensagem genérica (sem posição) - ou com posição se configurado
  let mensagem = `As vagas para "${evento.titulo}" estao esgotadas, mas registramos seu interesse! Caso surja uma vaga, entraremos em contato.`;

  if (evento.mostrar_posicao_fila) {
    mensagem = `As vagas estao esgotadas, mas voce foi adicionado a lista de espera! Sua posicao: ${posicao}. Caso surja uma vaga, entraremos em contato.`;
  }

  return new Response(
    JSON.stringify({ reply_message: mensagem }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
