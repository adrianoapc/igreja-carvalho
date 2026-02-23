import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import {
  getWebhookSecret,
  getActiveWhatsAppProvider,
} from "../_shared/secrets.ts";
import { normalizarTelefone, formatarParaWhatsApp } from "../_shared/telefone-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Estados da máquina de estados
type EstadoSessao =
  | "AGUARDANDO_FORMA_INICIAL" // Pergunta forma antes dos comprovantes (fluxo DESPESAS)
  | "AGUARDANDO_COMPROVANTES"
  | "AGUARDANDO_OBSERVACAO"    // Pergunta observação/contexto após comprovantes
  | "AGUARDANDO_DATA"
  | "AGUARDANDO_FORMA_PGTO"
  // Estados para fluxo TRANSFERENCIA
  | "TRANSFERENCIA_AGUARDANDO_CONTA_ORIGEM"
  | "TRANSFERENCIA_AGUARDANDO_CONFIRMACAO"
  | "FINALIZADO";

interface ItemProcessado {
  anexo_original: string;
  anexo_storage: string;
  anexo_storage_path: string;
  anexo_content_type: string;
  anexo_is_pdf: boolean;
  valor: number;
  fornecedor: string | null;
  fornecedor_id: string | null;
  data_emissao: string | null;
  descricao: string | null;
  categoria_sugerida_id: string | null;
  subcategoria_sugerida_id: string | null;
  centro_custo_sugerido_id: string | null;
  base_ministerial_sugerido_id: string | null;
  processado_em: string;
  // Campos específicos para detecção de depósito
  tipo_documento?: "nota_fiscal" | "comprovante_deposito" | "outro";
  banco_detectado?: string | null;
  cnpj_banco_detectado?: string | null;
}

// Dados de transferência detectada via OCR
interface DadosTransferencia {
  valor: number;
  banco_destino: string | null;
  cnpj_banco: string | null;
  data_deposito: string | null;
  conta_origem_sugerida_id?: string | null;
  conta_destino_sugerida_id?: string | null;
  descricao?: string | null;
}

interface MetaDados {
  contexto: string;
  fluxo: "REEMBOLSO" | "CONTA_UNICA" | "DESPESAS" | "TRANSFERENCIA";
  pessoa_id?: string;
  nome_perfil?: string;
  estado_atual: EstadoSessao;
  itens: ItemProcessado[];
  valor_total_acumulado: number;
  data_vencimento?: string;
  forma_pagamento?: "pix" | "dinheiro" | "cartao" | "boleto" | "a_definir";
  baixa_automatica?: boolean;
  observacao_usuario?: string;
  resultado?: string;
  itens_removidos?: number;
  // Campos específicos para TRANSFERENCIA
  transferencia?: DadosTransferencia;
  conta_origem_id?: string;
  conta_destino_id?: string;
  anexo_comprovante?: string;
}

// Função para fazer download de anexo do WhatsApp e upload para Storage
interface AnexoPersistido {
  storagePath: string;
  signedUrl: string;
  contentType: string;
  isPdf: boolean;
}

// Função auxiliar para resolver media_id para URL real via Graph API
async function resolverMediaUrl(
  mediaIdOrUrl: string,
  whatsappToken?: string
): Promise<string | null> {
  // Se já é uma URL válida, retornar diretamente
  if (mediaIdOrUrl.startsWith("http://") || mediaIdOrUrl.startsWith("https://")) {
    return mediaIdOrUrl;
  }

  // Se é só números, é um media_id - precisa buscar a URL na Graph API
  if (/^\d+$/.test(mediaIdOrUrl) && whatsappToken) {
    try {
      console.log(`[Storage] Resolvendo media_id ${mediaIdOrUrl} via Graph API...`);
      const urlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaIdOrUrl}`, {
        headers: { Authorization: `Bearer ${whatsappToken}` },
      });
      
      if (!urlRes.ok) {
        console.error(`[Storage] Erro ao buscar media URL: ${urlRes.status}`);
        return null;
      }
      
      const mediaData = await urlRes.json();
      if (!mediaData.url) {
        console.error("[Storage] Graph API não retornou URL:", mediaData);
        return null;
      }
      
      console.log(`[Storage] URL obtida com sucesso`);
      return mediaData.url;
    } catch (e) {
      console.error("[Storage] Erro ao resolver media_id:", e);
      return null;
    }
  }

  console.error(`[Storage] Formato de URL/media_id inválido: ${mediaIdOrUrl.slice(0, 50)}`);
  return null;
}

async function persistirAnexo(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  urlOriginalOrMediaId: string,
  sessaoId: string,
  whatsappToken?: string
): Promise<AnexoPersistido | null> {
  try {
    // Primeiro, resolver o media_id para URL real se necessário
    const urlOriginal = await resolverMediaUrl(urlOriginalOrMediaId, whatsappToken);
    
    if (!urlOriginal) {
      console.error(`[Storage] Não foi possível resolver URL para: ${urlOriginalOrMediaId.slice(0, 50)}`);
      return null;
    }
    
    console.log(`[Storage] Baixando anexo: ${urlOriginal.slice(0, 50)}...`);

    // Download do arquivo do WhatsApp (COM autenticação, igual ao chatbot-triagem)
    const fetchHeaders: Record<string, string> = {};
    if (whatsappToken) {
      fetchHeaders.Authorization = `Bearer ${whatsappToken}`;
    }
    const response = await fetch(urlOriginal, { headers: fetchHeaders });
    if (!response.ok) {
      console.error(`[Storage] Erro ao baixar: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Detectar tipo de arquivo pelo content-type ou magic bytes
    let contentType = response.headers.get("content-type") || "";

    // Verificar magic bytes para PDFs (%PDF-)
    const pdfMagic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const isPdfByMagic =
      uint8Array.length >= 5 &&
      pdfMagic.every((byte, i) => uint8Array[i] === byte);

    // Determinar tipo real
    const isPdf =
      isPdfByMagic ||
      contentType.includes("pdf") ||
      contentType.includes("application/octet-stream");

    if (isPdf) {
      contentType = "application/pdf";
    } else if (!contentType || contentType.includes("octet-stream")) {
      contentType = "image/jpeg";
    }

    const extension = isPdf
      ? "pdf"
      : contentType.includes("png")
        ? "png"
        : "jpg";

    // Nome do arquivo no Storage
    const timestamp = Date.now();
    const fileName = `whatsapp/${sessaoId}/${timestamp}.${extension}`;

    // Upload para o bucket transaction-attachments
    const { error } = await supabase.storage
      .from("transaction-attachments")
      .upload(fileName, uint8Array, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error(`[Storage] Erro no upload:`, error);
      return null;
    }

    // Gerar signed URL (bucket privado)
    const { data: signedUrlData, error: signError } = await supabase.storage
      .from("transaction-attachments")
      .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 ano de validade

    if (signError || !signedUrlData?.signedUrl) {
      console.error(`[Storage] Erro ao gerar signed URL:`, signError);
      // Fallback para public URL se signed falhar
      const { data: publicData } = supabase.storage
        .from("transaction-attachments")
        .getPublicUrl(fileName);

      console.log(`[Storage] Anexo salvo (public fallback): ${fileName}`);
      return {
        storagePath: fileName,
        signedUrl: publicData?.publicUrl || "",
        contentType,
        isPdf,
      };
    }

    console.log(
      `[Storage] Anexo salvo com signed URL: ${fileName} (${isPdf ? "PDF" : "Image"})`
    );
    return {
      storagePath: fileName,
      signedUrl: signedUrlData.signedUrl,
      contentType,
      isPdf,
    };
  } catch (error) {
    console.error(`[Storage] Erro ao persistir anexo:`, error);
    return null;
  }
}

// Função para processar nota fiscal via edge function (imagens e PDFs)
async function processarNotaFiscal(
  supabaseUrl: string,
  serviceKey: string,
  base64Data: string,
  mimeType: string = "image/jpeg",
  igrejaId?: string
): Promise<{
  valor: number;
  fornecedor: string | null;
  fornecedor_id: string | null;
  data_emissao: string | null;
  descricao: string | null;
  categoria_sugerida_id: string | null;
  subcategoria_sugerida_id: string | null;
  centro_custo_sugerido_id: string | null;
  base_ministerial_sugerido_id: string | null;
} | null> {
  try {
    console.log(`[OCR] Processando arquivo: ${mimeType}`);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/processar-nota-fiscal`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          igreja_id: igrejaId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OCR] Erro: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.dados) {
      console.error("[OCR] Resposta sem dados:", data);
      return null;
    }

    return {
      valor: data.dados.valor_total || 0,
      fornecedor: data.dados.fornecedor_nome || null,
      fornecedor_id: data.dados.fornecedor_id || null,
      data_emissao: data.dados.data_emissao || null,
      descricao: data.dados.descricao || null,
      categoria_sugerida_id: data.dados.categoria_sugerida_id || null,
      subcategoria_sugerida_id: data.dados.subcategoria_sugerida_id || null,
      centro_custo_sugerido_id: data.dados.centro_custo_sugerido_id || null,
      base_ministerial_sugerido_id: data.dados.base_ministerial_sugerido_id || null,
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
        const pathMatch = url.pathname.match(
          /\/storage\/v1\/object\/public\/transaction-attachments\/(.+)/
        );
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

    // Token WhatsApp global como fallback (será substituído por multi-tenant quando tivermos igreja_id)
    let whatsappToken = Deno.env.get("WHATSAPP_API_TOKEN");

    // 1. Recebe o Payload do Make
    // Suporta 2 formatos:
    // (a) Payload "flat" que já vem normalizado pelo Make
    // (b) Payload bruto do webhook do WhatsApp (messages[].document.url, etc.)
    const body = await req.json();

    // Extrair whatsapp_number do body (vem do Make)
    const whatsappNumber =
      body?.whatsapp_number ?? body?.display_phone_number ?? null;
    const phoneNumberId = body?.phone_number_id ?? null;

    // Normalizar número WhatsApp (remover formatação)
    const normalizeDisplayPhone = (tel?: string | null) =>
      (tel || "").replace(/\D/g, "");
    const whatsappNumeroNormalizado = normalizeDisplayPhone(whatsappNumber);

    // Tentar pegar igreja_id diretamente ou buscar via whatsapp_number
    let igrejaId =
      body?.igreja_id ?? new URL(req.url).searchParams.get("igreja_id");
    let filialIdFromWhatsApp: string | null = null;

    // Se não veio igreja_id mas veio whatsapp_number, buscar na tabela whatsapp_numeros
    if (!igrejaId && whatsappNumeroNormalizado) {
      console.log(
        `[Financeiro] Buscando igreja pelo whatsapp_number: ${whatsappNumeroNormalizado}`
      );

      const { data: rota, error: rotaError } = await supabase
        .from("whatsapp_numeros")
        .select("igreja_id, filial_id")
        .eq("display_phone_number", whatsappNumeroNormalizado)
        .eq("enabled", true)
        .maybeSingle();

      if (rotaError) {
        console.error(
          `[Financeiro] Erro ao buscar whatsapp_numeros:`,
          rotaError
        );
      }

      if (rota) {
        igrejaId = rota.igreja_id;
        filialIdFromWhatsApp = rota.filial_id;
        console.log(
          `[Financeiro] Igreja encontrada via whatsapp_number: ${igrejaId}, filial: ${filialIdFromWhatsApp}`
        );
      }
    }

    if (!igrejaId) {
      console.error(
        `[Financeiro] igreja_id não encontrado. whatsapp_number: ${whatsappNumber}`
      );
      return new Response(
        JSON.stringify({
          error:
            "igreja_id é obrigatório. Envie no body ou configure o whatsapp_number na tabela whatsapp_numeros.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const makeMsg = Array.isArray(body?.messages) ? body.messages[0] : null;
    const makeTipo = makeMsg?.type ?? null;

    const telefone =
      body.telefone ??
      makeMsg?.from ??
      body.from ??
      body?.contacts?.[0]?.wa_id ??
      null;
    const origem_canal =
      body.origem_canal ?? body.origem ?? body.messaging_product ?? "whatsapp";
    const nome_perfil =
      body.nome_perfil ?? body?.contacts?.[0]?.profile?.name ?? null;

    // Mensagem texto pode vir em diferentes campos
    const mensagem =
      body.mensagem ?? body.text ?? makeMsg?.text?.body ?? body.message ?? null;

    const tipo = body.tipo ?? makeTipo ?? null;

    // URL do anexo (document/image) pode vir "flat" ou dentro de messages[0].document.url
    const url_anexo =
      body.url_anexo ||
      body.url_documento ||
      body.document_url ||
      body.media_url ||
      body.url ||
      makeMsg?.document?.url ||
      makeMsg?.image?.url ||
      null;

    if (!telefone || !origem_canal) {
      throw new Error("Telefone e origem_canal são obrigatórios.");
    }

    console.log(
      `[Financeiro] Msg de ${telefone} no canal ${origem_canal}: ${mensagem || tipo}`
    );

    // Log detalhado para debug de anexos
    if (tipo === "image" || tipo === "document") {
      console.log(
        `[Financeiro] Anexo recebido - tipo: ${tipo}, url_anexo: ${url_anexo ? "presente" : "AUSENTE"}`
      );
      console.log(`[Financeiro] Campos do body:`, Object.keys(body).join(", "));
      if (!url_anexo) {
        console.log(
          `[Financeiro] Body completo para debug:`,
          JSON.stringify(body).slice(0, 2000)
        );
      }
    }

    // 2. Valida se o telefone pertence a um membro autorizado
    // Normaliza telefone usando utilitário compartilhado
    const telefoneNormalizado = normalizarTelefone(telefone) || telefone.replace(/\D/g, "").slice(-11);

    // OBS: Não usamos maybeSingle aqui porque o mesmo telefone pode estar duplicado em mais de um perfil
    // (ex.: pai/filho ou registros duplicados). Nesse caso, escolhemos o melhor candidato.
    const { data: candidatosAutorizados, error: authError } = await supabase
      .from("profiles")
      .select(
        "id, nome, telefone, autorizado_bot_financeiro, created_at, data_nascimento"
      )
      .eq("autorizado_bot_financeiro", true)
      .eq("igreja_id", igrejaId)
      .filter("telefone", "ilike", `%${telefoneNormalizado.slice(-9)}%`) // Busca pelos 9 dígitos finais
      .limit(5);

    // Função auxiliar para normalizar telefone do DB usando utilitário compartilhado
    const normalizarTelefoneDB = (t?: string | null) => normalizarTelefone(t) || "";

    const escolherMelhorCandidato = (rows: typeof candidatosAutorizados) => {
      const lista = rows || [];
      if (lista.length === 0) return null;

      const alvo11 = telefoneNormalizado;
      const alvo9 = telefoneNormalizado.slice(-9);

      // 1) Match exato pelos 11 dígitos (DDD + número)
      const exato11 = lista.find(
        (p) => normalizarTelefoneDB(p.telefone) === alvo11
      );
      if (exato11) return exato11;

      // 2) Match pelos 9 dígitos finais (número)
      const exato9 = lista.find((p) =>
        normalizarTelefoneDB(p.telefone).endsWith(alvo9)
      );
      if (exato9) return exato9;

      // 3) Fallback: mais antigo (menor data_nascimento) e depois criado primeiro
      return [...lista].sort((a, b) => {
        const aNasc = a.data_nascimento
          ? new Date(a.data_nascimento).getTime()
          : Number.POSITIVE_INFINITY;
        const bNasc = b.data_nascimento
          ? new Date(b.data_nascimento).getTime()
          : Number.POSITIVE_INFINITY;
        if (aNasc !== bNasc) return aNasc - bNasc;

        const aCreated = a.created_at
          ? new Date(a.created_at).getTime()
          : Number.POSITIVE_INFINITY;
        const bCreated = b.created_at
          ? new Date(b.created_at).getTime()
          : Number.POSITIVE_INFINITY;
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
        (candidatosAutorizados || []).map((p) => ({
          id: p.id,
          nome: p.nome,
          telefone: p.telefone,
        }))
      );
    }

    if (authError) {
      console.error("Erro ao validar membro:", authError);
    }

    if (!membroAutorizado) {
      console.log(
        `[Financeiro] Telefone ${telefone} não autorizado para bot financeiro`
      );
      return new Response(
        JSON.stringify({
          text: "⚠️ Você não está autorizado a usar o assistente financeiro. Solicite acesso à secretaria.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[Financeiro] Membro autorizado: ${membroAutorizado.nome} (${membroAutorizado.id})`
    );

    // 3. Busca Sessão Ativa
    let querySessao = supabase
      .from("atendimentos_bot")
      .select("*")
      .eq("telefone", telefone)
      .eq("origem_canal", origem_canal)
      .eq("igreja_id", igrejaId)
      .neq("status", "CONCLUIDO");
    if (phoneNumberId) {
      querySessao = querySessao.contains("meta_dados", {
        phone_number_id: phoneNumberId,
      });
    }
    const { data: sessao, error: searchError } =
      await querySessao.maybeSingle();

    if (searchError) {
      console.error("Erro ao buscar sessão:", searchError);
      throw searchError;
    }

    // --- CENÁRIO A: SEM SESSÃO ATIVA (Início) ---
    if (!sessao) {
      const texto = (mensagem || "").toLowerCase();
      const isReembolso = texto.includes("reembolso");
      const isContaUnica = texto.includes("conta") || texto.includes("nota");
      const isDespesas = texto.includes("despesa") || texto.includes("gasto");
      const isTransferencia = texto.includes("transferência") || texto.includes("transferencia") || 
                              texto.includes("depósito") || texto.includes("deposito");
      const isGatilho = isReembolso || isContaUnica || isDespesas || isTransferencia;

      // Fluxo TRANSFERENCIA - depósito entre contas
      if (isTransferencia) {
        // Buscar contas disponíveis e mapeamentos configurados
        const { data: contasAtivas } = await supabase
          .from("contas")
          .select("id, nome, tipo, banco, cnpj_banco")
          .eq("ativo", true)
          .eq("igreja_id", igrejaId)
          .order("nome");

        const { data: configFinanceiro } = await supabase
          .from("financeiro_config")
          .select("mapeamentos_transferencia")
          .eq("igreja_id", igrejaId)
          .maybeSingle();

        const mapeamentos = (configFinanceiro?.mapeamentos_transferencia || []) as Array<{
          conta_origem_id: string;
          conta_destino_id: string;
          nome_sugestao: string;
        }>;

        // Montar lista de contas para seleção
        const listaContas = (contasAtivas || [])
          .map((c, i) => `${i + 1}️⃣ ${c.nome}${c.banco ? ` (${c.banco})` : ""}`)
          .join("\n");

        const metaDadosInicial: MetaDados = {
          contexto: "FINANCEIRO",
          fluxo: "TRANSFERENCIA",
          pessoa_id: membroAutorizado.id,
          nome_perfil: nome_perfil || membroAutorizado.nome,
          estado_atual: "TRANSFERENCIA_AGUARDANDO_CONTA_ORIGEM",
          itens: [],
          valor_total_acumulado: 0,
          transferencia: {
            valor: 0,
            banco_destino: null,
            cnpj_banco: null,
            data_deposito: null,
          },
        };

        await supabase.from("atendimentos_bot").insert({
          telefone,
          origem_canal,
          pessoa_id: membroAutorizado.id,
          status: "EM_ANDAMENTO",
          meta_dados: {
            ...metaDadosInicial,
            phone_number_id: phoneNumberId ?? null,
            display_phone_number: whatsappNumeroNormalizado || null,
            contas_disponiveis: contasAtivas || [],
            mapeamentos_transferencia: mapeamentos,
          },
          igreja_id: igrejaId,
        });

        return new Response(
          JSON.stringify({
            text: `🔄 *Transferência entre Contas*\n\n📸 Envie o *comprovante de depósito* para detectar automaticamente.\n\nOu informe manualmente:\n\n💰 *De qual conta está saindo o dinheiro?*\n\n${listaContas}\n\nDigite o número ou envie o comprovante.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fluxo DESPESAS - pergunta forma de pagamento primeiro
      if (isDespesas) {
        const metaDadosInicial: MetaDados = {
          contexto: "FINANCEIRO",
          fluxo: "DESPESAS",
          pessoa_id: membroAutorizado.id,
          nome_perfil: nome_perfil || membroAutorizado.nome,
          estado_atual: "AGUARDANDO_FORMA_INICIAL",
          itens: [],
          valor_total_acumulado: 0,
        };

        await supabase.from("atendimentos_bot").insert({
          telefone,
          origem_canal,
          pessoa_id: membroAutorizado.id,
          status: "EM_ANDAMENTO",
          meta_dados: {
            ...metaDadosInicial,
            phone_number_id: phoneNumberId ?? null,
            display_phone_number: whatsappNumeroNormalizado || null,
          },
          igreja_id: igrejaId,
        });

        return new Response(
          JSON.stringify({
            text: `💸 Registro de Despesa iniciado!\n\n💳 *Como foi paga essa despesa?*\n\n1️⃣ Dinheiro/Espécie\n2️⃣ PIX (já transferido)\n3️⃣ Cartão/Boleto (a pagar)\n4️⃣ A definir pelo tesoureiro\n\nDigite o número da opção.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fluxos existentes: REEMBOLSO e CONTA_UNICA
      if (isGatilho) {
        const metaDadosInicial: MetaDados = {
          contexto: "FINANCEIRO",
          fluxo: isReembolso ? "REEMBOLSO" : "CONTA_UNICA",
          pessoa_id: membroAutorizado.id,
          nome_perfil: nome_perfil || membroAutorizado.nome,
          estado_atual: "AGUARDANDO_COMPROVANTES",
          itens: [],
          valor_total_acumulado: 0,
        };

        await supabase.from("atendimentos_bot").insert({
          telefone,
          origem_canal,
          pessoa_id: membroAutorizado.id,
          status: "EM_ANDAMENTO",
          meta_dados: {
            ...metaDadosInicial,
            phone_number_id: phoneNumberId ?? null,
            display_phone_number: whatsappNumeroNormalizado || null,
          },
          igreja_id: igrejaId,
        });

        const tipoFluxo = isReembolso ? "Reembolso" : "Nova Conta";
        return new Response(
          JSON.stringify({
            text: `🧾 Modo ${tipoFluxo} iniciado!\n\nEnvie a(s) foto(s) dos comprovantes.\nDigite *Fechar* quando terminar.\nDigite *Cancelar* para desistir.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          text: "Olá! Sou o assistente financeiro. Para iniciar:\n\n• *Despesas* - registrar gastos (dinheiro, PIX, cartão)\n• *Reembolso* - solicitar ressarcimento pessoal\n• *Nova Conta* - registrar conta a pagar\n• *Transferência* - movimentar entre contas (depósito)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- CENÁRIO B: SESSÃO ATIVA (Processamento) ---
    const metaDados = (sessao.meta_dados || {}) as MetaDados;
    const estadoAtual = metaDados.estado_atual || "AGUARDANDO_COMPROVANTES";

    // ========== ESTADO: AGUARDANDO_FORMA_INICIAL (Fluxo DESPESAS) ==========
    if (estadoAtual === "AGUARDANDO_FORMA_INICIAL") {
      const escolha = (mensagem || "").trim();
      let formaPagamento: "pix" | "dinheiro" | "cartao" | "boleto" | "a_definir";
      let baixaAutomatica: boolean;

      switch (escolha) {
        case "1":
          formaPagamento = "dinheiro";
          baixaAutomatica = true;
          break;
        case "2":
          formaPagamento = "pix";
          baixaAutomatica = true; // PIX já transferido = baixa
          break;
        case "3":
          formaPagamento = "cartao";
          baixaAutomatica = false; // Aguarda confirmação do tesoureiro
          break;
        case "4":
          formaPagamento = "a_definir";
          baixaAutomatica = false;
          break;
        default:
          // Também aceitar cancelamento neste estado
          if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
            await supabase
              .from("atendimentos_bot")
              .update({
                status: "CONCLUIDO",
                meta_dados: {
                  ...metaDados,
                  estado_atual: "FINALIZADO",
                  resultado: "CANCELADO_PELO_USUARIO",
                },
              })
              .eq("id", sessao.id)
              .eq("igreja_id", igrejaId);

            return new Response(
              JSON.stringify({
                text: "❌ Solicitação cancelada.\n\nDigite *Despesas*, *Reembolso* ou *Nova Conta* para iniciar novamente.",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({
              text: "⚠️ Opção inválida. Digite 1, 2, 3 ou 4.\n\n1️⃣ Dinheiro/Espécie\n2️⃣ PIX (já transferido)\n3️⃣ Cartão/Boleto (a pagar)\n4️⃣ A definir pelo tesoureiro",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }

      // Salvar forma de pagamento e avançar para comprovantes
      await supabase
        .from("atendimentos_bot")
        .update({
          meta_dados: {
            ...metaDados,
            estado_atual: "AGUARDANDO_COMPROVANTES",
            forma_pagamento: formaPagamento,
            baixa_automatica: baixaAutomatica,
          },
        })
        .eq("id", sessao.id)
        .eq("igreja_id", igrejaId);

      const textoForma: Record<string, string> = {
        dinheiro: "Dinheiro/Espécie",
        pix: "PIX",
        cartao: "Cartão/Boleto",
        a_definir: "A definir",
      };

      const msgBaixa = baixaAutomatica
        ? "💚 Baixa automática será aplicada ao finalizar."
        : "⏳ Tesoureiro irá aprovar o pagamento.";

      return new Response(
        JSON.stringify({
          text: `✅ Forma: *${textoForma[formaPagamento]}*\n${msgBaixa}\n\n📸 Agora envie a(s) foto(s) dos comprovantes.\nDigite *Fechar* quando terminar.\nDigite *Cancelar* para desistir.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ESTADO: AGUARDANDO_COMPROVANTES ==========
    if (estadoAtual === "AGUARDANDO_COMPROVANTES") {
      // B1. Recebimento de Arquivos (Imagens/PDFs)
      if (tipo === "image" || tipo === "document") {
        if (!url_anexo) {
          return new Response(
            JSON.stringify({ text: "Erro: Anexo sem URL." }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Baixar e salvar no Storage permanentemente
        const anexoResult = await persistirAnexo(
          supabase,
          url_anexo,
          sessao.id,
          whatsappToken
        );

        if (!anexoResult) {
          return new Response(
            JSON.stringify({
              text: "⚠️ Erro ao salvar o comprovante. Por favor, tente enviar novamente.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Processar via OCR para extrair dados (imagens E PDFs)
        let dadosNota: Awaited<ReturnType<typeof processarNotaFiscal>> = null;

        try {
          // Usar a URL do storage (já resolvida e salva) para o OCR
          // Não usar url_anexo diretamente pois pode ser um media_id
          const urlParaOcr = anexoResult.signedUrl;
          console.log(`[OCR] Baixando arquivo do storage para processamento...`);
          
          const fileResponse = await fetch(urlParaOcr);
          if (!fileResponse.ok) {
            throw new Error(`Erro ao baixar do storage: ${fileResponse.status}`);
          }
          
          const fileBuffer = await fileResponse.arrayBuffer();
          const uint8Arr = new Uint8Array(fileBuffer);
          
          // Converter para base64 de forma mais robusta
          let base64 = '';
          const chunkSize = 0x8000; // 32KB chunks
          for (let i = 0; i < uint8Arr.length; i += chunkSize) {
            const chunk = uint8Arr.subarray(i, Math.min(i + chunkSize, uint8Arr.length));
            base64 += String.fromCharCode.apply(null, Array.from(chunk));
          }
          base64 = btoa(base64);

          // Determinar mimeType
          const mimeType = anexoResult.isPdf
            ? "application/pdf"
            : anexoResult.contentType;

          console.log(`[OCR] Enviando para processamento: ${mimeType}, ${Math.round(uint8Arr.length/1024)}KB`);

          dadosNota = await processarNotaFiscal(
            supabaseUrl,
            supabaseKey,
            base64,
            mimeType,
            igrejaId
          );
          
          console.log(`[OCR] Resultado: valor=${dadosNota?.valor}, fornecedor=${dadosNota?.fornecedor}`);
        } catch (e) {
          console.error("[OCR] Erro ao processar para OCR:", e);
        }

        // Criar item processado
        const novoItem: ItemProcessado = {
          anexo_original: url_anexo,
          anexo_storage: anexoResult.signedUrl,
          anexo_storage_path: anexoResult.storagePath,
          anexo_content_type: anexoResult.contentType,
          anexo_is_pdf: anexoResult.isPdf,
          valor: dadosNota?.valor || 0,
          fornecedor: dadosNota?.fornecedor || null,
          fornecedor_id: dadosNota?.fornecedor_id || null,
          data_emissao: dadosNota?.data_emissao || null,
          descricao: dadosNota?.descricao || null,
          categoria_sugerida_id: dadosNota?.categoria_sugerida_id || null,
          subcategoria_sugerida_id: dadosNota?.subcategoria_sugerida_id || null,
          centro_custo_sugerido_id: dadosNota?.centro_custo_sugerido_id || null,
          base_ministerial_sugerido_id: dadosNota?.base_ministerial_sugerido_id || null,
          processado_em: new Date().toISOString(),
        };

        // Atualizar metadados
        const itensAtualizados = [...metaDados.itens, novoItem];
        const valorTotal = itensAtualizados.reduce(
          (acc, item) => acc + item.valor,
          0
        );

        await supabase
          .from("atendimentos_bot")
          .update({
            meta_dados: {
              ...metaDados,
              itens: itensAtualizados,
              valor_total_acumulado: valorTotal,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        // Resposta com resumo do item
        let resposta = `📥 Comprovante ${itensAtualizados.length} recebido!\n`;
        if (dadosNota?.valor) {
          resposta += `💰 Valor: ${formatarValor(dadosNota.valor)}\n`;
        }
        if (dadosNota?.fornecedor) {
          resposta += `🏪 ${dadosNota.fornecedor}\n`;
        }
        resposta += `\n📊 Total acumulado: ${formatarValor(valorTotal)} (${itensAtualizados.length} ${itensAtualizados.length === 1 ? "item" : "itens"})\n`;
        resposta += `\nEnvie mais ou digite *Fechar* para concluir.`;

        return new Response(JSON.stringify({ text: resposta }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // B2. Cancelamento
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
        const itensRemovidos = await deletarAnexosSessao(
          supabase,
          metaDados.itens
        );

        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: {
              ...metaDados,
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
              itens_removidos: itensRemovidos,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        console.log(
          `[Financeiro] Sessão ${sessao.id} cancelada. ${itensRemovidos} anexos removidos.`
        );

        return new Response(
          JSON.stringify({
            text: `❌ Solicitação cancelada.\n${itensRemovidos > 0 ? `${itensRemovidos} comprovante(s) descartado(s).` : ""}\n\nDigite *Reembolso* ou *Nova Conta* para iniciar novamente.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // B3. Finalização (Comando 'Fechar') - TRANSIÇÃO PARA AGUARDANDO_OBSERVACAO
      if (
        mensagem &&
        mensagem.toLowerCase().match(/fechar|fim|pronto|encerrar/)
      ) {
        const qtdItens = metaDados.itens.length;

        if (qtdItens === 0) {
          return new Response(
            JSON.stringify({
              text: "⚠️ Nenhum comprovante foi enviado ainda.\n\nEnvie a foto antes de fechar ou digite *Cancelar* para desistir.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // NOVO: Transição para AGUARDANDO_OBSERVACAO (pedir comentário do usuário)
        await supabase
          .from("atendimentos_bot")
          .update({
            meta_dados: {
              ...metaDados,
              estado_atual: "AGUARDANDO_OBSERVACAO",
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        return new Response(
          JSON.stringify({
            text: `📋 *Resumo: ${qtdItens} comprovante(s)*\n💰 Total: ${formatarValor(metaDados.valor_total_acumulado)}\n\n✏️ *Deseja adicionar uma observação?*\nEx: "Lanche do infantil" ou "Material reforma cozinha"\n\nDigite a observação ou *Pular* para continuar.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mensagem genérica
      return new Response(
        JSON.stringify({
          text: "📸 Aguardando comprovantes.\n\nEnvie a foto, digite *Fechar* para concluir ou *Cancelar* para desistir.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ESTADO: AGUARDANDO_OBSERVACAO (NOVO) ==========
    if (estadoAtual === "AGUARDANDO_OBSERVACAO") {
      const texto = (mensagem || "").trim();
      
      // Verificar se quer pular
      const querPular = /^(pular|skip|nao|não|n|continuar|ok|sim|s)$/i.test(texto.toLowerCase());
      
      // Cancelamento ainda disponível
      if (texto.toLowerCase().match(/cancelar|desistir|sair/)) {
        const itensRemovidos = await deletarAnexosSessao(
          supabase,
          metaDados.itens
        );

        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: {
              ...metaDados,
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
              itens_removidos: itensRemovidos,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        return new Response(
          JSON.stringify({
            text: `❌ Solicitação cancelada. ${itensRemovidos} comprovante(s) descartado(s).`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Salvar observação (ou null se pulou)
      const observacaoFinal = querPular ? null : texto;
      
      // Decidir próximo estado baseado no fluxo
      if (metaDados.fluxo === "REEMBOLSO") {
        // Reembolso: vai para perguntar data
        await supabase
          .from("atendimentos_bot")
          .update({
            meta_dados: {
              ...metaDados,
              observacao_usuario: observacaoFinal,
              estado_atual: "AGUARDANDO_DATA",
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        const qtdItens = metaDados.itens.length;
        let msgObs = observacaoFinal ? `📝 Obs: ${observacaoFinal}\n\n` : "";
        
        return new Response(
          JSON.stringify({
            text: `${msgObs}📋 *Resumo do Reembolso*\n\n💰 Total: ${formatarValor(metaDados.valor_total_acumulado)}\n📦 Itens: ${qtdItens}\n\n📅 *Quando deseja receber o ressarcimento?*\n\nDigite a data (ex: 15/01) ou:\n• *esta semana*\n• *próximo mês*`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // FLUXO DESPESAS ou CONTA_UNICA: Finalizar e criar transações
      // Buscar conta padrão
      const { data: contaPadrao } = await supabase
        .from("contas")
        .select("id")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .limit(1)
        .single();

      if (!contaPadrao) {
        return new Response(
          JSON.stringify({
            text: "❌ Erro: Nenhuma conta financeira configurada. Contate o administrador.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Determinar status baseado na forma de pagamento (baixa automática)
      const statusTransacao = metaDados.baixa_automatica ? "pago" : "pendente";

      const textoForma: Record<string, string> = {
        dinheiro: "Dinheiro",
        pix: "PIX",
        cartao: "Cartão/Boleto",
        boleto: "Boleto",
        a_definir: "A definir",
      };

      // Mapear forma de pagamento para valor do banco
      const formasPagamentoMap: Record<string, string> = {
        dinheiro: "Dinheiro",
        pix: "PIX",
        cartao: "Cartão de Crédito",
        boleto: "Boleto Bancário",
        a_definir: "",
      };
      const formaPagamentoBanco = formasPagamentoMap[metaDados.forma_pagamento || ""] || null;

      // Criar transações para cada item
      const transacoesCriadas: string[] = [];
      for (const item of metaDados.itens) {
        // Converter data de DD/MM/YYYY para YYYY-MM-DD
        let dataVencimento = new Date().toISOString().split("T")[0];
        if (item.data_emissao) {
          const partes = item.data_emissao.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (partes) {
            dataVencimento = `${partes[3]}-${partes[2]}-${partes[1]}`;
          } else if (item.data_emissao.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dataVencimento = item.data_emissao;
          }
        }

        // Se baixa automática, data de pagamento = data do comprovante (não data atual)
        const dataPagamentoFinal = metaDados.baixa_automatica ? dataVencimento : null;

        // Montar observações incluindo o comentário do usuário
        const observacoesTransacao = [
          observacaoFinal,  // Observação do usuário primeiro
          item.descricao,
          `Fornecedor: ${item.fornecedor || "N/A"}`,
          `Origem: WhatsApp`,
          `Forma: ${metaDados.forma_pagamento || "N/A"}`,
          `Solicitante: ${metaDados.nome_perfil}`,
        ].filter(Boolean).join("\n");

        console.log(`[Transação] Criando: valor=${item.valor}, fornecedor=${item.fornecedor} (id: ${item.fornecedor_id}), data=${dataVencimento}, data_pagamento=${dataPagamentoFinal}, forma=${formaPagamentoBanco}, categoria=${item.categoria_sugerida_id}, centro_custo=${item.centro_custo_sugerido_id}, base_ministerial=${item.base_ministerial_sugerido_id}`);

        const { data: tx, error } = await supabase
          .from("transacoes_financeiras")
          .insert({
            descricao:
              item.descricao ||
              `Despesa - ${item.fornecedor || "WhatsApp"}`,
            valor: item.valor || 0,
            tipo: "saida",
            tipo_lancamento: "unico",
            data_vencimento: dataVencimento,
            data_competencia: dataVencimento, // Competência = data do comprovante
            status: statusTransacao,
            data_pagamento: dataPagamentoFinal,
            conta_id: contaPadrao.id,
            categoria_id: item.categoria_sugerida_id,
            subcategoria_id: item.subcategoria_sugerida_id,
            centro_custo_id: item.centro_custo_sugerido_id,
            base_ministerial_id: item.base_ministerial_sugerido_id,
            fornecedor_id: item.fornecedor_id,
            forma_pagamento: formaPagamentoBanco,
            anexo_url: item.anexo_storage,
            observacoes: observacoesTransacao,
            igreja_id: igrejaId,
            filial_id: filialIdFromWhatsApp,
          })
          .select("id")
          .single();

        if (error) {
          console.error(`[Transação] Erro ao criar:`, error.message, error.details);
        }
        if (tx) {
          transacoesCriadas.push(tx.id);
          console.log(`[Transação] Criada com sucesso: ${tx.id}`);
        }
      }

      // Encerrar sessão
      const resultado = metaDados.fluxo === "DESPESAS"
        ? (metaDados.baixa_automatica ? "DESPESAS_BAIXA_AUTOMATICA" : "DESPESAS_PENDENTE")
        : "CONTA_UNICA_CRIADA";

      await supabase
        .from("atendimentos_bot")
        .update({
          status: "CONCLUIDO",
          meta_dados: {
            ...metaDados,
            observacao_usuario: observacaoFinal,
            estado_atual: "FINALIZADO",
            resultado,
            transacoes_ids: transacoesCriadas,
          },
        })
        .eq("id", sessao.id)
        .eq("igreja_id", igrejaId);

      // Mensagem diferenciada por status
      let msgFinal = `✅ ${transacoesCriadas.length} despesa(s) registrada(s)!\n\n💰 Total: ${formatarValor(metaDados.valor_total_acumulado)}`;
      
      if (metaDados.fluxo === "DESPESAS" && metaDados.forma_pagamento) {
        msgFinal += `\n💳 Forma: ${textoForma[metaDados.forma_pagamento]}`;
      }
      
      if (observacaoFinal) {
        msgFinal += `\n📝 Obs: ${observacaoFinal}`;
      }
      
      if (metaDados.fluxo === "DESPESAS") {
        msgFinal += metaDados.baixa_automatica
          ? "\n\n💚 Baixa automática realizada!"
          : "\n\n⏳ Aguardando aprovação do tesoureiro.";
      } else {
        msgFinal += "\n\nO financeiro irá processar em breve.";
      }

      return new Response(
        JSON.stringify({ text: msgFinal }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ESTADO: AGUARDANDO_DATA ==========
    if (estadoAtual === "AGUARDANDO_DATA") {
      // Cancelamento ainda disponível
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
        const itensRemovidos = await deletarAnexosSessao(
          supabase,
          metaDados.itens
        );

        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: {
              ...metaDados,
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
              itens_removidos: itensRemovidos,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        return new Response(
          JSON.stringify({
            text: `❌ Solicitação cancelada. ${itensRemovidos} comprovante(s) descartado(s).`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Processar data informada
      const textoData = (mensagem || "").toLowerCase().trim();
      let dataVencimento: string;
      const hoje = new Date();

      if (
        textoData.includes("esta semana") ||
        textoData.includes("essa semana")
      ) {
        // Próxima sexta-feira
        const diasAteSexta = (5 - hoje.getDay() + 7) % 7 || 7;
        const sexta = new Date(hoje);
        sexta.setDate(hoje.getDate() + diasAteSexta);
        dataVencimento = sexta.toISOString().split("T")[0];
      } else if (
        textoData.includes("próximo mês") ||
        textoData.includes("proximo mes")
      ) {
        // Dia 5 do próximo mês
        const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 5);
        dataVencimento = proximoMes.toISOString().split("T")[0];
      } else {
        // Tentar parsear data no formato DD/MM ou DD/MM/AAAA
        const matchData = textoData.match(
          /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/
        );
        if (matchData) {
          const dia = parseInt(matchData[1]);
          const mes = parseInt(matchData[2]) - 1;
          const ano = matchData[3]
            ? matchData[3].length === 2
              ? 2000 + parseInt(matchData[3])
              : parseInt(matchData[3])
            : hoje.getFullYear();
          const dataInformada = new Date(ano, mes, dia);
          dataVencimento = dataInformada.toISOString().split("T")[0];
        } else {
          return new Response(
            JSON.stringify({
              text: "⚠️ Não entendi a data.\n\nDigite no formato DD/MM (ex: 15/01) ou:\n• *esta semana*\n• *próximo mês*",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Salvar data e avançar para forma de pagamento
      await supabase
        .from("atendimentos_bot")
        .update({
          meta_dados: {
            ...metaDados,
            estado_atual: "AGUARDANDO_FORMA_PGTO",
            data_vencimento: dataVencimento,
          },
        })
        .eq("id", sessao.id)
        .eq("igreja_id", igrejaId);

      const dataFormatada = new Date(
        dataVencimento + "T12:00:00"
      ).toLocaleDateString("pt-BR");

      return new Response(
        JSON.stringify({
          text: `📅 Data do ressarcimento: *${dataFormatada}*\n\n💳 *Como prefere receber?*\n\n1️⃣ PIX\n2️⃣ Dinheiro\n\nDigite 1 ou 2`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ESTADO: AGUARDANDO_FORMA_PGTO ==========
    if (estadoAtual === "AGUARDANDO_FORMA_PGTO") {
      // Cancelamento
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
        const itensRemovidos = await deletarAnexosSessao(
          supabase,
          metaDados.itens
        );

        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: {
              ...metaDados,
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
              itens_removidos: itensRemovidos,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        return new Response(
          JSON.stringify({
            text: `❌ Solicitação cancelada. ${itensRemovidos} comprovante(s) descartado(s).`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Processar escolha
      const escolha = (mensagem || "").trim();
      let formaPagamento: "pix" | "dinheiro";

      if (escolha === "1" || escolha.toLowerCase().includes("pix")) {
        formaPagamento = "pix";
      } else if (
        escolha === "2" ||
        escolha.toLowerCase().includes("dinheiro")
      ) {
        formaPagamento = "dinheiro";
      } else {
        return new Response(
          JSON.stringify({
            text: "⚠️ Opção inválida.\n\nDigite:\n1️⃣ PIX\n2️⃣ Dinheiro",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ===== CRIAR SOLICITAÇÃO DE REEMBOLSO E ITENS (ADR-001) =====
      // Seguindo arquitetura: itens_reembolso = Fato Gerador (competência)
      // transacoes_financeiras será criada apenas no momento do PAGAMENTO pelo tesoureiro

      // Montar observação incluindo o comentário do usuário
      const observacaoReembolso = metaDados.observacao_usuario
        ? `Solicitação via WhatsApp\n${metaDados.itens.length} comprovante(s)\n📝 ${metaDados.observacao_usuario}`
        : `Solicitação via WhatsApp\n${metaDados.itens.length} comprovante(s)`;

      // 1. Criar solicitação de reembolso (status rascunho para RLS, depois pendente)
      const { data: solicitacao, error: solError } = await supabase
        .from("solicitacoes_reembolso")
        .insert({
          solicitante_id: metaDados.pessoa_id,
          status: "rascunho", // RLS permite inserir itens apenas com status rascunho
          forma_pagamento_preferida: formaPagamento,
          data_vencimento: metaDados.data_vencimento,
          observacoes: observacaoReembolso,
          igreja_id: igrejaId,
          filial_id: filialIdFromWhatsApp,
        })
        .select("id")
        .single();

      if (solError || !solicitacao) {
        console.error("Erro ao criar solicitação:", solError);
        return new Response(
          JSON.stringify({
            text: "❌ Erro ao criar solicitação. Tente novamente.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Criar ITENS de reembolso (fato gerador/competência - para DRE)
      const itensCriados: string[] = [];
      for (const item of metaDados.itens) {
        // Incluir observação do usuário na descrição do item
        const descricaoItem = metaDados.observacao_usuario
          ? `${item.descricao || `Comprovante - ${item.fornecedor || "N/A"}`} - ${metaDados.observacao_usuario}`
          : item.descricao || `Comprovante - ${item.fornecedor || "N/A"}`;

        // Converter data de DD/MM/YYYY para YYYY-MM-DD (formato PostgreSQL)
        let dataItem = new Date().toISOString().split("T")[0];
        if (item.data_emissao) {
          const partes = item.data_emissao.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (partes) {
            dataItem = `${partes[3]}-${partes[2]}-${partes[1]}`;
          } else if (item.data_emissao.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dataItem = item.data_emissao; // Já está no formato ISO
          }
        }

        const { data: itemReembolso, error: itemError } = await supabase
          .from("itens_reembolso")
          .insert({
            solicitacao_id: solicitacao.id,
            descricao: descricaoItem,
            valor: item.valor || 0,
            data_item: dataItem,
            categoria_id: item.categoria_sugerida_id,
            subcategoria_id: item.subcategoria_sugerida_id,
            centro_custo_id: item.centro_custo_sugerido_id,
            foto_url: item.anexo_storage,
            igreja_id: igrejaId,
            filial_id: filialIdFromWhatsApp,
            fornecedor_id: item.fornecedor_id,
            base_ministerial_id: item.base_ministerial_sugerido_id,
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
        .eq("id", solicitacao.id)
        .eq("igreja_id", igrejaId);

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
                observacao: metaDados.observacao_usuario || null,
                link: `/financas/reembolsos?id=${solicitacao.id}`,
              },
              igreja_id: igrejaId,
            },
          });
          console.log(
            `[Financeiro] Notificação de reembolso enviada para tesoureiros`
          );
        } catch (notifyErr) {
          console.error(
            "Erro ao notificar tesoureiro (não bloqueia fluxo):",
            notifyErr
          );
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
            itens_ids: itensCriados,
          },
        })
        .eq("id", sessao.id)
        .eq("igreja_id", igrejaId);

      const dataFormatada = new Date(
        metaDados.data_vencimento + "T12:00:00"
      ).toLocaleDateString("pt-BR");
      const formaPgtoTexto = formaPagamento === "pix" ? "PIX" : "Dinheiro";
      
      // Incluir observação na mensagem final se existir
      const msgObs = metaDados.observacao_usuario 
        ? `\n📝 Obs: ${metaDados.observacao_usuario}` 
        : "";

      return new Response(
        JSON.stringify({
          text: `✅ *Reembolso Solicitado!*\n\n💰 Valor: ${formatarValor(metaDados.valor_total_acumulado)}\n📦 Itens: ${metaDados.itens.length}\n📅 Previsão: ${dataFormatada}\n💳 Forma: ${formaPgtoTexto}${msgObs}\n\n🔖 Protocolo: #${solicitacao.id.slice(0, 8).toUpperCase()}\n\nO financeiro irá analisar e aprovar.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ESTADO: TRANSFERENCIA_AGUARDANDO_CONTA_ORIGEM ==========
    if (estadoAtual === "TRANSFERENCIA_AGUARDANDO_CONTA_ORIGEM") {
      const contasDisponiveis = ((metaDados as any).contas_disponiveis || []) as Array<{
        id: string;
        nome: string;
        tipo: string;
        banco: string | null;
        cnpj_banco: string | null;
      }>;
      const mapeamentos = ((metaDados as any).mapeamentos_transferencia || []) as Array<{
        conta_origem_id: string;
        conta_destino_id: string;
        nome_sugestao: string;
      }>;

      // Cancelamento
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair/)) {
        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: {
              ...metaDados,
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        return new Response(
          JSON.stringify({
            text: "❌ Transferência cancelada.\n\nDigite *Transferência* para iniciar novamente.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Recebimento de imagem = comprovante de depósito
      if (tipo === "image" || tipo === "document") {
        if (!url_anexo) {
          return new Response(
            JSON.stringify({ text: "Erro: Anexo sem URL." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Persistir anexo
        const anexoResult = await persistirAnexo(supabase, url_anexo, sessao.id, whatsappToken);
        if (!anexoResult) {
          return new Response(
            JSON.stringify({ text: "⚠️ Erro ao salvar comprovante. Tente novamente." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Processar OCR para extrair dados do depósito
        let dadosDeposito: { valor: number; banco?: string; cnpj?: string; data?: string; descricao?: string } | null = null;
        try {
          const fileResponse = await fetch(anexoResult.signedUrl);
          if (fileResponse.ok) {
            const fileBuffer = await fileResponse.arrayBuffer();
            const uint8Arr = new Uint8Array(fileBuffer);
            
            let base64 = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < uint8Arr.length; i += chunkSize) {
              const chunk = uint8Arr.subarray(i, Math.min(i + chunkSize, uint8Arr.length));
              base64 += String.fromCharCode.apply(null, Array.from(chunk));
            }
            base64 = btoa(base64);

            const mimeType = anexoResult.isPdf ? "application/pdf" : anexoResult.contentType;
            const ocrResult = await processarNotaFiscal(supabaseUrl, supabaseKey, base64, mimeType, igrejaId);
            
            if (ocrResult) {
              dadosDeposito = {
                valor: ocrResult.valor || 0,
                banco: ocrResult.fornecedor || undefined,
                descricao: ocrResult.descricao || undefined,
                data: ocrResult.data_emissao || undefined,
              };
            }
          }
        } catch (e) {
          console.error("[OCR Deposito] Erro:", e);
        }

        // Tentar detectar conta destino pelo banco
        let contaDestinoSugerida: typeof contasDisponiveis[0] | undefined;
        if (dadosDeposito?.banco) {
          const bancoNome = dadosDeposito.banco.toLowerCase();
          contaDestinoSugerida = contasDisponiveis.find(c => 
            c.banco?.toLowerCase().includes(bancoNome) || 
            c.nome.toLowerCase().includes(bancoNome)
          );
        }

        // Buscar sugestão de origem via mapeamentos
        let contaOrigemSugerida: typeof contasDisponiveis[0] | undefined;
        if (contaDestinoSugerida) {
          const mapeamentoMatch = mapeamentos.find(m => m.conta_destino_id === contaDestinoSugerida!.id);
          if (mapeamentoMatch) {
            contaOrigemSugerida = contasDisponiveis.find(c => c.id === mapeamentoMatch.conta_origem_id);
          }
        }

        // Se encontrou sugestões completas, ir direto para confirmação
        if (dadosDeposito?.valor && contaOrigemSugerida && contaDestinoSugerida) {
          await supabase
            .from("atendimentos_bot")
            .update({
              meta_dados: {
                ...metaDados,
                estado_atual: "TRANSFERENCIA_AGUARDANDO_CONFIRMACAO",
                transferencia: {
                  valor: dadosDeposito.valor,
                  banco_destino: contaDestinoSugerida.banco,
                  cnpj_banco: contaDestinoSugerida.cnpj_banco,
                  data_deposito: dadosDeposito.data,
                  conta_origem_sugerida_id: contaOrigemSugerida.id,
                  conta_destino_sugerida_id: contaDestinoSugerida.id,
                  descricao: dadosDeposito.descricao,
                },
                conta_origem_id: contaOrigemSugerida.id,
                conta_destino_id: contaDestinoSugerida.id,
                anexo_comprovante: anexoResult.signedUrl,
                valor_total_acumulado: dadosDeposito.valor,
              },
            })
            .eq("id", sessao.id)
            .eq("igreja_id", igrejaId);

          return new Response(
            JSON.stringify({
              text: `📸 *Depósito detectado!*\n\n💰 Valor: ${formatarValor(dadosDeposito.valor)}\n🏦 Destino: ${contaDestinoSugerida.nome}\n💵 Origem: ${contaOrigemSugerida.nome}\n${dadosDeposito.data ? `📅 Data: ${dadosDeposito.data}` : ""}\n\n✅ *Confirmar transferência?*\n\nDigite *Sim* para confirmar ou *Não* para corrigir.`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Se detectou parcialmente, pedir confirmação manual
        const listaContas = contasDisponiveis
          .map((c, i) => `${i + 1}️⃣ ${c.nome}${c.banco ? ` (${c.banco})` : ""}`)
          .join("\n");

        await supabase
          .from("atendimentos_bot")
          .update({
            meta_dados: {
              ...metaDados,
              anexo_comprovante: anexoResult.signedUrl,
              transferencia: {
                ...metaDados.transferencia,
                valor: dadosDeposito?.valor || 0,
                banco_destino: dadosDeposito?.banco || null,
                data_deposito: dadosDeposito?.data || null,
                descricao: dadosDeposito?.descricao || null,
              },
              valor_total_acumulado: dadosDeposito?.valor || 0,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        let resposta = `📸 Comprovante recebido!\n`;
        if (dadosDeposito?.valor) {
          resposta += `💰 Valor detectado: ${formatarValor(dadosDeposito.valor)}\n`;
        }
        if (dadosDeposito?.banco) {
          resposta += `🏦 Banco detectado: ${dadosDeposito.banco}\n`;
        }
        resposta += `\n💵 *De qual conta está saindo o dinheiro?*\n\n${listaContas}\n\nDigite o número.`;

        return new Response(
          JSON.stringify({ text: resposta }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Seleção manual de conta origem por número
      const escolha = parseInt((mensagem || "").trim());
      if (!isNaN(escolha) && escolha >= 1 && escolha <= contasDisponiveis.length) {
        const contaOrigem = contasDisponiveis[escolha - 1];

        // Listar outras contas como destino (excluindo a origem)
        const contasDestino = contasDisponiveis.filter(c => c.id !== contaOrigem.id);
        const listaDestino = contasDestino
          .map((c, i) => `${i + 1}️⃣ ${c.nome}${c.banco ? ` (${c.banco})` : ""}`)
          .join("\n");

        // Verificar se já tem valor detectado via OCR
        const valorDetectado = metaDados.transferencia?.valor || 0;
        
        await supabase
          .from("atendimentos_bot")
          .update({
            meta_dados: {
              ...metaDados,
              conta_origem_id: contaOrigem.id,
              estado_atual: "TRANSFERENCIA_AGUARDANDO_CONFIRMACAO",
              contas_destino_disponiveis: contasDestino,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        let resposta = `✅ Origem: *${contaOrigem.nome}*\n`;
        if (valorDetectado > 0) {
          resposta += `💰 Valor: ${formatarValor(valorDetectado)}\n`;
        }
        resposta += `\n🏦 *Para qual conta vai o dinheiro?*\n\n${listaDestino}\n\nDigite o número da conta destino.`;

        return new Response(
          JSON.stringify({ text: resposta }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          text: "⚠️ Opção inválida.\n\nEnvie o comprovante de depósito ou digite o número da conta de origem.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ESTADO: TRANSFERENCIA_AGUARDANDO_CONFIRMACAO ==========
    if (estadoAtual === "TRANSFERENCIA_AGUARDANDO_CONFIRMACAO") {
      const contasDisponiveis = ((metaDados as any).contas_disponiveis || []) as Array<{
        id: string;
        nome: string;
        tipo: string;
        banco: string | null;
        cnpj_banco: string | null;
      }>;
      const contasDestinoDisponiveis = ((metaDados as any).contas_destino_disponiveis || []) as typeof contasDisponiveis;

      // Cancelamento
      if (mensagem && mensagem.toLowerCase().match(/cancelar|desistir|sair|não|nao/)) {
        await supabase
          .from("atendimentos_bot")
          .update({
            status: "CONCLUIDO",
            meta_dados: {
              ...metaDados,
              estado_atual: "FINALIZADO",
              resultado: "CANCELADO_PELO_USUARIO",
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        return new Response(
          JSON.stringify({
            text: "❌ Transferência cancelada.\n\nDigite *Transferência* para iniciar novamente.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Se ainda não tem conta destino, processar seleção
      if (!metaDados.conta_destino_id && contasDestinoDisponiveis.length > 0) {
        const escolha = parseInt((mensagem || "").trim());
        if (!isNaN(escolha) && escolha >= 1 && escolha <= contasDestinoDisponiveis.length) {
          const contaDestino = contasDestinoDisponiveis[escolha - 1];
          
          // Atualizar com conta destino
          await supabase
            .from("atendimentos_bot")
            .update({
              meta_dados: {
                ...metaDados,
                conta_destino_id: contaDestino.id,
              },
            })
            .eq("id", sessao.id)
            .eq("igreja_id", igrejaId);

          // Buscar nome da conta origem
          const contaOrigem = contasDisponiveis.find(c => c.id === metaDados.conta_origem_id);
          const valorTransferencia = metaDados.transferencia?.valor || metaDados.valor_total_acumulado || 0;

          // Se já tem valor, pedir confirmação
          if (valorTransferencia > 0) {
            return new Response(
              JSON.stringify({
                text: `📋 *Resumo da Transferência:*\n\n💵 De: ${contaOrigem?.nome || "N/A"}\n🏦 Para: ${contaDestino.nome}\n💰 Valor: ${formatarValor(valorTransferencia)}\n\n✅ *Confirmar?*\n\nDigite *Sim* para confirmar.`,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Se não tem valor, pedir
          return new Response(
            JSON.stringify({
              text: `✅ Destino: *${contaDestino.nome}*\n\n💰 *Qual o valor da transferência?*\n\nDigite apenas o número (ex: 1500.00)`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Se já tem as contas mas precisa do valor
      if (metaDados.conta_origem_id && metaDados.conta_destino_id && (!metaDados.transferencia?.valor || metaDados.transferencia.valor === 0)) {
        const valorStr = (mensagem || "").replace(/[^\d.,]/g, "").replace(",", ".");
        const valorNum = parseFloat(valorStr);
        
        if (!isNaN(valorNum) && valorNum > 0) {
          // Atualizar com valor
          const contaOrigem = contasDisponiveis.find(c => c.id === metaDados.conta_origem_id);
          const contaDestino = contasDisponiveis.find(c => c.id === metaDados.conta_destino_id);

          await supabase
            .from("atendimentos_bot")
            .update({
              meta_dados: {
                ...metaDados,
                transferencia: {
                  ...metaDados.transferencia,
                  valor: valorNum,
                },
                valor_total_acumulado: valorNum,
              },
            })
            .eq("id", sessao.id)
            .eq("igreja_id", igrejaId);

          return new Response(
            JSON.stringify({
              text: `📋 *Resumo da Transferência:*\n\n💵 De: ${contaOrigem?.nome || "N/A"}\n🏦 Para: ${contaDestino?.nome || "N/A"}\n💰 Valor: ${formatarValor(valorNum)}\n\n✅ *Confirmar?*\n\nDigite *Sim* para confirmar ou *Cancelar* para desistir.`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Confirmação final
      if (mensagem && mensagem.toLowerCase().match(/sim|confirma|ok|s$/)) {
        const valorFinal = metaDados.transferencia?.valor || metaDados.valor_total_acumulado || 0;
        
        if (valorFinal <= 0) {
          return new Response(
            JSON.stringify({ text: "⚠️ Valor inválido. Informe o valor da transferência." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!metaDados.conta_origem_id || !metaDados.conta_destino_id) {
          return new Response(
            JSON.stringify({ text: "⚠️ Contas não definidas. Reinicie o processo." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Buscar categoria "Transferência entre Contas"
        const { data: categoriaTransferencia } = await supabase
          .from("categorias_financeiras")
          .select("id")
          .eq("nome", "Transferência entre Contas")
          .eq("igreja_id", igrejaId)
          .maybeSingle();

        const categoriaId = categoriaTransferencia?.id || null;
        const dataHoje = new Date().toISOString().split("T")[0];

        // Criar registro de transferência
        const { data: transferencia, error: transfError } = await supabase
          .from("transferencias_contas")
          .insert({
            conta_origem_id: metaDados.conta_origem_id,
            conta_destino_id: metaDados.conta_destino_id,
            valor: valorFinal,
            data_transferencia: dataHoje,
            data_competencia: dataHoje,
            observacoes: `Via WhatsApp por ${metaDados.nome_perfil}`,
            anexo_url: metaDados.anexo_comprovante || null,
            igreja_id: igrejaId,
            filial_id: filialIdFromWhatsApp,
            criado_por: metaDados.pessoa_id,
            sessao_id: sessao.id,
          })
          .select("id")
          .single();

        if (transfError || !transferencia) {
          console.error("[Transferencia] Erro ao criar:", transfError);
          return new Response(
            JSON.stringify({ text: "❌ Erro ao criar transferência. Tente novamente." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Criar transação de SAÍDA
        const { data: txSaida } = await supabase
          .from("transacoes_financeiras")
          .insert({
            descricao: `Transferência para conta destino`,
            valor: valorFinal,
            tipo: "saida",
            tipo_lancamento: "unico",
            data_vencimento: dataHoje,
            data_competencia: dataHoje,
            data_pagamento: dataHoje,
            status: "pago",
            conta_id: metaDados.conta_origem_id,
            categoria_id: categoriaId,
            transferencia_id: transferencia.id,
            observacoes: `Transferência entre contas - Via WhatsApp`,
            anexo_url: metaDados.anexo_comprovante || null,
            igreja_id: igrejaId,
            filial_id: filialIdFromWhatsApp,
          })
          .select("id")
          .single();

        // Criar transação de ENTRADA
        const { data: txEntrada } = await supabase
          .from("transacoes_financeiras")
          .insert({
            descricao: `Transferência de conta origem`,
            valor: valorFinal,
            tipo: "entrada",
            tipo_lancamento: "unico",
            data_vencimento: dataHoje,
            data_competencia: dataHoje,
            data_pagamento: dataHoje,
            status: "pago",
            conta_id: metaDados.conta_destino_id,
            categoria_id: categoriaId,
            transferencia_id: transferencia.id,
            observacoes: `Transferência entre contas - Via WhatsApp`,
            anexo_url: metaDados.anexo_comprovante || null,
            igreja_id: igrejaId,
            filial_id: filialIdFromWhatsApp,
          })
          .select("id")
          .single();

        // Atualizar transferência com os IDs das transações
        if (txSaida && txEntrada) {
          await supabase
            .from("transferencias_contas")
            .update({
              transacao_saida_id: txSaida.id,
              transacao_entrada_id: txEntrada.id,
            })
            .eq("id", transferencia.id);

          // Atualizar saldos das contas manualmente
          try {
            const { data: contaOrigemData } = await supabase
              .from("contas")
              .select("saldo_atual")
              .eq("id", metaDados.conta_origem_id)
              .single();

            if (contaOrigemData) {
              await supabase
                .from("contas")
                .update({ saldo_atual: contaOrigemData.saldo_atual - valorFinal })
                .eq("id", metaDados.conta_origem_id);
            }

            const { data: contaDestinoData } = await supabase
              .from("contas")
              .select("saldo_atual")
              .eq("id", metaDados.conta_destino_id)
              .single();

            if (contaDestinoData) {
              await supabase
                .from("contas")
                .update({ saldo_atual: contaDestinoData.saldo_atual + valorFinal })
                .eq("id", metaDados.conta_destino_id);
            }
          } catch (saldoErr) {
            console.error("[Transferencia] Erro ao atualizar saldos:", saldoErr);
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
              resultado: "TRANSFERENCIA_CRIADA",
              transferencia_id: transferencia.id,
              transacao_saida_id: txSaida?.id,
              transacao_entrada_id: txEntrada?.id,
            },
          })
          .eq("id", sessao.id)
          .eq("igreja_id", igrejaId);

        const contaOrigem = contasDisponiveis.find(c => c.id === metaDados.conta_origem_id);
        const contaDestino = contasDisponiveis.find(c => c.id === metaDados.conta_destino_id);

        return new Response(
          JSON.stringify({
            text: `✅ *Transferência Realizada!*\n\n💵 De: ${contaOrigem?.nome || "N/A"}\n🏦 Para: ${contaDestino?.nome || "N/A"}\n💰 Valor: ${formatarValor(valorFinal)}\n\n🔖 Protocolo: #${transferencia.id.slice(0, 8).toUpperCase()}\n\nSaldos atualizados automaticamente.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          text: "⚠️ Não entendi. Digite *Sim* para confirmar ou *Cancelar* para desistir.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Estado não reconhecido - reset
    return new Response(
      JSON.stringify({
        text: "⚠️ Sessão em estado inválido. Digite *Cancelar* para reiniciar.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro crítico:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
