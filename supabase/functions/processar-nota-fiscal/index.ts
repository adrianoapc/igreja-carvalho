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
const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_VISION_PROMPT = `Você é um assistente especializado em extrair informações de QUALQUER documento que comprove uma despesa/compra/contratação brasileira — não só nota fiscal formal. Isso inclui, sem se limitar a:
- Nota fiscal, cupom fiscal, recibo (NFe, NFCe, cupom fiscal, recibo simples)
- Print de compra em app/site (Shopee, Mercado Livre, Amazon, AliExpress, etc) — carrinho, checkout ou confirmação de pedido
- Pedido, orçamento, contrato de locação/serviço ou qualquer formulário comercial próprio do fornecedor (papel timbrado, layout customizado) que mostre valor total e o nome de quem está cobrando — mesmo sem CNPJ/CPF visível
- Comprovante de pagamento (PIX, transferência, boleto pago) quando é a única evidência da despesa

Regra central: **se o documento mostra um valor total cobrado/pago E algum nome identificando quem vendeu/prestou o serviço, extraia — não exija que pareça uma nota fiscal tradicional.** Só retorne null pros campos que genuinamente não aparecem em lugar nenhum do documento.

Analise o documento e extraia as seguintes informações:
- CNPJ ou CPF do fornecedor/emissor (se houver; em documentos informais costuma faltar — nesse caso deixe null, mas ainda assim extraia o resto)
- Nome/Razão Social do fornecedor — em print de app/site, o nome da plataforma/loja (ex: "Shopee"); em pedido/orçamento/locação, o nome do negócio ou de quem está cobrando (ex: nome da empresa no cabeçalho, ou o nome ao lado de "Locador(a)"/"Prestador"/"Vendedor")
- Data de emissão (formato YYYY-MM-DD) — se o documento só tiver "criado em" ou data do evento, use essa
- Valor total
- Data de vencimento (se houver, formato YYYY-MM-DD)
- Descrição dos itens/serviços
- Número da nota fiscal/pedido (se houver; senão deixe null)

## DOCUMENTOS SEM NOTA FISCAL FORMAL (print de app/site, pedido, orçamento, contrato de locação/serviço)
- Use como "valor_total" o total final cobrado (ex: "Total de X itens", "Valor Total", "Valor por pessoa" × quantidade) — mesmo critério do dicionário abaixo pra distinguir de desconto/bônus.
- Use como "fornecedor_nome" o nome do negócio/plataforma emissor do documento (cabeçalho, logo, ou campo "Locador(a)"/"Prestador"), não o nome do cliente/comprador nem de produtos individuais.
- Ignore elementos de interface/formulário que não são parte do valor da compra em si (banners de assinatura, cupom não aplicado, "convide amigos", checkboxes de status como "Entregue"/"Pago" vazios).

## DICIONÁRIO — COMO IDENTIFICAR O "valor_total" CORRETO
O campo "valor_total" deve ser SEMPRE o valor final efetivamente cobrado/pago pelo cliente. Em cupons e recibos brasileiros, esse valor costuma aparecer perto de termos como:
- "Total", "Total a pagar", "Valor total", "Total da compra", "Valor pago", "Total geral"

NUNCA use como "valor_total" linhas que representam vantagem, desconto ou troco — mesmo que o valor delas pareça em destaque no documento:
- "Bônus" / "Bônus na compra" / "Você ganhou"
- "Desconto" / "Você economizou" / "Economia" / "Cupom aplicado"
- "Cashback" / "Pontos fidelidade" / "Pontuação"
- "Troco" / "Valor recebido"

Exemplo: se o cupom mostra "Bônus na compra: R$ 12,50" em destaque e, mais abaixo, "Total: R$ 87,40", o "valor_total" correto é R$ 87,40 — o bônus NÃO é o valor da compra, é uma vantagem concedida ao cliente.

Em caso de dúvida entre dois valores candidatos, prefira sempre o que está identificado como "Total"/"Total a pagar"/"Valor pago" sobre qualquer valor rotulado como benefício, desconto ou economia.

Retorne os dados no formato estruturado solicitado. Se algum campo não estiver visível, retorne null.`;

const NOME_FORNECEDOR_GENERICO =
  /^(fornecedor|n\/?a|n\.a\.?|não identificado|nao identificado)$/i;

function nomeFornecedorAproveitavel(nome: string): boolean {
  return nome.trim().length >= 2 && !NOME_FORNECEDOR_GENERICO.test(nome.trim());
}

function escapeIlikeExact(valor: string): string {
  return valor.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    // Choose provider:
    // - PDFs: prefer Claude ou Lovable AI Gateway/Gemini direto (suportam PDF nativo), OpenAI não aceita PDF
    // - Imagens: prefer Claude, depois Gemini direto, depois OpenAI, depois Lovable AI Gateway
    const GEMINI_API_KEY =
      Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    // Limite de imagem da Anthropic é 5MB (bem menor que o teto de 10MB
    // que este endpoint aceita, checado acima) — foto de celular passa
    // fácil disso. Se a imagem for grande demais pro Claude, pula pro
    // próximo provedor em vez de deixar a Anthropic rejeitar com 400 sem
    // fallback (Codex P1 na PR #117). PDF não entra nessa conta — limite
    // de documento da Anthropic é bem maior (32MB) que o teto deste
    // endpoint.
    const CLAUDE_MAX_IMAGE_BASE64_LENGTH = Math.floor(
      5 * 1024 * 1024 * (4 / 3)
    );
    const imagemGrandeDemaisPraClaude =
      !isPdf && imageBase64.length > CLAUDE_MAX_IMAGE_BASE64_LENGTH;
    const claudeDisponivel = ANTHROPIC_API_KEY && !imagemGrandeDemaisPraClaude;
    if (imagemGrandeDemaisPraClaude) {
      console.log(
        `[processar-nota-fiscal] Imagem grande demais pro limite de 5MB da Anthropic (${imageBase64.length} chars base64) — pulando Claude, tentando próximo provedor.`
      );
    }

    let provider: "claude" | "gemini" | "openai" | "lovable" | null = null;
    if (isPdf) {
      provider = claudeDisponivel
        ? "claude"
        : LOVABLE_API_KEY
        ? "lovable"
        : GEMINI_API_KEY
        ? "gemini"
        : null;
      if (!provider) {
        console.error(
          "[processar-nota-fiscal] PDF recebido mas nenhum provedor compatível com PDF está configurado (ANTHROPIC_API_KEY, LOVABLE_API_KEY ou GEMINI_API_KEY). OpenAI não aceita PDFs."
        );
        return new Response(
          JSON.stringify({
            error:
              "Processamento de PDFs indisponível: configure ANTHROPIC_API_KEY, LOVABLE_API_KEY ou GEMINI_API_KEY.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      provider = claudeDisponivel
        ? "claude"
        : GEMINI_API_KEY
        ? "gemini"
        : OPENAI_API_KEY
        ? "openai"
        : LOVABLE_API_KEY
        ? "lovable"
        : null;
    }
    if (!provider) {
      console.error(
        "Nenhum provedor de IA configurado (ANTHROPIC_API_KEY, LOVABLE_API_KEY, GEMINI_API_KEY/GOOGLE_API_KEY ou OPENAI_API_KEY)"
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
    // supabaseService already created above (line 260)

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
    if (provider === "claude") {
      const claudeModel = model?.startsWith("claude")
        ? model
        : "claude-sonnet-5";
      const promptText = isPdf
        ? "Extraia as informações deste documento PDF de nota fiscal e sugira a categorização financeira mais adequada:"
        : "Extraia as informações desta imagem de nota fiscal e sugira a categorização financeira mais adequada:";

      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 1536,
          system: enhancedPrompt,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                isPdf
                  ? {
                      type: "document",
                      source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: imageBase64,
                      },
                    }
                  : {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: effectiveMimeType,
                        data: imageBase64,
                      },
                    },
              ],
            },
          ],
          tools: [
            {
              name: "extrair_nota_fiscal",
              description:
                "Extrai informações estruturadas de uma nota fiscal e sugere categorização",
              input_schema: {
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
              },
            },
          ],
          tool_choice: { type: "tool", name: "extrair_nota_fiscal" },
        }),
      });

      if (!claudeResp.ok) {
        const errorText = await claudeResp.text();
        console.error("Claude erro:", claudeResp.status, errorText);
        throw new Error("Erro ao processar documento via Claude");
      }
      const claudeData = await claudeResp.json();
      const toolUse = claudeData.content?.find(
        (block: any) =>
          block.type === "tool_use" && block.name === "extrair_nota_fiscal"
      );
      if (!toolUse) {
        console.error(
          "Claude: resposta sem tool_use estruturado",
          JSON.stringify(claudeData).slice(0, 500)
        );
        throw new Error("Resposta da IA não contém dados estruturados");
      }
      // Anthropic já devolve `input` como objeto — diferente da OpenAI, que
      // devolve `arguments` como string JSON exigindo JSON.parse.
      notaFiscalData = toolUse.input;
    } else if (provider === "openai") {
      // `model` vem de chatbot_configs.modelo_visao — pode estar apontando
      // pra outro provedor (ex: "claude-sonnet-5", "google/gemini-2.5-pro")
      // se o provedor preferencial não tiver a API key configurada nesta
      // implantação. Só repassa se realmente parecer um model id da OpenAI.
      const mappedModel = /^(gpt-|o1|o3|o4)/.test(model || "")
        ? model!
        : "gpt-4o-mini";
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
    } else if (provider === "lovable") {
      // Lovable AI Gateway (OpenAI-compatible) – supports PDFs via Gemini models
      const lovableModel = model?.startsWith("google/")
        ? model
        : "google/gemini-2.5-flash";
      const promptText = isPdf
        ? "Extraia as informações deste documento PDF de nota fiscal e sugira a categorização financeira mais adequada."
        : "Extraia as informações desta imagem de nota fiscal e sugira a categorização financeira mais adequada.";

      const lvResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: lovableModel,
            messages: [
              { role: "system", content: enhancedPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
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
        }
      );

      if (!lvResp.ok) {
        const errorText = await lvResp.text();
        console.error("Lovable AI Gateway erro:", lvResp.status, errorText);
        throw new Error("Erro ao processar documento via Lovable AI Gateway");
      }
      const lvData = await lvResp.json();
      const toolCall = lvData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function?.name !== "extrair_nota_fiscal") {
        console.error(
          "Lovable AI Gateway: resposta sem tool_call estruturada",
          JSON.stringify(lvData).slice(0, 500)
        );
        throw new Error("Resposta da IA não contém dados estruturados");
      }
      notaFiscalData = JSON.parse(toolCall.function.arguments);
    } else {

      // Gemini — mesmo cuidado do branch OpenAI: só repassa `model` se
      // parecer um model id do Gemini, senão usa o default seguro.
      const geminiModelId = model?.startsWith("google/")
        ? model.split("/")[1]
        : model?.startsWith("gemini")
        ? model
        : "gemini-2.0-pro";
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
        // Lookup global por igreja (filial_id = null). Com documento fiscal,
        // busca por CPF/CNPJ; sem documento (print de app/site), reusa o
        // cadastro pelo nome — senão cada print de "Shopee" cria um
        // fornecedor novo (insert grava cpf_cnpj NULL, lookup antigo
        // procurava string vazia e nunca encontrava o que criou).
        if (normalizedDoc) {
          const { data: found, error: findErr } = await supabaseService
            .from("fornecedores")
            .select("id")
            .eq("igreja_id", igrejaId)
            .eq("filial_id", null)
            .eq("cpf_cnpj", normalizedDoc)
            .limit(1);
          if (findErr) {
            console.error("Erro ao buscar fornecedor por cpf_cnpj:", findErr);
          } else if (found && found.length > 0) {
            fornecedorId = (found[0] as any).id as string;
            console.log(
              `[processar-nota-fiscal] Fornecedor encontrado por documento: ${fornecedorId}`
            );
          }
        }

        if (!fornecedorId && nomeFornecedorAproveitavel(fornecedorNome)) {
          const { data: foundByName, error: findNameErr } = await supabaseService
            .from("fornecedores")
            .select("id")
            .eq("igreja_id", igrejaId)
            .eq("filial_id", null)
            .eq("ativo", true)
            .ilike("nome", escapeIlikeExact(fornecedorNome))
            .order("created_at", { ascending: true })
            .limit(1);
          if (findNameErr) {
            console.error("Erro ao buscar fornecedor por nome:", findNameErr);
          } else if (foundByName && foundByName.length > 0) {
            fornecedorId = (foundByName[0] as any).id as string;
            console.log(
              `[processar-nota-fiscal] Fornecedor encontrado por nome: ${fornecedorId}`
            );
          }
        }

        if (!fornecedorId) {
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
