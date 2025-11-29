import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowLeft, ChevronRight, ChevronDown, Edit, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Categorias() {
  const navigate = useNavigate();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const { data: categorias, isLoading } = useQuery({
    queryKey: ['categorias-financeiras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select(`
          *,
          subcategorias:subcategorias_financeiras(*)
        `)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => 
      prev.includes(id) 
        ? prev.filter(catId => catId !== id)
        : [...prev, id]
    );
  };

  const categoriasEntrada = categorias?.filter(c => c.tipo === 'entrada') || [];
  const categoriasSaida = categorias?.filter(c => c.tipo === 'saida') || [];

  const CategoryItem = ({ categoria }: { categoria: any }) => {
    const isExpanded = expandedCategories.includes(categoria.id);
    const hasSubcategorias = categoria.subcategorias && categoria.subcategorias.length > 0;

    return (
      <div className="border border-border rounded-lg mb-2">
        <div className="flex items-center gap-2 p-3 md:p-4 bg-card hover:bg-accent/50 transition-colors">
          {hasSubcategorias && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => toggleCategory(categoria.id)}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          )}
          {!hasSubcategorias && <div className="w-6" />}
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm md:text-base">{categoria.nome}</h3>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{categoria.secao_dre}</p>
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            {hasSubcategorias && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Plus className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
              <Trash className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isExpanded && hasSubcategorias && (
          <div className="border-t border-border bg-muted/30">
            {categoria.subcategorias.map((sub: any) => (
              <div
                key={sub.id}
                className="flex items-center gap-2 p-3 md:p-4 pl-12 md:pl-14 hover:bg-accent/50 transition-colors border-b border-border last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium">{sub.nome}</h4>
                  <p className="text-xs text-muted-foreground">{categoria.secao_dre}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                    <Trash className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/financas')}
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Categorias</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Organize suas transações financeiras</p>
          </div>
          <Button className="bg-gradient-primary shadow-soft">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Categoria</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="entrada" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="entrada">Recebimento</TabsTrigger>
          <TabsTrigger value="saida">Pagamento</TabsTrigger>
        </TabsList>

        <TabsContent value="entrada" className="space-y-2">
          {isLoading ? (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">Carregando categorias...</p>
            </Card>
          ) : categoriasEntrada.length === 0 ? (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Nenhuma categoria de entrada cadastrada ainda.
              </p>
            </Card>
          ) : (
            categoriasEntrada.map(categoria => (
              <CategoryItem key={categoria.id} categoria={categoria} />
            ))
          )}
        </TabsContent>

        <TabsContent value="saida" className="space-y-2">
          {isLoading ? (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">Carregando categorias...</p>
            </Card>
          ) : categoriasSaida.length === 0 ? (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">
                Nenhuma categoria de saída cadastrada ainda.
              </p>
            </Card>
          ) : (
            categoriasSaida.map(categoria => (
              <CategoryItem key={categoria.id} categoria={categoria} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
