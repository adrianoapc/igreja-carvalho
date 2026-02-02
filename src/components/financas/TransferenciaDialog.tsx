import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TransferenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contaOrigemId?: string;
}

export function TransferenciaDialog({
  open,
  onOpenChange,
  contaOrigemId,
}: TransferenciaDialogProps) {
  const { igrejaId, filialId, isAllFiliais } = useAuthContext();
  const queryClient = useQueryClient();

  const [contaOrigem, setContaOrigem] = useState(contaOrigemId || "");
  const [contaDestino, setContaDestino] = useState("");
  const [valor, setValor] = useState("");
  const [dataTransferencia, setDataTransferencia] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form quando abre
  useEffect(() => {
    if (open) {
      setContaOrigem(contaOrigemId || "");
      setContaDestino("");
      setValor("");
      setDataTransferencia(format(new Date(), "yyyy-MM-dd"));
      setObservacoes("");
    }
  }, [open, contaOrigemId]);

  // Buscar contas ativas
  const { data: contas } = useQuery({
    queryKey: ["contas-transferencia", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome, tipo, saldo_atual")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!igrejaId,
  });

  // Buscar categoria "Transferência entre Contas"
  const { data: categoriaTransferencia } = useQuery({
    queryKey: ["categoria-transferencia", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return null;
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id")
        .eq("igreja_id", igrejaId)
        .ilike("nome", "%transferência%entre%contas%")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: open && !!igrejaId,
  });

  const contaOrigemData = contas?.find((c) => c.id === contaOrigem);
  const contaDestinoData = contas?.find((c) => c.id === contaDestino);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contaOrigem || !contaDestino) {
      toast.error("Selecione as contas de origem e destino");
      return;
    }

    if (contaOrigem === contaDestino) {
      toast.error("As contas devem ser diferentes");
      return;
    }

    const valorNum = parseFloat(valor.replace(",", "."));
    if (!valorNum || valorNum <= 0) {
      toast.error("Informe um valor válido maior que zero");
      return;
    }

    if (!categoriaTransferencia) {
      toast.error(
        "Categoria 'Transferência entre Contas' não encontrada. Crie-a em Categorias."
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Criar a transferência
      const { data: transferencia, error: errTransf } = await supabase
        .from("transferencias_contas")
        .insert({
          conta_origem_id: contaOrigem,
          conta_destino_id: contaDestino,
          valor: valorNum,
          data_transferencia: dataTransferencia,
          data_competencia: dataTransferencia,
          observacoes: observacoes || null,
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
          status: "executada",
        })
        .select("id")
        .single();

      if (errTransf) throw errTransf;

      // 2. Criar transação de SAÍDA (da conta origem)
      const { data: transacaoSaida, error: errSaida } = await supabase
        .from("transacoes_financeiras")
        .insert({
          tipo: "saida",
          tipo_lancamento: "unico",
          descricao: `Transferência para ${contaDestinoData?.nome || "outra conta"}`,
          valor: valorNum,
          data_vencimento: dataTransferencia,
          data_pagamento: dataTransferencia,
          data_competencia: dataTransferencia,
          status: "pago",
          conta_id: contaOrigem,
          categoria_id: categoriaTransferencia.id,
          transferencia_id: transferencia.id,
          igreja_id: igrejaId!,
          filial_id: !isAllFiliais ? filialId : null,
        })
        .select("id")
        .single();

      if (errSaida) throw errSaida;

      // 3. Criar transação de ENTRADA (na conta destino)
      const { data: transacaoEntrada, error: errEntrada } = await supabase
        .from("transacoes_financeiras")
        .insert({
          tipo: "entrada",
          tipo_lancamento: "unico",
          descricao: `Transferência de ${contaOrigemData?.nome || "outra conta"}`,
          valor: valorNum,
          data_vencimento: dataTransferencia,
          data_pagamento: dataTransferencia,
          data_competencia: dataTransferencia,
          status: "pago",
          conta_id: contaDestino,
          categoria_id: categoriaTransferencia.id,
          transferencia_id: transferencia.id,
          igreja_id: igrejaId!,
          filial_id: !isAllFiliais ? filialId : null,
        })
        .select("id")
        .single();

      if (errEntrada) throw errEntrada;

      // 4. Atualizar a transferência com os IDs das transações
      await supabase
        .from("transferencias_contas")
        .update({
          transacao_saida_id: transacaoSaida.id,
          transacao_entrada_id: transacaoEntrada.id,
        })
        .eq("id", transferencia.id);

      // 5. Atualizar saldos das contas
      if (contaOrigemData) {
        await supabase
          .from("contas")
          .update({ saldo_atual: (contaOrigemData.saldo_atual || 0) - valorNum })
          .eq("id", contaOrigem);
      }

      if (contaDestinoData) {
        await supabase
          .from("contas")
          .update({
            saldo_atual: (contaDestinoData.saldo_atual || 0) + valorNum,
          })
          .eq("id", contaDestino);
      }

      toast.success("Transferência realizada com sucesso!");

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ["contas"] });
      queryClient.invalidateQueries({ queryKey: ["transacoes"] });
      queryClient.invalidateQueries({ queryKey: ["transferencias"] });

      onOpenChange(false);
    } catch (error) {
      console.error("Erro na transferência:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao realizar transferência"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{
        className: "max-w-lg max-h-[90vh] overflow-hidden flex flex-col",
      }}
      drawerContentProps={{
        className: "max-h-[95vh]",
      }}
    >
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Transferência entre Contas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Movimentação interna que não afeta o DRE
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Seleção de Contas */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Label>Conta Origem *</Label>
                <Select value={contaOrigem} onValueChange={setContaOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="De onde sai" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas
                      ?.filter((c) => c.id !== contaDestino)
                      .map((conta) => (
                        <SelectItem key={conta.id} value={conta.id}>
                          <div className="flex flex-col">
                            <span>{conta.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              Saldo: {formatCurrency(conta.saldo_atual || 0)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <ArrowRight className="w-5 h-5 text-muted-foreground mt-6" />

              <div className="flex-1 space-y-2">
                <Label>Conta Destino *</Label>
                <Select value={contaDestino} onValueChange={setContaDestino}>
                  <SelectTrigger>
                    <SelectValue placeholder="Para onde vai" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas
                      ?.filter((c) => c.id !== contaOrigem)
                      .map((conta) => (
                        <SelectItem key={conta.id} value={conta.id}>
                          <div className="flex flex-col">
                            <span>{conta.nome}</span>
                            <span className="text-xs text-muted-foreground">
                              Saldo: {formatCurrency(conta.saldo_atual || 0)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Valor e Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={dataTransferencia}
                  onChange={(e) => setDataTransferencia(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Preview */}
            {contaOrigem && contaDestino && valor && (
              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                <p className="font-medium mb-2">Resumo da transferência:</p>
                <div className="space-y-1 text-muted-foreground">
                  <p>
                    <span className="text-destructive">
                      - {formatCurrency(parseFloat(valor.replace(",", ".")) || 0)}
                    </span>{" "}
                    de <strong>{contaOrigemData?.nome}</strong>
                  </p>
                  <p>
                    <span className="text-green-600">
                      + {formatCurrency(parseFloat(valor.replace(",", ".")) || 0)}
                    </span>{" "}
                    para <strong>{contaDestinoData?.nome}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Depósito de ofertas do domingo"
                rows={2}
              />
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !contaOrigem || !contaDestino || !valor}
                className="bg-gradient-primary"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Transferindo...
                  </>
                ) : (
                  "Confirmar Transferência"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
