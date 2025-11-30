import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCog, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Posicao {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  time: {
    id: string;
    nome: string;
    cor: string;
  };
}

export default function Posicoes() {
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosicoes();
  }, []);

  const loadPosicoes = async () => {
    try {
      const { data, error } = await supabase
        .from("posicoes_time")
        .select(`
          *,
          time:times_culto(id, nome, cor)
        `)
        .order("nome", { ascending: true });

      if (error) throw error;
      setPosicoes(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar posições", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Posições</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Carregando...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Agrupar por time
  const posicoesPorTime = posicoes.reduce((acc, pos) => {
    const timeId = pos.time.id;
    if (!acc[timeId]) {
      acc[timeId] = {
        time: pos.time,
        posicoes: []
      };
    }
    acc[timeId].posicoes.push(pos);
    return acc;
  }, {} as Record<string, { time: any; posicoes: Posicao[] }>);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Posições dos Times</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Visualize todas as posições organizadas por time
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6">
        {Object.values(posicoesPorTime).map(({ time, posicoes }) => (
          <Card key={time.id} className="shadow-soft">
            <CardHeader className="p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: time.cor }}
                >
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl">{time.nome}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {posicoes.length} {posicoes.length === 1 ? "posição" : "posições"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="grid gap-3 md:grid-cols-2">
                {posicoes.map((posicao) => (
                  <div 
                    key={posicao.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <UserCog className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{posicao.nome}</p>
                        <Badge variant={posicao.ativo ? "default" : "secondary"} className="text-xs">
                          {posicao.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {posicao.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {posicao.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {Object.keys(posicoesPorTime).length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <UserCog className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma posição cadastrada</h3>
              <p className="text-sm text-muted-foreground">
                As posições são criadas ao gerenciar os times.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}