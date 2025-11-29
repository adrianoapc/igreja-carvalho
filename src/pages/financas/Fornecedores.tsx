import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Building, User, Edit, Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { FornecedorDialog } from "@/components/financas/FornecedorDialog";
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

export default function Fornecedores() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<any>(null);
  const [fornecedorToDelete, setFornecedorToDelete] = useState<string | null>(null);

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  const handleDeleteConfirm = async () => {
    if (!fornecedorToDelete) return;

    try {
      const { error } = await supabase
        .from('fornecedores')
        .update({ ativo: false })
        .eq('id', fornecedorToDelete);
      
      if (error) throw error;
      toast.success("Fornecedor removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover fornecedor");
    } finally {
      setDeleteDialogOpen(false);
      setFornecedorToDelete(null);
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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Fornecedores</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Cadastro de fornecedores e beneficiários</p>
          </div>
          <Button 
            className="bg-gradient-primary shadow-soft"
            onClick={() => {
              setSelectedFornecedor(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Novo Fornecedor</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="shadow-soft">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Carregando fornecedores...</p>
          </CardContent>
        </Card>
      ) : fornecedores && fornecedores.length > 0 ? (
        <div className="space-y-3">
          {fornecedores.map((fornecedor) => (
            <Card key={fornecedor.id} className="shadow-soft hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {fornecedor.tipo_pessoa === 'juridica' ? (
                      <Building className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base md:text-lg font-semibold text-foreground">
                        {fornecedor.nome}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {fornecedor.tipo_pessoa === 'juridica' ? 'PJ' : 'PF'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedFornecedor(fornecedor);
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
                            setFornecedorToDelete(fornecedor.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {fornecedor.cpf_cnpj && (
                        <p>{fornecedor.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'}: {fornecedor.cpf_cnpj}</p>
                      )}
                      {fornecedor.email && <p>Email: {fornecedor.email}</p>}
                      {fornecedor.telefone && <p>Telefone: {fornecedor.telefone}</p>}
                    </div>
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
              Nenhum fornecedor cadastrado ainda.
            </p>
          </CardContent>
        </Card>
      )}

      <FornecedorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        fornecedor={selectedFornecedor}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este fornecedor? Esta ação não pode ser desfeita.
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
