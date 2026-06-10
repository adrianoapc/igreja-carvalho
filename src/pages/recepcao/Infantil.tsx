import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Camera,
  Baby,
  AlertTriangle,
  LogIn,
} from "lucide-react";
import { KidsManualCheckin } from "@/components/kids/KidsManualCheckin";

interface CriancaAtiva {
  id: string;
  checkin_at: string;
  crianca: {
    id: string;
    nome: string;
    avatar_url: string | null;
    alergias: string | null;
  } | null;
}

export default function RecepcaoInfantil() {
  const navigate = useNavigate();
  const { igrejaId, filialId, isAllFiliais } = useAuthContext();

  // Culto do dia (para exibir no header e filtrar ativos)
  const { data: cultoHoje, isLoading: cultoLoading } = useQuery({
    queryKey: ["kids-recepcao-culto-hoje", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return null;
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date();
      fim.setHours(23, 59, 59, 999);

      let query = supabase
        .from("eventos")
        .select("id, titulo")
        .eq("igreja_id", igrejaId)
        .gte("data_evento", inicio.toISOString())
        .lte("data_evento", fim.toISOString())
        .in("status", ["planejado", "confirmado"]);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query
        .order("data_evento", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId,
  });

  // Crianças atualmente na sala (sem checkout)
  const { data: criancasAtivas, isLoading: criancasLoading } = useQuery({
    queryKey: ["kids-recepcao-ativas", cultoHoje?.id],
    queryFn: async () => {
      if (!cultoHoje?.id) return [];
      const { data, error } = await supabase
        .from("kids_checkins")
        .select(
          `id, checkin_at,
           crianca:profiles!kids_checkins_crianca_id_fkey(id, nome, avatar_url, alergias)`,
        )
        .eq("evento_id", cultoHoje.id)
        .is("checkout_at", null)
        .order("checkin_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CriancaAtiva[];
    },
    enabled: !!cultoHoje?.id,
    refetchInterval: 10000,
  });

  const totalAtivas = criancasAtivas?.length ?? 0;
  const comAlergia = criancasAtivas?.filter((c) => {
    const crianca = Array.isArray(c.crianca) ? c.crianca[0] : c.crianca;
    return crianca?.alergias;
  }).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/recepcao")}
          className="mb-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Recepção
        </Button>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold leading-tight">
                Recepção Infantil
              </h1>
              {!cultoLoading && cultoHoje && (
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {cultoHoje.titulo}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => navigate("/kids/scanner")}
          >
            <Camera className="w-4 h-4" />
            Escanear QR
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-sm mx-auto space-y-4">
        {/* Aviso: sem culto hoje */}
        {!cultoLoading && !cultoHoje && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex gap-3 items-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Nenhum culto encontrado para hoje. O check-in ficará bloqueado.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats: crianças na sala */}
        {cultoHoje && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                  <Baby className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">
                    {criancasLoading ? "—" : totalAtivas}
                  </p>
                  <p className="text-xs text-green-600">Na sala agora</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={
                comAlergia > 0
                  ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                  : "border-muted"
              }
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    comAlergia > 0 ? "bg-red-500" : "bg-muted"
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 ${comAlergia > 0 ? "text-white" : "text-muted-foreground"}`}
                  />
                </div>
                <div>
                  <p
                    className={`text-2xl font-bold ${comAlergia > 0 ? "text-red-700" : "text-muted-foreground"}`}
                  >
                    {criancasLoading ? "—" : comAlergia}
                  </p>
                  <p
                    className={`text-xs ${comAlergia > 0 ? "text-red-600" : "text-muted-foreground"}`}
                  >
                    Com alergias
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Check-in manual */}
        <KidsManualCheckin />

        {/* Crianças na sala agora */}
        {cultoHoje && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-green-600" />
                  Crianças na sala
                </p>
                {totalAtivas > 0 && (
                  <Badge variant="secondary">{totalAtivas}</Badge>
                )}
              </div>

              {criancasLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : criancasAtivas && criancasAtivas.length > 0 ? (
                <div className="space-y-2">
                  {criancasAtivas.map((item) => {
                    const crianca = Array.isArray(item.crianca)
                      ? item.crianca[0]
                      : item.crianca;
                    if (!crianca) return null;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/40"
                      >
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarImage src={crianca.avatar_url || undefined} />
                          <AvatarFallback className="bg-orange-100 text-orange-700 text-xs font-semibold">
                            {crianca.nome
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {crianca.nome}
                          </p>
                          {crianca.alergias && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {crianca.alergias}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma criança registrada ainda
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
