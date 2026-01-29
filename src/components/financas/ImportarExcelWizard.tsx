import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { read, utils, WorkBook } from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useFilialId } from "@/hooks/useFilialId";

interface ImportarExcelWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "entrada" | "saida";
}

type ColumnMapping = {
  descricao?: string;
  valor?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  status?: string;
  conta?: string;
  categoria?: string;
  subcategoria?: string;
  fornecedor?: string;
  observacoes?: string;
};

type ValidationIssue = {
  index: number;
  messages: string[];
};

const MAX_FILE_SIZE_MB = 10;
const DEFAULT_CHUNK_SIZE = 100;

export function ImportarExcelWizard({
  open,
  onOpenChange,
  tipo,
}: ImportarExcelWizardProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [fileName, setFileName] = useState<string>("");
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    []
  );
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<{
    processed: number;
    total: number;
  }>({ processed: 0, total: 0 });
  const [rejected, setRejected] = useState<
    Array<{ index: number; reason: string }>
  >([]);

  const queryClient = useQueryClient();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  const requiredKeys = new Set([
    "descricao",
    "valor",
    "data_vencimento",
    "conta",
    "categoria",
  ]);

  const mappingErrors = useMemo(() => {
    const errors: string[] = [];
    if (!mapping.descricao) errors.push("Campo 'Descrição' não mapeado");
    if (!mapping.valor) errors.push("Campo 'Valor' não mapeado");
    if (!mapping.data_vencimento)
      errors.push("Campo 'Data Vencimento' não mapeado");
    if (!mapping.conta) errors.push("Campo 'Conta' não mapeado");
    if (!mapping.categoria) errors.push("Campo 'Categoria' não mapeado");
    return errors;
  }, [mapping]);

  // refs para virtualização
  const previewParentRef = useRef<HTMLDivElement | null>(null);
  const validationParentRef = useRef<HTMLDivElement | null>(null);

  const previewVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => previewParentRef.current,
    estimateSize: () => 32, // altura estimada por linha
    overscan: 8,
  });

  const validationVirtualizer = useVirtualizer({
    count: validationIssues.length,
    getScrollElement: () => validationParentRef.current,
    estimateSize: () => 32,
    overscan: 8,
  });

  const COL_MIN_WIDTH_PX = 140;
  const gridTemplate = useMemo(
    () => `repeat(${columns.length}, minmax(${COL_MIN_WIDTH_PX}px, 1fr))`,
    [columns.length]
  );

  const resetAll = () => {
    setStep(0);
    setFileName("");
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setColumns([]);
    setRows([]);
    setMapping({});
    setValidationIssues([]);
    setExcluded({});
    setLoading(false);
    setChunkProgress({ processed: 0, total: 0 });
    setRejected([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    setFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const wb = read(data);
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const firstSheet = wb.SheetNames[0];
      setSelectedSheet(firstSheet);
      parseSheet(wb, firstSheet);
      setStep(1);
      toast.success(`Arquivo carregado: ${file.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ler arquivo XLSX/CSV");
    }
  };

  const parseSheet = (wb: WorkBook, sheetName: string) => {
    try {
      const worksheet = wb.Sheets[sheetName];
      const jsonData = utils.sheet_to_json(worksheet);
      const firstRow = (jsonData[0] || {}) as Record<string, unknown>;
      const columnNames = Object.keys(firstRow);
      setColumns(columnNames);
      setRows(jsonData as Record<string, unknown>[]);
      autoDetectMapping(columnNames);
      toast.success(`${jsonData.length} linhas na planilha '${sheetName}'`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar planilha");
    }
  };

  const autoDetectMapping = (columnNames: string[]) => {
    const auto: ColumnMapping = {};
    columnNames.forEach((col) => {
      const k = col.toLowerCase().trim();
      if (k.includes("descri")) auto.descricao = col;
      if (k.includes("valor") && !k.includes("liquido")) auto.valor = col;
      if (k.includes("vencimento") || k.includes("data_venc"))
        auto.data_vencimento = col;
      if (k.includes("pagamento") || k.includes("data_pag"))
        auto.data_pagamento = col;
      if (k.includes("status") || k.includes("situacao")) auto.status = col;
      if (k.includes("conta")) auto.conta = col;
      if (k.includes("categoria")) auto.categoria = col;
      if (
        k.includes("subcat") ||
        k.includes("sub-categ") ||
        k.includes("subcategoria")
      )
        auto.subcategoria = col;
      if (k.includes("fornecedor") || k.includes("beneficiario"))
        auto.fornecedor = col;
      if (k.includes("observ") || k.includes("obs")) auto.observacoes = col;
    });
    setMapping(auto);
  };

  const presetKey = useMemo(() => {
    const ig = igrejaId || "unknown";
    const fi = isAllFiliais ? "all" : filialId || "none";
    return `import_preset_${tipo}_${ig}_${fi}`;
  }, [igrejaId, filialId, isAllFiliais, tipo]);

  const savePreset = () => {
    try {
      const payload = { mapping, sheet: selectedSheet, columns };
      localStorage.setItem(presetKey, JSON.stringify(payload));
      toast.success("Preset salvo");
    } catch (e) {
      toast.error("Falha ao salvar preset");
    }
  };

  const loadPreset = () => {
    try {
      const raw = localStorage.getItem(presetKey);
      if (!raw) {
        toast.warning("Nenhum preset encontrado para este contexto");
        return;
      }
      const payload = JSON.parse(raw);
      setMapping(payload.mapping || {});
      if (workbook && payload.sheet && sheetNames.includes(payload.sheet)) {
        setSelectedSheet(payload.sheet);
        parseSheet(workbook, payload.sheet);
      }
      toast.success("Preset carregado");
    } catch (e) {
      toast.error("Falha ao carregar preset");
    }
  };

  const parseValor = (valor: unknown): number => {
    if (valor === undefined || valor === null) return 0;
    
    // Se já é número, retorna direto
    if (typeof valor === "number") return valor;
    
    let str = String(valor).trim();
    
    // Remove símbolos de moeda e espaços
    str = str.replace(/[¤$\u20AC£¥R\s]/g, "");
    
    // Auto-detectar formato pelo último separador
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    
    // Determina se vírgula é o separador decimal (formato BR: 1.234,56)
    // ou se ponto é o separador decimal (formato US: 1,234.56)
    const isCommaDecimal = lastComma > lastDot;
    
    if (isCommaDecimal) {
      // Formato BR: 1.234,56 → remove pontos (milhares), troca vírgula por ponto
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato US: 1,234.56 → remove vírgulas (milhares)
      str = str.replace(/,/g, "");
    }
    
    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
  };

  const parseData = (data: unknown): string | null => {
    if (!data) return null;
    
    // Handle Excel serial dates (numbers between 1 and 100000 are likely dates)
    if (typeof data === "number" && data > 1 && data < 100000) {
      // Excel epoch: 1899-12-30 (using UTC to avoid timezone issues)
      // Excel serial date = days since 1899-12-30
      const excelEpochMs = Date.UTC(1899, 11, 30);
      const dateMs = excelEpochMs + data * 86400000;
      const date = new Date(dateMs);
      if (!isNaN(date.getTime())) {
        const year = date.getUTCFullYear();
        // Validate year is reasonable (1900-2100)
        if (year >= 1900 && year <= 2100) {
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        }
      }
      return null;
    }
    
    const s = String(data).trim();
    
    // Check if it's a numeric string that could be Excel serial date
    if (/^\d+$/.test(s)) {
      const num = parseInt(s, 10);
      if (num > 1 && num < 100000) {
        const excelEpochMs = Date.UTC(1899, 11, 30);
        const dateMs = excelEpochMs + num * 86400000;
        const date = new Date(dateMs);
        if (!isNaN(date.getTime())) {
          const year = date.getUTCFullYear();
          if (year >= 1900 && year <= 2100) {
            const month = String(date.getUTCMonth() + 1).padStart(2, "0");
            const day = String(date.getUTCDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
          }
        }
      }
      return null;
    }
    
    // dd/MM/yyyy format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split("/");
      const year = parseInt(y, 10);
      if (year >= 1900 && year <= 2100) {
        return `${y}-${m}-${d}`;
      }
      return null;
    }
    
    // yyyy-MM-dd format
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const year = parseInt(s.substring(0, 4), 10);
      if (year >= 1900 && year <= 2100) {
        return s;
      }
      return null;
    }
    
    // Try native Date parsing as fallback
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const year = dt.getFullYear();
      if (year >= 1900 && year <= 2100) {
        return dt.toISOString().split("T")[0];
      }
    }
    
    return null;
  };

  const validateMappingRequired = (): string[] => {
    const errors: string[] = [];
    if (!mapping.descricao) errors.push("Campo 'Descrição' não mapeado");
    if (!mapping.valor) errors.push("Campo 'Valor' não mapeado");
    if (!mapping.data_vencimento)
      errors.push("Campo 'Data Vencimento' não mapeado");
    if (!mapping.conta) errors.push("Campo 'Conta' não mapeado");
    if (!mapping.categoria) errors.push("Campo 'Categoria' não mapeado");
    return errors;
  };

  const runValidation = async () => {
    const mappingErrors = validateMappingRequired();
    if (mappingErrors.length) {
      setValidationIssues([{ index: -1, messages: mappingErrors }]);
      toast.error("Mapeamento incompleto");
      return;
    }

    // Fetch entidades para validação de FK
    const { data: contas } = await supabase
      .from("contas")
      .select("id, nome")
      .eq("ativo", true);
    const { data: categorias } = await supabase
      .from("categorias_financeiras")
      .select("id, nome, tipo")
      .eq("ativo", true);
    const { data: fornecedores } = await supabase
      .from("fornecedores")
      .select("id, nome, cnpj")
      .eq("ativo", true);
    const { data: subcategorias } = await supabase
      .from("subcategorias_financeiras")
      .select("id, nome")
      .eq("ativo", true);

    const issues: ValidationIssue[] = [];
    const newExcluded: Record<number, boolean> = { ...excluded };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const msgs: string[] = [];
      const descricao = mapping.descricao ? row[mapping.descricao] : null;
      const valor = mapping.valor ? parseValor(row[mapping.valor]) : 0;
      const dataVenc = mapping.data_vencimento
        ? parseData(row[mapping.data_vencimento])
        : null;
      if (!descricao) msgs.push("Descrição ausente");
      if (!valor || valor <= 0) msgs.push("Valor inválido");
      if (!dataVenc) msgs.push("Data de vencimento inválida");

      // Conta
      if (mapping.conta && contas) {
        const nomeConta = row[mapping.conta];
        const contaOk = contas.find(
          (c) =>
            c.nome.toLowerCase() ===
            String(nomeConta || "")
              .toLowerCase()
              .trim()
        );
        if (!contaOk) msgs.push("Conta não encontrada");
      }

      // Categoria (tipo compatível)
      if (mapping.categoria && categorias) {
        const nomeCategoria = row[mapping.categoria];
        const categoriaOk = categorias.find(
          (c) =>
            c.nome.toLowerCase() ===
            String(nomeCategoria || "")
              .toLowerCase()
              .trim()
        );
        if (!categoriaOk) msgs.push("Categoria não encontrada");
        else if (categoriaOk.tipo !== tipo)
          msgs.push("Categoria incompatível com tipo");
      }

      // Subcategoria (opcional)
      if (mapping.subcategoria && subcategorias) {
        const nomeSub = row[mapping.subcategoria];
        // Só valida se o campo tiver valor preenchido (subcategoria é opcional)
        const nomeSubStr = String(nomeSub || "").trim();
        if (nomeSubStr) {
          const subOk = subcategorias.find(
            (s) => s.nome.toLowerCase() === nomeSubStr.toLowerCase()
          );
          if (!subOk) msgs.push("Subcategoria não encontrada");
        }
      }

      if (msgs.length) {
        issues.push({ index: i, messages: msgs });
        newExcluded[i] = true; // Excluir por padrão linhas com erro
      }
    }

    setValidationIssues(issues);
    setExcluded(newExcluded);
    setStep(2);
    if (issues.length) toast.warning(`${issues.length} linhas com problemas`);
    else toast.success("Validação concluída sem erros");
  };

  const buildTransacao = (
    row: Record<string, unknown>,
    contas: Array<{ id: string; nome: string }>,
    categorias: Array<{ id: string; nome: string; tipo: string }>,
    fornecedores?: Array<{ id: string; nome: string }>,
    subcategorias?: Array<{ id: string; nome: string }>
  ) => {
    const descricao = mapping.descricao ? row[mapping.descricao] : null;
    const valor = mapping.valor ? parseValor(row[mapping.valor]) : 0;
    const dataVencimento = mapping.data_vencimento
      ? parseData(row[mapping.data_vencimento])
      : null;
    let contaId = contas[0]?.id;
    if (mapping.conta) {
      const nomeConta = row[mapping.conta];
      const contaEncontrada = contas.find(
        (c) =>
          c.nome.toLowerCase() ===
          String(nomeConta || "")
            .toLowerCase()
            .trim()
      );
      if (contaEncontrada) contaId = contaEncontrada.id;
    }
    let categoriaId: string | null = null;
    if (mapping.categoria) {
      const nomeCategoria = row[mapping.categoria];
      const categoriaEncontrada = categorias.find(
        (c) =>
          c.nome.toLowerCase() ===
          String(nomeCategoria || "")
            .toLowerCase()
            .trim()
      );
      if (categoriaEncontrada) categoriaId = categoriaEncontrada.id;
    }
    let fornecedorId: string | null = null;
    if (mapping.fornecedor && fornecedores) {
      const nomeFornecedor = row[mapping.fornecedor];
      const fornecedorEncontrado = fornecedores.find(
        (f) =>
          f.nome.toLowerCase() ===
          String(nomeFornecedor || "")
            .toLowerCase()
            .trim()
      );
      if (fornecedorEncontrado) fornecedorId = fornecedorEncontrado.id;
    }
    let subcategoriaId: string | null = null;
    if (mapping.subcategoria && subcategorias) {
      const nomeSub = row[mapping.subcategoria];
      const subEncontrada = subcategorias.find(
        (s) =>
          s.nome.toLowerCase() ===
          String(nomeSub || "")
            .toLowerCase()
            .trim()
      );
      if (subEncontrada) subcategoriaId = subEncontrada.id;
    }
    // Primeiro parsear data_pagamento para usar na inferência de status
    const dataPagamento = mapping.data_pagamento
      ? parseData(row[mapping.data_pagamento])
      : null;

    // Determinar status: prioridade para coluna explícita, fallback para data_pagamento
    let status = "pendente";
    if (mapping.status) {
      const s = String(row[mapping.status] || "").toLowerCase();
      if (s.includes("pago") || s.includes("recebido")) {
        status = "pago";
      } else if (s.includes("cancelado") || s.includes("estornado")) {
        status = "cancelado";
      }
    }
    // Se status ficou pendente mas tem data_pagamento → inferir como pago
    if (status === "pendente" && dataPagamento) {
      status = "pago";
    }
    const observacoes = mapping.observacoes ? row[mapping.observacoes] : null;
    return {
      tipo,
      descricao: descricao ? String(descricao) : null,
      valor,
      data_vencimento: dataVencimento,
      data_pagamento: dataPagamento,
      status,
      tipo_lancamento: "unico",
      conta_id: contaId,
      categoria_id: categoriaId,
      subcategoria_id: subcategoriaId,
      fornecedor_id: fornecedorId,
      observacoes: observacoes ? String(observacoes) : null,
      igreja_id: igrejaId,
      filial_id: isAllFiliais ? null : filialId,
    };
  };

  const processarImportacao = async () => {
    if (!igrejaId) {
      toast.error("Contexto da igreja não identificado");
      return;
    }

    setLoading(true);
    setStep(3);
    try {
      const { data: contas } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true);
      const { data: categorias } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .eq("tipo", tipo);
      const { data: fornecedores } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true);
      const { data: subcategorias } = await supabase
        .from("subcategorias_financeiras")
        .select("id, nome")
        .eq("ativo", true);

      if (!contas || !contas.length)
        throw new Error("Nenhuma conta ativa encontrada");

      const validRowsIdx = rows.map((_, i) => i).filter((i) => !excluded[i]);

      const transacoes = validRowsIdx.map((i) =>
        buildTransacao(
          rows[i],
          contas!,
          categorias || [],
          fornecedores || [],
          subcategorias || []
        )
      );

      const total = transacoes.length;
      setChunkProgress({ processed: 0, total });

      const chunkSize = DEFAULT_CHUNK_SIZE;
      const errs: Array<{ index: number; reason: string }> = [];

      for (let start = 0; start < transacoes.length; start += chunkSize) {
        const chunk = transacoes.slice(start, start + chunkSize);
        const { error } = await supabase
          .from("transacoes_financeiras")
          .insert(chunk);
        if (error) {
          // Marca todas do chunk como rejeitadas com motivo
          chunk.forEach((_, idx) =>
            errs.push({
              index: start + idx,
              reason: String(error.message || error),
            })
          );
        }
        setChunkProgress((p) => ({
          processed: Math.min(p.processed + chunk.length, total),
          total,
        }));
      }

      setRejected(errs);
      if (errs.length) {
        toast.warning(
          `${total - errs.length} importadas, ${errs.length} rejeitadas`
        );
      } else {
        toast.success(`${total} transações importadas`);
      }

      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      queryClient.invalidateQueries({ queryKey: ["contas"] });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = (format: "csv" | "xlsx" = "csv") => {
    const headers = [
      "descricao",
      "valor",
      "data_vencimento",
      "conta",
      "categoria",
      "fornecedor",
      "status",
      "observacoes",
    ];
    if (format === "csv") {
      const blob = new Blob([headers.join(",") + "\n"], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modelo_importacao_${tipo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const ws = utils.aoa_to_sheet([headers]);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "modelo");
      // @ts-ignore - writeFile disponível em runtime
      import("xlsx").then((xlsx: any) => {
        xlsx.writeFile(wb, `modelo_importacao_${tipo}.xlsx`);
      });
    }
  };

  const downloadRejectedCSV = () => {
    if (!rejected.length) return;
    const content = ["index,reason"]
      .concat(
        rejected.map((r) => `${r.index},"${r.reason.replace(/"/g, '"')}"`)
      )
      .join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rejeitados_${tipo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const headerSteps = ["Upload", "Mapeamento", "Validação", "Confirmação"];

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetAll();
      }}
    >
      <div className="flex flex-col h-full max-w-6xl mx-auto">
        {/* Cabeçalho fixo */}
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4 sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Importar {tipo === "entrada" ? "Entradas" : "Saídas"}
            </h2>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {headerSteps.map((s, i) => (
                <span
                  key={s}
                  className={`px-2 py-1 rounded ${
                    step === i ? "bg-muted font-medium" : ""
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Conteúdo com scroll interno */}
        <ScrollArea className="flex-1 overflow-hidden max-h-[80vh]">
          <div className="px-4 py-4 md:px-6 md:py-5 space-y-4">
            {step === 0 && (
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Faça upload de um arquivo Excel (.xlsx, .xls) ou CSV com os
                    dados das transações. Tamanho máx.: {MAX_FILE_SIZE_MB}MB. Se
                    houver múltiplas planilhas, selecione abaixo.
                  </AlertDescription>
                </Alert>

                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center min-h-24 bg-background">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  {fileName ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        {fileName}
                      </div>
                      <label htmlFor="excel-upload" className="cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <span>Selecionar outro arquivo</span>
                        </Button>
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="excel-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Selecionar arquivo Excel/CSV
                        </span>
                      </Button>
                    </label>
                  )}
                  <input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {sheetNames.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Planilha</Label>
                    <Select
                      value={selectedSheet}
                      onValueChange={(v) => {
                        setSelectedSheet(v);
                        if (workbook) parseSheet(workbook, v);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a planilha" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {columns.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">
                      Prévia ({rows.length} linhas)
                    </h3>
                    {/* Cabeçalho + Corpo em único container horizontal */}
                    <div className="border rounded-lg overflow-x-auto">
                      <div
                        className="bg-muted text-xs grid"
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        {columns.map((col) => (
                          <div
                            key={col}
                            className="px-3 py-2 font-medium whitespace-nowrap"
                          >
                            {col}
                          </div>
                        ))}
                      </div>
                      <div
                        ref={previewParentRef}
                        className="max-h-60 overflow-y-auto"
                      >
                        <div
                          style={{
                            height: previewVirtualizer.getTotalSize(),
                            position: "relative",
                          }}
                        >
                          {previewVirtualizer.getVirtualItems().map((vi) => {
                            const row = rows[vi.index] as Record<
                              string,
                              unknown
                            >;
                            return (
                              <div
                                key={vi.key}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  transform: `translateY(${vi.start}px)`,
                                }}
                                className="border-t"
                              >
                                <div
                                  className="text-xs grid"
                                  style={{ gridTemplateColumns: gridTemplate }}
                                >
                                  {columns.map((col) => (
                                    <div
                                      key={col}
                                      className="px-3 py-2 whitespace-nowrap"
                                    >
                                      {String(row[col] || "")}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-sm">
                    Mapeamento de Colunas
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate("csv")}
                    >
                      Baixar modelo CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate("xlsx")}
                    >
                      Baixar modelo XLSX
                    </Button>
                    <Button variant="outline" size="sm" onClick={savePreset}>
                      Salvar preset
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadPreset}>
                      Carregar preset
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6">
                  <div>
                    <div className="grid grid-cols-1 gap-3">
                      {(
                        [
                          "descricao",
                          "valor",
                          "data_vencimento",
                          "conta",
                          "categoria",
                          "subcategoria",
                          "data_pagamento",
                          "status",
                          "fornecedor",
                          "observacoes",
                        ] as const
                      ).map((key) => (
                        <div className="space-y-1.5" key={key}>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs">
                              {key.replace(/_/g, " ")}
                            </Label>
                            {requiredKeys.has(key) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                                Obrigatório
                              </span>
                            )}
                          </div>
                          <Select
                            value={(mapping as any)[key]}
                            onValueChange={(v) =>
                              setMapping({ ...mapping, [key]: v })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue
                                placeholder={
                                  requiredKeys.has(key)
                                    ? "Selecione (Obrigatório)"
                                    : "Selecione a coluna"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {key !== "descricao" &&
                                key !== "valor" &&
                                key !== "data_vencimento" &&
                                key !== "conta" &&
                                key !== "categoria" && (
                                  <SelectItem value="none">Nenhuma</SelectItem>
                                )}
                              {columns.map((col) => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    {columns.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-xs">Prévia rápida</h4>
                        <div className="border rounded-lg overflow-x-auto">
                          <div
                            className="bg-muted text-xs grid"
                            style={{ gridTemplateColumns: gridTemplate }}
                          >
                            {columns.map((col) => (
                              <div
                                key={col}
                                className="px-3 py-2 font-medium whitespace-nowrap"
                              >
                                {col}
                              </div>
                            ))}
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {rows.slice(0, 50).map((row, idx) => (
                              <div
                                key={idx}
                                className="border-t text-xs grid font-mono"
                                style={{ gridTemplateColumns: gridTemplate }}
                              >
                                {columns.map((col) => (
                                  <div
                                    key={col}
                                    className="px-3 py-2 whitespace-nowrap"
                                  >
                                    {String((row as any)[col] || "")}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {columns.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-xs">Prévia rápida</h4>
                    <div className="border rounded-lg overflow-x-auto">
                      <div
                        className="bg-muted text-xs grid"
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        {columns.map((col) => (
                          <div
                            key={col}
                            className="px-3 py-2 font-medium whitespace-nowrap"
                          >
                            {col}
                          </div>
                        ))}
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {rows.slice(0, 20).map((row, idx) => (
                          <div
                            key={idx}
                            className="border-t text-xs grid"
                            style={{ gridTemplateColumns: gridTemplate }}
                          >
                            {columns.map((col) => (
                              <div
                                key={col}
                                className="px-3 py-2 whitespace-nowrap"
                              >
                                {String((row as any)[col] || "")}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {mappingErrors.length ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {mappingErrors.join("; ")}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Todos os campos obrigatórios estão mapeados.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Resumo de Validação</h3>
                {validationIssues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum erro encontrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // desmarcar todos
                          const next = { ...excluded };
                          validationIssues.forEach((issue) => {
                            next[issue.index] = false;
                          });
                          setExcluded(next);
                        }}
                      >
                        Desmarcar todos
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // marcar todos
                          const next = { ...excluded };
                          validationIssues.forEach((issue) => {
                            next[issue.index] = true;
                          });
                          setExcluded(next);
                        }}
                      >
                        Marcar todos
                      </Button>
                    </div>
                    {/* Cabeçalho */}
                    <div className="border rounded-t-lg overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left">Linha</th>
                            <th className="px-3 py-2 text-left">Problemas</th>
                            <th className="px-3 py-2 text-left">Excluir</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                    {/* Corpo virtualizado */}
                    <div
                      ref={validationParentRef}
                      className="border-x border-b rounded-b-lg overflow-auto max-h-60"
                    >
                      <div
                        style={{
                          height: validationVirtualizer.getTotalSize(),
                          position: "relative",
                        }}
                      >
                        {validationVirtualizer.getVirtualItems().map((vi) => {
                          const issue = validationIssues[vi.index];
                          return (
                            <div
                              key={vi.key}
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${vi.start}px)`,
                              }}
                              className="border-t"
                            >
                              <div className="grid grid-cols-[80px_1fr_100px] text-xs">
                                <div className="px-3 py-2">
                                  {issue.index + 1}
                                </div>
                                <div className="px-3 py-2">
                                  {issue.messages.join("; ")}
                                </div>
                                <div className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={!!excluded[issue.index]}
                                    onChange={(e) =>
                                      setExcluded({
                                        ...excluded,
                                        [issue.index]: e.target.checked,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Importação</h3>
                <div className="space-y-2">
                  <div className="w-full h-2 bg-muted rounded">
                    <div
                      className="h-2 bg-primary rounded"
                      style={{
                        width: chunkProgress.total
                          ? `${Math.round(
                              (chunkProgress.processed / chunkProgress.total) *
                                100
                            )}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {chunkProgress.processed} / {chunkProgress.total} linhas
                  </p>
                </div>
                {rejected.length > 0 && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {rejected.length} rejeitadas
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadRejectedCSV}
                    >
                      Baixar CSV de rejeitadas
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Rodapé fixo */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetAll();
              }}
            >
              Cancelar
            </Button>
          </div>
          <div className="flex gap-2">
            {step > 0 && step < 3 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => (s > 0 ? ((s - 1) as any) : s))}
              >
                Voltar
              </Button>
            )}
            {step === 0 && (
              <Button
                onClick={() =>
                  columns.length
                    ? setStep(1)
                    : toast.error("Selecione um arquivo primeiro")
                }
                disabled={!columns.length}
              >
                Continuar
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={runValidation}
                disabled={columns.length === 0 || mappingErrors.length > 0}
              >
                Validar
              </Button>
            )}
            {step === 2 && (
              <Button onClick={processarImportacao} disabled={loading}>
                Importar
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={() => {
                  onOpenChange(false);
                  resetAll();
                }}
              >
                Concluir
              </Button>
            )}
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
