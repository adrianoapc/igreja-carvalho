import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type Sessao = {
  id: string;
  igreja_id: string;
  filial_id: string | null;
  data_culto: string;
  periodo: string;
  status: string;
  updated_at: string;
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

export default function SessoesContagem() {
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const navigate = useNavigate();

  const { data: sessoes = [], isLoading } = useQuery<Sessao[]>({
    queryKey: ["sessoes-contagem", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let q = supabase
        .from("sessoes_contagem")
        .select(
          "id, igreja_id, filial_id, data_culto, periodo, status, updated_at"
        )
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!isAllFiliais && filialId) q = q.eq("filial_id", filialId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Sessao[];
    },
    enabled: !loading && !!igrejaId,
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Sessões de Contagem</h1>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Sessões</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Carregando...</div>
          ) : sessoes.length === 0 ? (
            <div className="text-muted-foreground">
              Nenhuma sessão encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Período</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Atualizado</th>
                    <th className="py-2 pr-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sessoes.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2 pr-4">
                        {format(
                          new Date(s.data_culto),
                          "dd 'de' MMMM 'de' yyyy",
                          { locale: ptBR }
                        )}
                      </td>
                      <td className="py-2 pr-4 capitalize">{s.periodo}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="py-2 pr-4">
                        {format(new Date(s.updated_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </td>
                      <td className="py-2 pr-4">
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(`/financas/sessoes-contagem/${s.id}`)
                          }
                        >
                          Ver lançamentos
                        </Button>
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
