import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConvitePendente {
  id: string;
  status: "pendente" | "confirmado" | "recusado";
  enviado_em: string | null;
  evento: {
    id: string;
    titulo: string;
    data_evento: string;
    local: string | null;
    tipo: string;
  };
}

interface ConviteComEvento {
  id: string;
  status: string;
  enviado_em: string | null;
  evento: {
    id: string;
    titulo: string;
    data_evento: string;
    local: string | null;
    tipo: string;
  } | null;
}

export default function ConvitesPendentesWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [selectedConvite, setSelectedConvite] = useState<string | null>(null);

  const { data: convites = [], isLoading } = useQuery({
    queryKey: ["convites-pendentes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("eventos_convites")
        .select(
          `
          id,
          status,
          enviado_em,
          evento:eventos!eventos_convites_evento_id_fkey (
            id,
            titulo,
            data_evento,
            local,
            tipo
          )
        `
        )
        .eq("pessoa_id", user?.id)
        .eq("status", "pendente")
        .order("enviado_em", { ascending: false });

      if (error) throw error;

      // Filtrar eventos futuros no cliente (PostgREST não suporta filtros em campos relacionados)
      const convitesFiltrados = (data || []).filter(
        (convite: ConviteComEvento) => {
          return (
            convite.evento &&
            new Date(convite.evento.data_evento) > new Date(now)
          );
        }
      );

      // Ordenar por data do evento
      convitesFiltrados.sort((a: ConviteComEvento, b: ConviteComEvento) => {
        return (
          new Date(a.evento!.data_evento).getTime() -
          new Date(b.evento!.data_evento).getTime()
        );
      });

      return convitesFiltrados as ConvitePendente[];
    },
    enabled: !!user?.id,
  });

  const updateConviteMutation = useMutation({
    mutationFn: async ({
      conviteId,
      status,
      motivo,
    }: {
      conviteId: string;
      status: "confirmado" | "recusado";
      motivo?: string;
    }) => {
      const payload: {
        status: "confirmado" | "recusado";
        motivo_recusa?: string;
      } = { status };
      if (motivo) {
        payload.motivo_recusa = motivo;
      }

      const { error } = await supabase
        .from("eventos_convites")
        .update(payload)
        .eq("id", conviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["convites-pendentes"] });
      toast.success("Convite atualizado com sucesso!");
      setDialogOpen(false);
      setMotivoRecusa("");
      setSelectedConvite(null);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Erro ao atualizar convite";
      console.error("Erro ao atualizar convite:", error);
      toast.error(message);
    },
  });

  const handleAceitar = (conviteId: string) => {
    updateConviteMutation.mutate({ conviteId, status: "confirmado" });
  };

  const handleRecusarClick = (conviteId: string) => {
    setSelectedConvite(conviteId);
    setDialogOpen(true);
  };

  const handleConfirmarRecusa = () => {
    if (selectedConvite) {
      updateConviteMutation.mutate({
        conviteId: selectedConvite,
        status: "recusado",
        motivo: motivoRecusa.trim(),
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/10 shadow-md">
        <CardContent className="p-4">
          <div className="animate-pulse h-20 bg-muted rounded-lg"></div>
        </CardContent>
      </Card>
    );
  }

  const primeiroConvite = convites[0];

  if (!primeiroConvite) {
    return null;
  }

  const dataEvento = new Date(primeiroConvite.evento.data_evento);

  return (
    <>
      <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 shadow-lg mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-amber-900 dark:text-amber-100">
            <Send className="w-5 h-5 text-amber-600" />
            Você foi convidado para{" "}
            <span className="font-bold text-amber-700 dark:text-amber-200">
              {primeiroConvite.evento.titulo}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informações do evento */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(dataEvento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(dataEvento, "HH:mm")}
            </div>
            {primeiroConvite.evento.local && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{primeiroConvite.evento.local}</span>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleAceitar(primeiroConvite.id)}
              disabled={updateConviteMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold h-10"
            >
              {updateConviteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmar Presença
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => handleRecusarClick(primeiroConvite.id)}
                  disabled={updateConviteMutation.isPending}
                  variant="ghost"
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold h-10"
                >
                  {updateConviteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Não poderei ir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Recusar convite</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="motivo">Motivo (opcional)</Label>
                    <Textarea
                      id="motivo"
                      placeholder="Conte-nos por que não poderá comparecer..."
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleConfirmarRecusa}
                      disabled={updateConviteMutation.isPending}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {updateConviteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-2" />
                      )}
                      Confirmar Recusa
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
