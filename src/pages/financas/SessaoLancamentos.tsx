import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Sessao = {
  id: string;
  data_culto: string;
  periodo: string;
  status: string;
};

type Lancamento = {
  id: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  origem_registro: string | null;
  categoria: { nome: string } | null;
  forma: { nome: string } | null;
  conta: { nome: string } | null;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aberta: "default",
    em_contagem: "secondary",
    divergente: "destructive",
    validada: "success",
    fechada: "outline",
    rejeitada: "destructive",
  };
  const variant = (map[status] as any) || "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function SessaoLancamentos() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: sessao } = useQuery<Sessao | null>({
    queryKey: ["sessao-contagem", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("sessoes_contagem")
        .select("id, data_culto, periodo, status")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Sessao;
    },
    enabled: !!id,
  });

  const { data: lancamentos = [], isLoading } = useQuery<Lancamento[]>({
    queryKey: ["sessao-lancamentos", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("transacoes_financeiras")
        .select(
          `id, valor, data_vencimento, data_pagamento, origem_registro,
           categoria:categoria_id(nome),
           forma:forma_pagamento_id(nome),
           conta:conta_id(nome)`
        )
        .eq("sessao_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Lancamento[];
    },
    enabled: !!id,
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Lançamentos da Sessão</h1>
          {sessao && (
            <div className="text-sm text-muted-foreground mt-1">
              {format(new Date(sessao.data_culto), "dd 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}{" "}
              · {sessao.periodo}
              <span className="ml-2">
                <StatusBadge status={sessao.status} />
              </span>
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transações vinculadas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Carregando...</div>
          ) : lancamentos.length === 0 ? (
            <div className="text-muted-foreground">
              Nenhum lançamento encontrado para esta sessão.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Categoria</th>
                    <th className="py-2 pr-4">Forma</th>
                    <th className="py-2 pr-4">Conta</th>
                    <th className="py-2 pr-4">Origem</th>
                    <th className="py-2 pr-4">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="py-2 pr-4">
                        {l.data_pagamento
                          ? format(new Date(l.data_pagamento), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : l.data_vencimento
                          ? format(new Date(l.data_vencimento), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : "-"}
                      </td>
                      <td className="py-2 pr-4">{l.categoria?.nome || "-"}</td>
                      <td className="py-2 pr-4">{l.forma?.nome || "-"}</td>
                      <td className="py-2 pr-4">{l.conta?.nome || "-"}</td>
                      <td className="py-2 pr-4 capitalize">
                        {l.origem_registro || "-"}
                      </td>
                      <td className="py-2 pr-4">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(Number(l.valor || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
