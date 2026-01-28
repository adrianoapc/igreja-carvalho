import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChamadaTabContentProps {
  eventoId: string;
}

export default function ChamadaTabContent({ eventoId }: ChamadaTabContentProps) {
  const navigate = useNavigate();

  // Buscar informações do evento
  const { data: evento } = useQuery({
    queryKey: ["evento-chamada", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento")
        .eq("id", eventoId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Buscar estatísticas de presença - híbrido baseado em requer_inscricao
  const { data: stats, isLoading } = useQuery({
    queryKey: ["chamada-stats", eventoId],
    queryFn: async () => {
      try {
        // Buscar dados do evento
        const { data: evento, error: eventoError } = await supabase
          .from("eventos")
          .select("requer_inscricao, tipo")
          .eq("id", eventoId)
          .single();

        if (eventoError) {
          console.error("Erro ao buscar evento:", eventoError);
          throw eventoError;
        }

        let totalPessoas = 0;

        // Se requer inscrição, contar inscritos
        if (evento?.requer_inscricao) {
          const { count: inscritos, error: inscritos_error } = await supabase
            .from("inscricoes_eventos")
            .select("id", { count: "exact", head: true })
            .eq("evento_id", eventoId)
            .is("cancelado_em", null);

          if (inscritos_error) {
            console.error("Erro ao contar inscritos:", inscritos_error);
            throw inscritos_error;
          }
          totalPessoas = inscritos || 0;
        } else {
          // Se não requer inscrição (tipo culto), contar membros
          const { count: membros, error: membros_error } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("status", "membro");

          if (membros_error) {
            console.error("Erro ao contar membros:", membros_error);
            throw membros_error;
          }
          totalPessoas = membros || 0;
        }

        // Presentes (sempre da tabela checkins - fonte de verdade)
        const { count: presentes, error: presentesError } = await supabase
          .from("checkins")
          .select("id", { count: "exact", head: true })
          .eq("evento_id", eventoId);

        if (presentesError) {
          console.error("Erro ao contar presentes:", presentesError);
          throw presentesError;
        }

        const totalPresentes = presentes || 0;
        const totalAusentes = Math.max(0, totalPessoas - totalPresentes);

        console.log("Chamada stats:", { totalPessoas, totalPresentes, totalAusentes });

        return {
          total_membros: totalPessoas,
          total_presentes: totalPresentes,
          total_ausentes: totalAusentes,
          porcentagem: totalPessoas > 0 ? ((totalPresentes / totalPessoas) * 100).toFixed(0) : 0,
        };
      } catch (error) {
        console.error("Erro na query de chamada stats:", error);
        throw error;
      }
    },
    enabled: !!eventoId,
  });

  const handleAbrirChamada = () => {
    // Navega para a página de chamada geral ou para um contexto específico
    navigate("/chamada");
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Gerencie a lista de presença deste evento. Abra a página de chamada completa para registrar presenças.
        </AlertDescription>
      </Alert>

      {/* Stats Card */}
      {!isLoading && stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estatísticas de Presença</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total_membros}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">Presentes</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-300">{stats.total_presentes}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">Ausentes</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-300">{stats.total_ausentes}</p>
              </div>
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">%</p>
                <p className="text-2xl font-bold text-primary">{stats.porcentagem}%</p>
              </div>
            </div>

            {evento && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Evento</p>
                <p className="text-lg font-semibold">{evento.titulo}</p>
              </div>
            )}

            <Button onClick={handleAbrirChamada} className="w-full" size="lg">
              Abrir Página de Chamada Completa
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Na página de chamada você pode marcar/desmarcar presenças.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Carregando informações...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
