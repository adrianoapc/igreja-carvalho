import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Calendar,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { exportToExcel } from "@/lib/exportUtils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MESES,
  formatCurrencyDre,
  processarDados,
  calcularResultadoLiquido,
  type DreItem,
} from "./lib/dreCalculos";
import { ResultadoLiquidoCard } from "./components/ResultadoLiquidoCard";
import { SecaoDreCard } from "./components/SecaoDreCard";

/**
 * DRE Gerencial — F7 frente 4 (DRE mobile em cards). Desktop/tablet mantêm a
 * tabela original (12 meses + total, `overflow-x-auto`); mobile (<768px)
 * usa uma lista de cards resumidos por seção com drill-down (mesmo padrão
 * "listas em cards" já elogiado em Entradas/Saídas — §6.2/§6.5), sem perder
 * nenhum dado: o Resultado Líquido continua sempre visível e cada seção
 * expande pro detalhe mensal + por categoria.
 */
export function DRE() {
  const navigate = useNavigate();
  const { igrejaId, loading: authLoading } = useAuthContext();
  const isMobile = useIsMobile();
  const currentYear = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState(currentYear);
  // Regime do DRE (F2.5/ADR-001): caixa = apenas pagos (comportamento
  // histórico); competência = tudo que compete ao período, exceto cancelados.
  const [regime, setRegime] = useState<"caixa" | "competencia">("caixa");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  const { data: dreData, isLoading } = useQuery({
    queryKey: ["dre-anual", anoSelecionado, regime, igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_dre_anual", {
        p_ano: anoSelecionado,
        p_regime: regime,
      });
      if (error) throw error;
      return data as DreItem[];
    },
    enabled: !authLoading && !!igrejaId,
  });

  // Processar e agrupar dados
  const dadosAgrupados = processarDados(dreData || []);
  const resultadoLiquido = calcularResultadoLiquido(dadosAgrupados);

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  const handleExport = () => {
    if (!dadosAgrupados.length) {
      toast.error("Não há dados para exportar");
      return;
    }

    const exportData: Array<Record<string, string | number>> = [];

    dadosAgrupados.forEach((secao) => {
      // Header da seção
      exportData.push({
        Categoria: `=== ${secao.secao} ===`,
        Jan: "",
        Fev: "",
        Mar: "",
        Abr: "",
        Mai: "",
        Jun: "",
        Jul: "",
        Ago: "",
        Set: "",
        Out: "",
        Nov: "",
        Dez: "",
        "Total Ano": "",
      });

      secao.categorias.forEach((cat) => {
        exportData.push({
          Categoria: cat.categoria_nome,
          Jan: cat.valores[1] || 0,
          Fev: cat.valores[2] || 0,
          Mar: cat.valores[3] || 0,
          Abr: cat.valores[4] || 0,
          Mai: cat.valores[5] || 0,
          Jun: cat.valores[6] || 0,
          Jul: cat.valores[7] || 0,
          Ago: cat.valores[8] || 0,
          Set: cat.valores[9] || 0,
          Out: cat.valores[10] || 0,
          Nov: cat.valores[11] || 0,
          Dez: cat.valores[12] || 0,
          "Total Ano": cat.totalAno,
        });
      });
    });

    // Linha de resultado
    exportData.push({
      Categoria: "RESULTADO LÍQUIDO",
      Jan: resultadoLiquido[1] || 0,
      Fev: resultadoLiquido[2] || 0,
      Mar: resultadoLiquido[3] || 0,
      Abr: resultadoLiquido[4] || 0,
      Mai: resultadoLiquido[5] || 0,
      Jun: resultadoLiquido[6] || 0,
      Jul: resultadoLiquido[7] || 0,
      Ago: resultadoLiquido[8] || 0,
      Set: resultadoLiquido[9] || 0,
      Out: resultadoLiquido[10] || 0,
      Nov: resultadoLiquido[11] || 0,
      Dez: resultadoLiquido[12] || 0,
      "Total Ano": Object.values(resultadoLiquido).reduce((a, b) => a + b, 0),
    });

    try {
      exportToExcel(exportData, `DRE_${anoSelecionado}`, "DRE");
      toast.success("DRE exportado com sucesso");
    } catch (error) {
      toast.error("Erro ao exportar DRE");
    }
  };

  const anos = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const totalResultado = Object.values(resultadoLiquido).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/financas")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              DRE Gerencial
            </h1>
            <p className="text-sm text-muted-foreground">
              Demonstrativo de Resultado do Exercício
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select
            value={regime}
            onValueChange={(v) => setRegime(v as "caixa" | "competencia")}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="caixa">Regime de Caixa</SelectItem>
              <SelectItem value="competencia">Competência</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={anoSelecionado.toString()}
            onValueChange={(v) => setAnoSelecionado(Number(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((ano) => (
                <SelectItem key={ano} value={ano.toString()}>
                  {ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleExport}
            disabled={isLoading || !dreData?.length}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Period Badge */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5">
          <Calendar className="w-3 h-3" />
          Exercício {anoSelecionado}
        </Badge>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* Mobile: lista de cards — Resultado Líquido sempre visível no
           topo, uma seção por card com drill-down (meses + categorias). */
        <div className="space-y-3">
          <ResultadoLiquidoCard
            resultadoLiquido={resultadoLiquido}
            totalAno={totalResultado}
          />
          {dadosAgrupados.map((secao) => (
            <SecaoDreCard
              key={secao.secao}
              secao={secao}
              isExpanded={expandedSections.has(secao.secao)}
              onToggle={() => toggleSection(secao.secao)}
            />
          ))}
        </div>
      ) : (
        /* Desktop/tablet: tabela original */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              DRE {anoSelecionado}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[200px] font-semibold">
                    Categoria
                  </TableHead>
                  {MESES.map((mes) => (
                    <TableHead
                      key={mes}
                      className="text-right min-w-[80px] font-semibold"
                    >
                      {mes}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[100px] font-bold bg-muted">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosAgrupados.map((secao) => {
                  const isExpanded = expandedSections.has(secao.secao);
                  return (
                    <>
                      {/* Header da Seção com totais - Colapsável */}
                      <TableRow
                        key={secao.secao}
                        className="bg-primary/10 hover:bg-primary/15 cursor-pointer"
                        onClick={() => toggleSection(secao.secao)}
                      >
                        <TableCell className="font-bold text-primary py-3 flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 flex-shrink-0" />
                          )}
                          <span>{secao.secao || "Sem Classificação"}</span>
                        </TableCell>
                        {MESES.map((_, idx) => {
                          const valor = secao.totaisMes[idx + 1] || 0;
                          return (
                            <TableCell
                              key={idx}
                              className={cn(
                                "text-right font-semibold text-sm tabular-nums",
                                valor === 0 && "text-muted-foreground/40",
                                valor < 0 && "text-destructive",
                                valor > 0 && "text-green-600",
                              )}
                            >
                              {formatCurrencyDre(valor)}
                            </TableCell>
                          );
                        })}
                        <TableCell
                          className={cn(
                            "text-right font-bold tabular-nums bg-muted/50",
                            secao.totalAno < 0 && "text-destructive",
                            secao.totalAno > 0 && "text-green-600",
                          )}
                        >
                          {formatCurrencyDre(secao.totalAno)}
                        </TableCell>
                      </TableRow>
                      {/* Categorias detalhadas - Mostradas quando expandida */}
                      {isExpanded &&
                        secao.categorias.map((cat) => (
                          <TableRow
                            key={cat.categoria_id}
                            className="hover:bg-muted/30 bg-muted/10"
                          >
                            <TableCell className="pl-10 text-sm text-muted-foreground">
                              {cat.categoria_nome}
                            </TableCell>
                            {MESES.map((_, idx) => {
                              const valor = cat.valores[idx + 1] || 0;
                              return (
                                <TableCell
                                  key={idx}
                                  className={cn(
                                    "text-right text-xs tabular-nums",
                                    valor === 0 && "text-muted-foreground/40",
                                    valor < 0 && "text-destructive",
                                    valor > 0 && "text-green-600",
                                  )}
                                >
                                  {formatCurrencyDre(valor)}
                                </TableCell>
                              );
                            })}
                            <TableCell
                              className={cn(
                                "text-right text-xs font-medium tabular-nums",
                                cat.totalAno < 0 && "text-destructive",
                                cat.totalAno > 0 && "text-green-600",
                              )}
                            >
                              {formatCurrencyDre(cat.totalAno)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </>
                  );
                })}
                {/* Resultado Líquido */}
                <TableRow className="bg-card border-t-4 border-primary">
                  <TableCell className="font-bold text-lg py-4">
                    RESULTADO LÍQUIDO
                  </TableCell>
                  {MESES.map((_, idx) => {
                    const valor = resultadoLiquido[idx + 1] || 0;
                    return (
                      <TableCell
                        key={idx}
                        className={cn(
                          "text-right font-bold text-lg tabular-nums py-4",
                          valor === 0 && "text-muted-foreground/40",
                          valor < 0 && "text-destructive",
                          valor > 0 && "text-green-600",
                        )}
                      >
                        {formatCurrencyDre(valor)}
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className={cn(
                      "text-right font-bold text-lg tabular-nums bg-muted py-4",
                      totalResultado < 0 && "text-destructive",
                      totalResultado > 0 && "text-green-600",
                    )}
                  >
                    {formatCurrencyDre(totalResultado)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
