import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é o assistente virtual de acolhimento da Igreja Carvalho.

**CLASSIFICAÇÃO DE INTENÇÃO:**
Primeiro, classifique a intenção do usuário em uma das categorias:
- PEDIDO_ORACAO: Pessoa quer pedir oração por algo
- TESTEMUNHO: Pessoa quer compartilhar um testemunho/gratidão
- DUVIDA_IGREJA: Perguntas sobre horários, endereço, eventos
- CONVERSA_PASTORAL: Precisa de aconselhamento/conversa
- SAUDACAO: Apenas cumprimentando
- OUTRO: Não se encaixa nas anteriores

**REGRAS GERAIS:**
1. Se for a primeira mensagem, avise sobre a LGPD/Privacidade de forma breve.
2. Seja breve e empático. Não pregue nem prometa milagres.
3. Se detectar risco de vida (suicídio, crime, violência), retorne JSON com "risco": "CRITICO".

**PARA PEDIDO_ORACAO:**
Colete: Nome Real e Motivo de Oração.
Quando tiver os dados, retorne JSON no formato abaixo.

**PARA TESTEMUNHO:**
Colete: Nome Real e o Testemunho completo.
Quando tiver os dados, retorne JSON com intencao: "TESTEMUNHO".

**PARA DUVIDA_IGREJA:**
Responda diretamente com informações úteis:
- Cultos: Domingos 9h e 18h, Quartas 19h30
- Endereço: Pergunte ao usuário sua localização para indicar a unidade mais próxima
- Eventos: Mencione que podem verificar no app ou site

**PARA CONVERSA_PASTORAL:**
Informe que um pastor entrará em contato e colete nome e telefone.

**FORMATO DE RESPOSTA:**
- Se faltar dados ou for conversa: retorne APENAS texto (string)
- Se tiver dados completos: retorne APENAS JSON (sem texto adicional):
{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO|TESTEMUNHO|CONVERSA_PASTORAL",
  "nome_final": "...",
  "motivo_resumo": "...",
  "categoria": "SAUDE|FAMILIA|ESPIRITUAL|FINANCEIRO|OUTROS",
  "texto_na_integra": "Compilação fiel de todo o relato",
  "risco": "BAIXO|MEDIO|ALTO|CRITICO"
}

**IMPORTANTE:**
- Nunca retorne JSON e texto juntos. Ou um ou outro.
- Se receber descrição de áudio ou imagem, trate o conteúdo normalmente.`;

interface IncomingPayload {
  telefone: string;
  nome_perfil: string;
  tipo_mensagem: 'text' | 'audio' | 'image';
  conteudo_texto?: string;
  media_id?: string;
  // Legacy support
  mensagem_texto?: string;
}

interface AICompletionResponse {
  concluido: boolean;
  intencao: string;
  nome_final: string;
  motivo_resumo: string;
  categoria: string;
  texto_na_integra: string;
  risco: string;
}

// Transcribe audio using Lovable AI (Whisper-compatible)
async function transcribeAudio(mediaId: string, lovableApiKey: string, whatsappToken?: string): Promise<string> {
  console.log(`[chatbot-triagem] Transcrevendo áudio: ${mediaId}`);
  
  // If we have WhatsApp token, download the media first
  if (whatsappToken) {
    try {
      // Get media URL from WhatsApp
      const mediaUrlResponse = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${whatsappToken}` }
      });
      
      if (!mediaUrlResponse.ok) {
        console.error('[chatbot-triagem] Erro ao obter URL do áudio:', await mediaUrlResponse.text());
        return '[Áudio não pôde ser processado]';
      }
      
      const mediaData = await mediaUrlResponse.json();
      const mediaUrl = mediaData.url;
      
      // Download the audio file
      const audioResponse = await fetch(mediaUrl, {
        headers: { 'Authorization': `Bearer ${whatsappToken}` }
      });
      
      if (!audioResponse.ok) {
        console.error('[chatbot-triagem] Erro ao baixar áudio');
        return '[Áudio não pôde ser baixado]';
      }
      
      const audioBuffer = await audioResponse.arrayBuffer();
      const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      
      // Use Lovable AI for transcription via Gemini (supports audio)
      const transcriptionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcreva este áudio em português. Retorne APENAS o texto transcrito, sem comentários adicionais.'
                },
                {
                  type: 'input_audio',
                  input_audio: {
                    data: audioBase64,
                    format: 'ogg'
                  }
                }
              ]
            }
          ],
          max_tokens: 2048,
        }),
      });
      
      if (transcriptionResponse.ok) {
        const data = await transcriptionResponse.json();
        const transcription = data.choices?.[0]?.message?.content || '';
        console.log(`[chatbot-triagem] Áudio transcrito: ${transcription.substring(0, 50)}...`);
        return transcription || '[Áudio vazio ou inaudível]';
      }
    } catch (error) {
      console.error('[chatbot-triagem] Erro na transcrição:', error);
    }
  }
  
  return `[Áudio recebido - ID: ${mediaId}. Por favor, envie sua mensagem por texto para que possamos ajudá-lo melhor.]`;
}

// Analyze image using Lovable AI (Vision)
async function analyzeImage(mediaId: string, lovableApiKey: string, whatsappToken?: string): Promise<string> {
  console.log(`[chatbot-triagem] Analisando imagem: ${mediaId}`);
  
  if (whatsappToken) {
    try {
      // Get media URL from WhatsApp
      const mediaUrlResponse = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${whatsappToken}` }
      });
      
      if (!mediaUrlResponse.ok) {
        console.error('[chatbot-triagem] Erro ao obter URL da imagem:', await mediaUrlResponse.text());
        return '[Imagem não pôde ser processada]';
      }
      
      const mediaData = await mediaUrlResponse.json();
      const mediaUrl = mediaData.url;
      
      // Download the image
      const imageResponse = await fetch(mediaUrl, {
        headers: { 'Authorization': `Bearer ${whatsappToken}` }
      });
      
      if (!imageResponse.ok) {
        console.error('[chatbot-triagem] Erro ao baixar imagem');
        return '[Imagem não pôde ser baixada]';
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      
      // Use Lovable AI Vision for image analysis
      const visionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Descreva esta imagem de forma objetiva em português. Se for um documento, transcreva o texto. Se parecer relacionado a um pedido de oração (hospital, doença, situação difícil), descreva o contexto. Seja breve e objetivo.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${contentType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1024,
        }),
      });
      
      if (visionResponse.ok) {
        const data = await visionResponse.json();
        const description = data.choices?.[0]?.message?.content || '';
        console.log(`[chatbot-triagem] Imagem analisada: ${description.substring(0, 50)}...`);
        return `[Imagem recebida: ${description}]`;
      }
    } catch (error) {
      console.error('[chatbot-triagem] Erro na análise de imagem:', error);
    }
  }
  
  return `[Imagem recebida - ID: ${mediaId}. Por favor, descreva o que está na imagem ou envie sua mensagem por texto.]`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const whatsappToken = Deno.env.get('WHATSAPP_TOKEN');

  // Use service role to bypass RLS for audit logs
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  try {
    // 1. Parse incoming payload
    const payload: IncomingPayload = await req.json();
    const { telefone, nome_perfil, tipo_mensagem = 'text', conteudo_texto, media_id, mensagem_texto } = payload;

    if (!telefone) {
      return new Response(
        JSON.stringify({ error: 'telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process message content based on type
    let processedContent: string;
    
    switch (tipo_mensagem) {
      case 'audio':
        if (!media_id) {
          return new Response(
            JSON.stringify({ error: 'media_id é obrigatório para mensagens de áudio' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        processedContent = await transcribeAudio(media_id, lovableApiKey, whatsappToken);
        break;
        
      case 'image':
        if (!media_id) {
          return new Response(
            JSON.stringify({ error: 'media_id é obrigatório para mensagens de imagem' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        processedContent = await analyzeImage(media_id, lovableApiKey, whatsappToken);
        // If there's also text with the image, append it
        if (conteudo_texto) {
          processedContent = `${processedContent}\n\nMensagem do usuário: ${conteudo_texto}`;
        }
        break;
        
      case 'text':
      default:
        // Support both new and legacy field names
        processedContent = conteudo_texto || mensagem_texto || '';
        break;
    }

    if (!processedContent) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo da mensagem não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[chatbot-triagem] Recebido de ${telefone} (${tipo_mensagem}): ${processedContent.substring(0, 100)}...`);

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
          meta_dados: { nome_perfil, tipo_primeira_mensagem: tipo_mensagem }
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
        tipo_evento: tipo_mensagem === 'text' ? 'MENSAGEM_RECEBIDA' : `MEDIA_RECEBIDA_${tipo_mensagem.toUpperCase()}`,
        payload_raw: {
          ...payload,
          conteudo_processado: processedContent.substring(0, 500) // Truncate for storage
        },
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
      { role: 'user', content: processedContent }
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

    // Scenario A: Text response (question or info)
    if (!isJsonResponse) {
      // Update session with new messages
      const updatedHistorico = [
        ...historico,
        { role: 'user', content: processedContent },
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
    const intencao = parsedJson!.intencao || 'PEDIDO_ORACAO';
    console.log(`[chatbot-triagem] Conversa concluída para ${telefone} - Intenção: ${intencao}`);

    // Mark session as completed
    await supabase
      .from('atendimentos_bot')
      .update({
        status: 'CONCLUIDO',
        historico_conversa: [
          ...historico,
          { role: 'user', content: processedContent },
          { role: 'assistant', content: aiMessage }
        ],
        meta_dados: {
          ...((session.meta_dados as Record<string, unknown>) || {}),
          resultado_ia: parsedJson,
          intencao_classificada: intencao
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
            estagio_funil: intencao === 'TESTEMUNHO' ? 'TESTEMUNHO_RECEBIDO' : 'EM_ORACAO'
          })
          .eq('id', visitanteId);
      } else {
        const { data: newVisitor } = await supabase
          .from('visitantes_leads')
          .insert({
            telefone: cleanPhone,
            nome: parsedJson!.nome_final,
            origem: 'WABA',
            estagio_funil: intencao === 'TESTEMUNHO' ? 'TESTEMUNHO_RECEBIDO' : 'EM_ORACAO',
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

    // Handle based on intent
    let responseMessage = '';
    
    if (intencao === 'TESTEMUNHO') {
      // Create testimony
      const { data: testemunho, error: testemunhoError } = await supabase
        .from('testemunhos')
        .insert({
          titulo: parsedJson!.motivo_resumo?.substring(0, 100) || 'Testemunho via WhatsApp',
          mensagem: parsedJson!.texto_na_integra,
          categoria: parsedJson!.categoria || 'OUTROS',
          pessoa_id: pessoaId,
          nome_externo: pessoaId ? null : parsedJson!.nome_final,
          telefone_externo: pessoaId ? null : telefone,
          status: 'aberto', // Pending approval
          origem: origem
        })
        .select()
        .single();

      if (testemunhoError) {
        console.error('[chatbot-triagem] Erro ao criar testemunho:', testemunhoError);
        throw new Error('Erro ao salvar testemunho');
      }

      console.log(`[chatbot-triagem] Testemunho criado: ${testemunho.id}`);
      responseMessage = 'Que alegria receber seu testemunho! 🙌 Ele será revisado e poderá ser compartilhado para edificar nossa comunidade. Deus seja louvado!';

      // Audit Log
      await supabase
        .from('logs_auditoria_chat')
        .insert({
          sessao_id: session.id,
          ator: 'SYSTEM',
          tipo_evento: 'TESTEMUNHO_CRIADO',
          payload_raw: { testemunho_id: testemunho.id, categoria: parsedJson!.categoria }
        });

    } else if (intencao === 'CONVERSA_PASTORAL') {
      // Create pastoral contact request
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos_oracao')
        .insert({
          tipo: 'pastoral',
          mensagem: parsedJson!.motivo_resumo,
          texto_na_integra: parsedJson!.texto_na_integra,
          origem: origem,
          pessoa_id: pessoaId,
          visitante_id: visitanteId,
          nome_solicitante: parsedJson!.nome_final,
          telefone_solicitante: telefone,
          anonimo: false,
          status: 'urgente', // Pastoral requests are urgent
          analise_ia_motivo: 'CONVERSA_PASTORAL',
          analise_ia_gravidade: parsedJson!.risco?.toLowerCase() || 'media'
        })
        .select()
        .single();

      if (pedidoError) {
        console.error('[chatbot-triagem] Erro ao criar pedido pastoral:', pedidoError);
        throw new Error('Erro ao salvar solicitação pastoral');
      }

      console.log(`[chatbot-triagem] Solicitação pastoral criada: ${pedido.id}`);
      responseMessage = 'Sua solicitação foi registrada. Um pastor ou líder entrará em contato em breve para conversar com você. 💜';

      // Notify pastoral team
      const makeWebhookUrl = Deno.env.get('MAKE_WEBHOOK_URL');
      if (makeWebhookUrl) {
        try {
          await fetch(makeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'SOLICITACAO_PASTORAL',
              telefone,
              nome: parsedJson!.nome_final,
              motivo: parsedJson!.motivo_resumo,
              pedido_id: pedido.id
            })
          });
        } catch (webhookError) {
          console.error('[chatbot-triagem] Erro ao notificar equipe pastoral:', webhookError);
        }
      }

      // Audit Log
      await supabase
        .from('logs_auditoria_chat')
        .insert({
          sessao_id: session.id,
          ator: 'SYSTEM',
          tipo_evento: 'PEDIDO_PASTORAL_CRIADO',
          payload_raw: { pedido_id: pedido.id, risco: parsedJson!.risco }
        });

    } else {
      // Default: Prayer request
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

      responseMessage = 'Seu pedido de oração foi registrado! Nossa equipe de intercessores vai orar por você. 🙏 Que Deus te abençoe!';
    }

    return new Response(
      JSON.stringify({ reply_message: responseMessage }),
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
