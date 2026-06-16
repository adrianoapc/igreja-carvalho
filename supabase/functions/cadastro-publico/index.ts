import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizarTelefone } from "../_shared/telefone-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetTime < now) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

interface CadastroVisitanteData {
  nome: string;
  telefone?: string;
  email?: string;
  sexo?: string;
  data_nascimento?: string;
  estado_civil?: string;
  cidade?: string;
  bairro?: string;
  profissao?: string;
  entrou_por?: string;
  necessidades_especiais?: string;
  observacoes?: string;
  aceitou_jesus?: boolean;
  deseja_contato?: boolean;
  deseja_trilha?: boolean;
  igreja_id?: string;
  filial_id?: string;
  todas_filiais?: boolean;
}

interface AtualizarMembroData {
  id: string;
  nome: string;
  telefone?: string;
  sexo?: string;
  data_nascimento?: string;
  estado_civil?: string;
  necessidades_especiais?: string;
  cep?: string;
  cidade?: string;
  bairro?: string;
  estado?: string;
  endereco?: string;
  profissao?: string;
  igreja_id?: string;
  filial_id?: string;
  todas_filiais?: boolean;
}

interface BuscarMembroData {
  contato?: string;
  email?: string;
  telefone?: string;
  igreja_id?: string;
  filial_id?: string;
  todas_filiais?: boolean;
}

// Quando a pessoa aceita Jesus pela primeira vez, registra a data da
// conversão (usada pelo painel "Aceitaram Jesus" em /pessoas). Se já houver
// uma data registrada, ela é preservada.
function calcularDataConversao(
  aceitouAgora: boolean | undefined,
  dataConversaoExistente: string | null | undefined,
): string | null | undefined {
  if (aceitouAgora && !dataConversaoExistente) {
    return new Date().toISOString().slice(0, 10);
  }
  return dataConversaoExistente;
}

// deno-lint-ignore no-explicit-any
function applyTenantFilters(
  query: any,
  contexto: { igreja_id?: string; filial_id?: string; todas_filiais?: boolean },
) {
  let nextQuery = query.eq("igreja_id", contexto.igreja_id);
  if (!contexto.todas_filiais && contexto.filial_id) {
    nextQuery = nextQuery.eq("filial_id", contexto.filial_id);
  }
  return nextQuery;
}

// Confere se igreja_id (e, se informado, filial_id) correspondem a um
// tenant real antes de aceitar o cadastro público. Os links de cadastro
// carregam esses IDs na URL (necessário para roteamento multi-tenant), mas
// nada impede que um valor arbitrário seja enviado diretamente para a edge
// function — sem essa checagem, viraria lixo/spam em profiles com um
// igreja_id inexistente.
// deno-lint-ignore no-explicit-any
async function validarIgrejaFilial(
  supabase: any,
  igrejaId: string,
  filialId?: string | null,
): Promise<string | null> {
  const { data: igreja, error: igrejaError } = await supabase
    .from("igrejas")
    .select("id")
    .eq("id", igrejaId)
    .maybeSingle();

  if (igrejaError || !igreja) {
    return "Link inválido: igreja não encontrada.";
  }

  if (filialId) {
    const { data: filial, error: filialError } = await supabase
      .from("filiais")
      .select("id")
      .eq("id", filialId)
      .eq("igreja_id", igrejaId)
      .maybeSingle();

    if (filialError || !filial) {
      return "Link inválido: filial não encontrada.";
    }
  }

  return null;
}

// Sincroniza telefone e email em profile_contatos após criar/atualizar um
// perfil via cadastro público. Não lança — erros são apenas logados para
// não bloquear o retorno de sucesso ao usuário.
// deno-lint-ignore no-explicit-any
async function sincronizarContatosPerfil(
  supabase: any,
  profileId: string,
  telefone: string | null,
  email: string | null,
) {
  const upsertContato = async (
    tipo: string,
    valor: string,
    isWhatsapp: boolean,
    isLogin: boolean,
  ) => {
    // For phone types, search across all subtypes (celular/fixo/telefone) so we
    // don't insert a duplicate when the number changes size (10↔11 digits) or
    // when the existing row was created with the legacy 'telefone' type.
    const tiposBusca = tipo === "email" ? ["email"] : ["celular", "fixo", "telefone"];
    const { data: existing } = await supabase
      .from("profile_contatos")
      .select("id")
      .eq("profile_id", profileId)
      .in("tipo", tiposBusca)
      .eq("is_primary", true)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("profile_contatos")
        .update({ tipo, valor, is_whatsapp: isWhatsapp, is_login: isLogin })
        .eq("id", existing.id);
    } else {
      await supabase.from("profile_contatos").insert({
        profile_id: profileId,
        tipo,
        valor,
        rotulo: "Pessoal",
        is_primary: true,
        is_whatsapp: isWhatsapp,
        is_login: isLogin,
      });
    }
  };

  try {
    if (telefone) {
      const tipoTel = telefone.length >= 11 ? "celular" : "fixo";
      await upsertContato(tipoTel, telefone, true, false);
    }
    if (email) {
      await upsertContato("email", email, false, false);
    }
  } catch (err) {
    console.warn(
      "[cadastro-publico] Aviso: erro ao sincronizar profile_contatos:",
      err,
    );
  }
}

// Agenda um contato de acompanhamento (+3 dias) para um novo visitante que
// pediu para ser contatado. membro_responsavel_id fica em aberto (null) —
// a atribuição a um líder/departamento responsável é feita depois, por uma
// rotina de roteamento. Não lança — erros são apenas logados.
// deno-lint-ignore no-explicit-any
async function agendarContatoVisitante(
  supabase: any,
  visitanteId: string,
  igrejaId?: string,
  filialId?: string | null,
) {
  if (!igrejaId) return;

  try {
    const dataContato = new Date();
    dataContato.setDate(dataContato.getDate() + 3);

    await supabase.from("visitante_contatos").insert({
      visitante_id: visitanteId,
      membro_responsavel_id: null,
      data_contato: dataContato.toISOString(),
      tipo_contato: "telefonico",
      status: "agendado",
      observacoes: "Contato automático agendado após cadastro externo",
      igreja_id: igrejaId,
      filial_id: filialId || null,
    });
  } catch (err) {
    console.warn(
      "[cadastro-publico] Aviso: erro ao agendar visitante_contatos:",
      err,
    );
  }
}

// Helper to log audit events
// deno-lint-ignore no-explicit-any
async function logAudit(
  supabase: any,
  endpoint: string,
  action: string,
  clientIP: string,
  success: boolean,
  errorMessage?: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_public_endpoints").insert({
      endpoint_name: endpoint,
      action,
      client_ip: clientIP,
      success,
      error_message: errorMessage || null,
      request_metadata: metadata || {},
    });
  } catch (err) {
    console.error("[cadastro-publico] Failed to log audit:", err);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);

  // Initialize Supabase client early for security checks
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Security: Check if IP is blocked
  const { data: isBlocked } = await supabase.rpc("is_ip_blocked", {
    p_ip: clientIP,
  });
  if (isBlocked) {
    console.log(`[cadastro-publico] Blocked IP attempted access: ${clientIP}`);
    return new Response(
      JSON.stringify({
        error: "Acesso temporariamente bloqueado. Tente novamente mais tarde.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Rate limiting check
  const rateCheck = checkRateLimit(clientIP);

  if (!rateCheck.allowed) {
    console.log(`[cadastro-publico] Rate limit exceeded for IP: ${clientIP}`);
    // Log violation and potentially auto-block
    await supabase.rpc("log_rate_limit_violation", {
      p_ip: clientIP,
      p_endpoint: "cadastro-publico",
    });
    return new Response(
      JSON.stringify({
        error: "Muitas requisições. Tente novamente em alguns segundos.",
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfter || 60),
        },
      },
    );
  }

  try {
    const { action, data } = await req.json();

    console.log(`[cadastro-publico] Action: ${action}, IP: ${clientIP}`);

    if (action === "cadastrar_visitante") {
      const visitanteData = data as CadastroVisitanteData;

      if (!visitanteData.igreja_id) {
        return new Response(
          JSON.stringify({ error: "Link inválido: igreja não informada." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const erroTenantVisitante = await validarIgrejaFilial(
        supabase,
        visitanteData.igreja_id,
        visitanteData.filial_id,
      );
      if (erroTenantVisitante) {
        return new Response(JSON.stringify({ error: erroTenantVisitante }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validação básica
      if (!visitanteData.nome?.trim()) {
        return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!visitanteData.telefone?.trim() && !visitanteData.email?.trim()) {
        return new Response(
          JSON.stringify({
            error: "Informe pelo menos um contato (telefone ou email)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Normalizar telefone usando utilitário compartilhado
      const telefoneNormalizado = normalizarTelefone(visitanteData.telefone);

      // Verificar se já existe uma pessoa com o mesmo email ou telefone.
      // Busca em profiles (campo legado) E em profile_contatos para cobrir
      // perfis criados ou migrados após a padronização de contatos.
      let visitanteExistente = null;

      if (visitanteData.email?.trim()) {
        const emailBusca = visitanteData.email.trim().toLowerCase();

        let byEmailQuery = supabase
          .from("profiles")
          .select("*")
          .in("status", ["visitante", "frequentador"])
          .eq("email", emailBusca)
          .limit(1);

        byEmailQuery = applyTenantFilters(byEmailQuery, visitanteData);
        const { data: byEmail } = await byEmailQuery;

        if (byEmail && byEmail.length > 0) {
          visitanteExistente = byEmail[0];
        }

        // Fallback: buscar em profile_contatos
        if (!visitanteExistente) {
          let byEmailContatoQuery = supabase
            .from("profile_contatos")
            .select("profile_id, profiles!inner(*)")
            .eq("tipo", "email")
            .eq("valor", emailBusca)
            .eq("profiles.igreja_id", visitanteData.igreja_id)
            .in("profiles.status", ["visitante", "frequentador"]);

          if (!visitanteData.todas_filiais && visitanteData.filial_id) {
            byEmailContatoQuery = byEmailContatoQuery.eq("profiles.filial_id", visitanteData.filial_id);
          }

          const { data: byEmailContato } = await byEmailContatoQuery.limit(1).maybeSingle();

          if (byEmailContato?.profiles) {
            visitanteExistente = byEmailContato.profiles;
          }
        }
      }

      if (!visitanteExistente && telefoneNormalizado) {
        let byTelefoneQuery = supabase
          .from("profiles")
          .select("*")
          .in("status", ["visitante", "frequentador"])
          .eq("telefone", telefoneNormalizado)
          .limit(1);

        byTelefoneQuery = applyTenantFilters(byTelefoneQuery, visitanteData);
        const { data: byTelefone } = await byTelefoneQuery;

        if (byTelefone && byTelefone.length > 0) {
          visitanteExistente = byTelefone[0];
        }

        // Fallback: buscar em profile_contatos
        if (!visitanteExistente) {
          let byTelContatoQuery = supabase
            .from("profile_contatos")
            .select("profile_id, profiles!inner(*)")
            .in("tipo", ["celular", "fixo", "telefone"])
            .eq("valor", telefoneNormalizado)
            .eq("profiles.igreja_id", visitanteData.igreja_id)
            .in("profiles.status", ["visitante", "frequentador"]);

          if (!visitanteData.todas_filiais && visitanteData.filial_id) {
            byTelContatoQuery = byTelContatoQuery.eq("profiles.filial_id", visitanteData.filial_id);
          }

          const { data: byTelContato } = await byTelContatoQuery.limit(1).maybeSingle();

          if (byTelContato?.profiles) {
            visitanteExistente = byTelContato.profiles;
          }
        }
      }

      let resultData;

      if (visitanteExistente) {
        // Atualizar registro existente
        const novoNumeroVisitas = (visitanteExistente.numero_visitas || 0) + 1;

        // Promover automaticamente para frequentador após 2 visitas
        let novoStatus = visitanteExistente.status;
        if (
          visitanteExistente.status === "visitante" &&
          novoNumeroVisitas > 2
        ) {
          novoStatus = "frequentador";
        }

        const { data: updated, error: updateError } = await supabase
          .from("profiles")
          .update({
            numero_visitas: novoNumeroVisitas,
            data_ultima_visita: new Date().toISOString(),
            status: novoStatus,
            aceitou_jesus:
              visitanteData.aceitou_jesus || visitanteExistente.aceitou_jesus,
            data_conversao: calcularDataConversao(
              visitanteData.aceitou_jesus,
              visitanteExistente.data_conversao,
            ),
            deseja_contato:
              visitanteData.deseja_contato ?? visitanteExistente.deseja_contato,
            sexo: visitanteData.sexo || visitanteExistente.sexo,
            data_nascimento:
              visitanteData.data_nascimento ||
              visitanteExistente.data_nascimento,
            igreja_id: visitanteExistente.igreja_id || visitanteData.igreja_id,
            filial_id:
              visitanteExistente.filial_id || visitanteData.filial_id || null,
          })
          .eq("id", visitanteExistente.id)
          .select()
          .single();

        if (updateError) throw updateError;
        resultData = updated;

        await sincronizarContatosPerfil(
          supabase,
          visitanteExistente.id,
          telefoneNormalizado,
          visitanteData.email?.trim().toLowerCase() || null,
        );

        console.log(
          `[cadastro-publico] Visitante atualizado: ${resultData.nome}, visitas: ${resultData.numero_visitas}`,
        );
      } else {
        // Inserir novo registro
        const { data: newData, error: insertError } = await supabase
          .from("profiles")
          .insert({
            nome: visitanteData.nome.trim(),
            telefone: telefoneNormalizado,
            email: visitanteData.email?.trim().toLowerCase() || null,
            necessidades_especiais:
              visitanteData.necessidades_especiais?.trim() || null,
            observacoes: visitanteData.observacoes?.trim() || null,
            aceitou_jesus: visitanteData.aceitou_jesus || false,
            data_conversao: calcularDataConversao(
              visitanteData.aceitou_jesus,
              null,
            ),
            deseja_contato: visitanteData.deseja_contato ?? true,
            sexo: visitanteData.sexo || null,
            data_nascimento: visitanteData.data_nascimento || null,
            entrou_por: visitanteData.entrou_por || null,
            status: "visitante",
            data_primeira_visita: new Date().toISOString(),
            data_ultima_visita: new Date().toISOString(),
            numero_visitas: 1,
            igreja_id: visitanteData.igreja_id,
            filial_id: visitanteData.filial_id || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        resultData = newData;

        await sincronizarContatosPerfil(
          supabase,
          newData.id,
          telefoneNormalizado,
          visitanteData.email?.trim().toLowerCase() || null,
        );

        if (visitanteData.deseja_contato ?? true) {
          await agendarContatoVisitante(
            supabase,
            newData.id,
            visitanteData.igreja_id,
            visitanteData.filial_id,
          );
        }

        console.log(
          `[cadastro-publico] Novo visitante cadastrado: ${resultData.nome}`,
        );
      }

      // LGPD: never echo back full profile to unauthenticated caller.
      // When matching an existing visitor by phone/email, returning `*` leaks
      // fields the caller did not supply. Return only the minimum needed for UX.
      return new Response(
        JSON.stringify({
          success: true,
          data: { id: resultData.id, nome: resultData.nome },
          isUpdate: !!visitanteExistente,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );

    }

    if (action === "buscar_membro") {
      const buscaData = data as BuscarMembroData;
      const contato =
        buscaData.contato || buscaData.email || buscaData.telefone;

      if (!buscaData.igreja_id) {
        await logAudit(
          supabase,
          "cadastro-publico",
          "buscar_membro",
          clientIP,
          false,
          "Missing igreja_id",
        );
        return new Response(
          JSON.stringify({ error: "Link inválido: igreja não informada." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const erroTenantBusca = await validarIgrejaFilial(
        supabase,
        buscaData.igreja_id,
        buscaData.filial_id,
      );
      if (erroTenantBusca) {
        await logAudit(
          supabase,
          "cadastro-publico",
          "buscar_membro",
          clientIP,
          false,
          erroTenantBusca,
        );
        return new Response(JSON.stringify({ error: erroTenantBusca }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!contato?.trim()) {
        await logAudit(
          supabase,
          "cadastro-publico",
          "buscar_membro",
          clientIP,
          false,
          "Missing email",
        );
        return new Response(
          JSON.stringify({ error: "Telefone ou email é obrigatório" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const contatoLimpo = contato.trim();
      const emailBusca = contatoLimpo.includes("@")
        ? contatoLimpo.toLowerCase()
        : null;
      const telefoneBusca = !emailBusca
        ? normalizarTelefone(contatoLimpo)
        : null;

      if (!emailBusca && !telefoneBusca) {
        await logAudit(
          supabase,
          "cadastro-publico",
          "buscar_membro",
          clientIP,
          false,
          "Invalid contact format",
        );
        return new Response(
          JSON.stringify({ error: "Informe um email ou telefone válido" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      let profileQuery = supabase
        .from("profiles")
        .select(
          // LGPD minimization: only fields strictly needed to confirm identity
          // and prefill a self-service form the caller already owns.
          // Removed: user_id, necessidades_especiais (health), bairro, endereco,
          // profissao (professional data — not required for prefill).
          "id, nome, telefone, email, sexo, data_nascimento, estado_civil, cep, cidade, estado, status, igreja_id, filial_id",
        )

        .in("status", ["membro", "visitante", "frequentador"]);

      profileQuery = applyTenantFilters(profileQuery, buscaData);
      if (emailBusca) {
        profileQuery = profileQuery.eq("email", emailBusca);
      } else if (telefoneBusca) {
        profileQuery = profileQuery.eq("telefone", telefoneBusca);
      }

      const { data: profile, error } = await profileQuery.maybeSingle();

      if (error || !profile) {
        // Security: Log failed lookup attempts for audit
        await logAudit(
          supabase,
          "cadastro-publico",
          "buscar_membro",
          clientIP,
          false,
          "Member not found",
          { contato_hash: contatoLimpo.substring(0, 3) + "***" },
        );
        // Security: Use generic error message to prevent email enumeration
        return new Response(
          JSON.stringify({ error: "Não foi possível processar a solicitação" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Log successful lookup
      await logAudit(
        supabase,
        "cadastro-publico",
        "buscar_membro",
        clientIP,
        true,
        null,
        { profile_id: profile.id },
      );
      console.log(`[cadastro-publico] Membro encontrado (id=${profile.id})`);

      return new Response(JSON.stringify({ success: true, data: profile }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "cadastrar_cafe_vp") {
      const cafeData = data as CadastroVisitanteData;

      if (!cafeData.igreja_id) {
        return new Response(
          JSON.stringify({ error: "Link inválido: igreja não informada." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const erroTenantCafe = await validarIgrejaFilial(
        supabase,
        cafeData.igreja_id,
        cafeData.filial_id,
      );
      if (erroTenantCafe) {
        return new Response(JSON.stringify({ error: erroTenantCafe }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!cafeData.nome?.trim()) {
        return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!cafeData.telefone?.trim() && !cafeData.email?.trim()) {
        return new Response(
          JSON.stringify({
            error: "Informe pelo menos um contato (telefone ou email)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const telefoneNormalizado = normalizarTelefone(cafeData.telefone);
      const emailNormalizado = cafeData.email?.trim().toLowerCase() || null;

      let profileExistente = null;

      if (emailNormalizado) {
        let byEmailQuery = supabase
          .from("profiles")
          .select("*")
          .in("status", ["membro", "visitante", "frequentador"])
          .eq("email", emailNormalizado)
          .limit(1);

        byEmailQuery = applyTenantFilters(byEmailQuery, cafeData);
        const { data: byEmail } = await byEmailQuery;

        if (byEmail && byEmail.length > 0) {
          profileExistente = byEmail[0];
        }
      }

      if (!profileExistente && telefoneNormalizado) {
        let byTelefoneQuery = supabase
          .from("profiles")
          .select("*")
          .in("status", ["membro", "visitante", "frequentador"])
          .eq("telefone", telefoneNormalizado)
          .limit(1);

        byTelefoneQuery = applyTenantFilters(byTelefoneQuery, cafeData);
        const { data: byTelefone } = await byTelefoneQuery;

        if (byTelefone && byTelefone.length > 0) {
          profileExistente = byTelefone[0];
        }
      }

      const observacaoEvento = `Café V&P (${new Date().toISOString().slice(0, 10)})`;
      const observacoesCombinadas = [
        profileExistente?.observacoes,
        cafeData.observacoes?.trim(),
        observacaoEvento,
      ]
        .filter((item) => !!item && String(item).trim().length > 0)
        .join(" | ");

      if (profileExistente) {
        const updatePayload = {
          nome: cafeData.nome.trim() || profileExistente.nome,
          telefone: telefoneNormalizado || profileExistente.telefone,
          email: emailNormalizado || profileExistente.email,
          sexo: cafeData.sexo || profileExistente.sexo,
          estado_civil: cafeData.estado_civil || profileExistente.estado_civil,
          data_nascimento:
            cafeData.data_nascimento || profileExistente.data_nascimento,
          cidade: cafeData.cidade?.trim() || profileExistente.cidade,
          bairro: cafeData.bairro?.trim() || profileExistente.bairro,
          profissao: cafeData.profissao?.trim() || profileExistente.profissao,
          necessidades_especiais:
            cafeData.necessidades_especiais?.trim() ||
            profileExistente.necessidades_especiais,
          observacoes: observacoesCombinadas || profileExistente.observacoes,
          aceitou_jesus:
            cafeData.aceitou_jesus || profileExistente.aceitou_jesus,
          data_conversao: calcularDataConversao(
            cafeData.aceitou_jesus,
            profileExistente.data_conversao,
          ),
          deseja_contato:
            cafeData.deseja_contato ?? profileExistente.deseja_contato,
          entrou_por: profileExistente.entrou_por || "cafe_vp",
          igreja_id: profileExistente.igreja_id || cafeData.igreja_id,
          filial_id: profileExistente.filial_id || cafeData.filial_id || null,
        };

        const { data: updated, error: updateError } = await supabase
          .from("profiles")
          .update(updatePayload)
          .eq("id", profileExistente.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // LGPD: minimize response — do not echo full profile data the caller did not supply.
        return new Response(
          JSON.stringify({
            success: true,
            isUpdate: true,
            data: { id: updated.id, nome: updated.nome },
            message:
              profileExistente.status === "membro"
                ? "Cadastro localizado como membro e atualizado sem duplicidade."
                : "Cadastro existente localizado e atualizado sem duplicidade.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );

      }

      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({
          nome: cafeData.nome.trim(),
          telefone: telefoneNormalizado,
          email: emailNormalizado,
          sexo: cafeData.sexo || null,
          estado_civil: cafeData.estado_civil || null,
          data_nascimento: cafeData.data_nascimento || null,
          cidade: cafeData.cidade?.trim() || null,
          bairro: cafeData.bairro?.trim() || null,
          profissao: cafeData.profissao?.trim() || null,
          necessidades_especiais:
            cafeData.necessidades_especiais?.trim() || null,
          observacoes: observacoesCombinadas || null,
          aceitou_jesus: cafeData.aceitou_jesus || false,
          data_conversao: calcularDataConversao(cafeData.aceitou_jesus, null),
          deseja_contato: cafeData.deseja_contato ?? true,
          entrou_por: "cafe_vp",
          status: "visitante",
          data_primeira_visita: new Date().toISOString(),
          data_ultima_visita: new Date().toISOString(),
          numero_visitas: 1,
          igreja_id: cafeData.igreja_id,
          filial_id: cafeData.filial_id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (cafeData.deseja_contato ?? true) {
        await agendarContatoVisitante(
          supabase,
          created.id,
          cafeData.igreja_id,
          cafeData.filial_id,
        );
      }

      // LGPD: response minimization on public endpoint.
      return new Response(
        JSON.stringify({
          success: true,
          isUpdate: false,
          data: { id: created.id, nome: created.nome },
          message: cafeData.deseja_trilha
            ? "Cadastro Café V&P realizado! Já registramos seu interesse na trilha de membros."
            : "Cadastro Café V&P realizado com sucesso!",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );

    }

    if (action === "atualizar_membro") {
      const membroData = data as AtualizarMembroData;

      if (!membroData.igreja_id) {
        return new Response(
          JSON.stringify({ error: "Link inválido: igreja não informada." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const erroTenantMembro = await validarIgrejaFilial(
        supabase,
        membroData.igreja_id,
        membroData.filial_id,
      );
      if (erroTenantMembro) {
        return new Response(JSON.stringify({ error: erroTenantMembro }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!membroData.id || !membroData.nome?.trim()) {
        return new Response(
          JSON.stringify({ error: "ID e nome são obrigatórios" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Buscar dados atuais do perfil
      let currentProfileQuery = supabase
        .from("profiles")
        .select("*")
        .eq("id", membroData.id)
        .in("status", ["membro", "visitante", "frequentador"]);

      currentProfileQuery = applyTenantFilters(currentProfileQuery, membroData);
      const { data: currentProfile, error: fetchError } =
        await currentProfileQuery.single();

      if (fetchError || !currentProfile) {
        return new Response(
          JSON.stringify({ error: "Membro não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Normalizar telefone e CEP usando utilitário compartilhado
      const telefoneNormalizado = normalizarTelefone(membroData.telefone);
      const cepNormalizado = membroData.cep?.replace(/\D/g, "") || null;

      // Preparar dados novos
      const dadosNovos = {
        nome: membroData.nome.trim(),
        telefone: telefoneNormalizado,
        sexo: membroData.sexo || null,
        data_nascimento: membroData.data_nascimento || null,
        estado_civil: membroData.estado_civil || null,
        necessidades_especiais:
          membroData.necessidades_especiais?.trim() || null,
        cep: cepNormalizado,
        cidade: membroData.cidade?.trim() || null,
        bairro: membroData.bairro?.trim() || null,
        estado: membroData.estado || null,
        endereco: membroData.endereco?.trim() || null,
        profissao: membroData.profissao?.trim() || null,
      };

      // Preparar dados antigos (apenas os campos que serão comparados)
      const dadosAntigos = {
        nome: currentProfile.nome,
        telefone: currentProfile.telefone,
        sexo: currentProfile.sexo,
        data_nascimento: currentProfile.data_nascimento,
        estado_civil: currentProfile.estado_civil,
        necessidades_especiais: currentProfile.necessidades_especiais,
        cep: currentProfile.cep,
        cidade: currentProfile.cidade,
        bairro: currentProfile.bairro,
        estado: currentProfile.estado,
        endereco: currentProfile.endereco,
        profissao: currentProfile.profissao,
      };

      // Verificar se há alterações reais
      const hasChanges = Object.keys(dadosNovos).some((key) => {
        const novoValor = dadosNovos[key as keyof typeof dadosNovos];
        const antigoValor = dadosAntigos[key as keyof typeof dadosAntigos];
        return novoValor !== antigoValor;
      });

      if (!hasChanges) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Nenhuma alteração detectada",
            pending: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Inserir na tabela de alterações pendentes
      const { data: pendingChange, error: insertError } = await supabase
        .from("alteracoes_perfil_pendentes")
        .insert({
          profile_id: membroData.id,
          dados_novos: dadosNovos,
          dados_antigos: dadosAntigos,
          status: "pendente",
          igreja_id: currentProfile.igreja_id || membroData.igreja_id,
          filial_id: currentProfile.filial_id || membroData.filial_id || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(
        `[cadastro-publico] Alteração pendente criada para: ${currentProfile.nome}`,
      );

      // Notificar admins sobre nova alteração pendente
      await supabase.rpc("notify_admins", {
        p_title: "Nova Alteração de Perfil Pendente",
        p_message: `${currentProfile.nome} enviou uma atualização de cadastro via link externo que precisa ser aprovada.`,
        p_type: "alteracao_perfil_pendente",
        p_related_user_id: currentProfile.user_id,
        p_metadata: {
          profile_id: membroData.id,
          profile_name: currentProfile.nome,
          pending_change_id: pendingChange.id,
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message:
            "Sua solicitação foi enviada e será analisada pela secretaria da igreja.",
          pending: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cadastro-publico] Erro:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
