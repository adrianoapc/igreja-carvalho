import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useHideValues } from "@/hooks/useHideValues";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Split,
} from "lucide-react";

interface ExtratoItem {
  id: string;
  conta_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
}

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
  categorias_financeiras?: { nome: string } | null;
}

interface DividirExtratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extrato: ExtratoItem | null;
  onSuccess: () => void;
}

export function DividirExtratoDialog({
  open,
  onOpenChange,
  extrato,
  onSuccess,
}: DividirExtratoDialogProps) {
  const { formatValue } = useHideValues();
  const { igrejaId } = useIgrejaId();
  const { filialId, isAllFiliais } = useFilialId();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransacoes, setSelectedTransacoes] = useState<
    Map<string, { transacao: Transacao; valor: number }>
  >(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch transactions
  const { data: transacoes, isLoading: loadingTransacoes } = useQuery({
    queryKey: ["transacoes-divisao", igrejaId, filialId, isAllFiliais, extrato?.conta_id],
    queryFn: async () => {
      if (!igrejaId || !extrato) return [];
      const dataInicio = format(subDays(new Date(), 90), "yyyy-MM-dd");
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          "id, descricao, valor, tipo, data_pagamento, conta_id, categorias_financeiras(nome)"
        )
        .eq("igreja_id", igrejaId)
        .eq("status", "pago")
        .gte("data_pagamento", dataInicio)
        .order("data_pagamento", { ascending: false })
        .limit(200);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      // Match tipo (débito extrato = saída sistema, crédito extrato = entrada sistema)
      const tipoExtrato = extrato.tipo?.toLowerCase();
      if (tipoExtrato === "debit" || tipoExtrato === "debito") {
        query = query.eq("tipo", "saida");
      } else if (tipoExtrato === "credit" || tipoExtrato === "credito") {
        query = query.eq("tipo", "entrada");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transacao[];
    },
    enabled: open && !!igrejaId && !!extrato,
  });

  // Filter transactions
  const filteredTransacoes = useMemo(() => {
    if (!transacoes) return [];
    if (!searchTerm) return transacoes;

    const search = searchTerm.toLowerCase();
    return transacoes.filter(
      (t) =>
        t.descricao.toLowerCase().includes(search) ||
        t.categorias_financeiras?.nome.toLowerCase().includes(search)
    );
  }, [transacoes, searchTerm]);

  // Calculate totals
  const { somaSelected, diferenca, isBalanced } = useMemo(() => {
    const soma = Array.from(selectedTransacoes.values()).reduce(
      (acc, item) => acc + item.valor,
      0
    );
    const valorExtrato = Math.abs(extrato?.valor || 0);
    const diff = valorExtrato - soma;
    return {
      somaSelected: soma,
      diferenca: diff,
      isBalanced: Math.abs(diff) < 0.01,
    };
  }, [selectedTransacoes, extrato?.valor]);

  const handleToggleTransacao = (transacao: Transacao) => {
    const newMap = new Map(selectedTransacoes);
    if (newMap.has(transacao.id)) {
      newMap.delete(transacao.id);
    } else {
      newMap.set(transacao.id, {
        transacao,
        valor: Number(transacao.valor),
      });
    }
    setSelectedTransacoes(newMap);
  };

  const handleValorChange = (transacaoId: string, novoValor: number) => {
    const item = selectedTransacoes.get(transacaoId);
    if (!item) return;

    const newMap = new Map(selectedTransacoes);
    newMap.set(transacaoId, { ...item, valor: novoValor });
    setSelectedTransacoes(newMap);
  };

  const handleConfirmar = async () => {
    if (!extrato || !igrejaId || selectedTransacoes.size === 0) return;

    if (!isBalanced) {
      toast.error("A soma dos valores deve ser igual ao valor do extrato");
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Create divisao record
      const { data: divisao, error: divisaoError } = await supabase
        .from("conciliacoes_divisao")
        .insert({
          extrato_id: extrato.id,
          igreja_id: igrejaId,
          filial_id: filialId || null,
          conta_id: extrato.conta_id,
          valor_extrato: Math.abs(extrato.valor),
          status: "conciliada",
          created_by: user?.id,
        })
        .select("id")
        .single();

      if (divisaoError) {
        console.error("Erro ao criar divisão:", divisaoError);
        throw divisaoError;
      }

      // Create transaction links
      const transacoesLinks = Array.from(selectedTransacoes.entries()).map(
        ([transacaoId, item]) => ({
          conciliacao_divisao_id: divisao.id,
          transacao_id: transacaoId,
          valor: item.valor,
        })
      );

      const { error: linksError } = await supabase
        .from("conciliacoes_divisao_transacoes")
        .insert(transacoesLinks);

      if (linksError) {
        console.error("Erro ao vincular transações:", linksError);
        throw linksError;
      }

      toast.success(
        `Extrato dividido em ${selectedTransacoes.size} transações`
      );
      setSelectedTransacoes(new Map());
      setSearchTerm("");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error("Erro ao dividir extrato:", err);
      toast.error("Erro ao dividir extrato");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTransacoes(new Map());
    setSearchTerm("");
    onOpenChange(false);
  };

  if (!extrato) return null;

  const valorExtrato = Math.abs(extrato.valor);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="w-5 h-5" />
            Dividir Extrato em Múltiplas Transações
          </DialogTitle>
          <DialogDescription>
            Vincule um extrato bancário a várias transações do sistema
          </DialogDescription>
        </DialogHeader>

        {/* Extrato Info */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Extrato Bancário</p>
              <p className="font-medium">{extrato.descricao}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-bold text-lg">{formatValue(valorExtrato)}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Transactions List */}
        <ScrollArea className="flex-1 max-h-[300px] border rounded-lg">
          {loadingTransacoes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="text-sm">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {filteredTransacoes.map((transacao) => {
                const isSelected = selectedTransacoes.has(transacao.id);
                const selectedItem = selectedTransacoes.get(transacao.id);

                return (
                  <div
                    key={transacao.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleTransacao(transacao)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm truncate">
                            {transacao.descricao}
                          </p>
                          <Badge
                            variant="outline"
                            className={
                              transacao.tipo === "entrada"
                                ? "text-green-600 border-green-600"
                                : "text-red-600 border-red-600"
                            }
                          >
                            {formatValue(Number(transacao.valor))}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {format(
                              parseISO(transacao.data_pagamento),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )}
                          </span>
                          {transacao.categorias_financeiras?.nome && (
                            <Badge variant="secondary" className="text-xs">
                              {transacao.categorias_financeiras.nome}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Valor customizado quando selecionado */}
                    {isSelected && (
                      <div className="mt-3 ml-8 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Valor a conciliar:
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedItem?.valor || 0}
                          onChange={(e) =>
                            handleValorChange(
                              transacao.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-32 h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Summary */}
        <div
          className={`p-4 rounded-lg border ${
            isBalanced
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
          }`}
        >
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Valor Extrato</p>
              <p className="font-bold">{formatValue(valorExtrato)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Soma Selecionadas</p>
              <p className="font-bold">{formatValue(somaSelected)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Diferença</p>
              <p
                className={`font-bold ${
                  isBalanced ? "text-green-600" : "text-orange-600"
                }`}
              >
                {formatValue(diferenca)}
                {isBalanced && (
                  <CheckCircle2 className="inline-block w-4 h-4 ml-1" />
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={loading || !isBalanced || selectedTransacoes.size === 0}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirmando...
              </>
            ) : (
              <>
                <Split className="w-4 h-4 mr-2" />
                Confirmar Divisão ({selectedTransacoes.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
