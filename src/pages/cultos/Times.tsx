import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Settings, Edit, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TimeDialog from "@/components/cultos/TimeDialog";
import GerenciarTimeDialog from "@/components/cultos/GerenciarTimeDialog";

interface Membro {
  id: string;
  nome: string;
  posicao: string | null;
}

interface Time {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
  membros_count: number;
  membros: Membro[];
}

interface Categoria {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

export default function Times() {
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeEditando, setTimeEditando] = useState<Time | null>(null);
  const [gerenciarDialogOpen, setGerenciarDialogOpen] = useState(false);
  const [timeGerenciando, setTimeGerenciando] = useState<Time | null>(null);
  const [expandedTimes, setExpandedTimes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTimes();
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    try {
      const { data, error } = await supabase
        .from("categorias_times")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      setCategorias(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar categorias");
    }
  };

  const loadTimes = async () => {
    try {
      const { data, error } = await supabase
        .from("times_culto")
        .select(`
          *,
          membros_time(
            count,
            pessoa_id,
            posicao_id,
            profiles:pessoa_id(id, nome),
            posicoes_time:posicao_id(nome)
          )
        `)
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;

      const timesWithCount = data?.map(time => {
        const membros = time.membros_time
          ?.filter((m: any) => m.profiles)
          ?.map((m: any) => ({
            id: m.profiles.id,
            nome: m.profiles.nome,
            posicao: m.posicoes_time?.nome || null
          })) || [];

        return {
          ...time,
          membros_count: time.membros_time?.[0]?.count || 0,
          membros: membros
        };
      }) || [];

      setTimes(timesWithCount);
    } catch (error: any) {
      toast.error("Erro ao carregar times", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const timesFiltrados = categoriaFiltro === "todos"
    ? times
    : times.filter(t => t.categoria === categoriaFiltro);

  const handleNovoTime = () => {
    setTimeEditando(null);
    setDialogOpen(true);
  };

  const handleEditarTime = (time: Time) => {
    setTimeEditando(time);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    loadTimes();
  };

  const handleGerenciarTime = (time: Time) => {
    setTimeGerenciando(time);
    setGerenciarDialogOpen(true);
  };

  const toggleTime = (timeId: string) => {
    setExpandedTimes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(timeId)) {
        newSet.delete(timeId);
      } else {
        newSet.add(timeId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Times</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Carregando...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Times</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie as equipes e departamentos
          </p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft w-full sm:w-auto"
          onClick={handleNovoTime}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Time</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      {/* Filtros por Categoria */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={categoriaFiltro === "todos" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoriaFiltro("todos")}
          className="text-xs md:text-sm"
        >
          Todos ({times.length})
        </Button>
        {categorias.map((cat) => {
          const count = times.filter(t => t.categoria === cat.id).length;
          return (
            <Button
              key={cat.id}
              variant={categoriaFiltro === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoriaFiltro(cat.id)}
              className="text-xs md:text-sm"
            >
              <div 
                className="w-2 h-2 rounded-full mr-2" 
                style={{ backgroundColor: cat.cor }}
              />
              {cat.nome} ({count})
            </Button>
          );
        })}
      </div>

      {/* Lista de Times */}
      <div className="grid gap-4 md:gap-6">
        {timesFiltrados.map((time) => {
          const isExpanded = expandedTimes.has(time.id);
          return (
            <Collapsible key={time.id} open={isExpanded} onOpenChange={() => toggleTime(time.id)}>
              <Card className="shadow-soft hover:shadow-medium transition-shadow">
                <CardHeader className="p-4 md:p-6">
                  <div className="flex flex-col gap-3">
                    {/* Topo: Nome, Categoria e Ações */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                        <div 
                          className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: time.cor || 'hsl(var(--primary))' }}
                        >
                          <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg md:text-xl">{time.nome}</CardTitle>
                            {categorias.find(c => c.id === time.categoria) && (
                              <Badge 
                                style={{ 
                                  backgroundColor: categorias.find(c => c.id === time.categoria)?.cor + '20',
                                  color: categorias.find(c => c.id === time.categoria)?.cor
                                }}
                              >
                                {categorias.find(c => c.id === time.categoria)?.nome}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={time.ativo ? "default" : "secondary"} className="whitespace-nowrap">
                          {time.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs md:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditarTime(time);
                          }}
                        >
                          <Edit className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                          <span className="hidden md:inline">Editar</span>
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs md:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGerenciarTime(time);
                          }}
                        >
                          <Settings className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                          <span className="hidden md:inline">Gerenciar</span>
                        </Button>
                      </div>
                    </div>

                    {/* Descrição */}
                    {time.descricao && (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {time.descricao}
                      </p>
                    )}

                    {/* Contador de membros e botão expandir */}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm md:text-base">
                            {time.membros_count} {time.membros_count === 1 ? "membro" : "membros"}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="p-4 md:p-6 pt-0">
                    {time.membros.length > 0 ? (
                      <div className="space-y-2">
                        {time.membros.map((membro) => (
                          <div 
                            key={membro.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          >
                            <span className="text-sm font-medium">{membro.nome}</span>
                            {membro.posicao && (
                              <Badge variant="outline" className="text-xs">
                                {membro.posicao}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum membro cadastrado neste time
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        {timesFiltrados.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum time encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {categoriaFiltro === "todos" 
                  ? "Comece criando seu primeiro time."
                  : "Não há times nesta categoria."}
              </p>
              <Button onClick={handleNovoTime}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Time
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <TimeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        time={timeEditando}
        onSuccess={handleDialogSuccess}
      />

      <GerenciarTimeDialog
        open={gerenciarDialogOpen}
        onOpenChange={setGerenciarDialogOpen}
        time={timeGerenciando}
      />
    </div>
  );
}
