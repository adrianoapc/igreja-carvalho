import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { ConfirmarPagamentoDialog } from "./ConfirmarPagamentoDialog";

interface TransacaoActionsMenuProps {
  transacaoId: string;
  status: string;
  tipo: "entrada" | "saida";
  isReembolso?: boolean;
  isDinheiro?: boolean;
  conferidoManual?: boolean;
  onEdit: () => void;
}

export function TransacaoActionsMenu({
  transacaoId,
  status,
  tipo,
  isReembolso = false,
  isDinheiro = false,
  conferidoManual = false,
  onEdit,
}: TransacaoActionsMenuProps) {
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditWarningDialog, setShowEditWarningDialog] = useState(false);
  const [showConfirmarPagamentoDialog, setShowConfirmarPagamentoDialog] =
    useState(false);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updateData: {
        status: string;
        data_pagamento?: null;
        juros?: number;
        multas?: number;
        desconto?: number;
        taxas_administrativas?: number;
      } = { status: newStatus };

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

      toast.success(
        `Status atualizado para ${newStatus === "pendente" ? "Pendente" : "Pago"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
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
      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir transação");
    }
  };

  const handleToggleConferidoManual = async () => {
    try {
      const { error } = await supabase
        .from("transacoes_financeiras")
        .update({ conferido_manual: !conferidoManual })
        .eq("id", transacaoId);

      if (error) throw error;

      toast.success(
        conferidoManual ? "Conferência removida" : "Marcado como conferido",
      );
      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      queryClient.invalidateQueries({ queryKey: ["sessao-lancamentos"] });
    } catch (error) {
      console.error("Erro ao atualizar conferência:", error);
      toast.error("Erro ao atualizar conferência");
    }
  };

  const handleEditClick = () => {
    if (isReembolso) {
      setShowEditWarningDialog(true);
    } else {
      onEdit();
    }
  };

  const handleConfirmEdit = () => {
    setShowEditWarningDialog(false);
    onEdit();
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
          <DropdownMenuItem onClick={handleEditClick}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status !== "pago" && (
            <DropdownMenuItem
              onClick={() => setShowConfirmarPagamentoDialog(true)}
            >
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
          {isDinheiro && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleConferidoManual}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {conferidoManual
                  ? "Remover Conferido"
                  : "Marcar como Conferido"}
              </DropdownMenuItem>
            </>
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

      {/* Dialog de aviso para edição de transação de reembolso */}
      <AlertDialog
        open={showEditWarningDialog}
        onOpenChange={setShowEditWarningDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Transação vinculada a Reembolso
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <Alert
                  variant="default"
                  className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Este valor está vinculado a uma solicitação de reembolso.
                    Alterações manuais podem gerar inconsistências entre os
                    módulos.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  Deseja continuar com a edição mesmo assim?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEdit}>
              Editar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {isReembolso && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Esta transação está vinculada a uma solicitação de
                      reembolso. Excluí-la pode gerar inconsistências no módulo
                      de reembolsos.
                    </AlertDescription>
                  </Alert>
                )}
                <p>
                  Tem certeza que deseja excluir esta transação? Esta ação não
                  pode ser desfeita.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
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
