import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

interface CheckinRecentListProps {
  eventoId: string;
}

interface RecentCheckin {
  id: string;
  checkin_validado_em: string;
  pessoa: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
  } | null;
}

export function CheckinRecentList({ eventoId }: CheckinRecentListProps) {
  const { data: recentCheckins, isLoading } = useQuery({
    queryKey: ["checkins-recentes", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inscricoes_eventos")
        .select(`
          id,
          checkin_validado_em,
          pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (
            id,
            nome,
            telefone,
            email
          )
        `)
        .eq("evento_id", eventoId)
        .not("checkin_validado_em", "is", null)
        .order("checkin_validado_em", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as unknown as RecentCheckin[];
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Últimos Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!recentCheckins || recentCheckins.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Últimos Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum check-in realizado ainda</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Últimos Check-ins
          <Badge variant="secondary" className="ml-auto">
            {recentCheckins.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentCheckins.map((checkin) => {
            const pessoa = Array.isArray(checkin.pessoa)
              ? checkin.pessoa[0]
              : checkin.pessoa;

            return (
              <div
                key={checkin.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {pessoa?.nome || "Nome não disponível"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(checkin.checkin_validado_em), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
