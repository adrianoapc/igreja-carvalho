import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import {
  Loader2,
  Search,
  Link2,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from "lucide-react";

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
  categorias_financeiras?: { nome: string } | null;
}

interface ExtratoItem {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  reconciliado: boolean;
  transacao_vinculada_id?: string | null;
}

interface VincularTransacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extrato: ExtratoItem;
  onVinculado: () => void;
}

export function VincularTransacaoDialog({
  open,
  onOpenChange,
  extrato,
  onVinculado,
}: VincularTransacaoDialogProps) {
  const { formatValue } = useHideValues();
  const { igrejaId } = useIgrejaId();
  const { filialId, isAllFiliais } = useFilialId();
  const [loading, setLoading] = useState(false);
  const [selectedTransacaoId, setSelectedTransacaoId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Calculate date window (±60 days from extrato date)
  const dateWindow = useMemo(() => {
    const dataExtrato = parseISO(extrato.data_transacao);
    return {
      inicio: format(subDays(dataExtrato, 60), "yyyy-MM-dd"),
      fim: format(addDays(dataExtrato, 60), "yyyy-MM-dd"),
      inicioFormatado: format(subDays(dataExtrato, 60), "dd/MM", {
        locale: ptBR,
      }),
      fimFormatado: format(addDays(dataExtrato, 60), "dd/MM/yyyy", {
        locale: ptBR,
      }),
    };
  }, [extrato.data_transacao]);

  // Fetch available transactions with flexible date window
  const { data: transacoesDisponiveis = [], isLoading: loadingTransacoes } =
    useQuery({
      queryKey: [
        "transacoes-para-vincular",
        extrato.id,
        igrejaId,
        filialId,
        isAllFiliais,
        dateWindow.inicio,
        dateWindow.fim,
      ],
      queryFn: async () => {
        if (!igrejaId) return [];

        // Build transaction query
        let transacaoQuery = supabase
          .from("transacoes_financeiras")
          .select(
            "id, descricao, valor, tipo, data_pagamento, categorias_financeiras(nome)",
          )
          .eq("igreja_id", igrejaId)
          .eq("status", "pago")
          .gte("data_pagamento", dateWindow.inicio)
          .lte("data_pagamento", dateWindow.fim)
          .order("data_pagamento", { ascending: false });

        if (!isAllFiliais && filialId) {
          transacaoQuery = transacaoQuery.eq("filial_id", filialId);
        }

        const { data: transacoes, error: transacoesError } =
          await transacaoQuery;

        if (transacoesError) {
          console.error("Erro ao buscar transações:", transacoesError);
          return [];
        }

        // Fetch already linked transaction IDs
        const { data: vinculados, error: vinculadosError } = await supabase
          .from("extratos_bancarios")
          .select("transacao_vinculada_id")
          .not("transacao_vinculada_id", "is", null);

        if (vinculadosError) {
          console.error("Erro ao buscar vinculados:", vinculadosError);
        }

        const idsVinculados = new Set(
          vinculados?.map((e) => e.transacao_vinculada_id).filter(Boolean) ||
            [],
        );

        // Filter out already linked transactions
        return (transacoes || []).filter(
          (t) => !idsVinculados.has(t.id),
        ) as Transacao[];
      },
      enabled: open && !!igrejaId,
    });

  // Calculate matching score for each transaction
  const transacoesComScore = useMemo(() => {
    const tipoExtrato =
      extrato.tipo === "credito" || extrato.tipo === "CREDIT"
        ? "entrada"
        : "saida";

    return transacoesDisponiveis
      .map((t) => {
        let score = 0;

        // Type match (40 points)
        if (t.tipo === tipoExtrato) {
          score += 40;
        }

        // Value match (40 points)
        const diferencaValor = Math.abs(Number(t.valor) - extrato.valor);
        if (diferencaValor === 0) {
          score += 40;
        } else if (diferencaValor <= 1) {
          score += 30;
        } else if (diferencaValor <= 10) {
          score += 20;
        } else if (diferencaValor <= 50) {
          score += 10;
        }

        // Date match (20 points)
        try {
          if (t.data_pagamento) {
            const dataExtrato = parseISO(extrato.data_transacao);
            const dataTransacao = parseISO(t.data_pagamento);
            const diffDias = Math.abs(
              differenceInDays(dataExtrato, dataTransacao),
            );

            if (diffDias === 0) {
              score += 20;
            } else if (diffDias <= 1) {
              score += 15;
            } else if (diffDias <= 3) {
              score += 10;
            } else if (diffDias <= 7) {
              score += 5;
            }
          }
        } catch {
          // Invalid date
        }

        return { ...t, score };
      })
      .filter((t) => {
        // Filter by search term
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          t.descricao.toLowerCase().includes(search) ||
          t.categorias_financeiras?.nome.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => b.score - a.score);
  }, [transacoesDisponiveis, extrato, searchTerm]);

  const handleVincular = async () => {
    if (!selectedTransacaoId) {
      toast.error("Selecione uma transação para vincular");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({
          transacao_vinculada_id: selectedTransacaoId,
          reconciliado: true,
        })
        .eq("id", extrato.id);

      if (error) {
        console.error("Erro ao vincular:", error);
        toast.error("Erro ao vincular transação");
        return;
      }

      toast.success("Transação vinculada com sucesso!");
      onVinculado();
      onOpenChange(false);
    } catch (err) {
      console.error("Exceção ao vincular:", err);
      toast.error("Erro ao vincular transação");
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return <Badge className="bg-green-500 text-white">Alta ({score}%)</Badge>;
    } else if (score >= 50) {
      return (
        <Badge className="bg-yellow-500 text-white">Média ({score}%)</Badge>
      );
    } else {
      return <Badge variant="secondary">Baixa ({score}%)</Badge>;
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={null}
      dialogContentProps={{
        className: "max-w-xl max-h-[85vh] overflow-hidden flex flex-col",
      }}
    >
      <div className="space-y-4 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Vincular Transação</h2>
        </div>

        {/* Extrato Data */}
        <div
          className={`p-3 rounded-lg border ${
            extrato.tipo === "credito" || extrato.tipo === "CREDIT"
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}
        >
          <p className="text-xs text-muted-foreground mb-1">
            Extrato Bancário a Vincular:
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{extrato.descricao}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </p>
            </div>
            <p
              className={`font-bold ${
                extrato.tipo === "credito" || extrato.tipo === "CREDIT"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatValue(extrato.valor)}
            </p>
          </div>
        </div>

        {/* Date Range Indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Buscando: {dateWindow.inicioFormatado} a {dateWindow.fimFormatado}
          </Badge>
          <span className="text-xs text-muted-foreground">(±60 dias)</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Transaction List */}
        <ScrollArea className="flex-1 min-h-0 max-h-[280px] border rounded-lg">
          {loadingTransacoes ? (
            <div className="flex items-center justify-center h-full p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : transacoesComScore.length > 0 ? (
            <RadioGroup
              value={selectedTransacaoId || ""}
              onValueChange={setSelectedTransacaoId}
              className="p-2 space-y-2"
            >
              {transacoesComScore.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTransacaoId === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedTransacaoId(t.id)}
                >
                  <RadioGroupItem value={t.id} id={t.id} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <Label
                        htmlFor={t.id}
                        className="font-medium text-sm cursor-pointer break-words"
                      >
                        {t.descricao}
                      </Label>
                      {getScoreBadge(t.score)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.data_pagamento && (
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(t.data_pagamento), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </span>
                      )}
                      {t.categorias_financeiras && (
                        <Badge variant="outline" className="text-xs">
                          {t.categorias_financeiras.nome}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p
                    className={`font-bold text-sm whitespace-nowrap shrink-0 ${
                      t.tipo === "entrada" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatValue(Number(t.valor))}
                  </p>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma transação candidata encontrada
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Verifique se há transações pagas no período
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleVincular}
            disabled={loading || !selectedTransacaoId}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Confirmar Vinculação
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
