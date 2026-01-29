import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { useConciliacaoLote } from "@/hooks/useConciliacaoLote";
import { anonymizePixDescription } from "@/utils/anonymization";
import {
  Loader2,
  Search,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  X,
} from "lucide-react";

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
  categorias_financeiras?: { nome: string } | null;
  conta_id?: string | null;
}

interface ConciliacaoLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transacao: Transacao;
  onConciliado: () => void;
}

export function ConciliacaoLoteDialog({
  open,
  onOpenChange,
  transacao,
  onConciliado,
}: ConciliacaoLoteDialogProps) {
  const { formatValue } = useHideValues();
  
  // Date range state - default to ±3 days from transaction
  const [dataInicio, setDataInicio] = useState(
    format(subDays(parseISO(transacao.data_pagamento), 3), "yyyy-MM-dd")
  );
  const [dataFim, setDataFim] = useState(
    format(addDays(parseISO(transacao.data_pagamento), 3), "yyyy-MM-dd")
  );

  const {
    extratosDisponiveis,
    loadingExtratos,
    selectedExtratos,
    somaSelecionados,
    valorTransacao,
    diferenca,
    searchTerm,
    setSearchTerm,
    tipoFiltro,
    setTipoFiltro,
    toggleExtrato,
    selectAll,
    clearSelection,
    createLote,
    isCreating,
  } = useConciliacaoLote({
    transacao,
    dataInicio,
    dataFim,
  });

  const handleConfirmar = async () => {
    try {
      await createLote();
      onConciliado();
      onOpenChange(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const diferencaAbs = Math.abs(diferenca);
  const isExact = diferencaAbs < 0.01;
  const isClose = diferencaAbs <= 1 && !isExact;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={null}
      dialogContentProps={{ className: "max-w-2xl max-h-[90vh]" }}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Conciliar em Lote</h2>
        </div>

        {/* Transaction Info */}
        <div
          className={`p-3 rounded-lg border ${
            transacao.tipo === "entrada"
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}
        >
          <p className="text-xs text-muted-foreground mb-1">
            Transação a Conciliar:
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{transacao.descricao}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {format(parseISO(transacao.data_pagamento), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}
                </span>
                {transacao.categorias_financeiras && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs">
                      {transacao.categorias_financeiras.nome}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <p
              className={`font-bold text-lg ${
                transacao.tipo === "entrada" ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatValue(valorTransacao)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Compatível</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={selectAll}
            disabled={extratosDisponiveis.length === 0}
          >
            <ListChecks className="w-4 h-4 mr-1" />
            Selecionar Todos ({extratosDisponiveis.length})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            disabled={selectedExtratos.size === 0}
          >
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        </div>

        {/* Statements List */}
        <ScrollArea className="h-[250px] border rounded-lg">
          {loadingExtratos ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : extratosDisponiveis.length > 0 ? (
            <div className="p-2 space-y-1">
              {extratosDisponiveis.map((extrato) => {
                const isSelected = selectedExtratos.has(extrato.id);
                return (
                  <div
                    key={extrato.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => toggleExtrato(extrato.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleExtrato(extrato.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {anonymizePixDescription(extrato.descricao)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {format(
                            parseISO(extrato.data_transacao),
                            "dd/MM HH:mm",
                            { locale: ptBR }
                          )}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {extrato.tipo === "credito" ||
                          extrato.tipo === "CREDIT"
                            ? "Crédito"
                            : "Débito"}
                        </Badge>
                      </div>
                    </div>
                    <p
                      className={`font-bold text-sm ${
                        extrato.tipo === "credito" ||
                        extrato.tipo === "CREDIT"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatValue(Math.abs(extrato.valor))}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum extrato encontrado no período
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajuste as datas ou verifique se há extratos pendentes
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Summary */}
        <div
          className={`p-4 rounded-lg border ${
            isExact
              ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-700"
              : isClose
              ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300 dark:border-yellow-700"
              : "bg-muted/50 border-border"
          }`}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Selecionados</p>
              <p className="font-bold text-lg">{selectedExtratos.size}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Soma Extratos</p>
              <p className="font-bold text-lg">
                {formatValue(somaSelecionados)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Diferença</p>
              <p
                className={`font-bold text-lg ${
                  isExact
                    ? "text-green-600"
                    : diferenca > 0
                    ? "text-orange-600"
                    : "text-red-600"
                }`}
              >
                {diferenca > 0 ? "-" : "+"}
                {formatValue(diferencaAbs)}
              </p>
            </div>
          </div>
          {isExact && (
            <div className="flex items-center justify-center gap-2 mt-2 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Valores conferem!</span>
            </div>
          )}
          {!isExact && diferenca > 0 && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Faltam {formatValue(diferencaAbs)} para bater com a transação
            </p>
          )}
          {!isExact && diferenca < 0 && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Excede em {formatValue(diferencaAbs)} o valor da transação
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={isCreating || selectedExtratos.size === 0}
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            {isExact
              ? "Confirmar Conciliação"
              : "Confirmar com Discrepância"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
