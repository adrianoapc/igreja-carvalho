import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalize(str: string | null | undefined): string {
  return str?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Busca pessoas não mescladas
    const { data: pessoas, error } = await supabase
      .from("profiles")
      .select("id, nome, data_nascimento, email, telefone")
      .or("is_merged.is.null,is_merged.eq.false");

    if (error) {
      console.error("[detectar-duplicatas] Erro ao buscar profiles:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pessoas || pessoas.length === 0) {
      return new Response(JSON.stringify({ count: 0, message: "Nenhuma pessoa encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[detectar-duplicatas] Analisando ${pessoas.length} pessoas...`);

    const suspeitas: Array<{
      pessoa_id_1: string;
      pessoa_id_2: string;
      score_similaridade: number;
      campos_conflitantes: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < pessoas.length; i++) {
      for (let j = i + 1; j < pessoas.length; j++) {
        const p1 = pessoas[i];
        const p2 = pessoas[j];

        const scoreNome = levenshteinSimilarity(normalize(p1.nome), normalize(p2.nome));
        const scoreEmail = levenshteinSimilarity(normalize(p1.email), normalize(p2.email));
        const scoreTel = levenshteinSimilarity(normalize(p1.telefone), normalize(p2.telefone));
        const scoreNasc = p1.data_nascimento && p2.data_nascimento && p1.data_nascimento === p2.data_nascimento ? 1 : 0;

        const score = scoreNome * 0.5 + scoreEmail * 0.2 + scoreTel * 0.2 + scoreNasc * 0.1;

        if (score > 0.85) {
          suspeitas.push({
            pessoa_id_1: p1.id,
            pessoa_id_2: p2.id,
            score_similaridade: parseFloat(score.toFixed(4)),
            campos_conflitantes: {
              nome: [p1.nome, p2.nome],
              email: [p1.email, p2.email],
              telefone: [p1.telefone, p2.telefone],
              data_nascimento: [p1.data_nascimento, p2.data_nascimento],
            },
          });
        }
      }
    }

    // Insere suspeitas evitando duplicatas já existentes
    let inserted = 0;
    for (const s of suspeitas) {
      const { error: insertError } = await supabase
        .from("pessoas_duplicatas_suspeitas")
        .insert({ ...s, status: "pendente" });

      if (!insertError) inserted++;
      else console.warn("[detectar-duplicatas] Erro ao inserir suspeita:", insertError.message);
    }

    console.log(`[detectar-duplicatas] ${inserted}/${suspeitas.length} suspeitas inseridas.`);

    return new Response(
      JSON.stringify({ total_analisadas: pessoas.length, suspeitas_encontradas: suspeitas.length, inseridas: inserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[detectar-duplicatas] Erro inesperado:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
