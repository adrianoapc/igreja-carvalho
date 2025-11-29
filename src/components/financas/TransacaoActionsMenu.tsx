import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Edit, Trash2, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
import { useState } from "react";
import { ConfirmarPagamentoDialog } from "./ConfirmarPagamentoDialog";

interface TransacaoActionsMenuProps {
  transacaoId: string;
  status: string;
  tipo: "entrada" | "saida";
  onEdit: () => void;
}

export function TransacaoActionsMenu({ transacaoId, status, tipo, onEdit }: TransacaoActionsMenuProps) {
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfirmarPagamentoDialog, setShowConfirmarPagamentoDialog] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      // Se marcar como pendente, remover todos os dados de pagamento/recebimento
      if (newStatus === "pendente") {
        updateData.data_pagamento = null;
        updateData.juros = 0;
        updateData.multas = 0;
        updateData.desconto = 0;
        updateData.taxas_administrativas = 0;
      }

      const { error } = await supabase
        .from("transacoes_financeiras")
        .update(updateData)
        .eq("id", transacaoId);

      if (error) throw error;

      toast.success(`Status atualizado para ${newStatus === 'pendente' ? 'Pendente' : 'Pago'}`);
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("transacoes_financeiras")
        .delete()
        .eq("id", transacaoId);

      if (error) throw error;

      toast.success("Transação excluída com sucesso");
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir transação");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status !== "pago" && (
            <DropdownMenuItem onClick={() => setShowConfirmarPagamentoDialog(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Marcar como Pago
            </DropdownMenuItem>
          )}
          {status !== "pendente" && (
            <DropdownMenuItem onClick={() => handleStatusChange("pendente")}>
              <Clock className="mr-2 h-4 w-4" />
              Marcar como Pendente
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmarPagamentoDialog
        open={showConfirmarPagamentoDialog}
        onOpenChange={setShowConfirmarPagamentoDialog}
        transacaoId={transacaoId}
        tipo={tipo}
      />
    </>
  );
}
