import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Send,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ConvitePendente {
  id: string;
  status: "pendente" | "confirmado" | "recusado";
  data_envio: string;
  evento: {
    id: string;
    titulo: string;
    data_evento: string;
    local: string | null;
    tipo: string;
  };
}

export default function ConvitesPendentesWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: convites = [], isLoading } = useQuery({
    queryKey: ["convites-pendentes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("eventos_convites")
        .select(`
          id,
          status,
          data_envio,
          evento:eventos!eventos_convites_evento_id_fkey (
            id,
            titulo,
            data_evento,
            local,
            tipo
          )
        `)
        .eq("pessoa_id", user?.id)
        .eq("status", "pendente")
        .order("data_envio", { ascending: false });

      if (error) throw error;
      return data as ConvitePendente[];
    },
    enabled: !!user?.id,
  });

  const updateConviteMutation = useMutation({
    mutationFn: async ({ conviteId, status }: { conviteId: string; status: "confirmado" | "recusado" }) => {
      const { error } = await supabase
        .from("eventos_convites")
        .update({ status })
        .eq("id", conviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convites-pendentes"] });
      toast.success("Convite atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar convite:", error);
      toast.error("Erro ao atualizar convite");
    },
  });

  const handleAceitar = (conviteId: string) => {
    updateConviteMutation.mutate({ conviteId, status: "confirmado" });
  };

  const handleRecusar = (conviteId: string) => {
    updateConviteMutation.mutate({ conviteId, status: "recusado" });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Convites Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (convites.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Convites Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum convite pendente</p>
            <p className="text-sm text-muted-foreground mt-1">
              Você não tem convites aguardando resposta
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Convites Pendentes
          <Badge variant="secondary">{convites.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {convites.map((convite) => {
            const dataEvento = new Date(convite.evento.data_evento);
            const dataEnvio = new Date(convite.data_envio);

            return (
              <Card key={convite.id} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg truncate">
                        {convite.evento.titulo}
                      </h4>

                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(dataEvento, "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(dataEvento, "HH:mm")}
                        </div>
                        {convite.evento.local && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">{convite.evento.local}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {convite.evento.tipo}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Enviado em {format(dataEnvio, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={() => handleAceitar(convite.id)}
                      disabled={updateConviteMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {updateConviteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Aceitar
                    </Button>
                    <Button
                      onClick={() => handleRecusar(convite.id)}
                      disabled={updateConviteMutation.isPending}
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                      {updateConviteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Recusar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}