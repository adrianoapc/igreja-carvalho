import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Edit, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CentroCustoDialog } from "@/components/financas/CentroCustoDialog";
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

export default function CentrosCusto() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCentro, setSelectedCentro] = useState<any>(null);
  const [centroToDelete, setCentroToDelete] = useState<string | null>(null);

  const { data: centros, isLoading } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centros_custo')
        .select(`
          *,
          base_ministerial:base_ministerial_id(titulo)
        `)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  const handleDeleteConfirm = async () => {
    if (!centroToDelete) return;

    try {
      const { error } = await supabase
        .from('centros_custo')
        .update({ ativo: false })
        .eq('id', centroToDelete);
      
      if (error) throw error;
      toast.success("Centro de custo removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover centro de custo");
    } finally {
      setDeleteDialogOpen(false);
      setCentroToDelete(null);
    }
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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Centros de Custo</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Áreas que demandam entrada e saída de recursos</p>
          </div>
          <Button 
            className="bg-gradient-primary shadow-soft"
            onClick={() => {
              setSelectedCentro(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Novo Centro</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando centros de custo...</p>
          </CardContent>
        </Card>
      ) : centros && centros.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {centros.map((centro) => (
            <Card key={centro.id} className="shadow-soft">
              <CardContent className="p-4 md:p-6">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base md:text-lg font-semibold text-foreground">{centro.nome}</h3>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">Ativo</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedCentro(centro);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => {
                          setCentroToDelete(centro.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {centro.descricao && (
                    <p className="text-sm text-muted-foreground">{centro.descricao}</p>
                  )}
                  {centro.base_ministerial && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Base: <span className="font-medium">{centro.base_ministerial.titulo}</span>
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-sm md:text-base text-muted-foreground text-center">
              Nenhum centro de custo cadastrado ainda. Ex: Ministério Infantil, Mídia, Missões, etc.
            </p>
          </CardContent>
        </Card>
      )}

      <CentroCustoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        centro={selectedCentro}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este centro de custo? Esta ação não pode ser desfeita.
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
