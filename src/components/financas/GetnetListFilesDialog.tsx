import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, FileText, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/integrations/supabase/types";

type Integracao = Database["public"]["Tables"]["integracoes_financeiras"]["Row"];

interface SftpFile {
  name: string;
  type: string;
  size: number;
  modified: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integracao: Integracao | null;
  onImportFile: (integracao: Integracao, fileName: string, dataReferencia: string) => void;
}

// getnetextr_YYYYMMDD_XXXXXXXX_c101.txt
const GETNET_DATE_REGEX = /^getnetextr_(\d{4})(\d{2})(\d{2})_/i;

function extractDateFromFileName(name: string): string | null {
  const m = name.match(GETNET_DATE_REGEX);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`; // YYYY-MM-DD
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GetnetListFilesDialog({ open, onOpenChange, integracao, onImportFile }: Props) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    if (!integracao) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("getnet-sftp", {
        body: { action: "list_files", integracao_id: integracao.id },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (!data?.success) throw new Error(data?.error || "Falha ao listar arquivos");
      setFiles(
        (data.files as SftpFile[]).filter(
          (f) => f.type === "-" && !f.name.startsWith(".")
        )
      );
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && integracao) fetchFiles();
    if (!open) { setFiles([]); setError(null); }
  }, [open, integracao?.id]);

  const handleImport = (file: SftpFile) => {
    const dataRef = extractDateFromFileName(file.name) ?? new Date().toISOString().slice(0, 10);
    onImportFile(integracao!, file.name, dataRef);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Arquivos disponíveis no SFTP</DialogTitle>
          <DialogDescription>
            Arquivos encontrados no servidor Getnet. Clique em Importar para processar um arquivo específico.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading && (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Conectando ao SFTP...</span>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
              {error}
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum arquivo encontrado.</p>
          )}

          {!loading && files.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Data do extrato</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Modificado</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => {
                  const dataRef = extractDateFromFileName(f.name);
                  return (
                    <TableRow key={f.name}>
                      <TableCell className="font-mono text-xs flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        {f.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {dataRef
                          ? format(new Date(dataRef + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatSize(f.size)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.modified
                          ? format(new Date(f.modified), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleImport(f)}>
                          <Download className="w-3 h-3 mr-1" />
                          Importar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex justify-between mt-2">
          <Button variant="ghost" size="sm" onClick={fetchFiles} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
