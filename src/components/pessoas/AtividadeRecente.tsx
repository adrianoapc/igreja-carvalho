import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ActivitySquare, UserCheck, Edit3, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "VIEW";
  table_name: string;
  description: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
  user_id?: string;
  user_nome?: string;
}

interface AtividadeRecenteProps {
  profileId: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case "CREATE":
      return <Plus className="w-4 h-4" />;
    case "UPDATE":
      return <Edit3 className="w-4 h-4" />;
    case "DELETE":
      return <Trash2 className="w-4 h-4" />;
    case "VIEW":
      return <UserCheck className="w-4 h-4" />;
    default:
      return <ActivitySquare className="w-4 h-4" />;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case "CREATE":
      return "bg-green-100 text-green-800";
    case "UPDATE":
      return "bg-blue-100 text-blue-800";
    case "DELETE":
      return "bg-red-100 text-red-800";
    case "VIEW":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case "CREATE":
      return "Criado";
    case "UPDATE":
      return "Atualizado";
    case "DELETE":
      return "Removido";
    case "VIEW":
      return "Visualizado";
    default:
      return "Modificado";
  }
};

export function AtividadeRecente({ profileId }: AtividadeRecenteProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("profile_audit_log")
          .select("*")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        setLogs(data || []);
      } catch (err) {
        console.error("Erro ao carregar auditoria:", err);
        setError("Não foi possível carregar o histórico de atividades");
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();

    // Subscribe para atualizações em tempo real
    const subscription = supabase
      .channel(`audit_log:profile_id=eq.${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile_audit_log",
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLogs((prev) => [payload.new as AuditLog, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profileId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivitySquare className="w-5 h-5" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivitySquare className="w-5 h-5" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivitySquare className="w-5 h-5" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-1">Nenhuma atividade recente</p>
          <p className="text-xs text-muted-foreground">
            As últimas interações com essa pessoa aparecerão aqui
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ActivitySquare className="w-5 h-5" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
            >
              <div
                className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                  getActionColor(log.action)
                )}
              >
                {getActionIcon(log.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {getActionLabel(log.action)}
                  </Badge>
                  {log.table_name === "profile_contatos" && (
                    <Badge variant="secondary" className="text-xs">
                      Contato
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium break-words">
                  {log.description}
                </p>
                {(log.old_value || log.new_value) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {log.old_value && (
                      <span>
                        Anterior: <code className="bg-muted px-1 py-0.5 rounded">{log.old_value}</code>
                      </span>
                    )}
                    {log.old_value && log.new_value && <span> → </span>}
                    {log.new_value && (
                      <span>
                        Novo: <code className="bg-muted px-1 py-0.5 rounded">{log.new_value}</code>
                      </span>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(log.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
