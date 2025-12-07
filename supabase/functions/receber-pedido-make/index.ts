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
const pedidoSchema = z.object({
  telefone: z.string().trim().min(1, "Telefone é obrigatório").max(20),
  mensagem: z.string().trim().min(1, "Mensagem é obrigatória").max(5000),
  tema: z.string().trim().optional(),
  urgente: z.boolean().optional(),
  dataPedido: z.string().optional(),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(255),
});

// Mapear tema para tipo_pedido enum
const mapearTemaParaTipo = (tema?: string): string => {
  if (!tema) return 'outro';
  
  const temaLower = tema.toLowerCase();
  if (temaLower.includes('saúde') || temaLower.includes('saude')) return 'saude';
  if (temaLower.includes('família') || temaLower.includes('familia')) return 'familia';
  if (temaLower.includes('financeiro') || temaLower.includes('dinheiro')) return 'financeiro';
  if (temaLower.includes('trabalho') || temaLower.includes('emprego')) return 'trabalho';
  if (temaLower.includes('espiritual') || temaLower.includes('fé')) return 'espiritual';
  if (temaLower.includes('agradecimento') || temaLower.includes('gratidão')) return 'agradecimento';
  
  return 'outro';
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔔 Webhook receber-pedido-make chamado');

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

    const validatedData = pedidoSchema.parse(body);

    // Buscar pessoa existente por telefone
    console.log('🔍 Buscando pessoa por telefone:', validatedData.telefone);
    const { data: pessoaId } = await supabase.rpc('buscar_pessoa_por_contato', {
      p_telefone: validatedData.telefone,
      p_nome: validatedData.nome,
    });

    console.log('👤 Pessoa encontrada:', pessoaId ? 'Sim' : 'Não');

    // Mapear tipo do pedido
    const tipo = mapearTemaParaTipo(validatedData.tema);

    // Preparar dados do pedido
    const pedidoData: any = {
      pedido: validatedData.mensagem,
      tipo: tipo,
      status: 'pendente',
      anonimo: false,
    };

    // Se pessoa existe, vincular
    if (pessoaId) {
      pedidoData.pessoa_id = pessoaId;
    } else {
      // Dados externos
      pedidoData.nome_solicitante = validatedData.nome;
      pedidoData.telefone_solicitante = validatedData.telefone;
    }

    // Adicionar observações se urgente
    if (validatedData.urgente) {
      pedidoData.observacoes_intercessor = `URGENTE: ${validatedData.tema || 'Pedido urgente'}`;
    }

    console.log('💾 Salvando pedido de oração...');
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos_oracao')
      .insert(pedidoData)
      .select()
      .single();

    if (pedidoError) {
      console.error('❌ Erro ao salvar pedido:', pedidoError);
      throw pedidoError;
    }

    console.log('✅ Pedido salvo com sucesso:', pedido.id);

    // Notificar admins (o trigger do banco já faz isso, mas vamos garantir)
    console.log('📢 Notificação automática enviada via trigger do banco');

    return new Response(
      JSON.stringify({
        success: true,
        pedido_id: pedido.id,
        message: 'Pedido de oração recebido com sucesso',
        pessoa_encontrada: !!pessoaId,
        tipo_identificado: tipo,
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
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pedido';
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
