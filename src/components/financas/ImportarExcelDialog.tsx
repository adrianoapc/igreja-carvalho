import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useState } from "react";
import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportarExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "entrada" | "saida";
}

export function ImportarExcelDialog({ open, onOpenChange, tipo }: ImportarExcelDialogProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const queryClient = useQueryClient();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet);
      
      setPreview(jsonData.slice(0, 5)); // Mostrar apenas 5 primeiras linhas
      console.log("Dados do Excel:", jsonData);
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      toast.error("Erro ao ler arquivo Excel");
    }
  };

  const processarImportacao = async () => {
    if (preview.length === 0) {
      toast.error("Nenhum dado para importar");
      return;
    }

    setLoading(true);
    try {
      // Buscar primeira conta disponível como padrão
      const { data: contas } = await supabase
        .from("contas")
        .select("id")
        .eq("ativo", true)
        .limit(1);

      if (!contas || contas.length === 0) {
        toast.error("Nenhuma conta ativa encontrada. Crie uma conta primeiro.");
        setLoading(false);
        return;
      }

      // Aqui você precisará mapear os campos do Excel para os campos do banco
      // Este é um exemplo básico - ajuste conforme a estrutura do seu Excel
      const transacoes = preview.map((row: any) => ({
        tipo,
        descricao: row.Descrição || row.descricao || "",
        valor: parseFloat(String(row.Valor || row.valor || "0").replace(/[^\d,.-]/g, "").replace(",", ".")),
        data_vencimento: row["Data Vencimento"] || row.data_vencimento || new Date().toISOString().split('T')[0],
        status: row.Status || row.status || "pendente",
        tipo_lancamento: "unico",
        conta_id: contas[0].id, // Usar primeira conta ativa como padrão
        // Adicione mais campos conforme necessário
      }));

      // Inserir no banco
      const { error } = await supabase
        .from("transacoes_financeiras")
        .insert(transacoes);

      if (error) throw error;

      toast.success(`${transacoes.length} transações importadas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      onOpenChange(false);
      setPreview([]);
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar transações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar {tipo === "entrada" ? "Entradas" : "Saídas"} via Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              O arquivo Excel deve conter as colunas: Descrição, Valor, Data Vencimento, Status, Conta, Categoria.
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <label htmlFor="excel-upload" className="cursor-pointer">
              <Button type="button" variant="outline" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar arquivo Excel
                </span>
              </Button>
              <input
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {preview.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Prévia (primeiras 5 linhas):</h3>
              <div className="border rounded-lg p-4 bg-muted/50 max-h-64 overflow-auto">
                <pre className="text-xs">{JSON.stringify(preview, null, 2)}</pre>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setPreview([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={processarImportacao}
              disabled={loading || preview.length === 0}
            >
              {loading ? "Importando..." : "Importar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
