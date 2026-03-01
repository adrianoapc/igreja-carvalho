import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Users, UserCheck, Clock } from "lucide-react";
import { CheckinScanner } from "./CheckinScanner";
import { CheckinParticipantsList, type CheckinFiltro } from "./CheckinParticipantsList";
import { cn } from "@/lib/utils";

interface CheckinTabContentProps {
  eventoId: string;
}

export function CheckinTabContent({ eventoId }: CheckinTabContentProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [filtro, setFiltro] = useState<CheckinFiltro>("todos");
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["checkin-stats", eventoId],
    queryFn: async () => {
      try {
        const { data: evento, error: eventoError } = await supabase
          .from("eventos")
          .select("requer_inscricao, tipo")
          .eq("id", eventoId)
          .single();

        if (eventoError) throw eventoError;

        let total = 0;

        if (evento?.requer_inscricao) {
          const { count } = await supabase
            .from("inscricoes_eventos")
            .select("id", { count: "exact", head: true })
            .eq("evento_id", eventoId)
            .is("cancelado_em", null);
          total = count || 0;
        } else {
          const { count } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("status", "membro");
          total = count || 0;
        }

        const { count: presentes } = await supabase
          .from("checkins")
          .select("id", { count: "exact", head: true })
          .eq("evento_id", eventoId);

        const presentes_count = presentes || 0;
        const pendentes = Math.max(0, total - presentes_count);

        return {
          total,
          presentes: presentes_count,
          pendentes,
          percentual: total > 0 ? Math.round((presentes_count / total) * 100) : 0,
        };
      } catch (error) {
        console.error("Erro na query de stats:", error);
        throw error;
      }
    },
    refetchInterval: 10000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["checkin-stats", eventoId] });
    queryClient.invalidateQueries({ queryKey: ["checkin-participants", eventoId] });
  };

  const toggleFiltro = (f: CheckinFiltro) => {
    setFiltro((prev) => (prev === f ? "todos" : f));
  };

  const statCards: { key: CheckinFiltro; label: string; icon: typeof Users; value: number | undefined; colorClass: string }[] = [
    { key: "todos", label: "Total", icon: Users, value: stats?.total, colorClass: "" },
    { key: "presentes", label: "Presentes", icon: UserCheck, value: stats?.presentes, colorClass: "text-green-600" },
    { key: "pendentes", label: "Aguardando", icon: Clock, value: stats?.pendentes, colorClass: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas (filtros clicáveis) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((c) => (
          <Card
            key={c.key}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filtro === c.key && "ring-2 ring-primary"
            )}
            onClick={() => toggleFiltro(c.key)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <c.icon className="h-4 w-4" />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("text-3xl font-bold", c.colorClass)}>
                {statsLoading ? "-" : c.value ?? 0}
              </div>
            </CardContent>
          </Card>
        ))}
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

      {/* Lista Completa de Participantes (com busca integrada) */}
      <CheckinParticipantsList
        eventoId={eventoId}
        filtro={filtro}
        onCheckinSuccess={handleRefresh}
      />

      {/* Modal do Scanner */}
      <CheckinScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={handleRefresh}
        eventoId={eventoId}
      />
    </div>
  );
}
