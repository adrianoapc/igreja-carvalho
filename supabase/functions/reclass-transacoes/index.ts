import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type ReclassPayload = {
  tipo: "entrada" | "saida";
  filtros: Record<string, unknown>;
  ids?: string[]; // opcional: ids explicitamente selecionados
  novos_valores: Partial<{
    categoria_id: string | null;
    subcategoria_id: string | null;
    centro_custo_id: string | null;
    fornecedor_id: string | null;
    conta_id: string | null;
    status: string | null;
    data_competencia: string | null;
  }>;
  limite?: number;
};

type Contexto = {
  igreja_id: string;
  filial_id?: string | null;
};

type JobResult = {
  job_id: string;
  aplicados: number;
  ignorados: number;
};

Deno.serve(async (req) => {
  // Suporte a CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as ReclassPayload & Contexto;
    const { tipo, filtros, ids, novos_valores, limite = 5000, igreja_id, filial_id } = body;

    if (!tipo || (tipo !== "entrada" && tipo !== "saida")) {
      return new Response(JSON.stringify({ error: "tipo é obrigatório (entrada|saida)" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!igreja_id) {
      return new Response(JSON.stringify({ error: "igreja_id é obrigatório" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!novos_valores || Object.keys(novos_valores).length === 0) {
      return new Response(JSON.stringify({ error: "novos_valores não pode ser vazio" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (limite > 5000) {
      return new Response(JSON.stringify({ error: "limite máximo por operação é 5000" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Normaliza novos valores (remove undefined)
    const updateFields = Object.fromEntries(
      Object.entries(novos_valores).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(updateFields).length === 0) {
      return new Response(JSON.stringify({ error: "nenhum campo para atualizar" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Valida novos valores (categoria/tipo, subcategoria, conta ativa, centro, fornecedor)
    if (updateFields.categoria_id) {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, tipo")
        .eq("id", updateFields.categoria_id)
        .eq("igreja_id", igreja_id)
        .eq("ativo", true)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Categoria inválida ou inativa" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      if (data.tipo !== tipo) {
        return new Response(JSON.stringify({ error: "Categoria incompatível com o tipo" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    if (updateFields.subcategoria_id) {
      const { data, error } = await supabase
        .from("subcategorias_financeiras")
        .select("id")
        .eq("id", updateFields.subcategoria_id)
        .eq("igreja_id", igreja_id)
        .eq("ativo", true)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Subcategoria inválida ou inativa" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    if (updateFields.conta_id) {
      const { data, error } = await supabase
        .from("contas")
        .select("id")
        .eq("id", updateFields.conta_id)
        .eq("igreja_id", igreja_id)
        .eq("ativo", true)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Conta inválida ou inativa" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    if (updateFields.centro_custo_id) {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("id")
        .eq("id", updateFields.centro_custo_id)
        .eq("igreja_id", igreja_id)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Centro de custo inválido" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    if (updateFields.fornecedor_id) {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id")
        .eq("id", updateFields.fornecedor_id)
        .eq("igreja_id", igreja_id)
        .eq("ativo", true)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Fornecedor inválido ou inativo" }), {
          status: 400,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // Buscar transacoes alvo
    let query = supabase
      .from("transacoes_financeiras")
      .select("*")
      .eq("tipo", tipo)
      .eq("igreja_id", igreja_id)
      .limit(limite);

    if (filial_id) query = query.eq("filial_id", filial_id);
    if (ids && ids.length) query = query.in("id", ids);

    // Filtros simples (IDs/nome direto)
    if (filtros.descricao) query = query.ilike("descricao", `%${filtros.descricao}%` as string);
    if (filtros.status) query = query.eq("status", filtros.status as string);
    if (filtros.categoria) query = query.eq("categoria_id", filtros.categoria as string);
    if (filtros.subcategoria) query = query.eq("subcategoria_id", filtros.subcategoria as string);
    if (filtros.centro) query = query.eq("centro_custo_id", filtros.centro as string);
    if (filtros.fornecedor) query = query.eq("fornecedor_id", filtros.fornecedor as string);
    if (filtros.conta) query = query.eq("conta_id", filtros.conta as string);
    if (filtros.dataInicio) query = query.gte("data_vencimento", filtros.dataInicio as string);
    if (filtros.dataFim) query = query.lte("data_vencimento", filtros.dataFim as string);
    if (filtros.competenciaInicio) query = query.gte("data_competencia", filtros.competenciaInicio as string);
    if (filtros.competenciaFim) query = query.lte("data_competencia", filtros.competenciaFim as string);

    const { data: transacoes, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!transacoes || transacoes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma transacao encontrada" }), {
        status: 404,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // TODO: se houver campo de conciliacao, bloquear aqui (não presente no schema atual)

    const alvoIds = transacoes.map((t) => t.id);

    // Criar job
    const { data: jobInsert, error: jobError } = await supabase
      .from("reclass_jobs")
      .insert({
        igreja_id,
        filial_id,
        user_id: crypto.randomUUID(), // Sem autenticação, usar ID genérico
        tipo,
        filtros_aplicados: filtros,
        campos_alterados: updateFields,
        total_linhas: alvoIds.length,
        status: "processing",
      })
      .select("id")
      .single();

    if (jobError || !jobInsert) throw jobError || new Error("Falha ao criar job");

    // Atualizar em lote
    const { error: updateError, count } = await supabase
      .from("transacoes_financeiras")
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .in("id", alvoIds)
      .eq("igreja_id", igreja_id)
      .eq("tipo", tipo)
      .select("id");

    if (updateError) throw updateError;

    // Registrar itens
    const itens = transacoes.map((t) => {
      const antes = {
        categoria_id: t.categoria_id,
        subcategoria_id: t.subcategoria_id,
        centro_custo_id: t.centro_custo_id,
        fornecedor_id: t.fornecedor_id,
        conta_id: t.conta_id,
        status: t.status,
        data_competencia: t.data_competencia,
      };
      const depois = { ...antes, ...updateFields };
      return {
        job_id: jobInsert.id,
        transacao_id: t.id,
        antes,
        depois,
        status: "updated" as const,
      };
    });

    const { error: itemsError } = await supabase.from("reclass_job_items").insert(itens);
    if (itemsError) throw itemsError;

    await supabase
      .from("reclass_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", jobInsert.id);

    const result: JobResult = {
      job_id: jobInsert.id,
      aplicados: count ?? alvoIds.length,
      ignorados: 0,
    };

    return new Response(JSON.stringify({ success: true, job: result }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Erro reclass-transacoes:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
