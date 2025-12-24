import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Building2, Landmark, Wallet, Edit, Trash2, AlertCircle, Search, Loader2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ContaDialog } from "@/components/financas/ContaDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useHideValues } from "@/hooks/useHideValues";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ContasManutencao() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const queryClient = useQueryClient();
  const [contaDialogOpen, setContaDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [contaToDelete, setContaToDelete] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar todas as contas
  const { data: contas, isLoading, error: contasError } = useQuery({
    queryKey: ['contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      console.info('[contas] total', data?.length || 0, data);
      return data;
    },
    onError: (err: any) => {
      toast.error("Erro ao carregar contas", { description: err.message });
      console.error("Erro contas:", err);
    },
  });

  // Buscar transações para validação de exclusão
  const { data: transacoesPorConta, error: transacoesError } = useQuery({
    queryKey: ['transacoes-por-conta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('conta_id')
        .eq('status', 'pago');
      
      if (error) throw error;
      
      // Contar por conta
      const contagem: Record<string, number> = {};
      data?.forEach(t => {
        contagem[t.conta_id] = (contagem[t.conta_id] || 0) + 1;
      });
      return contagem;
    },
    onError: (err: any) => {
      console.error("Erro transacoes_financeiras:", err);
    },
  });

  // Mutation para deletar conta
  const deleteMutation = useMutation({
    mutationFn: async (contaId: string) => {
      const { error } = await supabase
        .from('contas')
        .update({ ativo: false })
        .eq('id', contaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      toast.success('Conta deletada com sucesso');
      setDeleteAlertOpen(false);
      setContaToDelete(null);
    },
    onError: (error: any) => {
      toast.error(`Erro ao deletar conta: ${error.message}`);
    },
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'bancaria': return <Landmark className="w-4 h-4" />;
      case 'fisica': return <Wallet className="w-4 h-4" />;
      case 'virtual': return <Building2 className="w-4 h-4" />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'bancaria': return 'Bancária';
      case 'fisica': return 'Física';
      case 'virtual': return 'Virtual';
      default: return tipo;
    }
  };

  const handleDeleteClick = (conta: any) => {
    const temMovimentacoes = (transacoesPorConta?.[conta.id] || 0) > 0;
    
    if (temMovimentacoes) {
      toast.error('Não é possível deletar conta com movimentações financeiras');
      return;
    }

    setContaToDelete(conta);
    setDeleteAlertOpen(true);
  };

  const handleConfirmDelete = () => {
    if (contaToDelete) {
      deleteMutation.mutate(contaToDelete.id);
    }
  };

  const temMovimentacoes = (contaId: string) => {
    return (transacoesPorConta?.[contaId] || 0) > 0;
  };

  // Filtrar contas por busca
  const contasFiltradas = contas?.filter(c =>
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.banco?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Manutenção de Contas</h2>
          <p className="text-sm text-muted-foreground">Gerenciar contas bancárias e caixas.</p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft"
          size="sm"
          onClick={() => {
            setSelectedConta(null);
            setContaDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Nova Conta</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Card com Tabela */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="p-3 border-b bg-muted/5 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar conta..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="max-w-xs h-8 text-sm"
          />
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2"/>
            Carregando contas...
          </div>
        ) : contasError ? (
          <div className="p-6 text-center text-destructive text-sm">
            Falha ao carregar contas. Verifique conexão ou permissões.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/5">
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Saldo Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {contas?.length === 0 ? "Nenhuma conta cadastrada." : "Nenhuma conta encontrada."}
                    </TableCell>
                  </TableRow>
                ) : (
                  contasFiltradas.map((conta) => {
                    const hasTransactions = temMovimentacoes(conta.id);
                    
                    return (
                      <TableRow key={conta.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {getTipoIcon(conta.tipo)}
                            {conta.nome}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getTipoLabel(conta.tipo)}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(
                          "font-medium",
                          conta.saldo_atual >= 0 ? "text-foreground" : "text-destructive"
                        )}>
                          {formatValue(conta.saldo_atual)}
                        </TableCell>
                        <TableCell>
                          {hasTransactions ? (
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Com movimentações
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem movimentações</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedConta(conta);
                                setContaDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5"/>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              disabled={hasTransactions || deleteMutation.isPending}
                              onClick={() => handleDeleteClick(conta)}
                            >
                              <Trash2 className="h-3.5 w-3.5"/>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Dialog de Criação/Edição */}
      <ContaDialog 
        open={contaDialogOpen}
        onOpenChange={setContaDialogOpen}
        conta={selectedConta}
      />

      {/* Alert Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a conta <strong>{contaToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
