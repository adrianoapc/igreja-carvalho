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
import { desconciliar } from "@/features/financeiro/core";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface DesconciliarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacaoId: string;
}

export function DesconciliarDialog({
  open,
  onOpenChange,
  transacaoId,
}: DesconciliarDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleDesconciliar = async () => {
    setLoading(true);
    try {
      // Desconciliação transacional (fin_desconciliar, ADR-030/F3): limpa os
      // 3 mecanismos de vínculo (1:1, lote, divisão) numa única transação.
      const result = (await desconciliar(transacaoId)) as any;
      const total =
        (result?.extratos_1a1 || 0) +
        (result?.extratos_lote || 0) +
        (result?.extratos_divisao || 0);

      toast.success(
        `Desconciliação realizada: ${total} extrato(s) liberado(s), ${result?.lotes_removidos || 0} lote(s) e ${result?.divisoes_removidas || 0} divisão(ões) removidos`,
      );

      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      queryClient.invalidateQueries({ queryKey: ["extratos-historico"] });
      queryClient.invalidateQueries({ queryKey: ["sessao-lancamentos"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao desconciliar:", error);
      toast.error("Erro ao desconciliar transação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Desconciliar transação</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá reverter todos os vínculos desta transação com extratos
            bancários (1:1, lotes e divisões). Os extratos voltarão a ficar
            disponíveis para nova conciliação. Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDesconciliar} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Desconciliar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
