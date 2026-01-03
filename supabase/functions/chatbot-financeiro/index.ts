import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Estados da máquina de estados
type EstadoSessao = 
  | "AGUARDANDO_COMPROVANTES" 
  | "AGUARDANDO_DATA" 
  | "AGUARDANDO_FORMA_PGTO" 
  | "FINALIZADO";

interface ItemProcessado {
  anexo_original: string;
  anexo_storage: string;
  valor: number;
  fornecedor: string | null;
  data_emissao: string | null;
  descricao: string | null;
  categoria_sugerida_id: string | null;
  subcategoria_sugerida_id: string | null;
  centro_custo_sugerido_id: string | null;
  processado_em: string;
}

interface MetaDados {
  contexto: string;
  fluxo: "REEMBOLSO" | "CONTA_UNICA";
  pessoa_id?: string;
  nome_perfil?: string;
  estado_atual: EstadoSessao;
  itens: ItemProcessado[];
  valor_total_acumulado: number;
  data_vencimento?: string;
  forma_pagamento?: "pix" | "dinheiro";
  resultado?: string;
  itens_removidos?: number;
}

// Função para fazer download de anexo do WhatsApp e upload para Storage
async function persistirAnexo(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  urlOriginal: string,
  sessaoId: string
): Promise<string | null> {
  try {
    console.log(`[Storage] Baixando anexo: ${urlOriginal.slice(0, 50)}...`);
    
    // Download do arquivo do WhatsApp
    const response = await fetch(urlOriginal);
    if (!response.ok) {
      console.error(`[Storage] Erro ao baixar: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Detectar tipo de arquivo
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.includes("pdf") ? "pdf" : "jpg";
    
    // Nome do arquivo no Storage
    const timestamp = Date.now();
    const fileName = `whatsapp/${sessaoId}/${timestamp}.${extension}`;
    
    // Upload para o bucket transaction-attachments
    const { error } = await supabase.storage
      .from("transaction-attachments")
      .upload(fileName, uint8Array, {
        contentType,
        upsert: false
      });
    
    if (error) {
      console.error(`[Storage] Erro no upload:`, error);
      return null;
    }
    
    // Gerar URL pública (ou signed se bucket privado)
    const { data: urlData } = supabase.storage
      .from("transaction-attachments")
      .getPublicUrl(fileName);
    
    console.log(`[Storage] Anexo salvo: ${fileName}`);
    return urlData?.publicUrl || null;
    
  } catch (error) {
    console.error(`[Storage] Erro ao persistir anexo:`, error);
    return null;
  }
}

// Função para processar nota fiscal via edge function
async function processarNotaFiscal(
  supabaseUrl: string,
  serviceKey: string,
  base64Image: string
): Promise<{
  valor: number;
  fornecedor: string | null;
  data_emissao: string | null;
  descricao: string | null;
  categoria_sugerida_id: string | null;
  subcategoria_sugerida_id: string | null;
  centro_custo_sugerido_id: string | null;
} | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/processar-nota-fiscal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ image_base64: base64Image })
    });
    
    if (!response.ok) {
      console.error(`[OCR] Erro: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      valor: data.valor || 0,
      fornecedor: data.fornecedor || null,
      data_emissao: data.data_emissao || null,
      descricao: data.descricao || null,
      categoria_sugerida_id: data.categoria_sugerida?.id || null,
      subcategoria_sugerida_id: data.subcategoria_sugerida?.id || null,
      centro_custo_sugerido_id: data.centro_custo_sugerido?.id || null
    };
  } catch (error) {
    console.error(`[OCR] Erro ao processar nota:`, error);
    return null;
  }
}

// Função para deletar anexos do Storage (rollback)
async function deletarAnexosSessao(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  itens: ItemProcessado[]
): Promise<number> {
  let removidos = 0;
  
  for (const item of itens) {
    if (item.anexo_storage) {
      try {
        // Extrair path do URL
        const url = new URL(item.anexo_storage);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/transaction-attachments\/(.+)/);
        if (pathMatch) {
          const filePath = pathMatch[1];
          const { error } = await supabase.storage
            .from("transaction-attachments")
            .remove([filePath]);
          
          if (!error) {
            removidos++;
            console.log(`[Storage] Removido: ${filePath}`);
          }
        }
      } catch (e) {
        console.error(`[Storage] Erro ao remover:`, e);
      }
    }
  }
  
  return removidos;
}

// Formatar valor em reais
function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

    // 2. Valida se o telefone pertence a um membro autorizado
    // Normaliza telefone removendo DDI (55) e caracteres não numéricos
    const telefoneDigitos = telefone.replace(/\D/g, "");
    const telefoneSemDDI = telefoneDigitos.startsWith("55") && telefoneDigitos.length > 11
      ? telefoneDigitos.slice(2)
      : telefoneDigitos;
    const telefoneNormalizado = telefoneSemDDI.slice(-11); // Últimos 11 dígitos (DDD + número)

    // OBS: Não usamos maybeSingle aqui porque o mesmo telefone pode estar duplicado em mais de um perfil
    // (ex.: pai/filho ou registros duplicados). Nesse caso, escolhemos o melhor candidato.
    const { data: candidatosAutorizados, error: authError } = await supabase
      .from("profiles")
      .select("id, nome, telefone, autorizado_bot_financeiro, dados_bancarios, created_at, data_nascimento")
      .eq("autorizado_bot_financeiro", true)
      .filter("telefone", "ilike", `%${telefoneNormalizado.slice(-9)}%`) // Busca pelos 9 dígitos finais
      .limit(5);

    const normalizarTelefoneDB = (t?: string | null) => {
      const dig = (t || "").replace(/\D/g, "");
      const semDDI = dig.startsWith("55") && dig.length > 11 ? dig.slice(2) : dig;
      return semDDI.slice(-11);
    };

    const escolherMelhorCandidato = (rows: typeof candidatosAutorizados) => {
      const lista = rows || [];
      if (lista.length === 0) return null;

      const alvo11 = telefoneNormalizado;
      const alvo9 = telefoneNormalizado.slice(-9);

      // 1) Match exato pelos 11 dígitos (DDD + número)
      const exato11 = lista.find((p) => normalizarTelefoneDB(p.telefone) === alvo11);
      if (exato11) return exato11;

      // 2) Match pelos 9 dígitos finais (número)
      const exato9 = lista.find((p) => normalizarTelefoneDB(p.telefone).endsWith(alvo9));
      if (exato9) return exato9;

      // 3) Fallback: mais antigo (menor data_nascimento) e depois criado primeiro
      return [...lista].sort((a, b) => {
        const aNasc = a.data_nascimento ? new Date(a.data_nascimento).getTime() : Number.POSITIVE_INFINITY;
        const bNasc = b.data_nascimento ? new Date(b.data_nascimento).getTime() : Number.POSITIVE_INFINITY;
        if (aNasc !== bNasc) return aNasc - bNasc;

        const aCreated = a.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY;
        return aCreated - bCreated;
      })[0];
    };

    const membroAutorizado = escolherMelhorCandidato(candidatosAutorizados);

    if (authError) {
      console.error("Erro ao validar membro:", authError);
    }

    if ((candidatosAutorizados?.length || 0) > 1) {
      console.warn(
        `[Financeiro] Telefone duplicado em perfis autorizados (${telefoneNormalizado}). Candidatos:`,
        (candidatosAutorizados || []).map((p) => ({ id: p.id, nome: p.nome, telefone: p.telefone }))
      );
    }

    if (authError) {
      console.error("Erro ao validar membro:", authError);
    }

    if (!membroAutorizado) {
      console.log(`[Financeiro] Telefone ${telefone} não autorizado para bot financeiro`);
      return new Response(JSON.stringify({
        text: "⚠️ Você não está autorizado a usar o assistente financeiro. Solicite acesso à secretaria."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[Financeiro] Membro autorizado: ${membroAutorizado.nome} (${membroAutorizado.id})`);

    // 3. Busca Sessão Ativa
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
      const isReembolso = texto.includes("reembolso");
      const isContaUnica = texto.includes("conta") || texto.includes("nota");
      const isGatilho = isReembolso || isContaUnica;

      if (isGatilho) {
        const metaDadosInicial: MetaDados = {
          contexto: "FINANCEIRO",
          fluxo: isReembolso ? "REEMBOLSO" : "CONTA_UNICA",
          pessoa_id: membroAutorizado.id,
          nome_perfil: nome_perfil || membroAutorizado.nome,
          estado_atual: "AGUARDANDO_COMPROVANTES",
          itens: [],
          valor_total_acumulado: 0
        };

        await supabase.from("atendimentos_bot").insert({
          telefone,
          origem_canal,
          pessoa_id: membroAutorizado.id,
          status: "EM_ANDAMENTO",
          meta_dados: metaDadosInicial
        });

        const tipoFluxo = isReembolso ? "Reembolso" : "Nova Conta";
        return new Response(JSON.stringify({
          text: `🧾 Modo ${tipoFluxo} iniciado!\n\nEnvie a(s) foto(s) dos comprovantes.\nDigite *Fechar* quando terminar.\nDigite *Cancelar* para desistir.`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        text: "Olá! Sou o assistente financeiro. Para iniciar:\n\n• *Reembolso* - para solicitar ressarcimento\n• *Nova Conta* - para registrar uma despesa"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- CENÁRIO B: SESSÃO ATIVA (Processamento) ---
    const metaDados = (sessao.meta_dados || {}) as MetaDados;
    const estadoAtual = metaDados.estado_atual || "AGUARDANDO_COMPROVANTES";

    // ========== ESTADO: AGUARDANDO_COMPROVANTES ==========
    if (estadoAtual === "AGUARDANDO_COMPROVANTES") {
      
      // B1. Recebimento de Arquivos (Imagens/PDFs)
      if (tipo === "image" || tipo === "document") {
        if (!url_anexo) {
          return new Response(JSON.stringify({ text: "Erro: Anexo sem URL." }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Baixar e salvar no Storage permanentemente
        const anexoStorage = await persistirAnexo(supabase, url_anexo, sessao.id);
        
        if (!anexoStorage) {
          return new Response(JSON.stringify({ 
            text: "⚠️ Erro ao salvar o comprovante. Por favor, tente enviar novamente." 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Processar via OCR para extrair dados
        let dadosNota: Awaited<ReturnType<typeof processarNotaFiscal>> = null;
        
        if (tipo === "image") {
          try {
            // Fazer download novamente para base64 (ou usar cache se disponível)
            const imgResponse = await fetch(url_anexo);
            const imgBuffer = await imgResponse.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
            dadosNota = await processarNotaFiscal(supabaseUrl, supabaseKey, base64);
          } catch (e) {
            console.error("[OCR] Erro ao converter para base64:", e);
          }
        }

        // Criar item processado
        const novoItem: ItemProcessado = {
          anexo_original: url_anexo,
          anexo_storage: anexoStorage,
          valor: dadosNota?.valor || 0,
          fornecedor: dadosNota?.fornecedor || null,
          data_emissao: dadosNota?.data_emissao || null,
          descricao: dadosNota?.descricao || null,
          categoria_sugerida_id: dadosNota?.categoria_sugerida_id || null,
          subcategoria_sugerida_id: dadosNota?.subcategoria_sugerida_id || null,
          centro_custo_sugerido_id: dadosNota?.centro_custo_sugerido_id || null,
          processado_em: new Date().toISOString()
        };

        // Atualizar metadados
        const itensAtualizados = [...metaDados.itens, novoItem];
        const valorTotal = itensAtualizados.reduce((acc, item) => acc + item.valor, 0);

        await supabase
          .from("atendimentos_bot")
          .update({
            meta_dados: { 
              ...metaDados, 
              itens: itensAtualizados,
              valor_total_acumulado: valorTotal
            }
          })
          .eq("id", sessao.id);

        // Resposta com resumo do item
        let resposta = `📥 Comprovante ${itensAtualizados.length} recebido!\n`;
        if (dadosNota?.valor) {
          resposta += `💰 Valor: ${formatarValor(dadosNota.valor)}\n`;
        }
        if (dadosNota?.fornecedor) {
          resposta += `🏪 ${dadosNota.fornecedor}\n`;
        }
        resposta += `\n📊 Total acumulado: ${formatarValor(valorTotal)} (${itensAtualizados.length} ${itensAtualizados.length === 1 ? 'item' : 'itens'})\n`;
        resposta += `\nEnvie mais ou digite *Fechar* para concluir.`;

        return new Response(JSON.stringify({ text: resposta }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // B2. Cancelamento
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
        const itensRemovidos = await deletarAnexosSessao(supabase, metaDados.itens);
        
        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: { 
              ...metaDados, 
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
              itens_removidos: itensRemovidos
            }
          })
          .eq("id", sessao.id);

        console.log(`[Financeiro] Sessão ${sessao.id} cancelada. ${itensRemovidos} anexos removidos.`);

        return new Response(JSON.stringify({
          text: `❌ Solicitação cancelada.\n${itensRemovidos > 0 ? `${itensRemovidos} comprovante(s) descartado(s).` : ''}\n\nDigite *Reembolso* ou *Nova Conta* para iniciar novamente.`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // B3. Finalização (Comando 'Fechar')
      if (mensagem && mensagem.toLowerCase().match(/fechar|fim|pronto|encerrar/)) {
        const qtdItens = metaDados.itens.length;
        
        if (qtdItens === 0) {
          return new Response(JSON.stringify({
            text: "⚠️ Nenhum comprovante foi enviado ainda.\n\nEnvie a foto antes de fechar ou digite *Cancelar* para desistir."
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // FLUXO CONTA_UNICA: Inserir diretamente
        if (metaDados.fluxo === "CONTA_UNICA") {
          // Buscar conta padrão
          const { data: contaPadrao } = await supabase
            .from("contas")
            .select("id")
            .eq("ativo", true)
            .limit(1)
            .single();

          if (!contaPadrao) {
            return new Response(JSON.stringify({
              text: "❌ Erro: Nenhuma conta financeira configurada. Contate o administrador."
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Criar transações para cada item
          const transacoesCriadas: string[] = [];
          for (const item of metaDados.itens) {
            const { data: tx, error } = await supabase
              .from("transacoes_financeiras")
              .insert({
                descricao: item.descricao || `Despesa - ${item.fornecedor || 'WhatsApp'}`,
                valor: item.valor || 0,
                tipo: "saida",
                tipo_lancamento: "unico",
                data_vencimento: item.data_emissao || new Date().toISOString().split('T')[0],
                status: "pendente",
                conta_id: contaPadrao.id,
                categoria_id: item.categoria_sugerida_id,
                subcategoria_id: item.subcategoria_sugerida_id,
                centro_custo_id: item.centro_custo_sugerido_id,
                anexo_url: item.anexo_storage,
                observacoes: `Fornecedor: ${item.fornecedor || 'N/A'}\nOrigem: WhatsApp\nSolicitante: ${metaDados.nome_perfil}`
              })
              .select("id")
              .single();

            if (!error && tx) {
              transacoesCriadas.push(tx.id);
            }
          }

          // Encerrar sessão
          await supabase
            .from("atendimentos_bot")
            .update({
              status: "CONCLUIDO",
              meta_dados: { 
                ...metaDados, 
                estado_atual: "FINALIZADO",
                resultado: "CONTA_UNICA_CRIADA",
                transacoes_ids: transacoesCriadas
              }
            })
            .eq("id", sessao.id);

          return new Response(JSON.stringify({
            text: `✅ ${transacoesCriadas.length} despesa(s) registrada(s)!\n\n💰 Total: ${formatarValor(metaDados.valor_total_acumulado)}\n\nO financeiro irá processar em breve.`
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // FLUXO REEMBOLSO: Perguntar data
        await supabase
          .from("atendimentos_bot")
          .update({
            meta_dados: { ...metaDados, estado_atual: "AGUARDANDO_DATA" }
          })
          .eq("id", sessao.id);

        return new Response(JSON.stringify({
          text: `📋 *Resumo do Reembolso*\n\n💰 Total: ${formatarValor(metaDados.valor_total_acumulado)}\n📦 Itens: ${qtdItens}\n\n📅 *Quando deseja receber o ressarcimento?*\n\nDigite a data (ex: 15/01) ou:\n• *esta semana*\n• *próximo mês*`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Mensagem genérica
      return new Response(JSON.stringify({
        text: "📸 Aguardando comprovantes.\n\nEnvie a foto, digite *Fechar* para concluir ou *Cancelar* para desistir."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== ESTADO: AGUARDANDO_DATA ==========
    if (estadoAtual === "AGUARDANDO_DATA") {
      // Cancelamento ainda disponível
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
        const itensRemovidos = await deletarAnexosSessao(supabase, metaDados.itens);
        
        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: { 
              ...metaDados, 
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
              itens_removidos: itensRemovidos
            }
          })
          .eq("id", sessao.id);

        return new Response(JSON.stringify({
          text: `❌ Solicitação cancelada. ${itensRemovidos} comprovante(s) descartado(s).`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Processar data informada
      const textoData = (mensagem || "").toLowerCase().trim();
      let dataVencimento: string;
      const hoje = new Date();

      if (textoData.includes("esta semana") || textoData.includes("essa semana")) {
        // Próxima sexta-feira
        const diasAteSexta = (5 - hoje.getDay() + 7) % 7 || 7;
        const sexta = new Date(hoje);
        sexta.setDate(hoje.getDate() + diasAteSexta);
        dataVencimento = sexta.toISOString().split('T')[0];
      } else if (textoData.includes("próximo mês") || textoData.includes("proximo mes")) {
        // Dia 5 do próximo mês
        const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 5);
        dataVencimento = proximoMes.toISOString().split('T')[0];
      } else {
        // Tentar parsear data no formato DD/MM ou DD/MM/AAAA
        const matchData = textoData.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        if (matchData) {
          const dia = parseInt(matchData[1]);
          const mes = parseInt(matchData[2]) - 1;
          const ano = matchData[3] ? (matchData[3].length === 2 ? 2000 + parseInt(matchData[3]) : parseInt(matchData[3])) : hoje.getFullYear();
          const dataInformada = new Date(ano, mes, dia);
          dataVencimento = dataInformada.toISOString().split('T')[0];
        } else {
          return new Response(JSON.stringify({
            text: "⚠️ Não entendi a data.\n\nDigite no formato DD/MM (ex: 15/01) ou:\n• *esta semana*\n• *próximo mês*"
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Salvar data e avançar para forma de pagamento
      await supabase
        .from("atendimentos_bot")
        .update({
          meta_dados: { 
            ...metaDados, 
            estado_atual: "AGUARDANDO_FORMA_PGTO",
            data_vencimento: dataVencimento
          }
        })
        .eq("id", sessao.id);

      const dataFormatada = new Date(dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR');

      return new Response(JSON.stringify({
        text: `📅 Data do ressarcimento: *${dataFormatada}*\n\n💳 *Como prefere receber?*\n\n1️⃣ PIX\n2️⃣ Dinheiro\n\nDigite 1 ou 2`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== ESTADO: AGUARDANDO_FORMA_PGTO ==========
    if (estadoAtual === "AGUARDANDO_FORMA_PGTO") {
      // Cancelamento
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
        const itensRemovidos = await deletarAnexosSessao(supabase, metaDados.itens);
        
        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: { 
              ...metaDados, 
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
              itens_removidos: itensRemovidos
            }
          })
          .eq("id", sessao.id);

        return new Response(JSON.stringify({
          text: `❌ Solicitação cancelada. ${itensRemovidos} comprovante(s) descartado(s).`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Processar escolha
      const escolha = (mensagem || "").trim();
      let formaPagamento: "pix" | "dinheiro";

      if (escolha === "1" || escolha.toLowerCase().includes("pix")) {
        formaPagamento = "pix";
      } else if (escolha === "2" || escolha.toLowerCase().includes("dinheiro")) {
        formaPagamento = "dinheiro";
      } else {
        return new Response(JSON.stringify({
          text: "⚠️ Opção inválida.\n\nDigite:\n1️⃣ PIX\n2️⃣ Dinheiro"
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ===== CRIAR SOLICITAÇÃO DE REEMBOLSO E ITENS (ADR-001) =====
      // Seguindo arquitetura: itens_reembolso = Fato Gerador (competência)
      // transacoes_financeiras será criada apenas no momento do PAGAMENTO pelo tesoureiro
      
      // 1. Criar solicitação de reembolso (status rascunho para RLS, depois pendente)
      const { data: solicitacao, error: solError } = await supabase
        .from("solicitacoes_reembolso")
        .insert({
          solicitante_id: metaDados.pessoa_id,
          status: "rascunho", // RLS permite inserir itens apenas com status rascunho
          forma_pagamento_preferida: formaPagamento,
          data_vencimento: metaDados.data_vencimento,
          observacoes: `Solicitação via WhatsApp\n${metaDados.itens.length} comprovante(s)`
        })
        .select("id")
        .single();

      if (solError || !solicitacao) {
        console.error("Erro ao criar solicitação:", solError);
        return new Response(JSON.stringify({
          text: "❌ Erro ao criar solicitação. Tente novamente."
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Criar ITENS de reembolso (fato gerador/competência - para DRE)
      const itensCriados: string[] = [];
      for (const item of metaDados.itens) {
        const { data: itemReembolso, error: itemError } = await supabase
          .from("itens_reembolso")
          .insert({
            solicitacao_id: solicitacao.id,
            descricao: item.descricao || `Comprovante - ${item.fornecedor || 'N/A'}`,
            valor: item.valor || 0,
            data_item: item.data_emissao || new Date().toISOString().split('T')[0],
            categoria_id: item.categoria_sugerida_id,
            subcategoria_id: item.subcategoria_sugerida_id,
            centro_custo_id: item.centro_custo_sugerido_id,
            foto_url: item.anexo_storage,
            // fornecedor_id e base_ministerial_id ficam null por ora (podem ser preenchidos na tela)
          })
          .select("id")
          .single();

        if (!itemError && itemReembolso) {
          itensCriados.push(itemReembolso.id);
        } else {
          console.error("Erro ao criar item de reembolso:", itemError);
        }
      }

      // 3. Atualizar status para pendente (agora que os itens foram criados)
      const { error: updateStatusError } = await supabase
        .from("solicitacoes_reembolso")
        .update({ status: "pendente" })
        .eq("id", solicitacao.id);

      if (updateStatusError) {
        console.error("Erro ao atualizar status:", updateStatusError);
      }

      // 3.5 Disparar notificação para tesoureiros/admins (apenas após confirmação bem-sucedida)
      if (!updateStatusError) {
        try {
          const solicitanteNome = metaDados.nome_perfil || "Membro";
          const valorFormatado = formatarValor(metaDados.valor_total_acumulado);
          
          await supabase.functions.invoke("disparar-alerta", {
            body: {
              evento: "financeiro_reembolso_aprovacao",
              dados: {
                solicitante: solicitanteNome,
                valor: valorFormatado,
                itens: metaDados.itens.length,
                solicitacao_id: solicitacao.id,
                forma_pagamento: formaPagamento,
                link: `/financas/reembolsos?id=${solicitacao.id}`
              }
            }
          });
          console.log(`[Financeiro] Notificação de reembolso enviada para tesoureiros`);
        } catch (notifyErr) {
          console.error("Erro ao notificar tesoureiro (não bloqueia fluxo):", notifyErr);
        }
      }

      // 4. Encerrar sessão
      await supabase
        .from("atendimentos_bot")
        .update({
          status: "CONCLUIDO",
          meta_dados: { 
            ...metaDados, 
            estado_atual: "FINALIZADO",
            forma_pagamento: formaPagamento,
            resultado: "REEMBOLSO_CRIADO",
            solicitacao_reembolso_id: solicitacao.id,
            itens_ids: itensCriados
          }
        })
        .eq("id", sessao.id);

      const dataFormatada = new Date(metaDados.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR');
      const formaPgtoTexto = formaPagamento === "pix" ? "PIX" : "Dinheiro";

      return new Response(JSON.stringify({
        text: `✅ *Reembolso Solicitado!*\n\n💰 Valor: ${formatarValor(metaDados.valor_total_acumulado)}\n📦 Itens: ${metaDados.itens.length}\n📅 Previsão: ${dataFormatada}\n💳 Forma: ${formaPgtoTexto}\n\n🔖 Protocolo: #${solicitacao.id.slice(0,8).toUpperCase()}\n\nO financeiro irá analisar e aprovar.`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Estado não reconhecido - reset
    return new Response(JSON.stringify({
      text: "⚠️ Sessão em estado inválido. Digite *Cancelar* para reiniciar."
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
