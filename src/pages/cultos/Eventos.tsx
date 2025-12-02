import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, MapPin, User, Users as UsersIcon, List, CalendarDays, Edit, Music2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import EscalasDialog from "@/components/cultos/EscalasDialog";
import CalendarioMensal from "@/components/cultos/CalendarioMensal";
import CultoDialog from "@/components/cultos/CultoDialog";
import LiturgiaDialog from "@/components/cultos/LiturgiaDialog";
import CancoesDialog from "@/components/cultos/CancoesDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Culto {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_culto: string;
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
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalasDialogOpen, setEscalasDialogOpen] = useState(false);
  const [cultoSelecionado, setCultoSelecionado] = useState<Culto | null>(null);
  const [escalasCount, setEscalasCount] = useState<Record<string, number>>({});
  const [cultoDialogOpen, setCultoDialogOpen] = useState(false);
  const [cultoEditando, setCultoEditando] = useState<Culto | null>(null);
  const [liturgiaDialogOpen, setLiturgiaDialogOpen] = useState(false);
  const [cancoesDialogOpen, setCancoesDialogOpen] = useState(false);

  useEffect(() => {
    loadCultos();
  }, []);

  const loadCultos = async () => {
    try {
      const { data, error } = await supabase
        .from("cultos")
        .select("*")
        .order("data_culto", { ascending: true });

      if (error) throw error;
      setCultos(data || []);

      // Carregar contagem de escalas para cada culto
      if (data && data.length > 0) {
        const { data: escalasData } = await supabase
          .from("escalas_culto")
          .select("culto_id");
        
        if (escalasData) {
          const counts: Record<string, number> = {};
          escalasData.forEach((escala) => {
            counts[escala.culto_id] = (counts[escala.culto_id] || 0) + 1;
          });
          setEscalasCount(counts);
        }
      }
    } catch (error: any) {
      toast.error("Erro ao carregar eventos", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGerenciarEscalas = (culto: Culto) => {
    setCultoSelecionado(culto);
    setEscalasDialogOpen(true);
  };

  const handleNovoCulto = () => {
    setCultoEditando(null);
    setCultoDialogOpen(true);
  };

  const handleEditarCulto = (culto: Culto) => {
    setCultoEditando(culto);
    setCultoDialogOpen(true);
  };

  const handleGerenciarLiturgia = (culto: Culto) => {
    setCultoSelecionado(culto);
    setLiturgiaDialogOpen(true);
  };

  const handleGerenciarCancoes = (culto: Culto) => {
    setCultoSelecionado(culto);
    setCancoesDialogOpen(true);
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
          const dataCulto = new Date(culto.data_culto);
          const statusConfig = STATUS_CONFIG[culto.status as keyof typeof STATUS_CONFIG];
          
          return (
            <Card key={culto.id} className="shadow-soft hover:shadow-medium transition-shadow">
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

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full sm:w-auto text-xs md:text-sm"
                    onClick={() => handleEditarCulto(culto)}
                  >
                    <Edit className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full sm:w-auto text-xs md:text-sm"
                    onClick={() => handleGerenciarEscalas(culto)}
                  >
                    <UsersIcon className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                    Ver Escalas
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full sm:w-auto text-xs md:text-sm"
                    onClick={() => handleGerenciarLiturgia(culto)}
                  >
                    Liturgia
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full sm:w-auto text-xs md:text-sm"
                    onClick={() => handleGerenciarCancoes(culto)}
                  >
                    <Music2 className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                    Canções
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
            onCultoClick={handleGerenciarEscalas}
          />
        </TabsContent>
      </Tabs>

      <EscalasDialog
        open={escalasDialogOpen}
        onOpenChange={setEscalasDialogOpen}
        culto={cultoSelecionado}
      />

      <CultoDialog
        open={cultoDialogOpen}
        onOpenChange={setCultoDialogOpen}
        culto={cultoEditando}
        onSuccess={loadCultos}
      />

      <LiturgiaDialog
        open={liturgiaDialogOpen}
        onOpenChange={setLiturgiaDialogOpen}
        culto={cultoSelecionado}
      />

      <CancoesDialog
        open={cancoesDialogOpen}
        onOpenChange={setCancoesDialogOpen}
        culto={cultoSelecionado}
      />
    </div>
  );
}
