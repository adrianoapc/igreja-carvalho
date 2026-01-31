import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";
import {
  exportToExcel,
  formatDateForExport,
  formatCurrencyForExport,
} from "@/lib/exportUtils";
import {
  Download,
  Calendar as CalendarIcon,
  AlertCircle,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type TipoExportacao =
  | "entradas"
  | "saidas"
  | "dre"
  | "contas"
  | "categorias"
  | "fornecedores";
type StatusFiltro = "todos" | "pago" | "pendente" | "atrasado";

type TransacaoExportacao = {
  id: string;
  descricao: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  data_competencia?: string | null;
  observacoes?: string | null;
  forma_pagamento?: string | null;
  conta?: { nome: string } | null;
  categoria?: { nome: string } | null;
  subcategoria?: { nome: string } | null;
  fornecedor?: { nome: string } | null;
  base_ministerial?: { titulo: string } | null;
  centro_custo?: { nome: string } | null;
};

const COLUNAS_DISPONIVEIS = [
  { id: "descricao", label: "Descrição" },
  { id: "valor", label: "Valor" },
  { id: "status", label: "Status" },
  { id: "data_vencimento", label: "Data Vencimento" },
  { id: "data_pagamento", label: "Data Pagamento" },
  { id: "conta", label: "Conta" },
  { id: "categoria", label: "Categoria" },
  { id: "subcategoria", label: "Subcategoria" },
  { id: "fornecedor", label: "Fornecedor" },
  { id: "base_ministerial", label: "Base Ministerial" },
  { id: "centro_custo", label: "Centro de Custo" },
  { id: "forma_pagamento", label: "Forma Pagamento" },
  { id: "observacoes", label: "Observações" },
];

export function ExportarTab() {
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get("tipo");
  const tipoInicial: TipoExportacao =
    tipoParam === "saidas" || tipoParam === "saida" ? "saidas" : "entradas";
  const [tipoExportacao, setTipoExportacao] = useState<TipoExportacao>(
    tipoInicial
  );
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [dataFim, setDataFim] = useState<Date | undefined>(new Date());
  const [contaFiltro, setContaFiltro] = useState<string>("todas");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [colunasSelecionadas, setColunasSelecionadas] = useState<string[]>(
    COLUNAS_DISPONIVEIS.map((c) => c.id)
  );

  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: filialLoading,
  } = useFilialId();

  // Query para contas
  const { data: contas = [] } = useQuery({
    queryKey: ["contas-exportacao", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !filialLoading,
  });

  // Query para categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-exportacao", igrejaId, tipoExportacao],
    queryFn: async () => {
      if (!igrejaId) return [];
      const tipo = tipoExportacao === "entradas" ? "entrada" : "saida";
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("ativo", true)
        .eq("tipo", tipo)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled:
      !!igrejaId &&
      (tipoExportacao === "entradas" || tipoExportacao === "saidas"),
  });

  // Query para dados de exportação
  const { data: transacoes = [], isLoading } = useQuery<TransacaoExportacao[]>({
    queryKey: [
      "dados-exportacao",
      igrejaId,
      filialId,
      isAllFiliais,
      tipoExportacao,
      statusFiltro,
      dataInicio,
      dataFim,
      contaFiltro,
      categoriaFiltro,
    ],
    queryFn: async () => {
      if (
        !igrejaId ||
        tipoExportacao === "dre" ||
        tipoExportacao === "contas" ||
        tipoExportacao === "categorias" ||
        tipoExportacao === "fornecedores"
      )
        return [];

      const tipo = tipoExportacao === "entradas" ? "entrada" : "saida";
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          `
          id,
          descricao,
          valor,
          status,
          data_vencimento,
          data_pagamento,
          data_competencia,
          observacoes,
          forma_pagamento,
          conta:conta_id(nome),
          categoria:categoria_id(nome),
          subcategoria:subcategoria_id(nome),
          fornecedor:fornecedor_id(nome),
          base_ministerial:base_ministerial_id(titulo),
          centro_custo:centro_custo_id(nome)
        `
        )
        .eq("tipo", tipo)
        .eq("igreja_id", igrejaId);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      if (dataInicio) {
        query = query.gte("data_competencia", format(dataInicio, "yyyy-MM-dd"));
      }
      if (dataFim) {
        query = query.lte("data_competencia", format(dataFim, "yyyy-MM-dd"));
      }

      if (statusFiltro !== "todos") {
        if (statusFiltro === "pago") {
          query = query.eq("status", "pago");
        } else if (statusFiltro === "pendente") {
          query = query.eq("status", "pendente");
        } else if (statusFiltro === "atrasado") {
          query = query
            .eq("status", "pendente")
            .lt("data_vencimento", new Date().toISOString().split("T")[0]);
        }
      }

      if (contaFiltro !== "todas") {
        query = query.eq("conta_id", contaFiltro);
      }

      if (categoriaFiltro !== "todas") {
        query = query.eq("categoria_id", categoriaFiltro);
      }

      query = query.order("data_vencimento", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled:
      !!igrejaId &&
      !filialLoading &&
      (tipoExportacao === "entradas" || tipoExportacao === "saidas"),
  });

  const dadosPreview = useMemo(() => {
    return transacoes?.slice(0, 10) || [];
  }, [transacoes]);

  const handleExportar = () => {
    try {
      if (!transacoes || transacoes.length === 0) {
        toast.error("Não há dados para exportar");
        return;
      }

      const dadosExportacao = transacoes.map((t) => {
        const row: Record<string, string | number> = {};

        if (colunasSelecionadas.includes("descricao"))
          row.Descrição = t.descricao;
        if (colunasSelecionadas.includes("valor"))
          row.Valor = formatCurrencyForExport(t.valor);
        if (colunasSelecionadas.includes("status")) row.Status = t.status;
        if (colunasSelecionadas.includes("data_vencimento"))
          row["Data Vencimento"] = formatDateForExport(t.data_vencimento);
        if (colunasSelecionadas.includes("data_pagamento"))
          row["Data Pagamento"] = formatDateForExport(t.data_pagamento);
        if (colunasSelecionadas.includes("conta"))
          row.Conta = t.conta?.nome || "";
        if (colunasSelecionadas.includes("categoria"))
          row.Categoria = t.categoria?.nome || "";
        if (colunasSelecionadas.includes("subcategoria"))
          row.Subcategoria = t.subcategoria?.nome || "";
        if (colunasSelecionadas.includes("fornecedor"))
          row.Fornecedor = t.fornecedor?.nome || "";
        if (colunasSelecionadas.includes("base_ministerial"))
          row["Base Ministerial"] = t.base_ministerial?.titulo || "";
        if (colunasSelecionadas.includes("centro_custo"))
          row["Centro de Custo"] = t.centro_custo?.nome || "";
        if (colunasSelecionadas.includes("forma_pagamento"))
          row["Forma Pagamento"] = t.forma_pagamento || "";
        if (colunasSelecionadas.includes("observacoes"))
          row.Observações = t.observacoes || "";

        return row;
      });

      const nomeArquivo = `${tipoExportacao}_${format(
        new Date(),
        "yyyyMMdd_HHmmss"
      )}`;
      exportToExcel(
        dadosExportacao,
        nomeArquivo,
        tipoExportacao === "entradas" ? "Entradas" : "Saídas"
      );
      toast.success(`${transacoes.length} registros exportados com sucesso!`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  const toggleColuna = (colunaId: string) => {
    setColunasSelecionadas((prev) =>
      prev.includes(colunaId)
        ? prev.filter((id) => id !== colunaId)
        : [...prev, colunaId]
    );
  };

  const selecionarTodasColunas = () => {
    setColunasSelecionadas(COLUNAS_DISPONIVEIS.map((c) => c.id));
  };

  const desmarcarTodasColunas = () => {
    setColunasSelecionadas([]);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Tipo de Exportação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Configuração de Exportação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Dados</Label>
              <Select
                value={tipoExportacao}
                onValueChange={(v) => setTipoExportacao(v as TipoExportacao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entradas">Entradas</SelectItem>
                  <SelectItem value="saidas">Saídas</SelectItem>
                  <SelectItem value="dre" disabled>
                    DRE (em breve)
                  </SelectItem>
                  <SelectItem value="contas" disabled>
                    Contas (em breve)
                  </SelectItem>
                  <SelectItem value="categorias" disabled>
                    Categorias (em breve)
                  </SelectItem>
                  <SelectItem value="fornecedores" disabled>
                    Fornecedores (em breve)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusFiltro}
                onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="atrasado">Atrasados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio
                      ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim
                      ? format(dataFim, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={contaFiltro} onValueChange={setContaFiltro}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as contas</SelectItem>
                  {contas.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={categoriaFiltro}
                onValueChange={setCategoriaFiltro}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Colunas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Colunas para Exportar
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selecionarTodasColunas}
              >
                Todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={desmarcarTodasColunas}
              >
                Nenhuma
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {COLUNAS_DISPONIVEIS.map((coluna) => (
              <div key={coluna.id} className="flex items-center space-x-2">
                <Checkbox
                  id={coluna.id}
                  checked={colunasSelecionadas.includes(coluna.id)}
                  onCheckedChange={() => toggleColuna(coluna.id)}
                />
                <label
                  htmlFor={coluna.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {coluna.label}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Preview ({transacoes?.length || 0} registros encontrados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando dados...
            </div>
          ) : dadosPreview.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum registro encontrado com os filtros selecionados.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {colunasSelecionadas.includes("descricao") && (
                      <th className="px-3 py-2 text-left font-medium">
                        Descrição
                      </th>
                    )}
                    {colunasSelecionadas.includes("valor") && (
                      <th className="px-3 py-2 text-right font-medium">
                        Valor
                      </th>
                    )}
                    {colunasSelecionadas.includes("status") && (
                      <th className="px-3 py-2 text-left font-medium">
                        Status
                      </th>
                    )}
                    {colunasSelecionadas.includes("data_vencimento") && (
                      <th className="px-3 py-2 text-left font-medium">
                        Vencimento
                      </th>
                    )}
                    {colunasSelecionadas.includes("conta") && (
                      <th className="px-3 py-2 text-left font-medium">Conta</th>
                    )}
                    {colunasSelecionadas.includes("categoria") && (
                      <th className="px-3 py-2 text-left font-medium">
                        Categoria
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {dadosPreview.map((t, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/50">
                      {colunasSelecionadas.includes("descricao") && (
                        <td className="px-3 py-2">{t.descricao}</td>
                      )}
                      {colunasSelecionadas.includes("valor") && (
                        <td className="px-3 py-2 text-right">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(t.valor)}
                        </td>
                      )}
                      {colunasSelecionadas.includes("status") && (
                        <td className="px-3 py-2 capitalize">{t.status}</td>
                      )}
                      {colunasSelecionadas.includes("data_vencimento") && (
                        <td className="px-3 py-2">
                          {t.data_vencimento
                            ? format(new Date(t.data_vencimento), "dd/MM/yyyy")
                            : "—"}
                        </td>
                      )}
                      {colunasSelecionadas.includes("conta") && (
                        <td className="px-3 py-2">{t.conta?.nome || "—"}</td>
                      )}
                      {colunasSelecionadas.includes("categoria") && (
                        <td className="px-3 py-2">
                          {t.categoria?.nome || "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {transacoes && transacoes.length > 10 && (
                <div className="px-3 py-2 bg-muted text-xs text-muted-foreground border-t">
                  Mostrando 10 de {transacoes.length} registros
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão Exportar */}
      <div className="flex justify-end">
        <Button
          onClick={handleExportar}
          disabled={
            !transacoes ||
            transacoes.length === 0 ||
            colunasSelecionadas.length === 0
          }
          size="lg"
          className="bg-gradient-primary"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar {transacoes?.length || 0} registros
        </Button>
      </div>
    </div>
  );
}
