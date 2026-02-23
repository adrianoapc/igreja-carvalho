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
  Eye,
  Link2,
  Copy,
  Check,
  Unlink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { DesconciliarDialog } from "./DesconciliarDialog";

interface TransacaoActionsMenuProps {
  transacaoId: string;
  status: string;
  tipo: "entrada" | "saida";
  isReembolso?: boolean;
  isDinheiro?: boolean;
  conferidoManual?: boolean;
  conciliacaoStatus?: string | null;
  onEdit: () => void;
  onVerExtrato?: (
    extratoId: string,
    entradaVinculada?: {
      id: string;
      descricao: string;
      valor: number;
      data_pagamento: string;
    },
  ) => void;
}

export function TransacaoActionsMenu({
  transacaoId,
  status,
  tipo,
  isReembolso = false,
  isDinheiro = false,
  conferidoManual = false,
  conciliacaoStatus = null,
  onEdit,
  onVerExtrato,
}: TransacaoActionsMenuProps) {
  const [showVinculadaDrawer, setShowVinculadaDrawer] = useState(false);
  const [movVinculada, setMovVinculada] = useState<{
    id: string;
    descricao: string;
    valor: number;
    data_pagamento: string;
    tipo: string;
  } | null>(null);
  // Handler para visualizar movimentação vinculada (transferência)
  const handleVerVinculada = async () => {
    try {
      // Buscar dados da transação atual
      const { data: transacao, error } = await supabase
        .from("transacoes_financeiras")
        .select("id, tipo, transferencia_id")
        .eq("id", transacaoId)
        .single();
      if (error) throw error;
      if (!transacao.transferencia_id) {
        toast.info("Transação não é uma transferência entre contas.");
        return;
      }
      // Se for ENTRADA, buscar SAÍDA correspondente; se for SAÍDA, buscar ENTRADA correspondente
      const tipoOposto = transacao.tipo === "entrada" ? "saida" : "entrada";
      const { data: vinculada } = await supabase
        .from("transacoes_financeiras")
        .select("id, descricao, valor, data_pagamento, tipo")
        .eq("transferencia_id", transacao.transferencia_id)
        .eq("tipo", tipoOposto)
        .maybeSingle();
      if (vinculada) {
        setMovVinculada(vinculada);
        setShowVinculadaDrawer(true);
      } else {
        toast.info("Movimentação vinculada não encontrada.");
      }
    } catch (err) {
      toast.error("Erro ao buscar movimentação vinculada");
    }
  };
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditWarningDialog, setShowEditWarningDialog] = useState(false);
  const [showConfirmarPagamentoDialog, setShowConfirmarPagamentoDialog] =
    useState(false);
  const [showDesconciliarDialog, setShowDesconciliarDialog] = useState(false);

  const handleVerExtrato = async () => {
    try {
      // Buscar dados completos da transação
      const { data: transacao, error } = await supabase
        .from("transacoes_financeiras")
        .select("id, tipo, transferencia_id")
        .eq("id", transacaoId)
        .single();
      if (error) throw error;

      // 1. Tentar buscar extrato vinculado diretamente (1:1)
      const { data: extrato1a1 } = await supabase
        .from("extratos_bancarios")
        .select("id")
        .eq("transacao_vinculada_id", transacaoId)
        .maybeSingle();
      if (extrato1a1) {
        onVerExtrato?.(extrato1a1.id);
        return;
      }

      // 2. Buscar extrato via lote (N:1)
      const { data: lotesData } = await supabase
        .from("conciliacoes_lote")
        .select("id")
        .eq("transacao_id", transacaoId);
      if (lotesData && lotesData.length > 0) {
        const { data: extratoEmLote } = await supabase
          .from("conciliacoes_lote_extratos")
          .select("extrato_id")
          .eq("conciliacao_lote_id", lotesData[0].id)
          .maybeSingle();
        if (extratoEmLote) {
          onVerExtrato?.(extratoEmLote.extrato_id);
          return;
        }
      }

      // 3. Se for SAÍDA de transferência, buscar ENTRADA correspondente e o extrato vinculado a ela
      if (transacao.tipo === "saida" && transacao.transferencia_id) {
        // Buscar a entrada correspondente
        const { data: entrada } = await supabase
          .from("transacoes_financeiras")
          .select("id, descricao, valor, data_pagamento")
          .eq("transferencia_id", transacao.transferencia_id)
          .eq("tipo", "entrada")
          .maybeSingle();
        if (entrada) {
          // Buscar extrato vinculado à entrada (1:1)
          const { data: extratoEntrada1a1 } = await supabase
            .from("extratos_bancarios")
            .select("id")
            .eq("transacao_vinculada_id", entrada.id)
            .maybeSingle();
          if (extratoEntrada1a1) {
            // Exibir extrato e mostrar info da entrada vinculada
            onVerExtrato?.(extratoEntrada1a1.id, entrada);
            return;
          }
          // Buscar extrato via lote (N:1) da entrada
          const { data: lotesEntrada } = await supabase
            .from("conciliacoes_lote")
            .select("id")
            .eq("transacao_id", entrada.id);
          if (lotesEntrada && lotesEntrada.length > 0) {
            const { data: extratoLoteEntrada } = await supabase
              .from("conciliacoes_lote_extratos")
              .select("extrato_id")
              .eq("conciliacao_lote_id", lotesEntrada[0].id)
              .maybeSingle();
            if (extratoLoteEntrada) {
              onVerExtrato?.(extratoLoteEntrada.extrato_id, entrada);
              return;
            }
          }
        }
      }

      toast.info(
        "Nenhum extrato vinculado a esta transação ou à entrada correspondente",
      );
    } catch (error) {
      console.error("Erro ao buscar extrato:", error);
      toast.error("Erro ao buscar extrato");
    }
  };

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
      // Atualiza a transação atual
      const { data: entradaAtual, error: fetchError } = await supabase
        .from("transacoes_financeiras")
        .select("id, transferencia_id, tipo")
        .eq("id", transacaoId)
        .single();
      if (fetchError) throw fetchError;

      const novoStatus = conferidoManual
        ? "nao_conciliado"
        : "conciliado_manual";

      // Atualiza a entrada
      const { error } = await supabase
        .from("transacoes_financeiras")
        .update({
          conferido_manual: !conferidoManual,
          conciliacao_status: novoStatus,
        })
        .eq("id", transacaoId);
      if (error) throw error;

      // Se for uma transferência (entrada com transferencia_id), concilia a saída correspondente
      if (
        entradaAtual &&
        entradaAtual.transferencia_id &&
        entradaAtual.tipo === "entrada"
      ) {
        await supabase
          .from("transacoes_financeiras")
          .update({
            conciliacao_status: novoStatus,
            conferido_manual: !conferidoManual,
          })
          .eq("transferencia_id", entradaAtual.transferencia_id)
          .eq("tipo", "saida");
      }

      toast.success(
        conferidoManual
          ? "Conciliação manual removida"
          : "Marcado como conciliado manual",
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
          {(conciliacaoStatus === "nao_conciliado" ||
            conciliacaoStatus === "conciliado_manual" ||
            !conciliacaoStatus) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleConferidoManual}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {conferidoManual
                  ? "Remover Conciliação Manual"
                  : "Conciliar Manualmente"}
              </DropdownMenuItem>
            </>
          )}
          {(conciliacaoStatus === "conciliado_extrato" ||
            conciliacaoStatus === "conciliado_bot" ||
            conciliacaoStatus === "conferido_manual") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleVerExtrato}>
                <Eye className="mr-2 h-4 w-4" />
                Ver Extrato
              </DropdownMenuItem>
            </>
          )}
          {(conciliacaoStatus === "conciliado_extrato" ||
            conciliacaoStatus === "conciliado_bot") && (
            <>
              <DropdownMenuItem onClick={() => setShowDesconciliarDialog(true)}>
                <Unlink className="mr-2 h-4 w-4" />
                Desconciliar
              </DropdownMenuItem>
            </>
          )}
          {/* Ação para ver movimentação vinculada (transferência) */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleVerVinculada}>
            <Link2 className="mr-2 h-4 w-4" />
            Ver Movimentação Vinculada
          </DropdownMenuItem>
          {/* Drawer para mostrar movimentação vinculada */}
          {showVinculadaDrawer && movVinculada && (
            <Sheet
              open={showVinculadaDrawer}
              onOpenChange={setShowVinculadaDrawer}
            >
              <SheetContent
                side="right"
                className="w-full sm:w-[500px] overflow-y-auto"
              >
                <SheetHeader>
                  <SheetTitle>Movimentação Vinculada</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">
                      Informações Básicas
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm text-muted-foreground">
                          Descrição
                        </span>
                        <span className="text-sm font-medium text-right max-w-[250px] break-words">
                          {movVinculada.descricao}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Valor
                        </span>
                        <span
                          className={
                            movVinculada.tipo === "entrada"
                              ? "text-green-600 font-bold text-sm"
                              : "text-red-600 font-bold text-sm"
                          }
                        >
                          R${" "}
                          {movVinculada.valor?.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Data
                        </span>
                        <span className="text-sm font-medium">
                          {movVinculada.data_pagamento
                            ? new Date(
                                movVinculada.data_pagamento,
                              ).toLocaleDateString("pt-BR")
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Tipo
                        </span>
                        <span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${movVinculada.tipo === "entrada" ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}`}
                          >
                            {movVinculada.tipo === "entrada"
                              ? "Entrada"
                              : "Saída"}
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm text-muted-foreground">
                          ID
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              String(movVinculada.id),
                            );
                            toast.success("ID copiado!");
                          }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span className="font-mono">
                            {String(movVinculada.id).substring(0, 8)}...
                          </span>
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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

      <DesconciliarDialog
        open={showDesconciliarDialog}
        onOpenChange={setShowDesconciliarDialog}
        transacaoId={transacaoId}
      />
    </>
  );
}
