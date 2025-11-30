import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Time {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
  membros_count: number;
}

const CATEGORIAS = {
  musica: { label: "Música", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" },
  tecnico: { label: "Técnico", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  kids: { label: "Kids", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400" },
  hospitalidade: { label: "Hospitalidade", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  outro: { label: "Outro", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" }
};

export default function Times() {
  const [times, setTimes] = useState<Time[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todos");

  useEffect(() => {
    loadTimes();
  }, []);

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
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
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
        {Object.entries(CATEGORIAS).map(([key, cat]) => {
          const count = times.filter(t => t.categoria === key).length;
          return (
            <Button
              key={key}
              variant={categoriaFiltro === key ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoriaFiltro(key)}
              className="text-xs md:text-sm"
            >
              {cat.label} ({count})
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
                        <Badge className={CATEGORIAS[time.categoria as keyof typeof CATEGORIAS]?.color}>
                          {CATEGORIAS[time.categoria as keyof typeof CATEGORIAS]?.label}
                        </Badge>
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
                <Button variant="outline" size="sm" className="text-xs md:text-sm">
                  <Settings className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                  Gerenciar
                </Button>
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
              <Button onClick={() => setCategoriaFiltro("todos")}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Time
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
