import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Integracao = Database["public"]["Tables"]["integracoes_financeiras"]["Row"];

interface ImportResult {
  success: boolean;
  arquivos?: Array<{
    nome: string;
    status: string;
    total_recebido?: number;
    total_inserido?: number;
    total_ignorado?: number;
    erro?: string;
  }>;
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integracao: Integracao | null;
  initialDate?: string;
  initialFileName?: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GetnetImportDialog({
  open,
  onOpenChange,
  integracao,
  initialDate,
  initialFileName,
}: Props) {
  const [date, setDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate + "T12:00:00") : new Date()
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setResult(null);
    onOpenChange(isOpen);
  };

  const dataReferencia = date
    ? format(date, "yyyy-MM-dd")
    : todayISO();

  const handleImport = async () => {
    if (!integracao) return;
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, string> = {
        action: "import_extrato",
        integracao_id: integracao.id,
        data_referencia: dataReferencia,
      };
      if (initialFileName) body.arquivo_nome = initialFileName;

      const { data, error: fnErr } = await supabase.functions.invoke("getnet-sftp", { body });
      if (fnErr) throw new Error(fnErr.message);
      setResult(data as ImportResult);
    } catch (err: any) {
      setResult({ success: false, error: err.message || "Erro desconhecido" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Extrato Getnet</DialogTitle>
          <DialogDescription>
            Selecione a data do extrato a importar. A função buscará o arquivo correspondente no SFTP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {initialFileName && (
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-muted/40">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-xs truncate">{initialFileName}</span>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium">Data de referência</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                  disabled={loading || !!result?.success}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date
                    ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ptBR}
                  disabled={(d) => d > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Buscará arquivo no padrão EEVD_*_{format(date ?? new Date(), "ddMMyyyy")}.txt
            </p>
          </div>

          {result && (
            <div
              className={cn(
                "rounded-md border p-3 text-sm space-y-2",
                result.success ? "border-green-500/30 bg-green-50 dark:bg-green-950/20" : "border-destructive/30 bg-destructive/5"
              )}
            >
              <div className="flex items-center gap-2 font-medium">
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                {result.success ? "Importação concluída" : "Falha na importação"}
              </div>

              {result.error && (
                <p className="text-destructive text-xs">{result.error}</p>
              )}

              {result.arquivos && result.arquivos.length > 0 && (
                <div className="space-y-1">
                  {result.arquivos.map((a, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <p className="font-mono truncate text-muted-foreground">{a.nome}</p>
                      {a.status === "processado" ? (
                        <p>
                          Recebido: <strong>{a.total_recebido}</strong> · Inserido:{" "}
                          <strong>{a.total_inserido}</strong> · Ignorado:{" "}
                          <strong>{a.total_ignorado}</strong>
                        </p>
                      ) : (
                        <p className="text-destructive">{a.erro || a.status}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {result?.success ? "Fechar" : "Cancelar"}
          </Button>
          {!result?.success && (
            <Button onClick={handleImport} disabled={loading || !date}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                "Importar"
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
