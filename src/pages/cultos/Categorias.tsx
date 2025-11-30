import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CategoriaDialog from "@/components/cultos/CategoriaDialog";

interface Categoria {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  times_count: number;
}

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null);

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    try {
      // Buscar categorias
      const { data: categoriasData, error: categoriasError } = await supabase
        .from("categorias_times")
        .select("*")
        .order("nome", { ascending: true });

      if (categoriasError) throw categoriasError;

      // Para cada categoria, contar times
      const categoriasComContagem = await Promise.all(
        (categoriasData || []).map(async (cat) => {
          const { count } = await supabase
            .from("times_culto")
            .select("*", { count: "exact", head: true })
            .eq("categoria", cat.id);

          return {
            ...cat,
            times_count: count || 0
          };
        })
      );

      setCategorias(categoriasComContagem);
    } catch (error: any) {
      toast.error("Erro ao carregar categorias", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNovaCategoria = () => {
    setCategoriaEditando(null);
    setDialogOpen(true);
  };

  const handleEditarCategoria = (categoria: Categoria) => {
    setCategoriaEditando(categoria);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    loadCategorias();
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Categorias</h1>
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Categorias de Times</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie as categorias dos times
          </p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft w-full sm:w-auto"
          onClick={handleNovaCategoria}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categorias.map((categoria) => (
          <Card key={categoria.id} className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader className="p-4 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: categoria.cor }}
                  >
                    <Tag className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{categoria.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {categoria.times_count} {categoria.times_count === 1 ? "time" : "times"}
                    </p>
                  </div>
                </div>
                <Badge variant={categoria.ativo ? "default" : "secondary"}>
                  {categoria.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => handleEditarCategoria(categoria)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </CardContent>
          </Card>
        ))}

        {categorias.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <Tag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma categoria</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece criando sua primeira categoria de times.
              </p>
              <Button onClick={handleNovaCategoria}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Categoria
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <CategoriaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categoria={categoriaEditando}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}