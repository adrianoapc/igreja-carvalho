import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FormaPagamentoDialog } from "@/components/financas/FormaPagamentoDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

export default function FormasPagamento() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForma, setEditingForma] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formaToDelete, setFormaToDelete] = useState<any>(null);

  const { data: formasPagamento, isLoading } = useQuery({
    queryKey: ['formas-pagamento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('formas_pagamento')
        .update({ ativo: !ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      toast({
        title: "Status atualizado",
        description: "A forma de pagamento foi atualizada com sucesso.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('formas_pagamento')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      toast({
        title: "Forma de pagamento excluída",
        description: "A operação foi concluída com sucesso.",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Formas de Pagamento</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie as formas de pagamento disponíveis
            </p>
          </div>
          <Button 
            className="bg-gradient-primary shadow-soft"
            onClick={() => {
              setEditingForma(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nova Forma</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Lista de Formas de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : formasPagamento && formasPagamento.length > 0 ? (
            <div className="space-y-3">
              {formasPagamento.map((forma) => (
                <Card key={forma.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div>
                          <h3 className="font-semibold text-sm">{forma.nome}</h3>
                        </div>
                        <Badge variant={forma.ativo ? "default" : "secondary"}>
                          {forma.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAtivoMutation.mutate({ id: forma.id, ativo: forma.ativo })}
                        >
                          {forma.ativo ? "Desativar" : "Ativar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingForma(forma);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormaToDelete(forma);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm md:text-base text-muted-foreground text-center py-4">
              Nenhuma forma de pagamento cadastrada.
            </p>
          )}
        </CardContent>
      </Card>

      <FormaPagamentoDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingForma(null);
        }}
        formaPagamento={editingForma}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a forma de pagamento "{formaToDelete?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(formaToDelete?.id)}
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
