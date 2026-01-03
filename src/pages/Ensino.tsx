import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Plus, 
  Calendar, 
  MapPin, 
  Video, 
  Church, 
  Users, 
  Baby,
  Settings,
  Copy,
  Clock,
  User,
  BookOpen,
  UserPlus,
  Route
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import NovaAulaDrawer from "@/components/ensino/NovaAulaDrawer";
import SalaDialog from "@/components/ensino/SalaDialog";
import AulaDetailsSheet from "@/components/ensino/AulaDetailsSheet";
import RegistrarVisitanteFamiliaDialog from "@/components/ensino/RegistrarVisitanteFamiliaDialog";
import { CheckinManualDialog } from "@/components/ensino/CheckinManualDialog";
import JornadasContent from "@/pages/Jornadas";

interface Aula {
  id: string;
  tema: string | null;
  data_inicio: string;
  duracao_minutos: number;
  modalidade: string;
  link_reuniao: string | null;
  status: string;
  sala_id: string | null;
  jornada_id: string | null;
  evento_id: string | null;
  professor_id: string | null;
  sala?: { id: string; nome: string } | null;
  jornada?: { id: string; titulo: string } | null;
  culto?: { id: string; titulo: string } | null;
  professor?: { id: string; nome: string; avatar_url: string | null } | null;
}

interface Sala {
  id: string;
  nome: string;
  capacidade: number;
  idade_min: number | null;
  idade_max: number | null;
  tipo: string;
  ativo: boolean;
  criancas_presentes?: number;
}

export default function Ensino() {
  const [activeTab, setActiveTab] = useState("agenda");
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [novaAulaOpen, setNovaAulaOpen] = useState(false);
  const [salaDialogOpen, setSalaDialogOpen] = useState(false);
  const [selectedSala, setSelectedSala] = useState<Sala | null>(null);
  const [selectedAula, setSelectedAula] = useState<Aula | null>(null);
  const [aulaDetailsOpen, setAulaDetailsOpen] = useState(false);
  const [visitanteFamiliaOpen, setVisitanteFamiliaOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [salaSelecionadaParaCheckin, setSalaSelecionadaParaCheckin] = useState<Sala | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchAulas(), fetchSalas()]);
    setLoading(false);
  };

  const fetchAulas = async () => {
    const { data, error } = await supabase
      .from("aulas")
      .select(`
        *,
        sala:salas(id, nome),
        jornada:jornadas(id, titulo),
        evento:eventos(id, titulo),
        professor:profiles!aulas_professor_id_fkey(id, nome, avatar_url)
      `)
      .gte("data_inicio", new Date().toISOString())
      .order("data_inicio", { ascending: true });

    if (error) {
      console.error("Erro ao carregar aulas:", error);
      return;
    }

    // Map evento to culto for backward compatibility
    const mappedData = (data || []).map((aula: Record<string, unknown>) => ({
      ...aula,
      culto: aula.evento
    }));
    setAulas(mappedData as Aula[]);
  };

  const fetchSalas = async () => {
    const { data: salasData, error: salasError } = await supabase
      .from("salas")
      .select("*")
      .eq("ativo", true)
      .order("nome");

    if (salasError) {
      console.error("Erro ao carregar salas:", salasError);
      return;
    }

    // Buscar crianças presentes em cada sala Kids
    const salasWithPresence = await Promise.all(
      (salasData || []).map(async (sala) => {
        if (sala.tipo === "kids") {
          const { count } = await supabase
            .from("presencas_aula")
            .select("*", { count: "exact", head: true })
            .is("checkout_at", null)
            .in("aula_id", 
              (await supabase.from("aulas").select("id").eq("sala_id", sala.id)).data?.map(a => a.id) || []
            );
          
          return { ...sala, criancas_presentes: count || 0 };
        }
        return { ...sala, criancas_presentes: 0 };
      })
    );

    setSalas(salasWithPresence);
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleAulaClick = (aula: Aula) => {
    setSelectedAula(aula);
    setAulaDetailsOpen(true);
  };

  const handleEditSala = (sala: Sala) => {
    setSelectedSala(sala);
    setSalaDialogOpen(true);
  };

  const handleNewSala = () => {
    setSelectedSala(null);
    setSalaDialogOpen(true);
  };

  const salaKids = salas.filter(s => s.tipo === "kids");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        {activeTab !== "jornadas" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <BookOpen className="w-7 h-7 text-primary" />
                Ensino & Discipulado
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie aulas, salas e acompanhe o progresso dos alunos
              </p>
            </div>
            <Button onClick={() => setNovaAulaOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Aula
            </Button>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agenda" className="gap-2">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Visão Geral</span>
              <span className="sm:hidden">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="kids" className="gap-2">
              <Baby className="w-4 h-4" />
              <span className="hidden sm:inline">Ministério Infantil</span>
              <span className="sm:hidden">Kids</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="jornadas" className="gap-2">
              <Route className="w-4 h-4" />
              <span>Jornadas</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab A: Visão Geral */}
          <TabsContent value="agenda" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Próximas Aulas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : aulas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma aula agendada. Clique em "Nova Aula" para começar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aulas.map((aula) => (
                      <div
                        key={aula.id}
                        onClick={() => handleAulaClick(aula)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            {aula.modalidade === "online" ? (
                              <Video className="w-5 h-5 text-primary" />
                            ) : (
                              <MapPin className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate">
                              {aula.tema || "Aula sem tema"}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(aula.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {aula.jornada && (
                                <Badge variant="outline" className="text-xs">
                                  {aula.jornada.titulo}
                                </Badge>
                              )}
                            </div>
                            {aula.professor && (
                              <div className="flex items-center gap-2 mt-2">
                                <Avatar className="w-5 h-5">
                                  <AvatarImage src={aula.professor.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {aula.professor.nome?.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">
                                  {aula.professor.nome}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {aula.modalidade === "presencial" && aula.sala && (
                            <Badge variant="secondary" className="gap-1">
                              <MapPin className="w-3 h-3" />
                              {aula.sala.nome}
                            </Badge>
                          )}
                          {aula.modalidade === "online" && aula.link_reuniao && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyLink(aula.link_reuniao!);
                              }}
                            >
                              <Copy className="w-3 h-3" />
                              Copiar Link
                            </Button>
                          )}
                          {aula.evento_id && (
                            <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
                              <Church className="w-3 h-3" />
                              Vinculado ao Culto
                            </Badge>
                          )}
                          <Badge 
                            variant={aula.status === "em_andamento" ? "default" : "outline"}
                            className="capitalize"
                          >
                            {aula.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab B: Ministério Infantil */}
          <TabsContent value="kids" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Baby className="w-5 h-5" />
                  Salas Kids
                </CardTitle>
                <Button 
                  onClick={() => setVisitanteFamiliaOpen(true)} 
                  variant="outline"
                  className="gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Novo Visitante (Família)
                </Button>
              </CardHeader>
              <CardContent>
                {salaKids.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma sala Kids cadastrada. Vá em Configurações para adicionar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {salaKids.map((sala) => (
                      <Card 
                        key={sala.id} 
                        className="hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => handleEditSala(sala)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-foreground">{sala.nome}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Capacidade: {sala.capacidade} crianças
                              </p>
                              {(sala.idade_min !== null || sala.idade_max !== null) && (
                                <p className="text-xs text-muted-foreground">
                                  Idade: {sala.idade_min || 0} - {sala.idade_max || "∞"} anos
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-1 text-lg font-bold text-primary">
                                <Users className="w-4 h-4" />
                                {sala.criancas_presentes}
                              </div>
                              <span className="text-xs text-muted-foreground">presentes</span>
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-4 gap-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSalaSelecionadaParaCheckin(sala);
                              setCheckinOpen(true);
                            }}
                          >
                            <User className="w-4 h-4" />
                            Check-in Manual
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab C: Configurações */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Gerenciar Salas
                </CardTitle>
                <Button onClick={handleNewSala} size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Sala
                </Button>
              </CardHeader>
              <CardContent>
                {salas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma sala cadastrada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {salas.map((sala) => (
                      <div
                        key={sala.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => handleEditSala(sala)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            sala.tipo === "kids" 
                              ? "bg-pink-100 text-pink-600" 
                              : sala.tipo === "hibrido"
                              ? "bg-purple-100 text-purple-600"
                              : "bg-blue-100 text-blue-600"
                          }`}>
                            {sala.tipo === "kids" ? (
                              <Baby className="w-4 h-4" />
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{sala.nome}</h4>
                            <p className="text-sm text-muted-foreground">
                              {sala.capacidade} lugares • {sala.tipo}
                            </p>
                          </div>
                        </div>
                        <Badge variant={sala.ativo ? "default" : "secondary"}>
                          {sala.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab D: Jornadas */}
          <TabsContent value="jornadas" className="space-y-4">
            <JornadasContent />
          </TabsContent>
        </Tabs>
      </div>

      {/* Drawers & Dialogs */}
      <NovaAulaDrawer 
        open={novaAulaOpen} 
        onOpenChange={setNovaAulaOpen}
        onSuccess={() => {
          fetchAulas();
          setNovaAulaOpen(false);
        }}
      />

      <SalaDialog
        open={salaDialogOpen}
        onOpenChange={setSalaDialogOpen}
        sala={selectedSala}
        onSuccess={() => {
          fetchSalas();
          setSalaDialogOpen(false);
        }}
      />

      <AulaDetailsSheet
        open={aulaDetailsOpen}
        onOpenChange={setAulaDetailsOpen}
        aula={selectedAula}
        onUpdate={fetchAulas}
      />

      <RegistrarVisitanteFamiliaDialog
        open={visitanteFamiliaOpen}
        onOpenChange={setVisitanteFamiliaOpen}
        onSuccess={(criancasIds) => {
          setVisitanteFamiliaOpen(false);
          // TODO: Open room selection for check-in
          toast.success("Família cadastrada! Selecione a sala para check-in.");
          fetchSalas();
        }}
      />

      <CheckinManualDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        sala={salaSelecionadaParaCheckin}
        onSuccess={() => {
          fetchSalas();
        }}
      />
    </div>
  );
}
