import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Download,
} from "lucide-react";
import { useState } from "react";
import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Progress } from "@/components/ui/progress";
import { useFilialId } from "@/hooks/useFilialId";

interface ImportarExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "entrada" | "saida";
}

type ColumnMapping = {
  descricao?: string;
  valor?: string;
  valor_liquido?: string;
  data_vencimento?: string;
  data_pagamento?: string;
  status?: string;
  conta?: string;
  categoria?: string;
  subcategoria?: string;
  centro_custo?: string;
  base_ministerial?: string;
  forma_pagamento?: string;
  fornecedor?: string;
  observacoes?: string;
  multas?: string;
  juros?: string;
  desconto?: string;
  taxas_administrativas?: string;
};

export function ImportarExcelDialog({
  open,
  onOpenChange,
  tipo,
}: ImportarExcelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileName, setFileName] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState<number>(0);
  const queryClient = useQueryClient();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setValidationErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      // Forçar leitura como texto para evitar conversão automática de datas
      const jsonData = utils.sheet_to_json(worksheet, { raw: false, dateNF: "dd/mm/yyyy" });

      if (jsonData.length === 0) {
        toast.error("Arquivo vazio ou sem dados válidos");
        return;
      }

      // Extrair nomes das colunas
      const firstRow = jsonData[0] as Record<string, unknown>;
      const columnNames = Object.keys(firstRow);
      setColumns(columnNames);

      // Tentar mapear automaticamente baseado em nomes comuns
      const autoMapping: ColumnMapping = {};
      columnNames.forEach((col) => {
        const colLower = col.toLowerCase().trim();
        if (colLower.includes("descri")) autoMapping.descricao = col;
        if (colLower.includes("valor") && !colLower.includes("liquido") && !colLower.includes("pago"))
          autoMapping.valor = col;
        if (colLower.includes("valor_pago") || colLower.includes("liquido") || (colLower.includes("pago") && colLower.includes("valor")))
          autoMapping.valor_liquido = col;
        if (colLower.includes("vencimento") || colLower.includes("data_venc"))
          autoMapping.data_vencimento = col;
        if ((colLower.includes("pagamento") && colLower.includes("data")) || colLower.includes("data_pag"))
          autoMapping.data_pagamento = col;
        if (colLower.includes("status") || colLower.includes("situacao"))
          autoMapping.status = col;
        if (colLower.includes("conta")) autoMapping.conta = col;
        if (colLower.includes("categoria") && !colLower.includes("sub"))
          autoMapping.categoria = col;
        if (colLower.includes("subcat") || colLower.includes("sub-categ"))
          autoMapping.subcategoria = col;
        if (colLower.includes("centro") || colLower.includes("custo"))
          autoMapping.centro_custo = col;
        if (colLower.includes("ministerial") || colLower.includes("base"))
          autoMapping.base_ministerial = col;
        if (colLower.includes("forma") && !colLower.includes("pagamento"))
          autoMapping.forma_pagamento = col;
        if (
          colLower.includes("fornecedor") ||
          colLower.includes("beneficiario")
        )
          autoMapping.fornecedor = col;
        if (colLower.includes("observ") || colLower.includes("obs"))
          autoMapping.observacoes = col;
        // Novos campos de ajuste financeiro
        if (colLower.includes("multa")) autoMapping.multas = col;
        if (colLower.includes("juros")) autoMapping.juros = col;
        if (colLower.includes("desconto")) autoMapping.desconto = col;
        if (colLower.includes("taxa")) autoMapping.taxas_administrativas = col;
      });

      setMapping(autoMapping);
      setPreview(jsonData.slice(0, 10) as Record<string, unknown>[]);

      toast.success(`${jsonData.length} linhas encontradas no arquivo`);
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      toast.error("Erro ao ler arquivo Excel/CSV");
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

  const validateMapping = (): boolean => {
    const errors: string[] = [];

    if (!mapping.descricao) errors.push("Campo 'Descrição' não mapeado");
    if (!mapping.valor) errors.push("Campo 'Valor' não mapeado");
    if (!mapping.data_vencimento)
      errors.push("Campo 'Data Vencimento' não mapeado");

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const processarImportacao = async () => {
    if (preview.length === 0) {
      toast.error("Nenhum dado para importar");
      return;
    }

    if (!validateMapping()) {
      toast.error("Mapeamento incompleto. Verifique os campos obrigatórios.");
      return;
    }

    setLoading(true);
    setImportProgress(0);
    try {
      // Buscar contas, categorias e fornecedores existentes
      const { data: contas } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);

      const { data: categorias } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("ativo", true)
        .eq("tipo", tipo)
        .eq("igreja_id", igrejaId);

      const { data: fornecedores } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);

      const { data: subcategorias } = await supabase
        .from("subcategorias_financeiras")
        .select("id, nome")
        .eq("igreja_id", igrejaId);

      const { data: centrosCusto } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("igreja_id", igrejaId);

      const { data: basesMinisteriais } = await supabase
        .from("bases_ministeriais")
        .select("id, titulo")
        .eq("igreja_id", igrejaId);

      const { data: formasPagamento } = await supabase
        .from("formas_pagamento")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);

      if (!contas || contas.length === 0) {
        toast.error("Nenhuma conta ativa encontrada. Crie uma conta primeiro.");
        setLoading(false);
        return;
      }

      if (!igrejaId) {
        toast.error(
          "Contexto da igreja não identificado. Recarregue e tente novamente.",
        );
        return;
      }

      const transacoes = [];
      const erros = [];

      for (let i = 0; i < preview.length; i++) {
        const row = preview[i];

        try {
          const descricao = mapping.descricao ? row[mapping.descricao] : null;
          const valor = mapping.valor ? parseValor(row[mapping.valor]) : 0;
          const dataVencimento = mapping.data_vencimento
            ? parseData(row[mapping.data_vencimento])
            : null;

          if (!descricao || !valor || !dataVencimento) {
            erros.push(`Linha ${i + 1}: Dados obrigatórios faltando`);
            continue;
          }

          // Buscar conta
          let contaId = contas[0].id; // Padrão
          if (mapping.conta) {
            const nomeConta = row[mapping.conta];
            const contaEncontrada = contas.find(
              (c) =>
                c.nome.toLowerCase() === String(nomeConta).toLowerCase().trim(),
            );
            if (contaEncontrada) contaId = contaEncontrada.id;
          }

          // Buscar categoria
          let categoriaId = null;
          if (mapping.categoria && categorias) {
            const nomeCategoria = row[mapping.categoria];
            const categoriaEncontrada = categorias.find(
              (c) =>
                c.nome.toLowerCase() ===
                String(nomeCategoria).toLowerCase().trim(),
            );
            if (categoriaEncontrada) categoriaId = categoriaEncontrada.id;
          }

          // Buscar subcategoria
          let subcategoriaId = null;
          if (mapping.subcategoria && subcategorias) {
            const nomeSub = row[mapping.subcategoria];
            const subEncontrada = subcategorias.find(
              (s) =>
                s.nome.toLowerCase() === String(nomeSub).toLowerCase().trim(),
            );
            if (subEncontrada) subcategoriaId = subEncontrada.id;
          }

          // Buscar centro de custo
          let centroCustoId = null;
          if (mapping.centro_custo && centrosCusto) {
            const nomeCC = row[mapping.centro_custo];
            const ccEncontrado = centrosCusto.find(
              (c) =>
                c.nome.toLowerCase() === String(nomeCC).toLowerCase().trim(),
            );
            if (ccEncontrado) centroCustoId = ccEncontrado.id;
          }

          // Buscar base ministerial
          let baseMinisterialId = null;
          if (mapping.base_ministerial && basesMinisteriais) {
            const nomeBM = row[mapping.base_ministerial];
            const bmEncontrada = basesMinisteriais.find(
              (b) =>
                (b.titulo || "").toLowerCase() ===
                String(nomeBM).toLowerCase().trim(),
            );
            if (bmEncontrada) baseMinisterialId = bmEncontrada.id;
          }

          // Buscar fornecedor
          let fornecedorId = null;
          if (mapping.fornecedor && fornecedores) {
            const nomeFornecedor = row[mapping.fornecedor];
            const fornecedorEncontrado = fornecedores.find(
              (f) =>
                f.nome.toLowerCase() ===
                String(nomeFornecedor).toLowerCase().trim(),
            );
            if (fornecedorEncontrado) fornecedorId = fornecedorEncontrado.id;
          }

          // Status
          let status = "pendente";
          if (mapping.status) {
            const statusValue = String(row[mapping.status]).toLowerCase();
            if (
              statusValue.includes("pago") ||
              statusValue.includes("recebido")
            ) {
              status = "pago";
            }
          }

          // Data pagamento
          let dataPagamento = null;
          if (mapping.data_pagamento) {
            dataPagamento = parseData(row[mapping.data_pagamento]);
          }

          // Forma de pagamento
          let formaPagamento = null as string | null;
          if (mapping.forma_pagamento && formasPagamento) {
            const nomeFP = row[mapping.forma_pagamento];
            const fpEncontrada = formasPagamento.find(
              (fp) =>
                fp.nome.toLowerCase() === String(nomeFP).toLowerCase().trim(),
            );
            if (fpEncontrada) formaPagamento = fpEncontrada.nome;
          }

          // Observações
          const observacoes = mapping.observacoes
            ? row[mapping.observacoes]
            : null;

          // Parsear ajustes financeiros
          const multasVal = mapping.multas ? parseValor(row[mapping.multas]) : 0;
          const jurosVal = mapping.juros ? parseValor(row[mapping.juros]) : 0;
          const descontoVal = mapping.desconto ? parseValor(row[mapping.desconto]) : 0;
          const taxasAdmVal = mapping.taxas_administrativas 
            ? parseValor(row[mapping.taxas_administrativas]) : 0;

          // Calcular valor_liquido: se informado usa direto, senão calcula
          const valorLiquido = mapping.valor_liquido 
            ? parseValor(row[mapping.valor_liquido])
            : valor + jurosVal + multasVal + taxasAdmVal - descontoVal;

          transacoes.push({
            tipo,
            descricao,
            valor,
            valor_liquido: valorLiquido || valor,
            multas: multasVal || null,
            juros: jurosVal || null,
            desconto: descontoVal || null,
            taxas_administrativas: taxasAdmVal || null,
            data_vencimento: dataVencimento,
            data_pagamento: dataPagamento,
            status,
            tipo_lancamento: "unico",
            conta_id: contaId,
            categoria_id: categoriaId,
            subcategoria_id: subcategoriaId,
            centro_custo_id: centroCustoId,
            base_ministerial_id: baseMinisterialId,
            fornecedor_id: fornecedorId,
            forma_pagamento: formaPagamento,
            observacoes,
            igreja_id: igrejaId,
            filial_id: isAllFiliais ? null : filialId,
          });
        } catch (error) {
          erros.push(`Linha ${i + 1}: ${error}`);
        }
      }

      if (transacoes.length === 0) {
        toast.error("Nenhuma transação válida para importar");
        setLoading(false);
        return;
      }

      // Inserir no banco em lotes para evitar travamentos
      const chunkSize = 200;
      for (let i = 0; i < transacoes.length; i += chunkSize) {
        const chunk = transacoes.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("transacoes_financeiras")
          .insert(chunk);
        if (error) throw error;
        setImportProgress(
          Math.min(
            100,
            Math.round(((i + chunk.length) / transacoes.length) * 100),
          ),
        );
      }

      if (erros.length > 0) {
        toast.warning(
          `${transacoes.length} transações importadas com ${erros.length} erros`,
        );
        console.log("Erros:", erros);
      } else {
        toast.success(
          `${transacoes.length} transações importadas com sucesso!`,
        );
      }

      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      queryClient.invalidateQueries({ queryKey: ["contas"] });

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar transações");
    } finally {
      setLoading(false);
      setImportProgress(0);
    }
  };

  const resetForm = () => {
    setPreview([]);
    setColumns([]);
    setMapping({});
    setFileName("");
    setValidationErrors([]);
  };

  return (
    <ResponsiveDialog
      dialogContentProps={{ className: "max-w-4xl w-full max-h-[85vh]" }}
      drawerContentProps={{ className: "max-h-[85vh]" }}
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetForm();
      }}
    >
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Importar {tipo === "entrada" ? "Entradas" : "Saídas"} via Excel/CSV
          </h2>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-4 py-4 md:px-6 md:py-5 space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Faça upload de um arquivo Excel (.xlsx, .xls) ou CSV com os
                dados das transações.
                <br />
                Campos obrigatórios: Descrição, Valor, Data de Vencimento
              </AlertDescription>
            </Alert>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              {fileName ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {fileName}
                  </div>
                  <label htmlFor="excel-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>Selecionar outro arquivo</span>
                    </Button>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const headers = [
                        "descricao",
                        "valor",
                        "valor_pago",
                        "data_vencimento",
                        "data_pagamento",
                        "status",
                        "conta",
                        "categoria",
                        "subcategoria",
                        "centro_custo",
                        "base_ministerial",
                        "fornecedor",
                        "forma_pagamento",
                        "observacoes",
                        "juros",
                        "multas",
                        "desconto",
                        "taxas_administrativas",
                      ];
                      const csv = headers.join(",") + "\n";
                      const blob = new Blob([csv], {
                        type: "text/csv;charset=utf-8;",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `modelo_importacao_${tipo}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="w-4 h-4 mr-1" /> Baixar modelo CSV
                  </Button>
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

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs">
                    {validationErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Column Mapping */}
            {columns.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Mapeamento de Colunas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Descrição *</Label>
                    <Select
                      value={mapping.descricao}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, descricao: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor *</Label>
                    <Select
                      value={mapping.valor}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, valor: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Vencimento *</Label>
                    <Select
                      value={mapping.data_vencimento}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, data_vencimento: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Pagamento</Label>
                    <Select
                      value={mapping.data_pagamento}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, data_pagamento: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={mapping.status}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, status: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta</Label>
                    <Select
                      value={mapping.conta}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, conta: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select
                      value={mapping.categoria}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, categoria: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Subcategoria</Label>
                    <Select
                      value={mapping.subcategoria}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, subcategoria: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Centro de Custo</Label>
                    <Select
                      value={mapping.centro_custo}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, centro_custo: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Base Ministerial</Label>
                    <Select
                      value={mapping.base_ministerial}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, base_ministerial: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Fornecedor</Label>
                    <Select
                      value={mapping.fornecedor}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, fornecedor: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select
                      value={mapping.forma_pagamento}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, forma_pagamento: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Observações</Label>
                    <Select
                      value={mapping.observacoes}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, observacoes: v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Ajustes Financeiros */}
                <div className="mt-4 pt-3 border-t">
                  <h4 className="text-xs font-medium text-muted-foreground mb-3">Ajustes Financeiros (opcional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Pago (Líquido)</Label>
                      <Select
                        value={mapping.valor_liquido}
                        onValueChange={(v) =>
                          setMapping({ ...mapping, valor_liquido: v })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione a coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Juros</Label>
                      <Select
                        value={mapping.juros}
                        onValueChange={(v) =>
                          setMapping({ ...mapping, juros: v })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione a coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Multas</Label>
                      <Select
                        value={mapping.multas}
                        onValueChange={(v) =>
                          setMapping({ ...mapping, multas: v })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione a coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Desconto</Label>
                      <Select
                        value={mapping.desconto}
                        onValueChange={(v) =>
                          setMapping({ ...mapping, desconto: v })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione a coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Taxas Administrativas</Label>
                      <Select
                        value={mapping.taxas_administrativas}
                        onValueChange={(v) =>
                          setMapping({ ...mapping, taxas_administrativas: v })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione a coluna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col} value={col}>
                              {col}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">
                  Prévia ({preview.length} linhas)
                </h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 text-left font-medium whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {columns.map((col) => (
                            <td
                              key={col}
                              className="px-3 py-2 whitespace-nowrap"
                            >
                              {String(row[col] || "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
          {loading && (
            <div className="flex items-center gap-2 mr-auto w-full max-w-xs">
              <Progress value={importProgress} className="w-full" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {importProgress}%
              </span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={processarImportacao}
            disabled={loading || preview.length === 0}
          >
            {loading
              ? "Importando..."
              : `Importar ${preview.length} transações`}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
