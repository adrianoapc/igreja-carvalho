import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFilialId } from "@/hooks/useFilialId";

interface ImportarExcelDialogProps {
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
  fornecedor?: string;
  observacoes?: string;
};

type ContaOption = { id: string; nome: string };
type CategoriaOption = { id: string; nome: string };
type FornecedorOption = { id: string; nome: string };

type ValueMappings = {
  contas: Record<string, string>;
  categorias: Record<string, string>;
  fornecedores: Record<string, string>;
};

const NONE_OPTION = "__none__";
const AUTO_OPTION = "__auto__";

export function ImportarExcelDialog({ open, onOpenChange, tipo }: ImportarExcelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileName, setFileName] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [contas, setContas] = useState<ContaOption[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOption[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [valueMappings, setValueMappings] = useState<ValueMappings>({
    contas: {},
    categorias: {},
    fornecedores: {},
  });
  const queryClient = useQueryClient();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  useEffect(() => {
    if (!open) return;

    const loadOptions = async () => {
      const [{ data: contasData }, { data: categoriasData }, { data: fornecedoresData }] = await Promise.all([
        supabase.from("contas").select("id, nome").eq("ativo", true),
        supabase
          .from("categorias_financeiras")
          .select("id, nome")
          .eq("ativo", true)
          .eq("tipo", tipo),
        supabase.from("fornecedores").select("id, nome").eq("ativo", true),
      ]);

      setContas((contasData ?? []) as ContaOption[]);
      setCategorias((categoriasData ?? []) as CategoriaOption[]);
      setFornecedores((fornecedoresData ?? []) as FornecedorOption[]);
    };

    loadOptions();
  }, [open, tipo]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setValidationErrors([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet);
      
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
      columnNames.forEach(col => {
        const colLower = col.toLowerCase().trim();
        if (colLower.includes('descri')) autoMapping.descricao = col;
        if (colLower.includes('valor') && !colLower.includes('liquido')) autoMapping.valor = col;
        if (colLower.includes('vencimento') || colLower.includes('data_venc')) autoMapping.data_vencimento = col;
        if (colLower.includes('pagamento') || colLower.includes('data_pag')) autoMapping.data_pagamento = col;
        if (colLower.includes('status') || colLower.includes('situacao')) autoMapping.status = col;
        if (colLower.includes('conta')) autoMapping.conta = col;
        if (colLower.includes('categoria')) autoMapping.categoria = col;
        if (colLower.includes('fornecedor') || colLower.includes('beneficiario')) autoMapping.fornecedor = col;
        if (colLower.includes('observ') || colLower.includes('obs')) autoMapping.observacoes = col;
      });
      
      setMapping(autoMapping);
      setPreview(jsonData.slice(0, 10) as Record<string, unknown>[]);
      setRows(jsonData as Record<string, unknown>[]);
      setValueMappings({
        contas: {},
        categorias: {},
        fornecedores: {},
      });
      
      toast.success(`${jsonData.length} linhas encontradas no arquivo`);
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      toast.error("Erro ao ler arquivo Excel/CSV");
    }
  };

  const normalizeValue = (value: unknown): string => {
    return String(value ?? "").trim().toLowerCase();
  };

  const parseValor = (valor: unknown): number => {
    if (!valor) return 0;
    const valorStr = String(valor).replace(/[^\d,.-]/g, "").replace(",", ".");
    return parseFloat(valorStr) || 0;
  };

  const parseData = (data: unknown): string | null => {
    if (!data) return null;
    try {
      // Tentar diferentes formatos de data
      const dataStr = String(data).trim();
      
      // dd/mm/yyyy
      if (dataStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [dia, mes, ano] = dataStr.split('/');
        return `${ano}-${mes}-${dia}`;
      }
      
      // yyyy-mm-dd
      if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dataStr;
      }
      
      // Tentar parse como data
      const date = new Date(data as string | number);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      
      return null;
    } catch {
      return null;
    }
  };

  const validateMapping = (): boolean => {
    const errors: string[] = [];
    
    if (!mapping.descricao) errors.push("Campo 'Descrição' não mapeado");
    if (!mapping.valor) errors.push("Campo 'Valor' não mapeado");
    if (!mapping.data_vencimento) errors.push("Campo 'Data Vencimento' não mapeado");
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const getDistinctValues = (column?: string) => {
    if (!column) return [];
    const values = new Set<string>();
    rows.forEach((row) => {
      const value = row[column];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        values.add(String(value).trim());
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  };

  const distinctContaValues = useMemo(() => getDistinctValues(mapping.conta), [rows, mapping.conta]);
  const distinctCategoriaValues = useMemo(() => getDistinctValues(mapping.categoria), [rows, mapping.categoria]);
  const distinctFornecedorValues = useMemo(() => getDistinctValues(mapping.fornecedor), [rows, mapping.fornecedor]);

  const findMatchId = (value: string, options: { id: string; nome: string }[]) => {
    const normalized = normalizeValue(value);
    return options.find((option) => normalizeValue(option.nome) === normalized)?.id ?? null;
  };

  const resolveMappedId = (
    value: unknown,
    overrides: Record<string, string>,
    options: { id: string; nome: string }[],
  ) => {
    const normalizedValue = normalizeValue(value);
    if (!normalizedValue) return null;
    const overrideKey = Object.keys(overrides).find((key) => normalizeValue(key) === normalizedValue);
    if (overrideKey) {
      const overrideValue = overrides[overrideKey];
      if (overrideValue) return overrideValue;
    }
    return options.find((option) => normalizeValue(option.nome) === normalizedValue)?.id ?? null;
  };

  const renderValueMappings = (
    label: string,
    values: string[],
    options: { id: string; nome: string }[],
    mappingKey: keyof ValueMappings,
  ) => {
    if (values.length === 0) return null;
    const overrides = valueMappings[mappingKey];

    return (
      <div className="space-y-2 rounded-md border p-3">
        <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="space-y-2">
          {values.map((value) => {
            const suggestedId = findMatchId(value, options);
            const overrideValue = overrides[value] ?? AUTO_OPTION;
            const suggestedName = options.find((option) => option.id === suggestedId)?.nome;

            return (
              <div key={value} className="grid gap-2 md:grid-cols-[1fr_220px] md:items-center">
                <div className="text-xs">
                  <div className="font-medium">{value}</div>
                  <div className="text-muted-foreground">
                    {suggestedName ? `Sugestão: ${suggestedName}` : "Sem correspondência automática"}
                  </div>
                </div>
                <Select
                  value={overrideValue}
                  onValueChange={(selected) =>
                    setValueMappings((prev) => ({
                      ...prev,
                      [mappingKey]: {
                        ...prev[mappingKey],
                        [value]: selected === AUTO_OPTION ? "" : selected,
                      },
                    }))
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Usar sugestão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_OPTION}>Usar sugestão</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const processarImportacao = async () => {
    if (rows.length === 0) {
      toast.error("Nenhum dado para importar");
      return;
    }

    if (!validateMapping()) {
      toast.error("Mapeamento incompleto. Verifique os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      // Buscar contas, categorias e fornecedores existentes
      const contasAtivas = contas.length > 0 ? contas : [];
      const categoriasAtivas = categorias.length > 0 ? categorias : [];
      const fornecedoresAtivos = fornecedores.length > 0 ? fornecedores : [];

      if (contasAtivas.length === 0) {
        toast.error("Nenhuma conta ativa encontrada. Crie uma conta primeiro.");
        setLoading(false);
        return;
      }

      if (!igrejaId) {
        toast.error("Contexto da igreja não identificado. Recarregue e tente novamente.");
        return;
      }

      const transacoes = [];
      const erros = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          const descricao = mapping.descricao ? row[mapping.descricao] : null;
          const valor = mapping.valor ? parseValor(row[mapping.valor]) : 0;
          const dataVencimento = mapping.data_vencimento ? parseData(row[mapping.data_vencimento]) : null;
          
          if (!descricao || !valor || !dataVencimento) {
            erros.push(`Linha ${i + 1}: Dados obrigatórios faltando`);
            continue;
          }

          // Buscar conta
          let contaId = contasAtivas[0].id; // Padrão
          if (mapping.conta) {
            const nomeConta = row[mapping.conta];
            const contaEncontrada = resolveMappedId(nomeConta, valueMappings.contas, contasAtivas);
            if (contaEncontrada) contaId = contaEncontrada;
          }

          // Buscar categoria
          let categoriaId = null;
          if (mapping.categoria && categoriasAtivas) {
            const nomeCategoria = row[mapping.categoria];
            const categoriaEncontrada = resolveMappedId(nomeCategoria, valueMappings.categorias, categoriasAtivas);
            if (categoriaEncontrada) categoriaId = categoriaEncontrada;
          }

          // Buscar fornecedor
          let fornecedorId = null;
          if (mapping.fornecedor && fornecedoresAtivos) {
            const nomeFornecedor = row[mapping.fornecedor];
            const fornecedorEncontrado = resolveMappedId(nomeFornecedor, valueMappings.fornecedores, fornecedoresAtivos);
            if (fornecedorEncontrado) fornecedorId = fornecedorEncontrado;
          }

          // Status
          let status = "pendente";
          if (mapping.status) {
            const statusValue = String(row[mapping.status]).toLowerCase();
            if (statusValue.includes("pago") || statusValue.includes("recebido")) {
              status = "pago";
            }
          }

          // Data pagamento
          let dataPagamento = null;
          if (mapping.data_pagamento) {
            dataPagamento = parseData(row[mapping.data_pagamento]);
          }

          // Observações
          const observacoes = mapping.observacoes ? row[mapping.observacoes] : null;

          transacoes.push({
            tipo,
            descricao,
            valor,
            data_vencimento: dataVencimento,
            data_pagamento: dataPagamento,
            status,
            tipo_lancamento: "unico",
            conta_id: contaId,
            categoria_id: categoriaId,
            fornecedor_id: fornecedorId,
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

      // Inserir no banco
      const { error } = await supabase
        .from("transacoes_financeiras")
        .insert(transacoes);

      if (error) throw error;

      if (erros.length > 0) {
        toast.warning(`${transacoes.length} transações importadas com ${erros.length} erros`);
        console.log("Erros:", erros);
      } else {
        toast.success(`${transacoes.length} transações importadas com sucesso!`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar transações");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPreview([]);
    setRows([]);
    setColumns([]);
    setMapping({});
    setFileName("");
    setValidationErrors([]);
    setValueMappings({
      contas: {},
      categorias: {},
      fornecedores: {},
    });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Importar {tipo === "entrada" ? "Entradas" : "Saídas"} via Excel/CSV</h2>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="px-4 py-4 md:px-6 md:py-5 space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Faça upload de um arquivo Excel (.xlsx, .xls) ou CSV com os dados das transações.
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
                    <Select value={mapping.descricao} onValueChange={(v) => setMapping({...mapping, descricao: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor *</Label>
                    <Select value={mapping.valor} onValueChange={(v) => setMapping({...mapping, valor: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Vencimento *</Label>
                    <Select value={mapping.data_vencimento} onValueChange={(v) => setMapping({...mapping, data_vencimento: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Pagamento</Label>
                    <Select
                      value={mapping.data_pagamento ?? NONE_OPTION}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, data_pagamento: v === NONE_OPTION ? undefined : v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_OPTION}>Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={mapping.status ?? NONE_OPTION}
                      onValueChange={(v) => setMapping({ ...mapping, status: v === NONE_OPTION ? undefined : v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_OPTION}>Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta</Label>
                    <Select
                      value={mapping.conta ?? NONE_OPTION}
                      onValueChange={(v) => {
                        setMapping({ ...mapping, conta: v === NONE_OPTION ? undefined : v });
                        setValueMappings((prev) => ({ ...prev, contas: {} }));
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_OPTION}>Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select
                      value={mapping.categoria ?? NONE_OPTION}
                      onValueChange={(v) => {
                        setMapping({ ...mapping, categoria: v === NONE_OPTION ? undefined : v });
                        setValueMappings((prev) => ({ ...prev, categorias: {} }));
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_OPTION}>Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Fornecedor</Label>
                    <Select
                      value={mapping.fornecedor ?? NONE_OPTION}
                      onValueChange={(v) => {
                        setMapping({ ...mapping, fornecedor: v === NONE_OPTION ? undefined : v });
                        setValueMappings((prev) => ({ ...prev, fornecedores: {} }));
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_OPTION}>Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Observações</Label>
                    <Select
                      value={mapping.observacoes ?? NONE_OPTION}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, observacoes: v === NONE_OPTION ? undefined : v })
                      }
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_OPTION}>Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {columns.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Associação de Valores</h3>
                <p className="text-xs text-muted-foreground">
                  Conferimos automaticamente as contas, categorias e fornecedores encontrados no arquivo. Se algo não
                  bater, ajuste manualmente abaixo.
                </p>
                <div className="space-y-3">
                  {mapping.conta &&
                    renderValueMappings("Contas", distinctContaValues, contas, "contas")}
                  {mapping.categoria &&
                    renderValueMappings("Categorias", distinctCategoriaValues, categorias, "categorias")}
                  {mapping.fornecedor &&
                    renderValueMappings("Fornecedores", distinctFornecedorValues, fornecedores, "fornecedores")}
                </div>
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Prévia ({preview.length} linhas)</h3>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {columns.map(col => (
                            <td key={col} className="px-3 py-2 whitespace-nowrap">
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
            disabled={loading || rows.length === 0}
          >
            {loading ? "Importando..." : `Importar ${rows.length} transações`}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
