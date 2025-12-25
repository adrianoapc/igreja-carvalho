import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export function ImportarExcelDialog({ open, onOpenChange, tipo }: ImportarExcelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileName, setFileName] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();

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
      const firstRow: any = jsonData[0];
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
      setPreview(jsonData.slice(0, 10));
      
      toast.success(`${jsonData.length} linhas encontradas no arquivo`);
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      toast.error("Erro ao ler arquivo Excel/CSV");
    }
  };

  const parseValor = (valor: any): number => {
    if (!valor) return 0;
    const valorStr = String(valor).replace(/[^\d,.-]/g, "").replace(",", ".");
    return parseFloat(valorStr) || 0;
  };

  const parseData = (data: any): string | null => {
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
      const date = new Date(data);
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
    try {
      // Buscar contas, categorias e fornecedores existentes
      const { data: contas } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true);

      const { data: categorias } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("ativo", true)
        .eq("tipo", tipo);

      const { data: fornecedores } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true);

      if (!contas || contas.length === 0) {
        toast.error("Nenhuma conta ativa encontrada. Crie uma conta primeiro.");
        setLoading(false);
        return;
      }

      const transacoes = [];
      const erros = [];

      for (let i = 0; i < preview.length; i++) {
        const row = preview[i];
        
        try {
          const descricao = mapping.descricao ? row[mapping.descricao] : null;
          const valor = mapping.valor ? parseValor(row[mapping.valor]) : 0;
          const dataVencimento = mapping.data_vencimento ? parseData(row[mapping.data_vencimento]) : null;
          
          if (!descricao || !valor || !dataVencimento) {
            erros.push(`Linha ${i + 1}: Dados obrigatórios faltando`);
            continue;
          }

          // Buscar conta
          let contaId = contas[0].id; // Padrão
          if (mapping.conta) {
            const nomeConta = row[mapping.conta];
            const contaEncontrada = contas.find(c => 
              c.nome.toLowerCase() === String(nomeConta).toLowerCase().trim()
            );
            if (contaEncontrada) contaId = contaEncontrada.id;
          }

          // Buscar categoria
          let categoriaId = null;
          if (mapping.categoria && categorias) {
            const nomeCategoria = row[mapping.categoria];
            const categoriaEncontrada = categorias.find(c => 
              c.nome.toLowerCase() === String(nomeCategoria).toLowerCase().trim()
            );
            if (categoriaEncontrada) categoriaId = categoriaEncontrada.id;
          }

          // Buscar fornecedor
          let fornecedorId = null;
          if (mapping.fornecedor && fornecedores) {
            const nomeFornecedor = row[mapping.fornecedor];
            const fornecedorEncontrado = fornecedores.find(f => 
              f.nome.toLowerCase() === String(nomeFornecedor).toLowerCase().trim()
            );
            if (fornecedorEncontrado) fornecedorId = fornecedorEncontrado.id;
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
    setColumns([]);
    setMapping({});
    setFileName("");
    setValidationErrors([]);
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
                    <Select value={mapping.data_pagamento} onValueChange={(v) => setMapping({...mapping, data_pagamento: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={mapping.status} onValueChange={(v) => setMapping({...mapping, status: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta</Label>
                    <Select value={mapping.conta} onValueChange={(v) => setMapping({...mapping, conta: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={mapping.categoria} onValueChange={(v) => setMapping({...mapping, categoria: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Fornecedor</Label>
                    <Select value={mapping.fornecedor} onValueChange={(v) => setMapping({...mapping, fornecedor: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Observações</Label>
                    <Select value={mapping.observacoes} onValueChange={(v) => setMapping({...mapping, observacoes: v})}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
            disabled={loading || preview.length === 0}
          >
            {loading ? "Importando..." : `Importar ${preview.length} transações`}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
