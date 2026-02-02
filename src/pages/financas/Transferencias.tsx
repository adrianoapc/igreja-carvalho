import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRightLeft,
  Plus,
  Calendar,
  Undo2,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { useHideValues } from "@/hooks/useHideValues";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { TransferenciaDialog } from "@/components/financas/TransferenciaDialog";
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

export default function Transferencias() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [estornoDialog, setEstornoDialog] = useState<{
    open: boolean;
    transferencia: any | null;
  }>({ open: false, transferencia: null });
  const [estornando, setEstornando] = useState(false);

  const startDate = customRange
    ? format(customRange.from, "yyyy-MM-dd")
    : format(startOfMonth(selectedMonth), "yyyy-MM-dd");
  const endDate = customRange
    ? format(customRange.to, "yyyy-MM-dd")
    : format(endOfMonth(selectedMonth), "yyyy-MM-dd");

  const { data: transferencias, isLoading } = useQuery({
    queryKey: [
      "transferencias",
      igrejaId,
      filialId,
      isAllFiliais,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transferencias_contas")
        .select(
          `
          *,
          conta_origem:contas!transferencias_contas_conta_origem_id_fkey(id, nome),
          conta_destino:contas!transferencias_contas_conta_destino_id_fkey(id, nome)
        `
        )
        .eq("igreja_id", igrejaId)
        .gte("data_transferencia", startDate)
        .lte("data_transferencia", endDate)
        .order("data_transferencia", { ascending: false });

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  const handleEstorno = async () => {
    if (!estornoDialog.transferencia) return;

    setEstornando(true);
    try {
      const t = estornoDialog.transferencia;

      // 1. Marcar transferência como estornada
      await supabase
        .from("transferencias_contas")
        .update({ status: "estornada" })
        .eq("id", t.id);

      // 2. Estornar transações vinculadas (marcar como canceladas)
      if (t.transacao_saida_id) {
        await supabase
          .from("transacoes_financeiras")
          .update({ status: "cancelado" })
          .eq("id", t.transacao_saida_id);
      }

      if (t.transacao_entrada_id) {
        await supabase
          .from("transacoes_financeiras")
          .update({ status: "cancelado" })
          .eq("id", t.transacao_entrada_id);
      }

      // 3. Reverter saldos das contas
      // Buscar saldos atuais
      const { data: contaOrigem } = await supabase
        .from("contas")
        .select("saldo_atual")
        .eq("id", t.conta_origem_id)
        .single();

      const { data: contaDestino } = await supabase
        .from("contas")
        .select("saldo_atual")
        .eq("id", t.conta_destino_id)
        .single();

      // Devolver para origem, tirar do destino
      if (contaOrigem) {
        await supabase
          .from("contas")
          .update({
            saldo_atual: (contaOrigem.saldo_atual || 0) + Number(t.valor),
          })
          .eq("id", t.conta_origem_id);
      }

      if (contaDestino) {
        await supabase
          .from("contas")
          .update({
            saldo_atual: (contaDestino.saldo_atual || 0) - Number(t.valor),
          })
          .eq("id", t.conta_destino_id);
      }

      toast.success("Transferência estornada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["transferencias"] });
      queryClient.invalidateQueries({ queryKey: ["contas"] });
      queryClient.invalidateQueries({ queryKey: ["transacoes"] });
    } catch (error) {
      console.error("Erro ao estornar:", error);
      toast.error("Erro ao estornar transferência");
    } finally {
      setEstornando(false);
      setEstornoDialog({ open: false, transferencia: null });
    }
  };

  const formatCurrency = (value: number) => formatValue(value);

  const totalTransferido =
    transferencias
      ?.filter((t) => t.status === "executada")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center justify-between gap-3 flex-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/financas/contas")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Transferências
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Movimentações internas entre contas
              </p>
            </div>
          </div>
          <HideValuesToggle />
        </div>

        <Button
          className="bg-gradient-primary shadow-soft w-full md:w-auto"
          onClick={() => setDialogOpen(true)}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Nova Transferência
        </Button>
      </div>

      {/* Filtro e Totais */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Calendar className="w-3 h-3" />
            {customRange
              ? `${format(customRange.from, "dd/MM/yyyy")} - ${format(
                  customRange.to,
                  "dd/MM/yyyy"
                )}`
              : format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </Badge>
          <MonthPicker
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
        </div>

        <Card className="shadow-soft">
          <CardContent className="p-3 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Total movimentado:
            </span>
            <span className="font-semibold">
              {formatCurrency(totalTransferido)}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">
              Carregando...
            </p>
          ) : transferencias && transferencias.length > 0 ? (
            <div className="space-y-3">
              {transferencias.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border",
                    t.status === "estornada" && "opacity-50 bg-muted/30"
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {t.conta_origem?.nome || "?"}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">
                        {t.conta_destino?.nome || "?"}
                      </span>
                      {t.status === "estornada" && (
                        <Badge variant="destructive" className="text-xs">
                          Estornada
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>
                        {format(
                          new Date(t.data_transferencia),
                          "dd/MM/yyyy",
                          { locale: ptBR }
                        )}
                      </span>
                      {t.observacoes && <span>• {t.observacoes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2 sm:mt-0">
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(Number(t.valor))}
                    </span>
                    {t.status === "executada" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEstornoDialog({ open: true, transferencia: t })
                        }
                        title="Estornar transferência"
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                Nenhuma transferência no período
              </p>
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setDialogOpen(true)}
              >
                Realizar primeira transferência
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Transferência */}
      <TransferenciaDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Dialog de Estorno */}
      <AlertDialog
        open={estornoDialog.open}
        onOpenChange={(open) =>
          setEstornoDialog({ open, transferencia: estornoDialog.transferencia })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar Transferência?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá reverter a transferência de{" "}
              <strong>
                {formatCurrency(Number(estornoDialog.transferencia?.valor || 0))}
              </strong>{" "}
              de <strong>{estornoDialog.transferencia?.conta_origem?.nome}</strong>{" "}
              para{" "}
              <strong>{estornoDialog.transferencia?.conta_destino?.nome}</strong>.
              <br />
              <br />
              Os saldos das contas serão ajustados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={estornando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEstorno}
              disabled={estornando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {estornando ? "Estornando..." : "Confirmar Estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
