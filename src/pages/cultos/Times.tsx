import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Settings, Edit, ChevronDown, ChevronUp, Search, X, Trash2, Crown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TimeDialog from "@/components/cultos/TimeDialog";
import GerenciarTimeDialog from "@/components/cultos/GerenciarTimeDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Membro {
  id: string;
  nome: string;
  posicao: string | null;
}

interface LiderInfo {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface Time {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
  lider_id: string | null;
  sublider_id: string | null;
  lider: LiderInfo | null;
  sublider: LiderInfo | null;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [timeDeletando, setTimeDeletando] = useState<Time | null>(null);

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
          lider:profiles!times_culto_lider_id_fkey(id, nome, avatar_url),
          sublider:profiles!times_culto_sublider_id_fkey(id, nome, avatar_url),
          membros_time(
            pessoa_id,
            posicao_id,
            ativo,
            profiles:pessoa_id(id, nome),
            posicoes_time:posicao_id(nome)
          )
        `)
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;

      const timesWithCount = data?.map(time => {
        const membros = time.membros_time
          ?.filter((m: any) => m.profiles && m.ativo)
          ?.map((m: any) => ({
            id: m.profiles.id,
            nome: m.profiles.nome,
            posicao: m.posicoes_time?.nome || null
          })) || [];

        return {
          ...time,
          lider: time.lider || null,
          sublider: time.sublider || null,
          membros_count: membros.length,
          membros: membros
        };
      }) || [];

      setTimes(timesWithCount as Time[]);
    } catch (error: any) {
      toast.error("Erro ao carregar times", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const timesFiltrados = times
    .filter(t => categoriaFiltro === "todos" || t.categoria === categoriaFiltro)
    .filter(t => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      // Busca pelo nome do time
      if (t.nome.toLowerCase().includes(search)) return true;
      // Busca pelos nomes dos membros
      return t.membros.some(m => m.nome.toLowerCase().includes(search));
    });

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

  const limparFiltros = () => {
    setSearchTerm("");
    setCategoriaFiltro("todos");
  };

  const hasActiveFilters = searchTerm !== "" || categoriaFiltro !== "todos";

  const handleExcluirTime = (time: Time) => {
    setTimeDeletando(time);
    setDeleteDialogOpen(true);
  };

  const confirmarExclusao = async () => {
    if (!timeDeletando) return;

    try {
      // Verificar se há membros no time
      if (timeDeletando.membros_count > 0) {
        toast.error("Não é possível excluir", {
          description: "Este time possui membros associados. Remova os membros antes de excluir."
        });
        setDeleteDialogOpen(false);
        return;
      }

      // Excluir o time
      const { error } = await supabase
        .from("times_culto")
        .delete()
        .eq("id", timeDeletando.id);

      if (error) throw error;

      toast.success("Time excluído com sucesso");
      loadTimes();
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error("Erro ao excluir time", {
        description: error.message
      });
    }
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

      {/* Campo de Busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por time ou membro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="default"
            onClick={limparFiltros}
            className="whitespace-nowrap"
          >
            <X className="w-4 h-4 mr-2" />
            Limpar filtros
          </Button>
        )}
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
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs md:text-sm text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExcluirTime(time);
                          }}
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Descrição */}
                    {time.descricao && (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {time.descricao}
                      </p>
                    )}

                    {/* Líder e Sub-líder */}
                    {(time.lider || time.sublider) && (
                      <div className="flex flex-col gap-1 text-sm">
                        {time.lider && (
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-amber-500" />
                            <span className="text-muted-foreground">Líder:</span>
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={time.lider.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {time.lider.nome.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{time.lider.nome}</span>
                          </div>
                        )}
                        {time.sublider && (
                          <div className="flex items-center gap-2">
                            <Crown className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Sub-líder:</span>
                            <Avatar className="w-5 h-5">
                              <AvatarImage src={time.sublider.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {time.sublider.nome.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{time.sublider.nome}</span>
                          </div>
                        )}
                      </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o time "{timeDeletando?.nome}"?
              {timeDeletando && timeDeletando.membros_count > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Atenção: Este time possui {timeDeletando.membros_count} {timeDeletando.membros_count === 1 ? "membro" : "membros"}.
                  Remova os membros antes de excluir.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
