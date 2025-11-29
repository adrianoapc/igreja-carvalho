import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowLeft, ChevronRight, ChevronDown, Edit, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CategoriaDialog } from "@/components/financas/CategoriaDialog";
import { SubcategoriaDialog } from "@/components/financas/SubcategoriaDialog";
import { toast } from "sonner";
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

export default function Categorias() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [subcategoriaDialogOpen, setSubcategoriaDialogOpen] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState<any>(null);
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'categoria' | 'subcategoria', id: string } | null>(null);

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

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'categoria') {
        const { error } = await supabase
          .from('categorias_financeiras')
          .update({ ativo: false })
          .eq('id', itemToDelete.id);
        
        if (error) throw error;
        toast.success("Categoria removida com sucesso!");
      } else {
        const { error } = await supabase
          .from('subcategorias_financeiras')
          .update({ ativo: false })
          .eq('id', itemToDelete.id);
        
        if (error) throw error;
        toast.success("Subcategoria removida com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ['categorias-financeiras'] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover item");
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
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
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCategoria(categoria);
                  setSelectedSubcategoria(null);
                  setSubcategoriaDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCategoria(categoria);
                setCategoriaDialogOpen(true);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setItemToDelete({ type: 'categoria', id: categoria.id });
                setDeleteDialogOpen(true);
              }}
            >
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
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setSelectedCategoria(categoria);
                      setSelectedSubcategoria(sub);
                      setSubcategoriaDialogOpen(true);
                    }}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-destructive"
                    onClick={() => {
                      setItemToDelete({ type: 'subcategoria', id: sub.id });
                      setDeleteDialogOpen(true);
                    }}
                  >
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
          <Button 
            className="bg-gradient-primary shadow-soft"
            onClick={() => {
              setSelectedCategoria(null);
              setCategoriaDialogOpen(true);
            }}
          >
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

      <CategoriaDialog
        open={categoriaDialogOpen}
        onOpenChange={setCategoriaDialogOpen}
        categoria={selectedCategoria}
      />

      {selectedCategoria && (
        <SubcategoriaDialog
          open={subcategoriaDialogOpen}
          onOpenChange={setSubcategoriaDialogOpen}
          categoriaId={selectedCategoria.id}
          categoriaNome={selectedCategoria.nome}
          subcategoria={selectedSubcategoria}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
