import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivitySquare } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContextProvider";

interface ActivitySummary {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  lastActivity?: string;
}

export function AtividadeRecenteSummary() {
  const { igrejaId } = useAuthContext();
  const [summary, setSummary] = useState<ActivitySummary>({
    total: 0,
    created: 0,
    updated: 0,
    deleted: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivitySummary = async () => {
      if (!igrejaId) return;

      try {
        setLoading(true);

        // Buscar todos os logs de auditoria da igreja
        const { data, error } = await supabase
          .from("profile_audit_log")
          .select("action, created_at")
          .eq("igreja_id", igrejaId)
          .order("created_at", { ascending: false })
          .limit(1000); // Limitar a 1000 registros para performance

        if (error) throw error;

        if (data && data.length > 0) {
          const created = data.filter((l) => l.action === "CREATE").length;
          const updated = data.filter((l) => l.action === "UPDATE").length;
          const deleted = data.filter((l) => l.action === "DELETE").length;

          setSummary({
            total: data.length,
            created,
            updated,
            deleted,
            lastActivity: data[0].created_at,
          });
        }
      } catch (error) {
        console.error("Erro ao carregar resumo de atividade:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivitySummary();

    // Subscribe para atualizações em tempo real
    const subscription = supabase
      .channel(`audit_log:igreja_id=eq.${igrejaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "profile_audit_log",
          filter: `igreja_id=eq.${igrejaId}`,
        },
        (payload) => {
          setSummary((prev) => {
            const action = payload.new.action as string;
            const newSummary = { ...prev, total: prev.total + 1 };

            if (action === "CREATE") newSummary.created += 1;
            else if (action === "UPDATE") newSummary.updated += 1;
            else if (action === "DELETE") newSummary.deleted += 1;

            return newSummary;
          });
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [igrejaId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <ActivitySquare className="w-5 h-5" />
            Atividade Recente de Alteraç˜oes em Pessoas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <ActivitySquare className="w-5 h-5" />
          Atividade Recente
        </CardTitle>
        {/* Resumo das alterações */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-green-50 p-3 border border-green-200">
            <p className="text-xs font-semibold text-green-600 uppercase">
              Criados
            </p>
            <p className="mt-1 text-xl font-bold text-green-700">
              {summary.created}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
            <p className="text-xs font-semibold text-blue-600 uppercase">
              Alterados
            </p>
            <p className="mt-1 text-xl font-bold text-blue-700">
              {summary.updated}
            </p>
          </div>
          <div className="rounded-lg bg-red-50 p-3 border border-red-200">
            <p className="text-xs font-semibold text-red-600 uppercase">
              Removidos
            </p>
            <p className="mt-1 text-xl font-bold text-red-700">
              {summary.deleted}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase">
              Total
            </p>
            <p className="mt-1 text-xl font-bold text-gray-700">
              {summary.total}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-6">
        {summary.lastActivity ? (
          <p className="text-xs text-muted-foreground">
            📊 Resumo das alterações feitas em pessoas e contatos da sua igreja
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma atividade registrada ainda
          </p>
        )}
      </CardContent>
    </Card>
  );
}
