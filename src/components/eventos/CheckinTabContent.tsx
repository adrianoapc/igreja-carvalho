import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Users, UserCheck, Clock } from "lucide-react";
import { CheckinScanner } from "./CheckinScanner";
import { CheckinManualSearch } from "./CheckinManualSearch";
import { CheckinRecentList } from "./CheckinRecentList";

interface CheckinTabContentProps {
  eventoId: string;
}

export function CheckinTabContent({ eventoId }: CheckinTabContentProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const queryClient = useQueryClient();

  // Estatísticas de check-in
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["checkin-stats", eventoId],
    queryFn: async () => {
      // Total de inscritos
      const { count: total, error: totalError } = await supabase
        .from("inscricoes_eventos")
        .select("id", { count: "exact", head: true })
        .eq("evento_id", eventoId)
        .is("cancelado_em", null);

      if (totalError) throw totalError;

      // Presentes (com check-in)
      const { count: presentes, error: presentesError } = await supabase
        .from("inscricoes_eventos")
        .select("id", { count: "exact", head: true })
        .eq("evento_id", eventoId)
        .is("cancelado_em", null)
        .not("checkin_validado_em", "is", null);

      if (presentesError) throw presentesError;

      return {
        total: total || 0,
        presentes: presentes || 0,
        pendentes: (total || 0) - (presentes || 0),
        percentual: total ? Math.round(((presentes || 0) / total) * 100) : 0,
      };
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["checkin-stats", eventoId] });
    queryClient.invalidateQueries({ queryKey: ["checkins-recentes", eventoId] });
  };

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Inscritos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {statsLoading ? "-" : stats?.total || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Presentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {statsLoading ? "-" : stats?.presentes || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aguardando
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {statsLoading ? "-" : stats?.pendentes || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Progresso */}
      {stats && stats.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso do Check-in</span>
              <span className="text-sm text-muted-foreground">
                {stats.presentes}/{stats.total} ({stats.percentual}%)
              </span>
            </div>
            <Progress value={stats.percentual} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Botão do Scanner */}
      <Card>
        <CardContent className="pt-6">
          <Button
            size="lg"
            className="w-full h-16 text-lg"
            onClick={() => setScannerOpen(true)}
          >
            <Camera className="h-6 w-6 mr-3" />
            Abrir Scanner QR Code
          </Button>
          <p className="text-sm text-muted-foreground text-center mt-3">
            Use a câmera do dispositivo para escanear os QR Codes das inscrições
          </p>
        </CardContent>
      </Card>

      {/* Busca Manual */}
      <CheckinManualSearch eventoId={eventoId} onCheckinSuccess={handleRefresh} />

      {/* Lista de Check-ins Recentes */}
      <CheckinRecentList eventoId={eventoId} />

      {/* Modal do Scanner */}
      <CheckinScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
