import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o assistente virtual de acolhimento da Igreja Carvalho.
Objetivo: Coletar Nome Real e Motivo de Oração.
Regras:
1. Se for a primeira mensagem, avise sobre a LGPD/Privacidade de forma breve.
2. Seja breve e empático. Não pregue nem prometa milagres.
3. Se detectar risco de vida (suicídio, crime), retorne JSON com "risco": "CRITICO".
4. O campo "texto_na_integra" deve ser a compilação fiel de todo o relato do usuário.
5. Se tiver Nome e Motivo, retorne APENAS um JSON (sem texto adicional) no formato:
   {
     "concluido": true,
     "nome_final": "...",
     "motivo_resumo": "...",
     "categoria": "SAUDE|FAMILIA|ESPIRITUAL|FINANCEIRO|OUTROS",
     "texto_na_integra": "...",
     "risco": "BAIXO|MEDIO|ALTO|CRITICO"
   }
6. Se faltar dados, retorne APENAS texto (string) com a próxima pergunta.
7. Nunca retorne JSON e texto juntos. Ou um ou outro.`;

interface IncomingPayload {
  telefone: string;
  nome_perfil: string;
  mensagem_texto: string;
}

interface AICompletionResponse {
  concluido: boolean;
  nome_final: string;
  motivo_resumo: string;
  categoria: string;
  texto_na_integra: string;
  risco: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  // Use service role to bypass RLS for audit logs
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  try {
    // 1. Parse incoming payload
    const payload: IncomingPayload = await req.json();
    const { telefone, nome_perfil, mensagem_texto } = payload;

    if (!telefone || !mensagem_texto) {
      return new Response(
        JSON.stringify({ error: 'telefone e mensagem_texto são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[chatbot-triagem] Recebido de ${telefone}: ${mensagem_texto.substring(0, 50)}...`);

    // 2. Session Management (State Machine)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Search for active session
    const { data: existingSession, error: sessionError } = await supabase
      .from('atendimentos_bot')
      .select('*')
      .eq('telefone', telefone)
      .neq('status', 'CONCLUIDO')
      .neq('status', 'EXPIRADO')
      .gte('updated_at', twentyFourHoursAgo)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      console.error('[chatbot-triagem] Erro ao buscar sessão:', sessionError);
      throw new Error('Erro ao buscar sessão');
    }

    let session = existingSession;
    let historico: Array<{ role: string; content: string }> = [];

    if (!session) {
      // Create new session
      console.log(`[chatbot-triagem] Criando nova sessão para ${telefone}`);
      const { data: newSession, error: createError } = await supabase
        .from('atendimentos_bot')
        .insert({
          telefone,
          status: 'INICIADO',
          historico_conversa: [],
          meta_dados: { nome_perfil }
        })
        .select()
        .single();

      if (createError) {
        console.error('[chatbot-triagem] Erro ao criar sessão:', createError);
        throw new Error('Erro ao criar sessão');
      }
      session = newSession;
    } else {
      // Load existing history
      historico = (session.historico_conversa as Array<{ role: string; content: string }>) || [];
      console.log(`[chatbot-triagem] Sessão existente: ${session.id} com ${historico.length} mensagens`);
    }

    // 3. Audit Log - User message (Compliance/LGPD)
    const { error: auditUserError } = await supabase
      .from('logs_auditoria_chat')
      .insert({
        sessao_id: session.id,
        ator: 'USER',
        tipo_evento: 'MENSAGEM_RECEBIDA',
        payload_raw: payload,
        ip_origem: req.headers.get('x-forwarded-for') || 'unknown'
      });

    if (auditUserError) {
      console.error('[chatbot-triagem] Erro ao registrar audit log USER:', auditUserError);
      // Continue even if audit fails
    }

    // 4. AI Brain - Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...historico,
      { role: 'user', content: mensagem_texto }
    ];

    console.log(`[chatbot-triagem] Chamando IA com ${messages.length} mensagens`);

    // Call Lovable AI Gateway (OpenAI compatible)
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[chatbot-triagem] Erro da IA:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Contate o administrador.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content || '';

    console.log(`[chatbot-triagem] Resposta IA: ${aiMessage.substring(0, 100)}...`);

    // 5. Process AI Response
    let isJsonResponse = false;
    let parsedJson: AICompletionResponse | null = null;

    // Try to parse as JSON
    try {
      const trimmed = aiMessage.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        parsedJson = JSON.parse(trimmed);
        isJsonResponse = parsedJson?.concluido === true;
      }
    } catch {
      // Not JSON, it's a text response
      isJsonResponse = false;
    }

    // Scenario A: Text response (question)
    if (!isJsonResponse) {
      // Update session with new messages
      const updatedHistorico = [
        ...historico,
        { role: 'user', content: mensagem_texto },
        { role: 'assistant', content: aiMessage }
      ];

      await supabase
        .from('atendimentos_bot')
        .update({
          status: 'EM_ANDAMENTO',
          historico_conversa: updatedHistorico,
          ultima_mensagem_at: new Date().toISOString()
        })
        .eq('id', session.id);

      // Audit Log - Bot response
      await supabase
        .from('logs_auditoria_chat')
        .insert({
          sessao_id: session.id,
          ator: 'BOT',
          tipo_evento: 'MENSAGEM_ENVIADA',
          payload_raw: { response: aiMessage }
        });

      console.log(`[chatbot-triagem] Resposta texto enviada para ${telefone}`);

      return new Response(
        JSON.stringify({ reply_message: aiMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Scenario B: JSON response (completion)
    console.log(`[chatbot-triagem] Conversa concluída para ${telefone}`);

    // Mark session as completed
    await supabase
      .from('atendimentos_bot')
      .update({
        status: 'CONCLUIDO',
        historico_conversa: [
          ...historico,
          { role: 'user', content: mensagem_texto },
          { role: 'assistant', content: aiMessage }
        ],
        meta_dados: {
          ...((session.meta_dados as Record<string, unknown>) || {}),
          resultado_ia: parsedJson
        }
      })
      .eq('id', session.id);

    // Member/Visitor Logic
    const cleanPhone = telefone.replace(/\D/g, '');
    
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, nome')
      .or(`telefone.eq.${telefone},telefone.eq.${cleanPhone}`)
      .limit(1)
      .maybeSingle();

    let pessoaId: string | null = null;
    let visitanteId: string | null = null;
    let origem = 'WABA_EXTERNO';

    if (existingProfile) {
      // Known member
      pessoaId = existingProfile.id;
      origem = 'WABA_INTERNO';
      console.log(`[chatbot-triagem] Membro encontrado: ${existingProfile.nome}`);

      // Link session to profile
      await supabase
        .from('atendimentos_bot')
        .update({ pessoa_id: pessoaId })
        .eq('id', session.id);

    } else {
      // New visitor - create/update in visitantes_leads
      const { data: existingVisitor } = await supabase
        .from('visitantes_leads')
        .select('id')
        .eq('telefone', cleanPhone)
        .maybeSingle();

      if (existingVisitor) {
        visitanteId = existingVisitor.id;
        await supabase
          .from('visitantes_leads')
          .update({
            nome: parsedJson!.nome_final,
            data_ultimo_contato: new Date().toISOString(),
            estagio_funil: 'EM_ORACAO'
          })
          .eq('id', visitanteId);
      } else {
        const { data: newVisitor } = await supabase
          .from('visitantes_leads')
          .insert({
            telefone: cleanPhone,
            nome: parsedJson!.nome_final,
            origem: 'WABA',
            estagio_funil: 'EM_ORACAO',
            data_ultimo_contato: new Date().toISOString()
          })
          .select()
          .single();
        
        visitanteId = newVisitor?.id || null;
      }

      console.log(`[chatbot-triagem] Visitante registrado: ${parsedJson!.nome_final}`);

      // Link session to visitor
      await supabase
        .from('atendimentos_bot')
        .update({ visitante_id: visitanteId })
        .eq('id', session.id);
    }

    // Create prayer request
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos_oracao')
      .insert({
        tipo: 'pedido',
        mensagem: parsedJson!.motivo_resumo,
        texto_na_integra: parsedJson!.texto_na_integra,
        origem: origem,
        pessoa_id: pessoaId,
        visitante_id: visitanteId,
        nome_solicitante: parsedJson!.nome_final,
        telefone_solicitante: telefone,
        anonimo: false,
        status: parsedJson!.risco === 'CRITICO' ? 'urgente' : 'pendente',
        analise_ia_motivo: parsedJson!.categoria,
        analise_ia_gravidade: parsedJson!.risco?.toLowerCase() || 'baixa'
      })
      .select()
      .single();

    if (pedidoError) {
      console.error('[chatbot-triagem] Erro ao criar pedido:', pedidoError);
      throw new Error('Erro ao salvar pedido de oração');
    }

    console.log(`[chatbot-triagem] Pedido de oração criado: ${pedido.id}`);

    // Audit Log - Completion
    await supabase
      .from('logs_auditoria_chat')
      .insert({
        sessao_id: session.id,
        ator: 'SYSTEM',
        tipo_evento: 'SESSAO_CONCLUIDA',
        payload_raw: { 
          pedido_id: pedido.id,
          categoria: parsedJson!.categoria,
          risco: parsedJson!.risco
        }
      });

    // Handle critical risk - notify pastoral emergency
    if (parsedJson!.risco === 'CRITICO') {
      console.log(`[chatbot-triagem] ⚠️ RISCO CRÍTICO detectado para ${telefone}`);
      
      // Try to notify via Make webhook
      const makeWebhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
      if (makeWebhookUrl) {
        try {
          await fetch(makeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'ALERTA_CRITICO',
              telefone,
              nome: parsedJson!.nome_final,
              motivo: parsedJson!.motivo_resumo,
              pedido_id: pedido.id
            })
          });
        } catch (webhookError) {
          console.error('[chatbot-triagem] Erro ao notificar alerta crítico:', webhookError);
        }
      }

      return new Response(
        JSON.stringify({ 
          reply_message: 'Seu pedido foi registrado com URGÊNCIA. Nossa equipe pastoral entrará em contato o mais rápido possível. Se você está em crise, ligue agora para o CVV: 188 🆘'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        reply_message: 'Seu pedido de oração foi registrado! Nossa equipe de intercessores vai orar por você. 🙏 Que Deus te abençoe!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[chatbot-triagem] Erro geral:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro interno',
        reply_message: 'Desculpe, tivemos um problema técnico. Por favor, tente novamente em alguns instantes.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
