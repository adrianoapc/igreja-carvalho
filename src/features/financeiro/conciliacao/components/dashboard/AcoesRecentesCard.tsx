import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileCheck, Sparkles, CheckCircle2, Layers } from "lucide-react";
import { parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { anonymizePixDescription } from "@/utils/anonymization";
import type { AuditLog } from "../../hooks/useDashboardConciliacaoData";

interface AcoesRecentesCardProps {
  recentActions?: AuditLog[];
  className?: string;
}

function getTipoIcon(tipo: string | null, hasLote: boolean) {
  if (hasLote) return <Layers className="w-4 h-4 text-purple-600" />;
  switch (tipo) {
    case "automatico":
      return <Sparkles className="w-4 h-4 text-green-600" />;
    case "manual":
      return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
    default:
      return <FileCheck className="w-4 h-4 text-muted-foreground" />;
  }
}

function getTipoLabel(tipo: string | null, hasLote: boolean) {
  if (hasLote) return "Lote";
  if (tipo === "automatico") return "Auto";
  if (tipo === "manual") return "Manual";
  return tipo || "Conciliado";
}

/** Card "Ações Recentes" — últimas 10 entradas do audit log de conciliação. */
export function AcoesRecentesCard({ recentActions, className }: AcoesRecentesCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4" />
          Ações Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {!recentActions?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma ação recente
            </p>
          ) : (
            <div className="space-y-3">
              {recentActions.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <div className="flex items-center gap-2">
                    {getTipoIcon(log.tipo_reconciliacao, !!log.conciliacao_lote_id)}
                    <Badge variant="outline" className="text-xs">
                      {getTipoLabel(log.tipo_reconciliacao, !!log.conciliacao_lote_id)}
                      {log.score && ` ${log.score}%`}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(parseISO(log.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  {log.extratos_bancarios && (
                    <p className="text-xs truncate">
                      <span className="text-muted-foreground">Extrato:</span>{" "}
                      {anonymizePixDescription(log.extratos_bancarios.descricao)}
                    </p>
                  )}
                  {log.transacoes_financeiras && (
                    <p className="text-xs truncate">
                      <span className="text-muted-foreground">Transação:</span>{" "}
                      {log.transacoes_financeiras.descricao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
