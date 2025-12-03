import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { exportToExcel } from "@/lib/exportUtils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const SECOES_ORDER = [
  "Receitas Operacionais",
  "Receitas Não Operacionais",
  "Despesas com Pessoal",
  "Despesas Operacionais",
  "Despesas Não Operacionais",
  "Impostos e Taxas",
];

interface DreItem {
  secao_dre: string | null;
  categoria_nome: string;
  categoria_id: string;
  mes: number;
  total: number;
}

interface CategoriaAgrupada {
  categoria_nome: string;
  categoria_id: string;
  valores: { [mes: number]: number };
  totalAno: number;
}

interface SecaoAgrupada {
  secao: string;
  categorias: CategoriaAgrupada[];
  totaisMes: { [mes: number]: number };
  totalAno: number;
}

export default function DRE() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado] = useState(currentYear);

  const { data: dreData, isLoading } = useQuery({
    queryKey: ["dre-anual", anoSelecionado],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dre_anual", { p_ano: anoSelecionado });
      if (error) throw error;
      return data as DreItem[];
    },
  });

  // Processar e agrupar dados
  const dadosAgrupados = processarDados(dreData || []);
  const resultadoLiquido = calcularResultadoLiquido(dadosAgrupados);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || value === 0) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExport = () => {
    if (!dadosAgrupados.length) {
      toast.error("Não há dados para exportar");
      return;
    }

    const exportData: any[] = [];
    
    dadosAgrupados.forEach((secao) => {
      // Header da seção
      exportData.push({
        Categoria: `=== ${secao.secao} ===`,
        Jan: "", Fev: "", Mar: "", Abr: "", Mai: "", Jun: "",
        Jul: "", Ago: "", Set: "", Out: "", Nov: "", Dez: "",
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
  const totalResultado = Object.values(resultadoLiquido).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/financas")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">DRE Gerencial</h1>
            <p className="text-sm text-muted-foreground">Demonstrativo de Resultado do Exercício</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={anoSelecionado.toString()} onValueChange={(v) => setAnoSelecionado(Number(v))}>
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
          <Button onClick={handleExport} disabled={isLoading || !dreData?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabela DRE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            DRE {anoSelecionado}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[200px] font-semibold">Categoria</TableHead>
                  {MESES.map((mes) => (
                    <TableHead key={mes} className="text-right min-w-[80px] font-semibold">
                      {mes}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[100px] font-bold bg-muted">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosAgrupados.map((secao) => (
                  <>
                    {/* Header da Seção */}
                    <TableRow key={secao.secao} className="bg-primary/10 hover:bg-primary/15">
                      <TableCell colSpan={14} className="font-bold text-primary py-2">
                        {secao.secao || "Sem Classificação"}
                      </TableCell>
                    </TableRow>
                    {/* Categorias */}
                    {secao.categorias.map((cat) => (
                      <TableRow key={cat.categoria_id} className="hover:bg-muted/30">
                        <TableCell className="pl-6 text-sm">{cat.categoria_nome}</TableCell>
                        {MESES.map((_, idx) => {
                          const valor = cat.valores[idx + 1] || 0;
                          return (
                            <TableCell
                              key={idx}
                              className={cn(
                                "text-right text-sm tabular-nums",
                                valor === 0 && "text-muted-foreground/40",
                                valor < 0 && "text-destructive",
                                valor > 0 && "text-green-600"
                              )}
                            >
                              {formatCurrency(valor)}
                            </TableCell>
                          );
                        })}
                        <TableCell
                          className={cn(
                            "text-right font-medium tabular-nums bg-muted/30",
                            cat.totalAno < 0 && "text-destructive",
                            cat.totalAno > 0 && "text-green-600"
                          )}
                        >
                          {formatCurrency(cat.totalAno)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Subtotal da Seção */}
                    <TableRow className="bg-muted/20 border-b-2">
                      <TableCell className="font-semibold text-sm">Subtotal {secao.secao}</TableCell>
                      {MESES.map((_, idx) => {
                        const valor = secao.totaisMes[idx + 1] || 0;
                        return (
                          <TableCell
                            key={idx}
                            className={cn(
                              "text-right font-medium text-sm tabular-nums",
                              valor === 0 && "text-muted-foreground/40",
                              valor < 0 && "text-destructive",
                              valor > 0 && "text-green-600"
                            )}
                          >
                            {formatCurrency(valor)}
                          </TableCell>
                        );
                      })}
                      <TableCell
                        className={cn(
                          "text-right font-bold tabular-nums bg-muted/50",
                          secao.totalAno < 0 && "text-destructive",
                          secao.totalAno > 0 && "text-green-600"
                        )}
                      >
                        {formatCurrency(secao.totalAno)}
                      </TableCell>
                    </TableRow>
                  </>
                ))}
                {/* Resultado Líquido */}
                <TableRow className="bg-card border-t-4 border-primary">
                  <TableCell className="font-bold text-lg py-4">RESULTADO LÍQUIDO</TableCell>
                  {MESES.map((_, idx) => {
                    const valor = resultadoLiquido[idx + 1] || 0;
                    return (
                      <TableCell
                        key={idx}
                        className={cn(
                          "text-right font-bold text-lg tabular-nums py-4",
                          valor === 0 && "text-muted-foreground/40",
                          valor < 0 && "text-destructive",
                          valor > 0 && "text-green-600"
                        )}
                      >
                        {formatCurrency(valor)}
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className={cn(
                      "text-right font-bold text-lg tabular-nums bg-muted py-4",
                      totalResultado < 0 && "text-destructive",
                      totalResultado > 0 && "text-green-600"
                    )}
                  >
                    {formatCurrency(totalResultado)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function processarDados(data: DreItem[]): SecaoAgrupada[] {
  const secoesMap = new Map<string, SecaoAgrupada>();

  data.forEach((item) => {
    const secaoKey = item.secao_dre || "Outros";
    
    if (!secoesMap.has(secaoKey)) {
      secoesMap.set(secaoKey, {
        secao: secaoKey,
        categorias: [],
        totaisMes: {},
        totalAno: 0,
      });
    }

    const secao = secoesMap.get(secaoKey)!;
    
    // Encontrar ou criar categoria
    let categoria = secao.categorias.find((c) => c.categoria_id === item.categoria_id);
    if (!categoria) {
      categoria = {
        categoria_nome: item.categoria_nome,
        categoria_id: item.categoria_id,
        valores: {},
        totalAno: 0,
      };
      secao.categorias.push(categoria);
    }

    // Adicionar valor ao mês
    categoria.valores[item.mes] = (categoria.valores[item.mes] || 0) + Number(item.total);
    categoria.totalAno += Number(item.total);

    // Atualizar totais da seção
    secao.totaisMes[item.mes] = (secao.totaisMes[item.mes] || 0) + Number(item.total);
    secao.totalAno += Number(item.total);
  });

  // Ordenar seções
  const resultado = Array.from(secoesMap.values());
  resultado.sort((a, b) => {
    const idxA = SECOES_ORDER.indexOf(a.secao);
    const idxB = SECOES_ORDER.indexOf(b.secao);
    if (idxA === -1 && idxB === -1) return a.secao.localeCompare(b.secao);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  // Ordenar categorias dentro de cada seção
  resultado.forEach((secao) => {
    secao.categorias.sort((a, b) => a.categoria_nome.localeCompare(b.categoria_nome));
  });

  return resultado;
}

function calcularResultadoLiquido(secoes: SecaoAgrupada[]): { [mes: number]: number } {
  const resultado: { [mes: number]: number } = {};
  
  for (let mes = 1; mes <= 12; mes++) {
    resultado[mes] = 0;
  }

  secoes.forEach((secao) => {
    for (let mes = 1; mes <= 12; mes++) {
      resultado[mes] += secao.totaisMes[mes] || 0;
    }
  });

  return resultado;
}
