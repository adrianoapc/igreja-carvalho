import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, MapPin, User, List, CalendarDays, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CalendarioMensal from "@/components/cultos/CalendarioMensal";
import EventoDialog from "@/components/cultos/EventoDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Evento {
  id: string;
  tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
  titulo: string;
  descricao: string | null;
  data_evento: string;
  duracao_minutos: number | null;
  local: string | null;
  endereco: string | null;
  pregador: string | null;
  tema: string | null;
  status: string;
}

const STATUS_CONFIG = {
  planejado: { label: "Planejado", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" },
  confirmado: { label: "Confirmado", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  realizado: { label: "Realizado", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" }
};

export default function Eventos() {
  const navigate = useNavigate();
  const [cultos, setCultos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalasCount, setEscalasCount] = useState<Record<string, number>>({});
  const [eventoDialogOpen, setEventoDialogOpen] = useState(false);

  useEffect(() => {
    loadCultos();
  }, []);

  const loadCultos = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos")
        .select("*")
        .order("data_evento", { ascending: true });

      if (error) throw error;

      const normalized = (data || []).map((d) => ({
        ...d,
        tipo: d.tipo as Evento["tipo"],
      }));

      setCultos(normalized);

      // Carregar contagem de escalas para cada culto
      if (normalized.length > 0) {
        const { data: escalasData } = await supabase
          .from("escalas")
          .select("evento_id");
        
        if (escalasData) {
          const counts: Record<string, number> = {};
          escalasData.forEach((escala) => {
            counts[escala.evento_id] = (counts[escala.evento_id] || 0) + 1;
          });
          setEscalasCount(counts);
        }
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar eventos", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNovoCulto = () => {
    setEventoDialogOpen(true);
  };

  const handleAbrirCulto = (culto: Evento) => {
    navigate(`/eventos/${culto.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Eventos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Eventos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie cultos e eventos programados
          </p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft w-full sm:w-auto"
          onClick={handleNovoCulto}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Evento</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      {/* Tabs para alternar entre Lista e Calendário */}
      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="lista" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Lista</span>
          </TabsTrigger>
          <TabsTrigger value="calendario" className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Calendário</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-4">
          {/* Lista de Cultos/Eventos */}
          <div className="grid gap-4 md:gap-6">
            {cultos.map((culto) => {
              const dataCulto = new Date(culto.data_evento);
              const statusConfig = STATUS_CONFIG[culto.status as keyof typeof STATUS_CONFIG];
              
              return (
                <Card 
                  key={culto.id} 
                  className="shadow-soft hover:shadow-medium transition-shadow cursor-pointer"
                  onClick={() => handleAbrirCulto(culto)}
                >
                  <CardHeader className="p-4 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg md:text-xl">{culto.titulo}</CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {culto.tipo}
                              </Badge>
                            </div>
                            {culto.tema && (
                              <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">
                                {culto.tema}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs md:text-sm">
                          {format(dataCulto, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs md:text-sm">
                          {format(dataCulto, "HH:mm")}
                          {culto.duracao_minutos && ` (${culto.duracao_minutos} min)`}
                        </span>
                      </div>
                      {culto.local && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs md:text-sm truncate">{culto.local}</span>
                        </div>
                      )}
                      {culto.pregador && (
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs md:text-sm truncate">{culto.pregador}</span>
                        </div>
                      )}
                    </div>

                    {culto.descricao && (
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                        {culto.descricao}
                      </p>
                    )}

                    <div className="flex items-center justify-end pt-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs md:text-sm text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbrirCulto(culto);
                        }}
                      >
                        <ExternalLink className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                        Abrir Mesa de Controle
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {cultos.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum evento cadastrado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Comece criando seu primeiro culto ou evento.
                  </p>
                  <Button onClick={handleNovoCulto}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Evento
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <CalendarioMensal 
            cultos={cultos}
            escalasCount={escalasCount}
            onCultoClick={handleAbrirCulto}
          />
        </TabsContent>
      </Tabs>

      <EventoDialog
        open={eventoDialogOpen}
        onOpenChange={setEventoDialogOpen}
        evento={null}
        onSuccess={loadCultos}
      />
    </div>
  );
}
