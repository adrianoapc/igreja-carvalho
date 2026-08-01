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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";
import {
  exportSheetsToExcel,
  formatDateForExport,
} from "@/lib/exportUtils";
import { Download, AlertCircle, FileSpreadsheet, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatLocalDate, parseLocalDate } from "@/utils/dateUtils";
import { MonthPicker } from "@/components/financas/MonthPicker";
import {
  MultiSelectFilter,
  type MultiSelectOption,
} from "@/components/financas/MultiSelectFilter";
import { getPeriodoRange } from "@/features/financeiro/core";

// Exportar tem um 3º eixo de data (Competência) que o resto do financeiro
// não oferece — ADR-031 manteve "Tipo de Data" (Vencimento/Pagamento) e
// "Regime" (Caixa/Competência) como conceitos ortogonais de propósito, e
// Vencimento/Pagamento é a única RPC-facing enum (fin_resumo_periodo, usada
// pelo Dashboard) que existe hoje — adicionar Competência ali quebraria essa
// RPC. Exportar não chama RPC nenhuma pra isso (query PostgREST direta), daí
// o eixo local só aqui, sem tocar no TipoDataFiltro compartilhado.
type TipoDataFiltroExport = "vencimento" | "pagamento" | "competencia";
const TIPO_DATA_FILTRO_EXPORT_DEFAULT: TipoDataFiltroExport = "vencimento";

function colunaDataFiltroExport(
  tipo: TipoDataFiltroExport,
): "data_vencimento" | "data_pagamento" | "data_competencia" {
  if (tipo === "pagamento") return "data_pagamento";
  if (tipo === "competencia") return "data_competencia";
  return "data_vencimento";
}

type TipoExportacao =
  | "entradas"
  | "saidas"
  | "dre"
  | "contas"
  | "categorias"
  | "fornecedores";
type TipoExportacaoFuncional = "entradas" | "saidas";
type StatusFiltroValor = "pago" | "pendente" | "atrasado";

const TIPO_DADOS_OPTIONS: MultiSelectOption[] = [
  { value: "entradas", label: "Entradas" },
  { value: "saidas", label: "Saídas" },
  { value: "dre", label: "DRE (em breve)", disabled: true },
  { value: "contas", label: "Contas (em breve)", disabled: true },
  { value: "categorias", label: "Categorias (em breve)", disabled: true },
  { value: "fornecedores", label: "Fornecedores (em breve)", disabled: true },
];

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "pago", label: "Pagos" },
  { value: "pendente", label: "Pendentes" },
  { value: "atrasado", label: "Atrasados" },
];

/** Combina Pendentes/Atrasados como "or" PostgREST — Atrasado é um
 * subconjunto de Pendente (status=pendente + vencimento passado), então
 * marcar os dois junto simplifica pra só "status=pendente" (sem perder
 * nenhuma linha). Retorna null = sem filtro de status (todos). */
function statusParaQuery(
  selecionados: StatusFiltroValor[],
  hoje: string,
): string | null {
  if (selecionados.length === 0) return null;
  const partes: string[] = [];
  if (selecionados.includes("pago")) partes.push("status.eq.pago");
  if (selecionados.includes("pendente")) {
    partes.push("status.eq.pendente");
  } else if (selecionados.includes("atrasado")) {
    partes.push(`and(status.eq.pendente,data_vencimento.lt.${hoje})`);
  }
  return partes.length ? partes.join(",") : null;
}

type TransacaoExportacao = {
  id: string;
  descricao: string;
  valor: number;
  valor_liquido?: number | null;
  taxas_administrativas?: number | null;
  multas?: number | null;
  juros?: number | null;
  desconto?: number | null;
  status: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  data_competencia?: string | null;
  observacoes?: string | null;
  forma_pagamento?: string | null;
  forma?: { nome: string } | null;
  conta?: { nome: string } | null;
  categoria?: { nome: string } | null;
  subcategoria?: { nome: string } | null;
  fornecedor?: { nome: string; cpf_cnpj: string | null } | null;
  base_ministerial?: { titulo: string } | null;
  centro_custo?: { nome: string } | null;
};

interface FetchTransacoesParams {
  tipo: "entrada" | "saida";
  igrejaId: string;
  filialId: string | null;
  isAllFiliais: boolean;
  periodo: { inicio: string; fim: string };
  tipoData: TipoDataFiltroExport;
  statusSelecionados: StatusFiltroValor[];
  contasSelecionadas: string[];
  categoriasSelecionadas: string[];
}

async function fetchTransacoesExportacao({
  tipo,
  igrejaId,
  filialId,
  isAllFiliais,
  periodo,
  tipoData,
  statusSelecionados,
  contasSelecionadas,
  categoriasSelecionadas,
}: FetchTransacoesParams): Promise<TransacaoExportacao[]> {
  // forma_pagamento_id ainda não consta nos tipos gerados de types.ts
  // (regenerar com `supabase gen types` após o deploy da migration).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("transacoes_financeiras")
    .select(
      `
      id,
      descricao,
      valor,
      valor_liquido,
      taxas_administrativas,
      multas,
      juros,
      desconto,
      status,
      data_vencimento,
      data_pagamento,
      data_competencia,
      observacoes,
      forma_pagamento,
      conta:conta_id(nome),
      categoria:categoria_id(nome),
      subcategoria:subcategoria_id(nome),
      fornecedor:fornecedor_id(nome, cpf_cnpj),
      base_ministerial:base_ministerial_id(titulo),
      centro_custo:centro_custo_id(nome),
      forma:forma_pagamento_id(nome)
    `,
    )
    .eq("tipo", tipo)
    .eq("igreja_id", igrejaId);

  if (!isAllFiliais && filialId) {
    query = query.eq("filial_id", filialId);
  }

  const colunaPeriodo = colunaDataFiltroExport(tipoData);
  query = query
    .gte(colunaPeriodo, periodo.inicio)
    .lte(colunaPeriodo, periodo.fim);

  if (colunaPeriodo === "data_pagamento") {
    // Data de Caixa: paid-only — mesma semântica já aplicada em
    // Dashboard/Contas/useLancamentos/Insights. Uma transação paga e
    // depois cancelada mantém data_pagamento preenchida
    // (20260728170000_fin_taxa_entrada_subtrai_liquido.sql), então sem
    // isso o export sairia com lançamentos que não valem mais. Ignora
    // statusSelecionados por completo nesse modo (mesmo comportamento
    // já existente antes do multi-select).
    query = query.eq("status", "pago");
  } else {
    const statusClause = statusParaQuery(
      statusSelecionados,
      formatLocalDate(new Date()),
    );
    if (statusClause) query = query.or(statusClause);
  }

  if (contasSelecionadas.length > 0) {
    query = query.in("conta_id", contasSelecionadas);
  }

  if (categoriasSelecionadas.length > 0) {
    query = query.in("categoria_id", categoriasSelecionadas);
  }

  query = query.order(colunaPeriodo, { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const COLUNAS_DISPONIVEIS = [
  { id: "ano", label: "Ano" },
  { id: "mes", label: "Mês" },
  { id: "cnpj", label: "CNPJ" },
  { id: "competencia", label: "Competência" },
  { id: "descricao", label: "Descrição" },
  { id: "valor", label: "Valor" },
  { id: "valor_liquido", label: "Valor Líquido" },
  { id: "taxas_administrativas", label: "Taxa Administrativa" },
  { id: "multas", label: "Multa" },
  { id: "juros", label: "Juros" },
  { id: "desconto", label: "Desconto" },
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
  const tipoInicial: TipoExportacaoFuncional =
    tipoParam === "saidas" || tipoParam === "saida" ? "saidas" : "entradas";
  const [tiposSelecionados, setTiposSelecionados] = useState<TipoExportacao[]>(
    [tipoInicial],
  );
  const [statusSelecionados, setStatusSelecionados] = useState<
    StatusFiltroValor[]
  >([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const periodo = getPeriodoRange(selectedMonth, customRange);
  const [tipoData, setTipoData] = useState<TipoDataFiltroExport>(
    TIPO_DATA_FILTRO_EXPORT_DEFAULT,
  );
  const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<
    string[]
  >([]);
  const [colunasSelecionadas, setColunasSelecionadas] = useState<string[]>(
    COLUNAS_DISPONIVEIS.map((c) => c.id),
  );
  const [previewTipo, setPreviewTipo] =
    useState<TipoExportacaoFuncional>(tipoInicial);

  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: filialLoading,
  } = useFilialId();

  const tiposFuncionaisSelecionados = tiposSelecionados.filter(
    (t): t is TipoExportacaoFuncional => t === "entradas" || t === "saidas",
  );
  // Deriva do state em vez de sincronizar com useEffect: se o tipo em
  // preview foi desmarcado, cai pro primeiro tipo funcional que sobrou.
  const previewTipoEfetivo: TipoExportacaoFuncional =
    tiposFuncionaisSelecionados.includes(previewTipo)
      ? previewTipo
      : (tiposFuncionaisSelecionados[0] ?? "entradas");

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

  // Query para categorias — união dos tipos funcionais marcados, já que
  // Categoria é filtro compartilhado entre Entradas e Saídas.
  const tiposConceito = useMemo(
    () => tiposFuncionaisSelecionados.map((t) => (t === "entradas" ? "entrada" : "saida")),
    [tiposFuncionaisSelecionados],
  );
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-exportacao", igrejaId, tiposConceito],
    queryFn: async () => {
      if (!igrejaId || tiposConceito.length === 0) return [];
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("ativo", true)
        .in("tipo", tiposConceito)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && tiposConceito.length > 0,
  });

  // Query de dados de exportação — uma por tipo funcional, pra poder gerar
  // uma aba por tipo no Excel sem misturar entrada/saída na mesma busca.
  const entradasQuery = useQuery<TransacaoExportacao[]>({
    queryKey: [
      "dados-exportacao",
      "entrada",
      igrejaId,
      filialId,
      isAllFiliais,
      statusSelecionados,
      periodo.inicio,
      periodo.fim,
      tipoData,
      contasSelecionadas,
      categoriasSelecionadas,
    ],
    queryFn: () =>
      fetchTransacoesExportacao({
        tipo: "entrada",
        igrejaId: igrejaId as string,
        filialId,
        isAllFiliais,
        periodo,
        tipoData,
        statusSelecionados,
        contasSelecionadas,
        categoriasSelecionadas,
      }),
    enabled:
      !!igrejaId && !filialLoading && tiposSelecionados.includes("entradas"),
  });

  const saidasQuery = useQuery<TransacaoExportacao[]>({
    queryKey: [
      "dados-exportacao",
      "saida",
      igrejaId,
      filialId,
      isAllFiliais,
      statusSelecionados,
      periodo.inicio,
      periodo.fim,
      tipoData,
      contasSelecionadas,
      categoriasSelecionadas,
    ],
    queryFn: () =>
      fetchTransacoesExportacao({
        tipo: "saida",
        igrejaId: igrejaId as string,
        filialId,
        isAllFiliais,
        periodo,
        tipoData,
        statusSelecionados,
        contasSelecionadas,
        categoriasSelecionadas,
      }),
    enabled:
      !!igrejaId && !filialLoading && tiposSelecionados.includes("saidas"),
  });

  const isLoading =
    (tiposSelecionados.includes("entradas") && entradasQuery.isLoading) ||
    (tiposSelecionados.includes("saidas") && saidasQuery.isLoading);

  const totalRegistros =
    (tiposSelecionados.includes("entradas")
      ? entradasQuery.data?.length ?? 0
      : 0) +
    (tiposSelecionados.includes("saidas") ? saidasQuery.data?.length ?? 0 : 0);

  const transacoesPreview = useMemo(
    () =>
      previewTipoEfetivo === "entradas"
        ? entradasQuery.data ?? []
        : saidasQuery.data ?? [],
    [previewTipoEfetivo, entradasQuery.data, saidasQuery.data],
  );

  const dadosPreview = useMemo(() => {
    return transacoesPreview.slice(0, 10);
  }, [transacoesPreview]);

  const montarLinhasExportacao = (dados: TransacaoExportacao[]) => {
    const colunaPeriodo = colunaDataFiltroExport(tipoData);
    return dados.map((t) => {
      const row: Record<string, string | number> = {};
      // parseLocalDate em vez de `new Date(string)`: "YYYY-MM-DD" seria
      // interpretado como meia-noite UTC, que em fusos a oeste de UTC
      // (ex: Brasil) volta um dia no horário local — ano/mês errados
      // perto da virada de mês/ano.
      const dataFiltro = parseLocalDate(t[colunaPeriodo]);

      if (colunasSelecionadas.includes("ano"))
        row.Ano = dataFiltro ? dataFiltro.getFullYear() : "";
      if (colunasSelecionadas.includes("mes"))
        row.Mês = dataFiltro
          ? format(dataFiltro, "MMMM", { locale: ptBR })
          : "";
      if (colunasSelecionadas.includes("cnpj"))
        row.CNPJ = t.fornecedor?.cpf_cnpj || "";
      if (colunasSelecionadas.includes("competencia"))
        row.Competência = formatDateForExport(t.data_competencia);
      if (colunasSelecionadas.includes("descricao"))
        row.Descrição = t.descricao;
      if (colunasSelecionadas.includes("valor")) row.Valor = t.valor;
      if (colunasSelecionadas.includes("valor_liquido"))
        row["Valor Líquido"] = t.valor_liquido ?? 0;
      if (colunasSelecionadas.includes("taxas_administrativas"))
        row["Taxa Administrativa"] = t.taxas_administrativas ?? 0;
      if (colunasSelecionadas.includes("multas")) row.Multa = t.multas ?? 0;
      if (colunasSelecionadas.includes("juros")) row.Juros = t.juros ?? 0;
      if (colunasSelecionadas.includes("desconto"))
        row.Desconto = t.desconto ?? 0;
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
        row["Forma Pagamento"] = t.forma?.nome || t.forma_pagamento || "";
      if (colunasSelecionadas.includes("observacoes"))
        row.Observações = t.observacoes || "";

      return row;
    });
  };

  const handleExportar = () => {
    try {
      const numberFormats = {
        Valor: "#,##0.00",
        "Valor Líquido": "#,##0.00",
        "Taxa Administrativa": "#,##0.00",
        Multa: "#,##0.00",
        Juros: "#,##0.00",
      };

      const sheets = [
        tiposSelecionados.includes("entradas") && {
          name: "Entradas",
          data: montarLinhasExportacao(entradasQuery.data ?? []),
          numberFormats,
        },
        tiposSelecionados.includes("saidas") && {
          name: "Saídas",
          data: montarLinhasExportacao(saidasQuery.data ?? []),
          numberFormats,
        },
      ].filter(
        (s): s is { name: string; data: Record<string, string | number>[]; numberFormats: typeof numberFormats } =>
          !!s,
      );

      const nomeArquivo =
        tiposFuncionaisSelecionados.join("_") || "exportacao";

      exportSheetsToExcel(sheets, nomeArquivo);
      toast.success(`${totalRegistros} registros exportados com sucesso!`);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao exportar dados",
      );
    }
  };

  const toggleColuna = (colunaId: string) => {
    setColunasSelecionadas((prev) =>
      prev.includes(colunaId)
        ? prev.filter((id) => id !== colunaId)
        : [...prev, colunaId],
    );
  };

  const selecionarTodasColunas = () => {
    setColunasSelecionadas(COLUNAS_DISPONIVEIS.map((c) => c.id));
  };

  const desmarcarTodasColunas = () => {
    setColunasSelecionadas([]);
  };

  const labelPagamento =
    tiposFuncionaisSelecionados.length === 1
      ? tiposFuncionaisSelecionados[0] === "entradas"
        ? "Recebimento"
        : "Pagamento"
      : "Pagamento/Recebimento";

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
              <MultiSelectFilter
                options={TIPO_DADOS_OPTIONS}
                selected={tiposSelecionados}
                onChange={(v) => setTiposSelecionados(v as TipoExportacao[])}
                allLabel="Selecione ao menos um tipo"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <MultiSelectFilter
                options={STATUS_OPTIONS}
                selected={statusSelecionados}
                onChange={(v) =>
                  setStatusSelecionados(v as StatusFiltroValor[])
                }
                allLabel="Todos"
                disabled={tipoData === "pagamento"}
              />
              {tipoData === "pagamento" && (
                <p className="text-xs text-muted-foreground">
                  Data de Caixa exporta somente pagos.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <MonthPicker
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                customRange={customRange}
                onCustomRangeChange={setCustomRange}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Data</Label>
              <Select
                value={tipoData}
                onValueChange={(v: TipoDataFiltroExport) => {
                  setTipoData(v);
                  // A query já força status='pago' em modo Pagamento —
                  // reseta o filtro de Status pra não sugerir uma seleção
                  // (Pendente/Atrasado) que a busca ignoraria.
                  if (v === "pagamento") setStatusSelecionados([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vencimento">Vencimento</SelectItem>
                  <SelectItem value="pagamento">{labelPagamento}</SelectItem>
                  <SelectItem value="competencia">Competência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <MultiSelectFilter
                options={contas.map((c) => ({ value: c.id, label: c.nome }))}
                selected={contasSelecionadas}
                onChange={setContasSelecionadas}
                allLabel="Todas as contas"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <MultiSelectFilter
                options={categorias.map((c) => ({
                  value: c.id,
                  label: c.nome,
                }))}
                selected={categoriasSelecionadas}
                onChange={setCategoriasSelecionadas}
                allLabel="Todas as categorias"
              />
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
            Preview ({totalRegistros} registros encontrados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tiposSelecionados.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Selecione ao menos um Tipo de Dados para exportar.
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando dados...
            </div>
          ) : (
            <>
              {tiposFuncionaisSelecionados.length > 1 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-muted-foreground">
                    Visualizando:
                  </span>
                  {tiposFuncionaisSelecionados.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={previewTipoEfetivo === t ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPreviewTipo(t)}
                    >
                      {t === "entradas" ? "Entradas" : "Saídas"}
                    </Button>
                  ))}
                </div>
              )}

              {dadosPreview.length === 0 ? (
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
                          <th className="px-3 py-2 text-left font-medium">
                            Conta
                          </th>
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
                            <td className="px-3 py-2 capitalize">
                              {t.status}
                            </td>
                          )}
                          {colunasSelecionadas.includes("data_vencimento") && (
                            <td className="px-3 py-2">
                              {t.data_vencimento
                                ? format(
                                    new Date(t.data_vencimento),
                                    "dd/MM/yyyy",
                                  )
                                : "—"}
                            </td>
                          )}
                          {colunasSelecionadas.includes("conta") && (
                            <td className="px-3 py-2">
                              {t.conta?.nome || "—"}
                            </td>
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
                  {transacoesPreview.length > 10 && (
                    <div className="px-3 py-2 bg-muted text-xs text-muted-foreground border-t">
                      Mostrando 10 de {transacoesPreview.length} registros
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Botão Exportar */}
      <div className="flex justify-end">
        <Button
          onClick={handleExportar}
          disabled={
            tiposSelecionados.length === 0 ||
            totalRegistros === 0 ||
            colunasSelecionadas.length === 0 ||
            isLoading
          }
          size="lg"
          className="bg-gradient-primary"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar {totalRegistros} registros
        </Button>
      </div>
    </div>
  );
}
