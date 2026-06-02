import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integracaoId: string | null;
}

const ACAO_LABEL: Record<string, string> = {
  test_connection: "Teste de conexão",
  list_files: "Listar arquivos",
  download_file: "Download",
  import_extrato: "Importar extrato",
};

function statusBadge(status: string) {
  const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
    success: "default",
    error: "destructive",
    partial: "secondary",
    running: "outline",
  };
  const labels: Record<string, string> = {
    success: "Sucesso",
    error: "Erro",
    partial: "Parcial",
    running: "Em execução",
  };
  return (
    <Badge variant={variants[status] ?? "outline"}>
      {labels[status] ?? status}
    </Badge>
  );
}

export function IntegracaoLogsDialog({ open, onOpenChange, integracaoId }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["integracao_logs", integracaoId, statusFilter],
    enabled: open && !!integracaoId,
    queryFn: async () => {
      let q = supabase
        .from("integracoes_execucoes_log" as any)
        .select("*")
        .eq("integracao_id", integracaoId!)
        .order("iniciado_em", { ascending: false })
        .limit(50);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{
        className: "sm:max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0",
      }}
    >
      <DialogHeader className="px-6 pt-6 pb-4 border-b">
        <DialogTitle>Histórico de execuções</DialogTitle>
        <DialogDescription>
          Últimas 50 execuções desta integração (testes, listagens e
          importações).
        </DialogDescription>
        <div className="flex items-center gap-2 pt-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
              <SelectItem value="partial">Parcial</SelectItem>
              <SelectItem value="running">Em execução</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhuma execução registrada ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.map((log) => (
              <li
                key={log.id}
                className="rounded-md border border-border p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {ACAO_LABEL[log.acao] ?? log.acao}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.iniciado_em), "dd/MM/yyyy HH:mm:ss", {
                        locale: ptBR,
                      })}
                      {log.duracao_ms != null && ` · ${log.duracao_ms} ms`}
                    </p>
                  </div>
                  {statusBadge(log.status)}
                </div>

                {log.arquivo_nome && (
                  <p className="text-xs">
                    📄 <span className="font-mono">{log.arquivo_nome}</span>
                    {log.arquivo_tamanho != null && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {Math.round(log.arquivo_tamanho / 1024)} KB
                      </span>
                    )}
                  </p>
                )}

                {(log.total_recebido != null ||
                  log.total_inserido != null ||
                  log.total_ignorado != null) && (
                  <div className="text-xs grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-muted-foreground">Recebido:</span>{" "}
                      <span className="font-medium">
                        {log.total_recebido ?? "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Inserido:</span>{" "}
                      <span className="font-medium">
                        {log.total_inserido ?? "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ignorado:</span>{" "}
                      <span className="font-medium">
                        {log.total_ignorado ?? "-"}
                      </span>
                    </div>
                  </div>
                )}

                {log.erro_mensagem && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-destructive font-medium">
                      Erro: {log.erro_mensagem}
                    </summary>
                    {log.erro_stack && (
                      <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto whitespace-pre-wrap">
                        {log.erro_stack}
                      </pre>
                    )}
                  </details>
                )}

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Metadata
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end px-6 py-4 border-t bg-background">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
