import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Recebe o Payload do Make
    const { telefone, mensagem, tipo, url_anexo, origem_canal, nome_perfil } = await req.json();

    if (!telefone || !origem_canal) {
      throw new Error("Telefone e origem_canal são obrigatórios.");
    }

    console.log(`[Financeiro] Msg de ${telefone} no canal ${origem_canal}: ${mensagem || tipo}`);

    // 2. Busca Sessão Ativa
    const { data: sessao, error: searchError } = await supabase
      .from("atendimentos_bot")
      .select("*")
      .eq("telefone", telefone)
      .eq("origem_canal", origem_canal)
      .neq("status", "CONCLUIDO")
      .maybeSingle();

    if (searchError) {
      console.error("Erro ao buscar sessão:", searchError);
      throw searchError;
    }

    // --- CENÁRIO A: SEM SESSÃO ATIVA (Início) ---
    if (!sessao) {
      const texto = (mensagem || "").toLowerCase();
      const isGatilho = texto.includes("reembolso") || texto.includes("nota") || texto.includes("conta");

      if (isGatilho) {
        await supabase.from("atendimentos_bot").insert({
          telefone,
          origem_canal,
          status: "EM_ANDAMENTO",
          meta_dados: {
            contexto: "FINANCEIRO",
            fluxo: texto.includes("reembolso") ? "REEMBOLSO" : "NOVA_CONTA",
            nome_perfil: nome_perfil,
            anexos: []
          }
        });

        return new Response(JSON.stringify({
          text: "🧾 Modo Financeiro iniciado. Por favor, envie a foto do comprovante ou boleto. Digite 'Fechar' quando terminar."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        text: "Olá! Sou o assistente financeiro. Para enviar um comprovante, digite 'Reembolso' ou 'Nova Conta'."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- CENÁRIO B: SESSÃO ATIVA (Processamento) ---
    
    // B1. Recebimento de Arquivos (Imagens/PDFs)
    if (tipo === "image" || tipo === "document") {
      if (!url_anexo) {
        return new Response(JSON.stringify({ text: "Erro: Anexo sem URL." }), { headers: corsHeaders });
      }

      const metaDados = sessao.meta_dados as Record<string, unknown> || {};
      const anexosAtuais = (metaDados.anexos as string[]) || [];
      const novosAnexos = [...anexosAtuais, url_anexo];

      await supabase
        .from("atendimentos_bot")
        .update({
          meta_dados: { ...metaDados, anexos: novosAnexos }
        })
        .eq("id", sessao.id);

      return new Response(JSON.stringify({
        text: `📥 Recebido (${novosAnexos.length} no total). Envie mais ou digite 'Fechar' para processar.`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // B2. Finalização (Comando 'Fechar')
    if (mensagem && mensagem.toLowerCase().match(/fechar|fim|pronto|encerrar/)) {
      const metaDados = sessao.meta_dados as Record<string, unknown> || {};
      const anexos = (metaDados.anexos as string[]) || [];
      const qtdAnexos = anexos.length;
      
      if (qtdAnexos === 0) {
        return new Response(JSON.stringify({
          text: "⚠️ Nenhum comprovante foi enviado ainda. Envie a foto antes de fechar."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Busca uma conta padrão para vincular a transação
      const { data: contaPadrao } = await supabase
        .from("contas")
        .select("id")
        .eq("ativo", true)
        .limit(1)
        .single();

      if (!contaPadrao) {
        console.error("Nenhuma conta ativa encontrada");
        return new Response(JSON.stringify({
          text: "❌ Erro: Nenhuma conta financeira configurada. Contate o administrador."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Cria transação financeira pendente
      const fluxo = metaDados.fluxo as string || "REEMBOLSO";
      const { data: transacao, error: txError } = await supabase
        .from("transacoes_financeiras")
        .insert({
          descricao: `Solicitação via WhatsApp (${fluxo})`,
          valor: 0,
          tipo: "saida",
          tipo_lancamento: "unico",
          data_vencimento: new Date().toISOString().split('T')[0],
          status: "pendente",
          conta_id: contaPadrao.id,
          observacoes: `Anexos: ${anexos.join(", ")}\nOrigem: ${origem_canal}\nNome: ${metaDados.nome_perfil || "N/A"}`
        })
        .select()
        .single();

      if (txError) {
        console.error("Erro ao criar transação:", txError);
        return new Response(JSON.stringify({
          text: "❌ Erro ao criar solicitação. Tente novamente mais tarde."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Encerra sessão
      await supabase
        .from("atendimentos_bot")
        .update({
          status: "CONCLUIDO",
          meta_dados: { ...metaDados, resultado: "Transação Criada", transacao_id: transacao?.id }
        })
        .eq("id", sessao.id);

      return new Response(JSON.stringify({
        text: `✅ Solicitação #${transacao?.id?.slice(0,8)} criada com sucesso! O departamento financeiro foi notificado.`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // B3. Mensagem genérica durante sessão
    return new Response(JSON.stringify({
      text: "Ainda aguardando seus comprovantes. Envie a foto ou digite 'Fechar' para concluir."
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    console.error("Erro crítico:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
