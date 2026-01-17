import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// Estrutura real do webhook PIX do Santander (padrão BACEN)
interface PixItemSantander {
  endToEndId: string;
  txid?: string;
  chave: string;           // Chave PIX (CNPJ da igreja)
  valor: string;           // String no formato "150.00"
  horario: string;
  infoPagador?: string;
  pagador?: {
    cpf?: string;
    cnpj?: string;
    nome?: string;
  };
  devolucoes?: Array<{
    id: string;
    rtrId: string;
    valor: string;
    horario: { solicitacao: string };
    status: string;
  }>;
}

interface PixWebhookPayload {
  pix: PixItemSantander[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Remove formatação do CNPJ (pontos, barras, hífens)
function limparCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

// Busca igreja pelo CNPJ da chave PIX
async function buscarIgrejaPorCnpj(chave: string): Promise<string | null> {
  const cnpjLimpo = limparCnpj(chave);
  
  console.log(`[pix-webhook] Buscando igreja por CNPJ: ${cnpjLimpo}`);
  
  // Buscar pelo CNPJ limpo (sem formatação)
  const { data, error } = await supabase
    .from('igrejas')
    .select('id')
    .eq('cnpj', cnpjLimpo)
    .maybeSingle();
  
  if (error) {
    console.error(`[pix-webhook] Erro ao buscar igreja:`, error);
    return null;
  }
  
  if (data) {
    console.log(`[pix-webhook] Igreja encontrada: ${data.id}`);
    return data.id;
  }
  
  // Tentar busca com CNPJ formatado (XX.XXX.XXX/XXXX-XX)
  const cnpjFormatado = cnpjLimpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
  
  const { data: dataFormatado, error: errorFormatado } = await supabase
    .from('igrejas')
    .select('id')
    .eq('cnpj', cnpjFormatado)
    .maybeSingle();
  
  if (errorFormatado) {
    console.error(`[pix-webhook] Erro ao buscar igreja (formatado):`, errorFormatado);
    return null;
  }
  
  if (dataFormatado) {
    console.log(`[pix-webhook] Igreja encontrada (CNPJ formatado): ${dataFormatado.id}`);
    return dataFormatado.id;
  }
  
  console.warn(`[pix-webhook] Igreja não encontrada para CNPJ: ${chave}`);
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse do payload
    const payload: PixWebhookPayload = await req.json();
    console.log("[pix-webhook] Recebido payload:", JSON.stringify(payload));

    // Validar estrutura do payload
    if (!payload.pix || !Array.isArray(payload.pix) || payload.pix.length === 0) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: array 'pix' obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultados: Array<{ pixId: string; valor: number; status: string }> = [];
    const erros: Array<{ pixId: string; erro: string }> = [];

    // Processar cada PIX do array
    for (const pixItem of payload.pix) {
      try {
        const pixId = pixItem.endToEndId;
        const valor = parseFloat(pixItem.valor);
        
        if (!pixId) {
          erros.push({ pixId: 'unknown', erro: 'endToEndId não informado' });
          continue;
        }
        
        if (isNaN(valor) || valor <= 0) {
          erros.push({ pixId, erro: 'Valor inválido' });
          continue;
        }

        // Buscar igreja pelo CNPJ da chave PIX
        const igrejaId = await buscarIgrejaPorCnpj(pixItem.chave);
        
        if (!igrejaId) {
          console.warn(`[pix-webhook] PIX ${pixId} sem igreja vinculada (chave: ${pixItem.chave})`);
          // Continua processando mas registra sem igreja_id
        }

        // Montar dados para inserção
        const dadosInserir = {
          pix_id: pixId,
          valor: valor,
          pagador_cpf_cnpj: pixItem.pagador?.cpf || pixItem.pagador?.cnpj || null,
          pagador_nome: pixItem.pagador?.nome || null,
          descricao: pixItem.infoPagador || "PIX Recebido",
          data_pix: new Date(pixItem.horario).toISOString(),
          banco_id: "90400888000142", // Santander CNPJ
          igreja_id: igrejaId,
          webhook_payload: pixItem,
          status: "recebido",
        };

        console.log(`[pix-webhook] Inserindo PIX ${pixId}:`, JSON.stringify(dadosInserir));

        // Inserir na tabela temporária
        const { error } = await supabase
          .from("pix_webhook_temp")
          .insert([dadosInserir]);

        if (error) {
          console.error(`[pix-webhook] Erro ao inserir PIX ${pixId}:`, error);
          erros.push({ pixId, erro: error.message });
        } else {
          console.log(`[pix-webhook] PIX ${pixId} inserido com sucesso`);
          resultados.push({ pixId, valor, status: 'recebido' });
        }
      } catch (itemErr) {
        console.error(`[pix-webhook] Exceção ao processar item:`, itemErr);
        erros.push({ 
          pixId: pixItem.endToEndId || 'unknown', 
          erro: itemErr instanceof Error ? itemErr.message : String(itemErr) 
        });
      }
    }

    // Retornar resultado consolidado
    const response = {
      success: resultados.length > 0,
      message: `${resultados.length} PIX processados, ${erros.length} erros`,
      processados: resultados,
      erros: erros.length > 0 ? erros : undefined,
    };

    console.log("[pix-webhook] Resposta:", JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      {
        status: erros.length === payload.pix.length ? 400 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[pix-webhook] Exceção:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
