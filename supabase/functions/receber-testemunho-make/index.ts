import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Função para verificar assinatura do webhook
const verifyWebhookSecret = (req: Request): { valid: boolean; error?: string } => {
  const webhookSecret = Deno.env.get('MAKE_WEBHOOK_SECRET');
  
  // SECURITY: Secret MUST be configured - no fallback allowed
  if (!webhookSecret) {
    console.error('❌ MAKE_WEBHOOK_SECRET não configurado - requisição rejeitada por segurança');
    return { valid: false, error: 'Webhook secret not configured on server' };
  }
  
  const requestSecret = req.headers.get('x-webhook-secret');
  
  if (!requestSecret) {
    console.error('❌ Header x-webhook-secret não fornecido');
    return { valid: false, error: 'Missing x-webhook-secret header' };
  }
  
  // Comparação segura de strings (timing-safe comparison)
  if (webhookSecret.length !== requestSecret.length) {
    return { valid: false, error: 'Invalid webhook secret' };
  }
  
  let result = 0;
  for (let i = 0; i < webhookSecret.length; i++) {
    result |= webhookSecret.charCodeAt(i) ^ requestSecret.charCodeAt(i);
  }
  
  if (result !== 0) {
    return { valid: false, error: 'Invalid webhook secret' };
  }
  
  return { valid: true };
};

// Schema de validação
const testemunhoSchema = z.object({
  telefone: z.string().trim().min(1, "Telefone é obrigatório").max(20),
  mensagem: z.string().trim().min(1, "Mensagem é obrigatória").max(5000),
  data: z.string().optional(),
  permitidoPublicar: z.boolean().optional().default(false),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(255),
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Webhook receber-testemunho-make chamado');

    // Verificar autenticação do webhook
    const secretCheck = verifyWebhookSecret(req);
    if (!secretCheck.valid) {
      console.error('❌ Falha na verificação do webhook secret:', secretCheck.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
          message: secretCheck.error,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse e valida o body
    const body = await req.json();
    console.log('📥 Dados recebidos:', { ...body, mensagem: '[redacted]' });

    const validatedData = testemunhoSchema.parse(body);

    // Buscar pessoa existente por telefone
    console.log('🔍 Buscando pessoa por telefone:', validatedData.telefone);
    const { data: pessoaId } = await supabase.rpc('buscar_pessoa_por_contato', {
      p_telefone: validatedData.telefone,
      p_nome: validatedData.nome,
    });

    console.log('👤 Pessoa encontrada:', pessoaId ? 'Sim' : 'Não');

    // Gerar título automático (primeiras palavras da mensagem)
    const titulo = validatedData.mensagem
      .split(' ')
      .slice(0, 8)
      .join(' ')
      .substring(0, 100) + (validatedData.mensagem.length > 100 ? '...' : '');

    // Preparar dados do testemunho
    const testemunhoData: Record<string, unknown> = {
      titulo: titulo,
      mensagem: validatedData.mensagem,
      categoria: 'outro', // Categoria padrão
      status: 'aberto',
      publicar: validatedData.permitidoPublicar,
      anonimo: false,
    };

    // Se pessoa existe, vincular
    if (pessoaId) {
      testemunhoData.pessoa_id = pessoaId;
      testemunhoData.autor_id = pessoaId;
    } else {
      // Dados externos
      testemunhoData.nome_externo = validatedData.nome;
      testemunhoData.telefone_externo = validatedData.telefone;
    }

    console.log('💾 Salvando testemunho...');
    const { data: testemunho, error: testemunhoError } = await supabase
      .from('testemunhos')
      .insert(testemunhoData)
      .select()
      .single();

    if (testemunhoError) {
      console.error('❌ Erro ao salvar testemunho:', testemunhoError);
      throw testemunhoError;
    }

    console.log('✅ Testemunho salvo com sucesso:', testemunho.id);

    // Notificar admins (o trigger do banco já faz isso, mas vamos garantir)
    console.log('📢 Notificação automática enviada via trigger do banco');

    return new Response(
      JSON.stringify({
        success: true,
        testemunho_id: testemunho.id,
        message: 'Testemunho recebido com sucesso',
        pessoa_encontrada: !!pessoaId,
        sera_publicado: validatedData.permitidoPublicar,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro no webhook:', error);

    // Erro de validação
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dados inválidos',
          details: error.errors,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Outros erros
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar testemunho';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
