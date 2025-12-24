import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Loader2, 
  Search, 
  RefreshCw, 
  Plus, 
  Minus, 
  Edit, 
  ChevronDown, 
  ChevronUp,
  Clock,
  User,
  Key
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  description: string;
}

interface AuditLog {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: 'INSERT' | 'DELETE' | 'UPDATE';
  role_id: number;
  permission_id: number;
  old_row: Record<string, any> | null;
  new_row: Record<string, any> | null;
  source: string | null;
  request_id: string | null;
}

interface PermissionsHistoryTabProps {
  roles: AppRole[];
  permissions: AppPermission[];
}

export function PermissionsHistoryTab({ roles, permissions }: PermissionsHistoryTabProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRequestIds, setExpandedRequestIds] = useState<Set<string>>(new Set());
  
  // Filtros
  const [filterRoleId, setFilterRoleId] = useState<number | 'all'>('all');
  const [filterPermissionId, setFilterPermissionId] = useState<number | 'all'>('all');
  const [filterRequestId, setFilterRequestId] = useState<string>('');
  const [filterActor, setFilterActor] = useState<string>('');

  // Maps para lookup rápido
  const roleMap = useMemo(() => {
    const map = new Map<number, AppRole>();
    roles.forEach(r => map.set(r.id, r));
    return map;
  }, [roles]);

  const permissionMap = useMemo(() => {
    const map = new Map<number, AppPermission>();
    permissions.forEach(p => map.set(p.id, p));
    return map;
  }, [permissions]);

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('role_permissions_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      
      // Cast explícito para o tipo esperado
      const typedData = (data || []).map(item => ({
        ...item,
        action: item.action as 'INSERT' | 'DELETE' | 'UPDATE',
        old_row: item.old_row as Record<string, any> | null,
        new_row: item.new_row as Record<string, any> | null
      }));
      
      setLogs(typedData);
    } catch (error) {
      console.error('Erro ao carregar histórico de auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Aplicar filtros
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterRoleId !== 'all' && log.role_id !== filterRoleId) return false;
      if (filterPermissionId !== 'all' && log.permission_id !== filterPermissionId) return false;
      if (filterRequestId && (!log.request_id || !log.request_id.toLowerCase().includes(filterRequestId.toLowerCase()))) return false;
      if (filterActor && (!log.actor_email || !log.actor_email.toLowerCase().includes(filterActor.toLowerCase()))) return false;
      return true;
    });
  }, [logs, filterRoleId, filterPermissionId, filterRequestId, filterActor]);

  // Agrupar por request_id
  const groupedLogs = useMemo(() => {
    const groups = new Map<string, AuditLog[]>();
    
    filteredLogs.forEach(log => {
      const key = log.request_id || `single-${log.id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(log);
    });
    
    // Ordenar grupos por data mais recente
    return Array.from(groups.entries()).sort((a, b) => {
      const dateA = new Date(a[1][0].created_at).getTime();
      const dateB = new Date(b[1][0].created_at).getTime();
      return dateB - dateA;
    });
  }, [filteredLogs]);

  const toggleExpandGroup = (requestId: string) => {
    setExpandedRequestIds(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return <Plus className="h-3.5 w-3.5 text-green-600" />;
      case 'DELETE': return <Minus className="h-3.5 w-3.5 text-red-600" />;
      case 'UPDATE': return <Edit className="h-3.5 w-3.5 text-blue-600" />;
      default: return null;
    }
  };

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (action) {
      case 'INSERT': return 'default';
      case 'DELETE': return 'destructive';
      case 'UPDATE': return 'secondary';
      default: return 'outline';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'INSERT': return 'Adicionada';
      case 'DELETE': return 'Removida';
      case 'UPDATE': return 'Alterada';
      default: return action;
    }
  };

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando histórico...</span>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      {/* Header de Filtros */}
      <div className="p-4 border-b bg-muted/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Histórico de Alterações ({filteredLogs.length} registros)
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Filtro por Cargo */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Cargo</label>
            <select
              value={filterRoleId}
              onChange={(e) => setFilterRoleId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todos os cargos</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          
          {/* Filtro por Permissão */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Permissão</label>
            <select
              value={filterPermissionId}
              onChange={(e) => setFilterPermissionId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="all">Todas as permissões</option>
              {permissions.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          {/* Filtro por Request ID */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Request ID</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por ID..."
                value={filterRequestId}
                onChange={(e) => setFilterRequestId(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          
          {/* Filtro por Ator */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Usuário</label>
            <div className="relative">
              <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Email do usuário..."
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Logs Agrupados */}
      <div className="divide-y divide-border/50">
        {groupedLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum registro de auditoria encontrado.</p>
          </div>
        ) : (
          groupedLogs.map(([requestId, groupLogs]) => {
            const isExpanded = expandedRequestIds.has(requestId);
            const isSingleLog = requestId.startsWith('single-');
            const firstLog = groupLogs[0];
            const timestamp = format(new Date(firstLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
            
            // Contagem de ações
            const insertCount = groupLogs.filter(l => l.action === 'INSERT').length;
            const deleteCount = groupLogs.filter(l => l.action === 'DELETE').length;
            const updateCount = groupLogs.filter(l => l.action === 'UPDATE').length;

            return (
              <div key={requestId} className="bg-background">
                {/* Header do Grupo */}
                <button
                  onClick={() => !isSingleLog && toggleExpandGroup(requestId)}
                  className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors ${
                    !isSingleLog ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Ícone de expansão (apenas para grupos) */}
                    {!isSingleLog && (
                      <div className="shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    
                    {/* Info principal */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{timestamp}</span>
                        {firstLog.actor_email && (
                          <Badge variant="outline" className="text-xs font-normal">
                            {firstLog.actor_email}
                          </Badge>
                        )}
                        {firstLog.source && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {firstLog.source}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Para log único, mostrar detalhes inline */}
                      {isSingleLog && (
                        <div className="flex items-center gap-2">
                          <Badge variant={getActionBadgeVariant(firstLog.action)} className="text-xs gap-1">
                            {getActionIcon(firstLog.action)}
                            {getActionLabel(firstLog.action)}
                          </Badge>
                          <span className="text-sm">
                            <strong>{roleMap.get(firstLog.role_id)?.name || `Role ${firstLog.role_id}`}</strong>
                            {' → '}
                            <span className="text-muted-foreground">
                              {permissionMap.get(firstLog.permission_id)?.name || `Permission ${firstLog.permission_id}`}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo do grupo */}
                  {!isSingleLog && (
                    <div className="flex items-center gap-2 shrink-0">
                      {insertCount > 0 && (
                        <Badge variant="default" className="text-xs gap-1">
                          <Plus className="h-3 w-3" />
                          {insertCount}
                        </Badge>
                      )}
                      {deleteCount > 0 && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <Minus className="h-3 w-3" />
                          {deleteCount}
                        </Badge>
                      )}
                      {updateCount > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Edit className="h-3 w-3" />
                          {updateCount}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">
                        {groupLogs.length} alteração(ões)
                      </span>
                    </div>
                  )}
                </button>

                {/* Detalhes expandidos do grupo */}
                {!isSingleLog && isExpanded && (
                  <div className="px-4 pb-3 pt-1 space-y-2 bg-muted/20">
                    {/* Request ID */}
                    <div className="text-xs text-muted-foreground mb-2">
                      Request ID: <code className="bg-muted px-1 py-0.5 rounded">{requestId}</code>
                    </div>
                    
                    {/* Lista de alterações no grupo */}
                    {groupLogs.map(log => (
                      <div 
                        key={log.id} 
                        className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-background border text-sm"
                      >
                        <Badge variant={getActionBadgeVariant(log.action)} className="text-xs gap-1 shrink-0">
                          {getActionIcon(log.action)}
                          {getActionLabel(log.action)}
                        </Badge>
                        <span className="truncate">
                          <strong>{roleMap.get(log.role_id)?.name || `Role ${log.role_id}`}</strong>
                          {' → '}
                          <span className="text-muted-foreground">
                            {permissionMap.get(log.permission_id)?.name || `Permission ${log.permission_id}`}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer com paginação futura */}
      {filteredLogs.length > 0 && (
        <div className="p-3 border-t bg-muted/10 text-center text-xs text-muted-foreground">
          Exibindo até 500 registros mais recentes
        </div>
      )}
    </Card>
  );
}
