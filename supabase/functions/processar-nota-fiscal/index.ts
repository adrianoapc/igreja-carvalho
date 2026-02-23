import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const FUNCTION_NAME = "processar-nota-fiscal";

// Default config if not in database
const DEFAULT_MODEL = "google/gemini-2.5-pro";
const DEFAULT_VISION_PROMPT = `Você é um assistente especializado em extrair informações de notas fiscais brasileiras (NFe, NFCe, cupons fiscais, etc).
             
Analise a imagem da nota fiscal e extraia as seguintes informações:
- CNPJ ou CPF do fornecedor/emissor
- Nome/Razão Social do fornecedor
- Data de emissão (formato YYYY-MM-DD)
- Valor total
- Data de vencimento (se houver, formato YYYY-MM-DD)
- Descrição dos itens/serviços
- Número da nota fiscal

Retorne os dados no formato estruturado solicitado. Se algum campo não estiver visível, retorne null.`;

// Fetch chatbot config from database (global, not per igreja)
async function getChatbotConfig(
  supabase: SupabaseClient
): Promise<{ model: string; systemPrompt: string }> {
  try {
    const { data: config, error } = await supabase
      .from("chatbot_configs")
      .select("modelo_visao, role_visao")
      .eq("edge_function_name", FUNCTION_NAME)
      .eq("ativo", true)
      .single();

    if (error || !config) {
      console.log(
        `[${FUNCTION_NAME}] No config found, using defaults. Error: ${
          error?.message || "none"
        }`
      );
      return { model: DEFAULT_MODEL, systemPrompt: DEFAULT_VISION_PROMPT };
    }

    console.log(`[${FUNCTION_NAME}] Config loaded successfully from database`);
    return {
      model: config.modelo_visao || DEFAULT_MODEL,
      systemPrompt: config.role_visao || DEFAULT_VISION_PROMPT,
    };
  } catch (err) {
    console.error(`[${FUNCTION_NAME}] Error fetching chatbot config:`, err);
    return { model: DEFAULT_MODEL, systemPrompt: DEFAULT_VISION_PROMPT };
  }
}

// Fetch categories, subcategories and cost centers from database
async function getFinancialOptions(
  supabase: SupabaseClient,
  igrejaId: string,
  filialId?: string | null
): Promise<{
  categorias: Array<{
    id: string;
    nome: string;
    subcategorias: Array<{ id: string; nome: string }>;
  }>;
  centrosCusto: Array<{ id: string; nome: string; descricao: string | null }>;
}> {
  try {
    // Fetch categories with subcategories (with optional filial filter)
    let categorias: any[] | null = null;
    let catError: any = null;
    try {
      let query = supabase
        .from("categorias_financeiras")
        .select(
          `
        id,
        nome,
        tipo,
        subcategorias_financeiras(id, nome)
      `
        )
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("igreja_id", igrejaId)
        .order("nome");

      if (filialId) {
        // If filial_id column exists, filter by it or null (global)
        // @ts-ignore runtime-level handling
        query = query.or(`filial_id.is.null,filial_id.eq.${filialId}`);
      }

      const res = await query;
      categorias = res.data as any[] | null;
      catError = res.error;
      if (catError) throw catError;
    } catch (e) {
      console.warn(
        "Categorias: fallback sem filtro de filial:",
        (e as Error)?.message
      );
      const res = await supabase
        .from("categorias_financeiras")
        .select(
          `
        id,
        nome,
        tipo,
        subcategorias_financeiras(id, nome)
      `
        )
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("igreja_id", igrejaId)
        .order("nome");
      categorias = res.data as any[] | null;
      catError = res.error;
    }

    if (catError) {
      console.error("Error fetching categories:", catError);
    }

    // Fetch cost centers (with optional filial filter)
    let centrosCusto: any[] | null = null;
    let ccError: any = null;
    try {
      let queryCc = supabase
        .from("centros_custo")
        .select("id, nome, descricao")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (filialId) {
        // @ts-ignore runtime-level handling
        queryCc = queryCc.or(`filial_id.is.null,filial_id.eq.${filialId}`);
      }
      const resCc = await queryCc;
      centrosCusto = resCc.data as any[] | null;
      ccError = resCc.error;
      if (ccError) throw ccError;
    } catch (e) {
      console.warn(
        "Centros de custo: fallback sem filtro de filial:",
        (e as Error)?.message
      );
      const resCc = await supabase
        .from("centros_custo")
        .select("id, nome, descricao")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      centrosCusto = resCc.data as any[] | null;
      ccError = resCc.error;
    }

    if (ccError) {
      console.error("Error fetching cost centers:", ccError);
    }

    // Format categories with nested subcategories
    const categoriasFormatadas = (categorias || []).map(
      (cat: Record<string, unknown>) => ({
        id: cat.id as string,
        nome: cat.nome as string,
        subcategorias:
          (cat.subcategorias_financeiras as Array<{
            id: string;
            nome: string;
          }>) || [],
      })
    );

    return {
      categorias: categoriasFormatadas,
      centrosCusto: centrosCusto || [],
    };
  } catch (err) {
    console.error("Error fetching financial options:", err);
    return { categorias: [], centrosCusto: [] };
  }
}

// Build category context for the AI prompt
function buildCategoryContext(
  options: Awaited<ReturnType<typeof getFinancialOptions>>
): string {
  const { categorias, centrosCusto } = options;

  let context = "\n\n## CATEGORIAS DISPONÍVEIS PARA SUGESTÃO:\n";

  categorias.forEach((cat) => {
    context += `\n### ${cat.nome} (ID: ${cat.id})\n`;
    if (cat.subcategorias.length > 0) {
      context += "Subcategorias:\n";
      cat.subcategorias.forEach((sub) => {
        context += `  - ${sub.nome} (ID: ${sub.id})\n`;
      });
    }
  });

  context += "\n\n## CENTROS DE CUSTO DISPONÍVEIS:\n";
  centrosCusto.forEach((cc) => {
    context += `- ${cc.nome}${cc.descricao ? ` (${cc.descricao})` : ""} (ID: ${
      cc.id
    })\n`;
  });

  context +=
    "\n\nBaseado na descrição dos itens/serviços da nota fiscal, sugira a categoria, subcategoria e centro de custo mais adequados.";

  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Auth header missing or invalid format");
      return new Response(
        JSON.stringify({ error: "Token de autenticação ausente" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      console.error("Empty token after extraction");
      return new Response(
        JSON.stringify({ error: "Token de autenticação vazio" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the caller is using the service role key (internal call from other edge functions)
    const isServiceRole = token === supabaseServiceKey;

    let userId: string | null = null;

    if (!isServiceRole) {
      console.log(`[${FUNCTION_NAME}] Token length: ${token.length}`);

      const { data: userData, error: authError } =
        await supabaseService.auth.getUser(token);
      if (authError || !userData?.user) {
        console.error(
          "JWT validation error:",
          authError?.message || "No user found"
        );
        return new Response(
          JSON.stringify({ error: "Sessão inválida ou expirada" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      userId = userData.user.id;
      console.log(`[${FUNCTION_NAME}] Authenticated user: ${userId}`);

      const { data: userRoles, error: rolesError } = await supabaseService
        .from("user_app_roles")
        .select("role:app_roles(name)")
        .eq("user_id", userId);

      if (rolesError) {
        console.error("Roles error:", rolesError);
        return new Response(
          JSON.stringify({ error: "Erro ao verificar permissões" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const hasPermission = userRoles?.some((ur: Record<string, unknown>) =>
        ["admin", "tesoureiro", "pastor"].includes(
          (ur.role as Record<string, unknown>)?.name
            ?.toString()
            ?.toLowerCase() || ""
        )
      );

      if (!hasPermission) {
        return new Response(
          JSON.stringify({
            error: "Permissão negada. Requer papel de admin ou tesoureiro.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      console.log(`[${FUNCTION_NAME}] Internal service role call`);
    }

    // IMPORTANT: req.json() só pode ser consumido UMA vez (senão dá "Body already consumed")
    const body = await req.json();
    const {
      imageBase64,
      mimeType,
      igreja_id: igrejaId,
      filial_id: filialId,
    } = body ?? {};

    if (!igrejaId) {
      return new Response(
        JSON.stringify({ error: "igreja_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "Imagem/PDF não fornecido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (imageBase64.length > MAX_IMAGE_SIZE * 1.4) {
      return new Response(
        JSON.stringify({ error: "Arquivo muito grande. Tamanho máximo: 10MB" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Suportar imagens e PDFs
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    const effectiveMimeType = mimeType || "image/jpeg";

    if (!allowedMimeTypes.includes(effectiveMimeType)) {
      return new Response(
        JSON.stringify({
          error: `Tipo de arquivo não suportado: ${effectiveMimeType}. Aceitos: imagens e PDFs.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isPdf = effectiveMimeType === "application/pdf";
    console.log(
      `[processar-nota-fiscal] Processando ${isPdf ? "PDF" : "imagem"}...`
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // Choose provider (prefer Gemini, fallback to OpenAI)
    const GEMINI_API_KEY =
      Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const provider = GEMINI_API_KEY
      ? "gemini"
      : OPENAI_API_KEY
      ? "openai"
      : null;
    if (!provider) {
      console.error(
        "Nenhum provedor de IA configurado (GEMINI_API_KEY/GOOGLE_API_KEY ou OPENAI_API_KEY)"
      );
      return new Response(
        JSON.stringify({ error: "Serviço de processamento não configurado" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role client to fetch config and financial options
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[${FUNCTION_NAME}] Igreja ID: ${igrejaId}`);

    const { model, systemPrompt } = await getChatbotConfig(supabaseService);
    const financialOptions = await getFinancialOptions(
      supabaseService,
      igrejaId,
      filialId
    );

    console.log(`[processar-nota-fiscal] Using model: ${model}`);
    console.log(
      `[processar-nota-fiscal] Found ${financialOptions.categorias.length} categories, ${financialOptions.centrosCusto.length} cost centers`
    );

    // Build enhanced prompt with categories
    const enhancedPrompt =
      systemPrompt + buildCategoryContext(financialOptions);

    let notaFiscalData: any = null;
    if (provider === "openai") {
      const mappedModel = model?.startsWith("google/")
        ? "gpt-4o-mini"
        : model || "gpt-4o-mini";
      const oaResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: mappedModel,
          messages: [
            { role: "system", content: enhancedPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: isPdf
                    ? "Extraia as informações deste documento PDF de nota fiscal e sugira a categorização financeira mais adequada:"
                    : "Extraia as informações desta imagem de nota fiscal e sugira a categorização financeira mais adequada:",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${effectiveMimeType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extrair_nota_fiscal",
                description:
                  "Extrai informações estruturadas de uma nota fiscal e sugere categorização",
                parameters: {
                  type: "object",
                  properties: {
                    fornecedor_cnpj_cpf: { type: "string" },
                    fornecedor_nome: { type: "string" },
                    data_emissao: { type: "string" },
                    valor_total: { type: "number" },
                    data_vencimento: { type: "string" },
                    descricao: { type: "string" },
                    numero_nota: { type: "string" },
                    tipo_documento: {
                      type: "string",
                      enum: ["nfe", "nfce", "cupom_fiscal", "recibo", "outro"],
                    },
                    categoria_sugerida_id: { type: "string" },
                    categoria_sugerida_nome: { type: "string" },
                    subcategoria_sugerida_id: { type: "string" },
                    subcategoria_sugerida_nome: { type: "string" },
                    centro_custo_sugerido_id: { type: "string" },
                    centro_custo_sugerido_nome: { type: "string" },
                  },
                  required: [
                    "fornecedor_nome",
                    "data_emissao",
                    "valor_total",
                    "descricao",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extrair_nota_fiscal" },
          },
        }),
      });

      if (!oaResp.ok) {
        const errorText = await oaResp.text();
        console.error("OpenAI erro:", oaResp.status, errorText);
        throw new Error("Erro ao processar imagem");
      }
      const oaData = await oaResp.json();
      const toolCall = oaData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function?.name !== "extrair_nota_fiscal") {
        throw new Error("Resposta da IA não contém dados estruturados");
      }
      notaFiscalData = JSON.parse(toolCall.function.arguments);
    } else {
      // Gemini
      const geminiModelId = model?.startsWith("google/")
        ? model.split("/")[1]
        : model || "gemini-2.0-pro";
      const promptText =
        (isPdf
          ? "Extraia as informações deste documento PDF de nota fiscal e sugira a categorização financeira mais adequada:"
          : "Extraia as informações desta imagem de nota fiscal e sugira a categorização financeira mais adequada:") +
        "\nRetorne um JSON exatamente com as chaves: fornecedor_cnpj_cpf, fornecedor_nome, data_emissao, valor_total, data_vencimento, descricao, numero_nota, tipo_documento, categoria_sugerida_id, categoria_sugerida_nome, subcategoria_sugerida_id, subcategoria_sugerida_nome, centro_custo_sugerido_id, centro_custo_sugerido_nome. Use null quando não houver.";

      const gmResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModelId}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: enhancedPrompt + "\n\n" + promptText },
                  {
                    inline_data: {
                      mime_type: effectiveMimeType,
                      data: imageBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: { response_mime_type: "application/json" },
          }),
        }
      );

      if (!gmResp.ok) {
        const errorText = await gmResp.text();
        console.error("Gemini erro:", gmResp.status, errorText);
        throw new Error("Erro ao processar imagem");
      }
      const gmData = await gmResp.json();
      const text = gmData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Resposta vazia do provedor");
      try {
        notaFiscalData = JSON.parse(text);
      } catch (e) {
        console.error("Falha ao parsear JSON do Gemini:", text);
        throw new Error("Resposta não estruturada do provedor");
      }
    }
    console.log(
      "[processar-nota-fiscal] Dados extraídos da IA (antes sugestões por histórico):",
      JSON.stringify({
        fornecedor_nome: notaFiscalData?.fornecedor_nome,
        fornecedor_cnpj_cpf: notaFiscalData?.fornecedor_cnpj_cpf,
        valor_total: notaFiscalData?.valor_total,
        data_emissao: notaFiscalData?.data_emissao,
        categoria_sugerida_id: notaFiscalData?.categoria_sugerida_id,
        subcategoria_sugerida_id: notaFiscalData?.subcategoria_sugerida_id,
        centro_custo_sugerido_id: notaFiscalData?.centro_custo_sugerido_id,
      })
    );

    console.log(
      "[processar-nota-fiscal] Dados finais (após sugestões):",
      JSON.stringify(notaFiscalData)
    );

    // Vincular/criar fornecedor por CPF/CNPJ e aplicar sugestões por histórico
    try {
      const rawDoc = (notaFiscalData?.fornecedor_cnpj_cpf || "").toString();
      const normalizedDoc = rawDoc.replace(/\D/g, "");
      const fornecedorNome = (notaFiscalData?.fornecedor_nome || "")
        .toString()
        .trim();
      let fornecedorId: string | null = null;

      console.log(
        `[processar-nota-fiscal] Iniciando vinculação de fornecedor - CNPJ/CPF: ${
          normalizedDoc || "vazio"
        }, Nome: ${fornecedorNome || "vazio"}`
      );

      if (normalizedDoc || fornecedorNome) {
        // Lookup: global por igreja (filial_id = null)
        const { data: found, error: findErr } = await supabaseService
          .from("fornecedores")
          .select("id")
          .eq("igreja_id", igrejaId)
          .eq("filial_id", null)
          .eq("cpf_cnpj", normalizedDoc)
          .limit(1);
        if (findErr) {
          console.error("Erro ao buscar fornecedor por cpf_cnpj:", findErr);
        }

        if (found && found.length > 0) {
          fornecedorId = (found[0] as any).id as string;
          console.log(
            `[processar-nota-fiscal] Fornecedor encontrado: ${fornecedorId}`
          );
        } else {
          const tipoPessoa =
            normalizedDoc && normalizedDoc.length === 11
              ? "fisica"
              : "juridica";
          const insertPayload: Record<string, unknown> = {
            nome: fornecedorNome || "Fornecedor",
            cpf_cnpj: normalizedDoc || null,
            tipo_pessoa: tipoPessoa,
            ativo: true,
            igreja_id: igrejaId,
            filial_id: null,
          };
          console.log(
            `[processar-nota-fiscal] Criando novo fornecedor:`,
            insertPayload
          );
          const { data: inserted, error: insErr } = await supabaseService
            .from("fornecedores")
            .insert(insertPayload)
            .select("id")
            .limit(1);
          if (insErr) {
            console.error("Erro ao criar fornecedor:", insErr);
          } else if (inserted && inserted.length > 0) {
            fornecedorId = (inserted[0] as any).id as string;
            console.log(
              `[processar-nota-fiscal] Fornecedor criado: ${fornecedorId}`
            );
          }
        }

        if (fornecedorId) {
          // anexar ao payload de saída
          (notaFiscalData as any).fornecedor_id = fornecedorId;

          // Sugestões por histórico
          try {
            let histQuery = supabaseService
              .from("transacoes_financeiras")
              .select(
                "categoria_id, subcategoria_id, centro_custo_id, base_ministerial_id, conta_id, forma_pagamento"
              )
              .eq("igreja_id", igrejaId)
              .eq("fornecedor_id", fornecedorId)
              .order("created_at", { ascending: false })
              .limit(50);

            if (filialId) {
              // @ts-ignore: se coluna não existir, a consulta pode falhar e caímos no catch
              histQuery = (histQuery as any).or(
                `filial_id.is.null,filial_id.eq.${filialId}`
              );
            }

            const { data: transacoesHist, error: histErr } =
              (await histQuery) as any;
            if (histErr) throw histErr;

            if (transacoesHist && transacoesHist.length > 0) {
              console.log(
                `[processar-nota-fiscal] Encontradas ${transacoesHist.length} transações do fornecedor ${fornecedorId}`
              );
              const freq = (arr: any[], key: string) => {
                const map: Record<string, number> = {};
                for (const t of arr) {
                  const v = (t[key] as string | null) || "";
                  if (!v) continue;
                  map[v] = (map[v] || 0) + 1;
                }
                return (
                  Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                  null
                );
              };

              const cat = freq(transacoesHist, "categoria_id");
              const sub = freq(transacoesHist, "subcategoria_id");
              const cc = freq(transacoesHist, "centro_custo_id");
              const bm = freq(transacoesHist, "base_ministerial_id");
              const contaHist = freq(transacoesHist, "conta_id");
              const formaHist = freq(transacoesHist, "forma_pagamento");

              console.log(
                `[processar-nota-fiscal] Histórico - categoria mais frequente: ${
                  cat || "nenhuma"
                }, subcategoria: ${sub || "nenhuma"}, centro_custo: ${
                  cc || "nenhum"
                }, base_ministerial: ${bm || "nenhuma"}`
              );

              if (!notaFiscalData.categoria_sugerida_id && cat) {
                (notaFiscalData as any).categoria_sugerida_id = cat;
                console.log(
                  `[processar-nota-fiscal] Categoria preenchida do histórico: ${cat}`
                );
              }
              if (!notaFiscalData.subcategoria_sugerida_id && sub) {
                (notaFiscalData as any).subcategoria_sugerida_id = sub;
                console.log(
                  `[processar-nota-fiscal] Subcategoria preenchida do histórico: ${sub}`
                );
              }
              if (!notaFiscalData.centro_custo_sugerido_id && cc) {
                (notaFiscalData as any).centro_custo_sugerido_id = cc;
                console.log(
                  `[processar-nota-fiscal] Centro de custo preenchido do histórico: ${cc}`
                );
              }
              if (!(notaFiscalData as any).base_ministerial_sugerido_id && bm) {
                (notaFiscalData as any).base_ministerial_sugerido_id = bm;
                console.log(
                  `[processar-nota-fiscal] Base ministerial preenchida do histórico: ${bm}`
                );
              }
              if (!(notaFiscalData as any).conta_sugerida_id && contaHist) {
                (notaFiscalData as any).conta_sugerida_id = contaHist;
                console.log(
                  `[processar-nota-fiscal] Conta sugerida do histórico: ${contaHist}`
                );
              }
              if (
                !(notaFiscalData as any).forma_pagamento_sugerida &&
                formaHist
              ) {
                (notaFiscalData as any).forma_pagamento_sugerida = formaHist;
                console.log(
                  `[processar-nota-fiscal] Forma de pagamento sugerida do histórico: ${formaHist}`
                );
              }
            } else {
              console.log(
                `[processar-nota-fiscal] Nenhuma transação anterior encontrada para fornecedor ${fornecedorId}`
              );
            }
          } catch (e) {
            console.warn("Falha ao aplicar sugestões por histórico:", e);
          }
        }
      }
    } catch (e) {
      console.error("Falha na vinculação/criação de fornecedor:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dados: notaFiscalData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro ao processar nota fiscal:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao processar nota fiscal. Tente novamente.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
