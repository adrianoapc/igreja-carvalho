import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { Loader2, Search, Link2, CheckCircle2, AlertCircle } from "lucide-react";

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
  transacoesDisponiveis: Transacao[];
  onVinculado: () => void;
}

export function VincularTransacaoDialog({
  open,
  onOpenChange,
  extrato,
  transacoesDisponiveis,
  onVinculado,
}: VincularTransacaoDialogProps) {
  const { formatValue } = useHideValues();
  const [loading, setLoading] = useState(false);
  const [selectedTransacaoId, setSelectedTransacaoId] = useState<string | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");

  // Calcular score de correspondência para cada transação
  const transacoesComScore = useMemo(() => {
    const tipoExtrato =
      extrato.tipo === "credito" || extrato.tipo === "CREDIT"
        ? "entrada"
        : "saida";

    return transacoesDisponiveis
      .map((t) => {
        let score = 0;

        // Correspondência de tipo (40 pontos)
        if (t.tipo === tipoExtrato) {
          score += 40;
        }

        // Correspondência de valor (40 pontos)
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

        // Correspondência de data (20 pontos)
        try {
          if (t.data_pagamento) {
            const dataExtrato = parseISO(extrato.data_transacao);
            const dataTransacao = parseISO(t.data_pagamento);
            const diffDias = Math.abs(differenceInDays(dataExtrato, dataTransacao));

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
          // Data inválida
        }

        return { ...t, score };
      })
      .filter((t) => {
        // Filtrar por termo de busca
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
      return (
        <Badge className="bg-green-500 text-white">Alta ({score}%)</Badge>
      );
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
      dialogContentProps={{ className: "max-w-xl max-h-[85vh] overflow-hidden flex flex-col" }}
    >
      <div className="space-y-4 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Vincular Transação</h2>
        </div>

        {/* Dados do Extrato */}
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

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista de Transações */}
        <ScrollArea className="flex-1 min-h-0 max-h-[280px] border rounded-lg">
          {transacoesComScore.length > 0 ? (
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
