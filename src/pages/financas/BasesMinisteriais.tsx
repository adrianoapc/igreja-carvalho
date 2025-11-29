import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, User, Edit, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { BaseMinisterialDialog } from "@/components/financas/BaseMinisterialDialog";
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

export default function BasesMinisteriais() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBase, setSelectedBase] = useState<any>(null);
  const [baseToDelete, setBaseToDelete] = useState<string | null>(null);

  const { data: bases, isLoading } = useQuery({
    queryKey: ['bases-ministeriais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bases_ministeriais')
        .select(`
          *,
          responsavel:responsavel_id(nome)
        `)
        .eq('ativo', true)
        .order('titulo');
      
      if (error) throw error;
      return data;
    },
  });

  const handleDeleteConfirm = async () => {
    if (!baseToDelete) return;

    try {
      const { error } = await supabase
        .from('bases_ministeriais')
        .update({ ativo: false })
        .eq('id', baseToDelete);
      
      if (error) throw error;
      toast.success("Base ministerial removida com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['bases-ministeriais'] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover base ministerial");
    } finally {
      setDeleteDialogOpen(false);
      setBaseToDelete(null);
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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bases Ministeriais</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Unidades de negócio da igreja</p>
          </div>
          <Button 
            className="bg-gradient-primary shadow-soft"
            onClick={() => {
              setSelectedBase(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Base</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando bases ministeriais...</p>
          </CardContent>
        </Card>
      ) : bases && bases.length > 0 ? (
        <div className="space-y-3">
          {bases.map((base) => (
            <Card key={base.id} className="shadow-soft">
              <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{base.titulo}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{base.descricao}</p>
                    {base.responsavel && (
                      <div className="flex items-center gap-2 mt-3">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Responsável: {base.responsavel.nome}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Ativa</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedBase(base);
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
                        setBaseToDelete(base.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-sm md:text-base text-muted-foreground text-center">
              Nenhuma base ministerial cadastrada ainda. Ex: Base de Evangelismo, Base de Comunhão, etc.
            </p>
          </CardContent>
        </Card>
      )}

      <BaseMinisterialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        base={selectedBase}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta base ministerial? Esta ação não pode ser desfeita.
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
