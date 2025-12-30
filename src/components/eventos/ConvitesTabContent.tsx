import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import EnviarConvitesDialog from "./EnviarConvitesDialog";

interface Convite {
  id: string;
  pessoa_id: string;
  status: "pendente" | "confirmado" | "recusado";
  enviado_em: string | null;
  profiles: {
    nome: string;
  } | null;
}

interface ConvitesTabContentProps {
  eventoId: string;
}

export default function ConvitesTabContent({
  eventoId,
}: ConvitesTabContentProps) {
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviarDialogOpen, setEnviarDialogOpen] = useState(false);
  const [reenviando, setReenviando] = useState<string | null>(null);

  useEffect(() => {
    loadConvites();
  }, [eventoId]);

  const loadConvites = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos_convites")
        .select(
          `
          id,
          pessoa_id,
          status,
          enviado_em,
          profiles:pessoa_id (
            nome
          )
        `
        )
        .eq("evento_id", eventoId)
        .order("enviado_em", { ascending: false });

      if (error) throw error;
      setConvites((data || []) as Convite[]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao carregar convites";
      console.error("Erro ao carregar convites:", error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReenviarConvite = async (convite: Convite) => {
    setReenviando(convite.id);
    try {
      // Chamar edge function para reenviar notificação
      const { error } = await supabase.functions.invoke("disparar-alerta", {
        body: {
          user_id: convite.pessoa_id,
          titulo: "Convite Reenviado",
          mensagem: `Seu convite para o evento foi reenviado. Por favor, confirme sua presença.`,
          tipo: "push",
          slug: "convite_evento",
        },
      });

      if (error) throw error;

      toast.success("Convite reenviado com sucesso!");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Erro ao reenviar convite";
      console.error("Erro ao reenviar convite:", error);
      toast.error(message);
    } finally {
      setReenviando(null);
    }
  };

  const totalConvidados = convites.length;
  const confirmados = convites.filter((c) => c.status === "confirmado").length;
  const recusados = convites.filter((c) => c.status === "recusado").length;
  const pendentes = convites.filter((c) => c.status === "pendente").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmado":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
            Confirmado
          </Badge>
        );
      case "recusado":
        return <Badge variant="destructive">Recusado</Badge>;
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
            Pendente
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-20 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-12"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Convidados</p>
              <p className="text-2xl font-bold">{totalConvidados}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmados</p>
              <p className="text-2xl font-bold text-green-600">{confirmados}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recusados</p>
              <p className="text-2xl font-bold text-red-600">{recusados}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{pendentes}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ação Principal */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Convites Enviados</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os convites e acompanhe as confirmações
          </p>
        </div>
        <Button
          onClick={() => setEnviarDialogOpen(true)}
          className="bg-gradient-primary"
        >
          <Send className="w-4 h-4 mr-2" />
          Enviar Convites
        </Button>
      </div>

      {/* Lista de Convidados */}
      <Card>
        <CardContent className="p-0">
          {convites.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum convite enviado
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece enviando convites para este evento.
              </p>
              <Button onClick={() => setEnviarDialogOpen(true)}>
                <Send className="w-4 h-4 mr-2" />
                Enviar Primeiro Convite
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Envio</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convites.map((convite) => (
                  <TableRow key={convite.id}>
                    <TableCell className="font-medium">
                      {convite.profiles?.nome || "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(convite.status)}</TableCell>
                    <TableCell>
                      {convite.enviado_em
                        ? format(new Date(convite.enviado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {convite.status === "pendente" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReenviarConvite(convite)}
                          disabled={reenviando === convite.id}
                        >
                          {reenviando === convite.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Enviar Convites */}
      <EnviarConvitesDialog
        open={enviarDialogOpen}
        onOpenChange={setEnviarDialogOpen}
        eventoId={eventoId}
        onSuccess={loadConvites}
      />
    </div>
  );
}
