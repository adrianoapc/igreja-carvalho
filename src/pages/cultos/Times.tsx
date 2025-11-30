import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Settings, Edit } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TimeDialog from "@/components/cultos/TimeDialog";
import GerenciarTimeDialog from "@/components/cultos/GerenciarTimeDialog";

interface Time {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
  membros_count: number;
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
          membros_time(count)
        `)
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;

      const timesWithCount = data?.map(time => ({
        ...time,
        membros_count: time.membros_time?.[0]?.count || 0
      })) || [];

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
        {timesFiltrados.map((time) => (
          <Card key={time.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3">
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
                      {time.descricao && (
                        <p className="text-xs md:text-sm text-muted-foreground mt-1">
                          {time.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant={time.ativo ? "default" : "secondary"} className="whitespace-nowrap">
                  {time.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm md:text-base">
                    {time.membros_count} {time.membros_count === 1 ? "membro" : "membros"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs md:text-sm"
                    onClick={() => handleEditarTime(time)}
                  >
                    <Edit className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs md:text-sm"
                    onClick={() => handleGerenciarTime(time)}
                  >
                    <Settings className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                    Gerenciar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

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
