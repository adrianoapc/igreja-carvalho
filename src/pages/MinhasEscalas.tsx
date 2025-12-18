import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, CheckCircle, XCircle, Music, Users, Baby, Megaphone } from "lucide-react";
import { RecusarEscalaDialog } from "@/components/voluntario/RecusarEscalaDialog";
import { EscalaDetailsSheet } from "@/components/voluntario/EscalaDetailsSheet";

interface Escala {
  id: string;
  confirmado: boolean;
  status_confirmacao: string | null;
  motivo_recusa: string | null;
  observacoes: string | null;
  culto: {
    id: string;
    titulo: string;
    data_culto: string;
    tipo: string;
    tema: string | null;
    local: string | null;
  };
  time: {
    id: string;
    nome: string;
    cor: string;
    categoria: string | null;
  };
  posicao: {
    id: string;
    nome: string;
  } | null;
}

export default function MinhasEscalas() {
  const { profile } = useAuth();
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEscala, setSelectedEscala] = useState<Escala | null>(null);
  const [recusarEscala, setRecusarEscala] = useState<Escala | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadEscalas();
    }
  }, [profile?.id]);

  const loadEscalas = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("escalas_culto")
        .select(`
          id,
          confirmado,
          status_confirmacao,
          motivo_recusa,
          observacoes,
          culto:cultos!escalas_culto_culto_id_fkey (
            id,
            titulo,
            data_culto,
            tipo,
            tema,
            local
          ),
          time:times_culto!escalas_culto_time_id_fkey (
            id,
            nome,
            cor,
            categoria
          ),
          posicao:posicoes_time!escalas_culto_posicao_id_fkey (
            id,
            nome
          )
        `)
        .eq("pessoa_id", profile.id)
        .gte("culto.data_culto", new Date().toISOString())
        .order("culto(data_culto)", { ascending: true });

      if (error) throw error;
      
      // Filter out escalas with null culto (past dates filtered by gte)
      const validEscalas = (data || []).filter(e => e.culto !== null) as Escala[];
      setEscalas(validEscalas);
    } catch (error) {
      console.error("Erro ao carregar escalas:", error);
      toast.error("Erro ao carregar suas escalas");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async (escala: Escala) => {
    try {
      const { error } = await supabase
        .from("escalas_culto")
        .update({
          confirmado: true,
          status_confirmacao: "aceito",
          motivo_recusa: null
        })
        .eq("id", escala.id);

      if (error) throw error;
      
      toast.success("Escala confirmada!");
      loadEscalas();
    } catch (error) {
      console.error("Erro ao confirmar escala:", error);
      toast.error("Erro ao confirmar escala");
    }
  };

  const handleRecusar = async (escalaId: string, motivo: string) => {
    try {
      const { error } = await supabase
        .from("escalas_culto")
        .update({
          confirmado: false,
          status_confirmacao: "recusado",
          motivo_recusa: motivo
        })
        .eq("id", escalaId);

      if (error) throw error;
      
      toast.success("Escala recusada");
      setRecusarEscala(null);
      loadEscalas();
    } catch (error) {
      console.error("Erro ao recusar escala:", error);
      toast.error("Erro ao recusar escala");
    }
  };

  const getTeamIcon = (categoria: string | null | undefined) => {
    const nome = categoria?.toLowerCase() || "";
    if (nome.includes("louvor") || nome.includes("música")) return <Music className="h-5 w-5" />;
    if (nome.includes("kids") || nome.includes("infantil")) return <Baby className="h-5 w-5" />;
    if (nome.includes("mídia") || nome.includes("comunicação")) return <Megaphone className="h-5 w-5" />;
    return <Users className="h-5 w-5" />;
  };

  const getStatusBadge = (escala: Escala) => {
    const status = escala.status_confirmacao || "pendente";
    switch (status) {
      case "aceito":
      case "confirmado":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Confirmado</Badge>;
      case "recusado":
        return <Badge variant="destructive">Recusado</Badge>;
      default:
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
    }
  };

  const pendentes = escalas.filter(e => !e.status_confirmacao || e.status_confirmacao === "pendente");
  const confirmadas = escalas.filter(e => e.status_confirmacao === "aceito" || e.status_confirmacao === "confirmado");
  const recusadas = escalas.filter(e => e.status_confirmacao === "recusado");

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minhas Escalas</h1>
          <p className="text-muted-foreground">Gerencie suas próximas escalas e compromissos</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : escalas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma escala encontrada</h3>
              <p className="text-muted-foreground">Você não possui escalas futuras no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Pendentes de Confirmação */}
            {pendentes.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Aguardando sua confirmação ({pendentes.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pendentes.map(escala => (
                    <Card key={escala.id} className="border-yellow-500/30 bg-yellow-500/5">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getTeamIcon(escala.time.categoria)}
                            <CardTitle className="text-base">{escala.time.nome}</CardTitle>
                          </div>
                          {getStatusBadge(escala)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="font-medium">{escala.culto.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(escala.culto.data_culto), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(escala.culto.data_culto), "HH:mm")}
                            {escala.culto.local && ` • ${escala.culto.local}`}
                          </p>
                        </div>
                        {escala.posicao && (
                          <Badge variant="outline">{escala.posicao.nome}</Badge>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleConfirmar(escala)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Confirmar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1"
                            onClick={() => setRecusarEscala(escala)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Recusar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmadas */}
            {confirmadas.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Escalas Confirmadas ({confirmadas.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {confirmadas.map(escala => (
                    <Card 
                      key={escala.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => {
                        setSelectedEscala(escala);
                        setDetailsOpen(true);
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getTeamIcon(escala.time.categoria)}
                            <CardTitle className="text-base">{escala.time.nome}</CardTitle>
                          </div>
                          {getStatusBadge(escala)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="font-medium">{escala.culto.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(escala.culto.data_culto), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(escala.culto.data_culto), "HH:mm")}
                            {escala.culto.local && ` • ${escala.culto.local}`}
                          </p>
                        </div>
                        {escala.posicao && (
                          <Badge variant="outline">{escala.posicao.nome}</Badge>
                        )}
                        <p className="text-xs text-muted-foreground pt-2">
                          Clique para ver detalhes e briefing
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Recusadas */}
            {recusadas.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-5 w-5" />
                  Escalas Recusadas ({recusadas.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {recusadas.map(escala => (
                    <Card key={escala.id} className="opacity-60">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getTeamIcon(escala.time.categoria)}
                            <CardTitle className="text-base">{escala.time.nome}</CardTitle>
                          </div>
                          {getStatusBadge(escala)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <p className="font-medium">{escala.culto.titulo}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(escala.culto.data_culto), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                          </p>
                        </div>
                        {escala.motivo_recusa && (
                          <p className="text-sm text-muted-foreground italic">
                            Motivo: {escala.motivo_recusa}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      <RecusarEscalaDialog
        open={!!recusarEscala}
        onOpenChange={(open) => !open && setRecusarEscala(null)}
        onConfirm={(motivo) => recusarEscala && handleRecusar(recusarEscala.id, motivo)}
        escala={recusarEscala}
      />

      <EscalaDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        escala={selectedEscala}
      />
    </div>
  );
}
