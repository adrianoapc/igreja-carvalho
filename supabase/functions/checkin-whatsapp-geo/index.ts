import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Check-in WhatsApp Geolocalização ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    console.log('Dados recebidos:', JSON.stringify(body, null, 2));

    const { telefone, latitude, longitude, lat, long } = body;

    // Suporte para diferentes formatos de coordenadas
    const finalLat = latitude ?? lat;
    const finalLong = longitude ?? long;

    // Validação dos campos obrigatórios
    if (!telefone) {
      console.error('Telefone não fornecido');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Campo telefone é obrigatório' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (finalLat === undefined || finalLong === undefined) {
      console.error('Coordenadas não fornecidas');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Coordenadas (latitude/longitude) são obrigatórias' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processando check-in para telefone: ${telefone}`);
    console.log(`Coordenadas: lat=${finalLat}, long=${finalLong}`);

    // Chamar a função de check-in por localização
    const { data, error } = await supabase.rpc('checkin_por_localizacao', {
      p_telefone: telefone,
      p_lat: parseFloat(finalLat),
      p_long: parseFloat(finalLong)
    });

    if (error) {
      console.error('Erro ao processar check-in:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Erro ao processar check-in',
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Resultado do check-in:', JSON.stringify(data, null, 2));

    // Retornar resposta da função
    return new Response(
      JSON.stringify(data),
      { 
        status: data?.success ? 200 : 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Erro interno do servidor',
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
