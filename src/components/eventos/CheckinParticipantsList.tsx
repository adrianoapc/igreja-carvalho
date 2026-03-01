import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Users,
  Search,
  Loader2,
  Phone,
  LogIn,
  LogOut,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { extractEdgeFunctionPayload } from "./edgeFunctionPayload";

export type CheckinFiltro = "todos" | "presentes" | "pendentes";

interface CheckinParticipantsListProps {
  eventoId: string;
  filtro: CheckinFiltro;
  onCheckinSuccess?: () => void;
}

interface Participant {
  pessoa_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  checkin_at: string | null;
  qr_token: string | null;
  inscricao_id: string | null;
}

export function CheckinParticipantsList({
  eventoId,
  filtro,
  onCheckinSuccess,
}: CheckinParticipantsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: participants, isLoading } = useQuery({
    queryKey: ["checkin-participants", eventoId],
    queryFn: async () => {
      // Get event info
      const { data: evento } = await supabase
        .from("eventos")
        .select("requer_inscricao")
        .eq("id", eventoId)
        .single();

      // Get all checkins for this event
      const { data: checkins } = await supabase
        .from("checkins")
        .select("pessoa_id, created_at")
        .eq("evento_id", eventoId);

      const checkinMap = new Map<string, string>();
      (checkins || []).forEach((c) => checkinMap.set(c.pessoa_id, c.created_at!));

      if (evento?.requer_inscricao) {
        // Get subscribers
        const { data: inscricoes } = await supabase
          .from("inscricoes_eventos")
          .select(`
            id,
            pessoa_id,
            qr_token,
            pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (
              id, nome, telefone, email
            )
          `)
          .eq("evento_id", eventoId)
          .is("cancelado_em", null);

        return (inscricoes || []).map((i: any) => {
          const pessoa = Array.isArray(i.pessoa) ? i.pessoa[0] : i.pessoa;
          return {
            pessoa_id: i.pessoa_id,
            nome: pessoa?.nome || "Sem nome",
            telefone: pessoa?.telefone || null,
            email: pessoa?.email || null,
            checkin_at: checkinMap.get(i.pessoa_id) || null,
            qr_token: i.qr_token,
            inscricao_id: i.id,
          } as Participant;
        });
      } else {
        // Get all members
        const { data: membros } = await supabase
          .from("profiles")
          .select("id, nome, telefone, email")
          .eq("status", "membro");

        return (membros || []).map((m) => ({
          pessoa_id: m.id,
          nome: m.nome || "Sem nome",
          telefone: m.telefone || null,
          email: m.email || null,
          checkin_at: checkinMap.get(m.id) || null,
          qr_token: null,
          inscricao_id: null,
        })) as Participant[];
      }
    },
    refetchInterval: 10000,
  });

  const checkinMutation = useMutation({
    mutationFn: async (participant: Participant) => {
      if (participant.qr_token) {
        // Use edge function for inscription-based checkin
        const { data, error } = await supabase.functions.invoke("checkin-inscricao", {
          body: { qr_token: participant.qr_token, contexto_evento_id: eventoId },
        });
        const payload = extractEdgeFunctionPayload(data, error);
        if (payload) return payload;
        if (error) throw error;
        return data;
      } else {
        // Direct insert for non-inscription events
        const { error } = await supabase.from("checkins").insert({
          evento_id: eventoId,
          pessoa_id: participant.pessoa_id,
          metodo: "manual",
          tipo_registro: "checkin",
        });
        if (error) throw error;
        return { success: true };
      }
    },
    onSuccess: (data) => {
      if (data?.success === false) {
        toast.error(data.message || "Erro ao realizar check-in");
        return;
      }
      toast.success("Check-in realizado!");
      queryClient.invalidateQueries({ queryKey: ["checkin-participants", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["checkin-stats", eventoId] });
      onCheckinSuccess?.();
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const cancelMutation = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase
        .from("checkins")
        .delete()
        .eq("evento_id", eventoId)
        .eq("pessoa_id", pessoaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Check-in cancelado!");
      queryClient.invalidateQueries({ queryKey: ["checkin-participants", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["checkin-stats", eventoId] });
      onCheckinSuccess?.();
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const filtered = (participants || [])
    .filter((p) => {
      if (filtro === "presentes") return !!p.checkin_at;
      if (filtro === "pendentes") return !p.checkin_at;
      return true;
    })
    .filter((p) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.nome.toLowerCase().includes(term) ||
        p.telefone?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      // Present first (most recent), then pending alphabetically
      if (a.checkin_at && !b.checkin_at) return -1;
      if (!a.checkin_at && b.checkin_at) return 1;
      if (a.checkin_at && b.checkin_at) {
        return new Date(b.checkin_at).getTime() - new Date(a.checkin_at).getTime();
      }
      return a.nome.localeCompare(b.nome);
    });

  const isPending = checkinMutation.isPending || cancelMutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Participantes
          <Badge variant="secondary" className="ml-auto">
            {filtered.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchTerm
                ? "Nenhum resultado encontrado"
                : filtro === "presentes"
                ? "Nenhum check-in realizado"
                : filtro === "pendentes"
                ? "Todos já fizeram check-in"
                : "Nenhum participante encontrado"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filtered.map((p) => {
              const isPresent = !!p.checkin_at;

              return (
                <div
                  key={p.pessoa_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50"
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      isPresent
                        ? "bg-green-500/10"
                        : "bg-muted"
                    }`}
                  >
                    {isPresent ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{p.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {p.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {p.telefone}
                        </span>
                      )}
                      {p.email && (
                        <span className="truncate">{p.email}</span>
                      )}
                      {isPresent && p.checkin_at && (
                        <span>
                          {formatDistanceToNow(new Date(p.checkin_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  {isPresent ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-orange-600 hover:text-orange-700 shrink-0"
                      disabled={isPending}
                      onClick={() => cancelMutation.mutate(p.pessoa_id)}
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <LogOut className="h-4 w-4 mr-1" />
                          Cancelar
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="shrink-0"
                      disabled={isPending}
                      onClick={() => checkinMutation.mutate(p)}
                    >
                      {checkinMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <LogIn className="h-4 w-4 mr-1" />
                          Check-in
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
