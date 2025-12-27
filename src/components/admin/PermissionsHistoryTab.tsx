import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AppRole {
  id: number;
  name: string;
  is_system: boolean;
}

interface AppPermission {
  id: number;
  key: string;
  name: string;
  module: string;
  description?: string;
}

interface AuditRecord {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: 'INSERT' | 'DELETE' | 'UPDATE';
  role_id: number;
  permission_id: number;
  request_id: string | null;
}

interface GroupedAudit {
  request_id: string;
  created_at: string;
  actor_email: string | null;
  actor_user_id: string | null;
  changes: AuditRecord[];
}

interface Props {
  roles: AppRole[];
  permissions: AppPermission[];
}

export function PermissionsHistoryTab({ roles, permissions }: Props) {
  const [auditLog, setAuditLog] = useState<GroupedAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAuditLog();
  }, []);

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('role_permissions_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (queryError) {
        throw queryError;
      }

      if (!data || data.length === 0) {
        setAuditLog([]);
        return;
      }

      // Agrupar por request_id
      const grouped = new Map<string, GroupedAudit>();

      (data as AuditRecord[]).forEach((record) => {
        // Se não tiver request_id, usa record_id como grupo individual
        const groupKey = record.request_id || record.id;

        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, {
            request_id: groupKey,
            created_at: record.created_at,
            actor_email: record.actor_email,
            actor_user_id: record.actor_user_id,
            changes: [],
          });
        }

        grouped.get(groupKey)!.changes.push(record);
      });

      // Converter para array e ordenar por data (mais recente primeiro)
      const result = Array.from(grouped.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setAuditLog(result);
    } catch (err: any) {
      console.error('Erro ao buscar histórico de permissões:', err);
      setError('Não foi possível carregar o histórico. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleName = (roleId: number) => {
    const role = roles.find((r) => r.id === roleId);
    return role?.name || `Cargo #${roleId}`;
  };

  const getPermissionName = (permissionId: number) => {
    const permission = permissions.find((p) => p.id === permissionId);
    return permission?.name || `Permissão #${permissionId}`;
  };

  const getPermissionModule = (permissionId: number) => {
    const permission = permissions.find((p) => p.id === permissionId);
    return permission?.module || 'Desconhecido';
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const formatActorDisplay = (email: string | null, userId: string | null) => {
    if (email) return email;
    if (userId) return `ID: ${userId.slice(0, 8)}...`;
    return 'Sistema';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Erro ao carregar histórico</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <button
              onClick={fetchAuditLog}
              className="mt-2 text-sm text-destructive hover:underline"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </Card>
    );
  }

  if (auditLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">Nenhuma alteração de permissões registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Total de {auditLog.length} lote(s) de alteração(ões)
      </div>

      {auditLog.map((group) => (
        <Collapsible
          key={group.request_id}
          open={expandedGroups.has(group.request_id)}
          onOpenChange={() => toggleGroup(group.request_id)}
        >
          <Card className="overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4 flex-1 text-left">
                  {/* Data e Hora */}
                  <div className="flex items-center gap-2 min-w-fit">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {formatDate(group.created_at)}
                    </span>
                  </div>

                  {/* Ator */}
                  <div className="flex items-center gap-2 min-w-fit">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {formatActorDisplay(group.actor_email, group.actor_user_id)}
                    </span>
                  </div>

                  {/* Contador */}
                  <Badge variant="outline" className="ml-auto">
                    {group.changes.length} alteração(ões)
                  </Badge>
                </div>

                {/* Chevron */}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ml-2 ${
                    expandedGroups.has(group.request_id) ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
                {group.changes.map((change) => {
                  const roleName = getRoleName(change.role_id);
                  const permName = getPermissionName(change.permission_id);
                  const module = getPermissionModule(change.permission_id);
                  const isAdd = change.action === 'INSERT';
                  const isRemove = change.action === 'DELETE';

                  return (
                    <div
                      key={change.id}
                      className="flex items-start gap-3 p-2 rounded text-sm"
                    >
                      {/* Ícone de ação */}
                      <div
                        className={`mt-0.5 p-1 rounded ${
                          isAdd
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : isRemove
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : 'bg-yellow-100 dark:bg-yellow-900/30'
                        }`}
                      >
                        {isAdd ? (
                          <Plus
                            className={`h-3.5 w-3.5 ${
                              isAdd
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          />
                        ) : (
                          <Trash2
                            className={`h-3.5 w-3.5 ${
                              isAdd
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          />
                        )}
                      </div>

                      {/* Descrição da mudança */}
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-medium">{roleName}</span>
                          <span className="text-muted-foreground">
                            {isAdd ? 'ganhou' : 'perdeu'}
                          </span>
                          <span className="font-semibold">{permName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {module}
                          </Badge>
                        </div>
                        {/* ID único da mudança individual */}
                        <div className="text-xs text-muted-foreground mt-1">
                          ID: {change.id.slice(0, 12)}...
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
