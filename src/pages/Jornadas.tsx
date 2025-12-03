import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import NovaJornadaDialog from "@/components/jornadas/NovaJornadaDialog";

export default function Jornadas() {
  const navigate = useNavigate();
  const [showNovaJornada, setShowNovaJornada] = useState(false);

  const { data: jornadas, isLoading, refetch } = useQuery({
    queryKey: ["jornadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jornadas")
        .select(`
          *,
          etapas_jornada(id),
          inscricoes_jornada(id, concluido)
        `)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/pessoas")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Jornadas</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe trilhas de discipulado e formação
              </p>
            </div>
          </div>
          <Button onClick={() => setShowNovaJornada(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Jornada
          </Button>
        </div>

        {/* Grid de Jornadas */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : jornadas && jornadas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jornadas.map((jornada) => {
              const totalInscritos = jornada.inscricoes_jornada?.length || 0;
              const concluidos = jornada.inscricoes_jornada?.filter(
                (i: any) => i.concluido
              ).length || 0;
              const etapas = jornada.etapas_jornada?.length || 0;

              return (
                <Card
                  key={jornada.id}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 group overflow-hidden"
                  onClick={() => navigate(`/jornadas/${jornada.id}`)}
                >
                  <div
                    className="h-2"
                    style={{ backgroundColor: jornada.cor_tema || "#3b82f6" }}
                  />
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{jornada.titulo}</span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {jornada.descricao && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {jornada.descricao}
                      </p>
                    )}
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="w-3 h-3" />
                        {totalInscritos} inscritos
                      </Badge>
                      <Badge variant="outline">
                        {etapas} etapas
                      </Badge>
                      {concluidos > 0 && (
                        <Badge variant="default" className="bg-green-600">
                          {concluidos} concluídos
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Nenhuma jornada criada</h3>
                <p className="text-muted-foreground text-sm">
                  Crie sua primeira jornada de discipulado
                </p>
              </div>
              <Button onClick={() => setShowNovaJornada(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Jornada
              </Button>
            </div>
          </Card>
        )}
      </div>

      <NovaJornadaDialog
        open={showNovaJornada}
        onOpenChange={setShowNovaJornada}
        onSuccess={() => {
          refetch();
          setShowNovaJornada(false);
        }}
      />
    </div>
  );
}
