import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, AlertCircle, Loader2, RotateCcw, CheckCircle2, XCircle, Users, History } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { PermissionsHistoryTab } from '@/components/admin/PermissionsHistoryTab';

// Tipos baseados nas tabelas do Supabase
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

interface RolePermission {
  role_id: number;
  permission_id: number;
}

// Tipo para rastrear mudanças
interface PendingChange {
  roleId: number;
  permissionId: number;
  action: 'add' | 'remove';
}

export default function AdminPermissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'matrix' | 'history'>('matrix');

  // Estados de Dados
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [matrix, setMatrix] = useState<RolePermission[]>([]);
  const [originalMatrix, setOriginalMatrix] = useState<RolePermission[]>([]);
  const [lastSavedMatrix, setLastSavedMatrix] = useState<RolePermission[] | null>(null);
  
  // Controle de mudanças pendentes
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  // Filtros e seleção
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | 'all'>('all');
  const [reviewMode, setReviewMode] = useState<'all' | 'enabledOnly' | 'pendingOnly'>('all');

  // Índices em memória para lookups rápidos
  const matrixSet = useMemo(() => {
    return new Set(matrix.map((x) => `${x.role_id}:${x.permission_id}`));
  }, [matrix]);

  const effectiveSet = useMemo(() => {
    const s = new Set<string>(originalMatrix.map((x) => `${x.role_id}:${x.permission_id}`));
    for (const change of pendingChanges) {
      const key = `${change.roleId}:${change.permissionId}`;
      if (change.action === 'add') s.add(key);
      else s.delete(key);
    }
    return s;
  }, [originalMatrix, pendingChanges]);

  // Carregar dados iniciais
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Buscar Cargos (Ordenados por ID)
      const { data: rolesData, error: rolesError } = await supabase
        .from('app_roles')
        .select('*')
        .order('id');
      if (rolesError) throw rolesError;

      // 2. Buscar Catálogo de Permissões
      const { data: permsData, error: permsError } = await supabase
        .from('app_permissions')
        .select('*')
        .order('module, id');
      if (permsError) throw permsError;

      // 3. Buscar a Matriz Atual (Ligações)
      const { data: matrixData, error: matrixError } = await supabase
        .from('role_permissions')
        .select('*');
      if (matrixError) throw matrixError;

      setRoles(rolesData || []);
      setPermissions(permsData || []);
      setMatrix(matrixData || []);
      setOriginalMatrix(matrixData ? [...matrixData] : []);
      setPendingChanges([]);

    } catch (error: any) {
      console.error('Erro ao carregar permissões:', error);
      const t = toast({
        variant: "destructive",
        title: "Erro ao carregar",
        description: "Não foi possível buscar as permissões do sistema.",
        action: (
          <ToastAction altText="Fechar" onClick={() => t.dismiss()}>
            Fechar
          </ToastAction>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para checar se está ativo (considerando mudanças pendentes)
  const hasPermission = (roleId: number, permId: number) => {
    return matrixSet.has(`${roleId}:${permId}`);
  };

  // Estado visual efetivo considerando snapshot original + mudanças pendentes
  const getEffectiveState = (roleId: number, permId: number) => {
    return effectiveSet.has(`${roleId}:${permId}`);
  };

  // Indica se a célula possui alteração pendente
  const isCellPending = (roleId: number, permId: number) => {
    return pendingChanges.some(
      (c) => c.roleId === roleId && c.permissionId === permId
    );
  };

  // Helpers de dependência
  const findPermissionIdByKey = useCallback((key: string) => {
    const perm = permissions.find((p) => p.key === key);
    return perm?.id;
  }, [permissions]);

  const getViewKeyFromManageKey = (manageKey: string) => {
    return manageKey.endsWith('.manage')
      ? manageKey.replace(/\.manage$/, '.view')
      : undefined;
  };

  // Função de Toggle (apenas atualiza UI e registra mudanças)
  const handleToggle = useCallback((roleId: number, permId: number) => {
    const perm = permissions.find((p) => p.id === permId);
    if (!perm) return;

    const isActive = hasPermission(roleId, permId);
    const isManage = perm.key.endsWith('.manage');
    const isView = perm.key.endsWith('.view');

    // Regra correta: bloquear desativar .view se .manage estiver ativo
    if (isView && isActive) {
      const manageKey = perm.key.replace(/\.view$/, '.manage');
      const managePermId = findPermissionIdByKey(manageKey);
      if (managePermId) {
        const manageActive = hasPermission(roleId, managePermId);
        if (manageActive) {
          {
            const t = toast({
              variant: 'destructive',
              title: 'Ação bloqueada',
              description: 'Para remover view, remova manage antes.',
              action: (
                <ToastAction altText="Fechar" onClick={() => t.dismiss()}>
                  Fechar
                </ToastAction>
              ),
            });
          }
          return;
        }
      }
    }

    // Calcular próxima matriz considerando dependências
    setMatrix((prev) => {
      let next = prev;
      const exists = next.some((p) => p.role_id === roleId && p.permission_id === permId);
      if (exists) {
        next = next.filter((p) => !(p.role_id === roleId && p.permission_id === permId));
      } else {
        next = [...next, { role_id: roleId, permission_id: permId }];
      }

      // Se ativar .manage, garantir .view ativo
      if (isManage) {
        const viewKey = getViewKeyFromManageKey(perm.key);
        const viewPermId = viewKey ? findPermissionIdByKey(viewKey) : undefined;
        if (viewPermId) {
          const viewExists = next.some((p) => p.role_id === roleId && p.permission_id === viewPermId);
          const manageNowActive = next.some((p) => p.role_id === roleId && p.permission_id === permId);
          if (manageNowActive && !viewExists) {
            next = [...next, { role_id: roleId, permission_id: viewPermId }];
          }
        }
      }

      // Atualizar pendingChanges com base em next vs original
      setPendingChanges((prevChanges) => {
        const updateFor = (
          changes: PendingChange[],
          rId: number,
          pId: number
        ): PendingChange[] => {
          const filtered = changes.filter(
            (c) => !(c.roleId === rId && c.permissionId === pId)
          );
          const originalHas = originalMatrix.some(
            (p) => p.role_id === rId && p.permission_id === pId
          );
          const nextHas = next.some(
            (p) => p.role_id === rId && p.permission_id === pId
          );
          if (originalHas && !nextHas) return [...filtered, { roleId: rId, permissionId: pId, action: 'remove' as const }];
          if (!originalHas && nextHas) return [...filtered, { roleId: rId, permissionId: pId, action: 'add' as const }];
          return filtered;
        };

        let updated = updateFor(prevChanges, roleId, permId);

        if (isManage) {
          const viewKey = getViewKeyFromManageKey(perm.key);
          const viewPermId = viewKey ? findPermissionIdByKey(viewKey) : undefined;
          if (viewPermId) {
            updated = updateFor(updated, roleId, viewPermId);
          }
        }

        return updated;
      });

      return next;
    });
  }, [permissions, originalMatrix, findPermissionIdByKey]);

  // Ações em lote por módulo e cargo
  const handleBulkToggleModule = useCallback(
    (roleId: number, moduleKey: string, action: 'activate' | 'deactivate') => {
      // Admin bloqueado
      const role = roles.find(r => r.id === roleId);
      if (!role || role.name === 'admin') return;

      // Lista de permissões do módulo
      const permsInModule = permissions.filter(p => p.module === moduleKey);

      // Ordenação: manage antes de view para consistência
      const ordered = permsInModule.sort((a, b) => {
        const aManage = a.key.endsWith('.manage') ? -1 : 0;
        const bManage = b.key.endsWith('.manage') ? -1 : 0;
        const aView = a.key.endsWith('.view') ? 1 : 0;
        const bView = b.key.endsWith('.view') ? 1 : 0;
        return (aManage - bManage) || (aView - bView);
      });

      if (action === 'activate') {
        for (const p of ordered) {
          const effective = getEffectiveState(roleId, p.id);
          if (!effective) {
            handleToggle(roleId, p.id);
          }
        }
      } else {
        // Primeiro desativar manages, depois views e demais
        const manages = ordered.filter(p => p.key.endsWith('.manage'));
        const others = ordered.filter(p => !p.key.endsWith('.manage'));
        for (const p of manages) {
          const effective = getEffectiveState(roleId, p.id);
          if (effective) {
            handleToggle(roleId, p.id);
          }
        }
        for (const p of others) {
          const effective = getEffectiveState(roleId, p.id);
          if (effective) {
            handleToggle(roleId, p.id);
          }
        }
      }
    }, [roles, permissions, getEffectiveState, handleToggle]
  );

  // Agrupar permissões por módulo para as Abas
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, AppPermission[]>);

  const modules = Object.keys(groupedPermissions);

  // Contagem de alterações pendentes por módulo (respeitando filtro de cargo)
  const pendingCountsByModule = useMemo(() => {
    const map: Record<string, number> = {};
    for (const mod of modules) map[mod] = 0;

    const targetRoleIds = selectedRoleId === 'all' ? roles.map(r => r.id) : [selectedRoleId as number];
    const permIdToModule = new Map<number, string>();
    for (const p of permissions) permIdToModule.set(p.id, p.module);

    for (const change of pendingChanges) {
      if (targetRoleIds.includes(change.roleId)) {
        const mod = permIdToModule.get(change.permissionId);
        if (mod) map[mod] = (map[mod] || 0) + 1;
      }
    }

    return map;
  }, [pendingChanges, permissions, selectedRoleId, roles, modules]);

  // Gerar UUID v4 para request_id
  const generateUUID = () => {
    return crypto.randomUUID();
  };

  // Função para salvar mudanças em batch (com auditoria)
  const handleSaveChanges = async () => {
    if (pendingChanges.length === 0 || saving) return;
    
    try {
      setSaving(true);
      
      // Gerar request_id único para agrupar as alterações
      const requestId = generateUUID();
      
      // Definir contexto de auditoria via RPC
      const { error: contextError } = await supabase.rpc('set_audit_context', {
        p_request_id: requestId,
        p_source: 'admin-ui'
      });
      
      if (contextError) {
        console.warn('Aviso: não foi possível definir contexto de auditoria:', contextError);
        // Continua mesmo se falhar (auditoria ficará sem request_id)
      }
      
      // Snapshot anterior para possível desfazer
      const previousSnapshot = [...originalMatrix];
      
      // Separar adds e removes
      const toAdd = pendingChanges.filter(c => c.action === 'add');
      const toRemove = pendingChanges.filter(c => c.action === 'remove');
      
      // Executar deletes em lote
      if (toRemove.length > 0) {
        const deleteConditions = toRemove.map(c => ({ 
          role_id: c.roleId, 
          permission_id: c.permissionId 
        }));
        
        for (const condition of deleteConditions) {
          const { error } = await supabase
            .from('role_permissions')
            .delete()
            .match(condition);
          if (error) throw error;
        }
      }
      
      // Executar inserts em lote
      if (toAdd.length > 0) {
        const insertData = toAdd.map(c => ({
          role_id: c.roleId,
          permission_id: c.permissionId
        }));
        
        const { error } = await supabase
          .from('role_permissions')
          .insert(insertData);
        if (error) throw error;
      }
      
      // Atualizar state e limpar mudanças
      setOriginalMatrix([...matrix]);
      setLastSavedMatrix(previousSnapshot);
      setPendingChanges([]);
      
      const t = toast({
        title: "Salvo com sucesso",
        description: `${toAdd.length + toRemove.length} permissão(ões) atualizada(s). ID: ${requestId.slice(0, 8)}...`,
        action: (
          <ToastAction altText="Desfazer" onClick={() => { handleUndoLastSave(); t.dismiss(); }}>
            Desfazer
          </ToastAction>
        ),
      });
      
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      const t = toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        action: (
          <ToastAction altText="Fechar" onClick={() => t.dismiss()}>
            Fechar
          </ToastAction>
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  // Desfazer última operação de salvar
  const handleUndoLastSave = async () => {
    if (!lastSavedMatrix || saving) return;
    try {
      setSaving(true);
      
      // Gerar request_id para undo também
      const requestId = generateUUID();
      await supabase.rpc('set_audit_context', {
        p_request_id: requestId,
        p_source: 'admin-ui-undo'
      });
      
      // Estado atual salvo (originalMatrix) deve ser revertido para lastSavedMatrix
      const current = originalMatrix;
      const previous = lastSavedMatrix;

      const currentSet = new Set(current.map((x) => `${x.role_id}:${x.permission_id}`));
      const previousSet = new Set(previous.map((x) => `${x.role_id}:${x.permission_id}`));

      // Itens a remover: presentes em current e não em previous
      const toRemove: RolePermission[] = current.filter(
        (x) => !previousSet.has(`${x.role_id}:${x.permission_id}`)
      );
      // Itens a adicionar: presentes em previous e não em current
      const toAdd: RolePermission[] = previous.filter(
        (x) => !currentSet.has(`${x.role_id}:${x.permission_id}`)
      );

      // Remover em lote
      if (toRemove.length > 0) {
        for (const item of toRemove) {
          const { error } = await supabase
            .from('role_permissions')
            .delete()
            .match({ role_id: item.role_id, permission_id: item.permission_id });
          if (error) throw error;
        }
      }

      // Adicionar em lote
      if (toAdd.length > 0) {
        const insertData = toAdd.map((x) => ({ role_id: x.role_id, permission_id: x.permission_id }));
        const { error } = await supabase
          .from('role_permissions')
          .insert(insertData);
        if (error) throw error;
      }

      // Atualizar estados locais
      setOriginalMatrix(previous);
      setMatrix(previous);
      setPendingChanges([]);

      {
        const t = toast({
          title: 'Desfeito',
          description: 'As alterações foram revertidas para o estado anterior.',
          action: (
            <ToastAction altText="Fechar" onClick={() => t.dismiss()}>
              Fechar
            </ToastAction>
          ),
        });
      }
    } catch (error: any) {
      console.error('Erro ao desfazer alterações:', error);
      {
        const t = toast({
          variant: 'destructive',
          title: 'Erro ao desfazer',
          description: 'Não foi possível reverter as alterações.',
          action: (
            <ToastAction altText="Fechar" onClick={() => t.dismiss()}>
              Fechar
            </ToastAction>
          ),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // Função para descartar mudanças
  const handleDiscardChanges = () => {
    setMatrix([...originalMatrix]);
    setPendingChanges([]);
    {
      const t = toast({
        title: "Alterações descartadas",
        description: "Voltando ao estado anterior.",
        action: (
          <ToastAction altText="Fechar" onClick={() => t.dismiss()}>
            Fechar
          </ToastAction>
        ),
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> 
            Matriz de Permissões
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie acessos por cargo.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Abas principais: Matriz / Histórico */}
          <div className="flex bg-muted rounded-lg p-1 mr-2">
            <Button
              variant={activeMainTab === 'matrix' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveMainTab('matrix')}
              className="gap-1.5"
            >
              <Shield className="h-4 w-4" />
              Matriz
            </Button>
            <Button
              variant={activeMainTab === 'history' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveMainTab('history')}
              className="gap-1.5"
            >
              <History className="h-4 w-4" />
              Histórico
            </Button>
          </div>

          {activeMainTab === 'matrix' && (
            <>
              {/* Botão Salvar (Primário) */}
              <Button 
                onClick={handleSaveChanges}
                disabled={pendingChanges.length === 0 || saving}
                className="min-w-max"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  `Salvar alterações (${pendingChanges.length})`
                )}
              </Button>
              
              {/* Botão Descartar (Secundário) */}
              {pendingChanges.length > 0 && (
                <Button 
                  variant="outline"
                  onClick={handleDiscardChanges}
                  disabled={saving}
                  className="min-w-max"
                >
                  Descartar
                </Button>
              )}
              
              {/* Botão Recarregar dados */}
              <Button 
                variant="ghost"
                size="sm"
                onClick={fetchData}
                disabled={saving}
                title="Recarregar dados do servidor"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo baseado na aba principal */}
      {activeMainTab === 'history' ? (
        <PermissionsHistoryTab roles={roles} permissions={permissions} />
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <Tabs defaultValue={modules[0] || 'system'} className="w-full">
              
              {/* Lista de Abas (Módulos) - Com scroll horizontal em mobile */}
              <div className="px-3 sm:px-4 pt-4 pb-2 border-b bg-muted/5">
                <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <TabsList className="inline-flex h-9 items-center justify-start gap-1 bg-transparent p-0 w-max sm:w-auto">
                    {modules.map(modKey => (
                      <TabsTrigger 
                        key={modKey} 
                        value={modKey}
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-xs sm:text-sm whitespace-nowrap transition-all inline-flex items-center gap-2"
                      >
                        {modKey === 'finance' ? '💰 Financeiro' : 
                         modKey === 'members' ? '👥 Membros' : 
                         modKey === 'worship' ? '🎵 Cultos' : 
                         modKey === 'kids' ? '👶 Kids' :
                         modKey === 'system' ? '⚙️ Sistema' : modKey}
                        {pendingCountsByModule[modKey] > 0 && (
                          <Badge 
                            variant="outline" 
                            className="h-5 px-1.5 text-[10px] bg-amber-100 text-amber-700 border-amber-200"
                            title={`${pendingCountsByModule[modKey]} alteração(ões) pendente(s) neste módulo`}
                          >
                            {pendingCountsByModule[modKey]}
                          </Badge>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </div>

              {/* Barra de filtros */}
              <div className="px-3 sm:px-4 py-2 border-b bg-muted/10 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, chave ou descrição"
                  className="flex-1 min-w-[200px] rounded-md border bg-background px-3 py-2 text-sm"
                />
                <select
                  value={selectedRoleId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedRoleId(val === 'all' ? 'all' : Number(val));
                  }}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  title="Filtrar por cargo"
                >
                  <option value="all">Todos os cargos</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <select
                  value={reviewMode}
                  onChange={(e) => setReviewMode(e.target.value as 'all' | 'enabledOnly' | 'pendingOnly')}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  title="Modo de revisão"
                >
                  <option value="all">Todas as permissões</option>
                  <option value="enabledOnly">Somente ativadas</option>
                  <option value="pendingOnly">Somente pendentes</option>
                </select>
              </div>

              {/* Conteúdo das Abas */}
              {modules.map(moduleKey => (
                <TabsContent key={moduleKey} value={moduleKey} className="m-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                      <thead className="bg-muted/50 text-muted-foreground uppercase font-medium text-[10px] sm:text-xs">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 w-[200px] sm:w-[300px] sticky left-0 bg-muted/50 z-10">Permissão</th>
                          {(selectedRoleId === 'all' ? roles : roles.filter(r => r.id === selectedRoleId)).map(role => (
                            <th key={role.id} className="px-2 sm:px-4 py-3 text-center min-w-[100px]">
                              <div className="flex flex-col items-center gap-1">
                                <Badge 
                                  variant={role.name === 'admin' ? "default" : "outline"} 
                                  className="capitalize whitespace-nowrap text-[10px] h-5 px-1.5"
                                >
                                  {role.name}
                                </Badge>
                                <div className="flex items-center gap-1 mt-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={role.name === 'admin'}
                                    title="Ativar tudo neste módulo para este cargo"
                                    onClick={() => handleBulkToggleModule(role.id, moduleKey, 'activate')}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={role.name === 'admin'}
                                    title="Desativar tudo neste módulo para este cargo"
                                    onClick={() => handleBulkToggleModule(role.id, moduleKey, 'deactivate')}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {groupedPermissions[moduleKey]
                          .filter((perm) => {
                            // Filtro por busca
                            if (searchTerm) {
                              const q = searchTerm.toLowerCase();
                              const matches = (
                                perm.name.toLowerCase().includes(q) ||
                                perm.key.toLowerCase().includes(q) ||
                                (perm.description ? perm.description.toLowerCase().includes(q) : false)
                              );
                              if (!matches) return false;
                            }

                            // Filtro por reviewMode
                            const targetRoles = (selectedRoleId === 'all' ? roles : roles.filter(r => r.id === selectedRoleId));
                            if (reviewMode === 'enabledOnly') {
                              const anyOn = targetRoles.some(r => getEffectiveState(r.id, perm.id));
                              if (!anyOn) return false;
                            } else if (reviewMode === 'pendingOnly') {
                              const anyPending = targetRoles.some(r => isCellPending(r.id, perm.id));
                              if (!anyPending) return false;
                            }

                            return true;
                          })
                          .map((perm) => (
                          <tr key={perm.id} className="hover:bg-muted/30 transition-colors group">
                            <td className="px-3 sm:px-6 py-3 sticky left-0 bg-background group-hover:bg-muted/30 z-10">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-medium text-foreground text-xs sm:text-sm line-clamp-2">{perm.name}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono hidden sm:block">{perm.key}</span>
                                  {perm.description && (
                                    <span className="text-[10px] text-muted-foreground/70 line-clamp-1 hidden md:block">
                                      {perm.description}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  title="Aplicar a todos os cargos (exceto admin)"
                                  onClick={() => {
                                    const targetRoles = (selectedRoleId === 'all' ? roles : roles.filter(r => r.id === selectedRoleId))
                                      .filter(r => r.name !== 'admin');
                                    const allActive = targetRoles.every(r => getEffectiveState(r.id, perm.id));
                                    if (allActive) {
                                      // Desativar para todos
                                      targetRoles.forEach(r => {
                                        if (getEffectiveState(r.id, perm.id)) {
                                          handleToggle(r.id, perm.id);
                                        }
                                      });
                                    } else {
                                      // Ativar para todos
                                      targetRoles.forEach(r => {
                                        if (!getEffectiveState(r.id, perm.id)) {
                                          handleToggle(r.id, perm.id);
                                        }
                                      });
                                    }
                                  }}
                                >
                                  <Users className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                            {(selectedRoleId === 'all' ? roles : roles.filter(r => r.id === selectedRoleId)).map(role => {
                              const isActive = getEffectiveState(role.id, perm.id);
                              const pending = isCellPending(role.id, perm.id);
                              const isAdmin = role.name === 'admin';
                              
                              return (
                                <td key={role.id} className="px-2 sm:px-4 py-3 text-center">
                                  <button
                                    onClick={() => handleToggle(role.id, perm.id)}
                                    disabled={isAdmin}
                                    className={`
                                      relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                                      ${isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                      ${isActive || isAdmin ? 'bg-primary' : 'bg-input'}
                                      ${pending ? 'ring-2 ring-amber-500' : ''}
                                    `}
                                    title={pending ? 'Alteração pendente' : undefined}
                                    aria-label={`${isActive ? 'Desativar' : 'Ativar'} permissão ${perm.name} para ${role.name}`}
                                  >
                                    <span
                                      className={`
                                        inline-block h-5 w-5 transform rounded-full bg-background shadow-sm transition-transform duration-200
                                        ${isActive || isAdmin ? 'translate-x-6' : 'translate-x-1'}
                                      `}
                                    />
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Aviso de Rodapé */}
                  <div className="p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/50 flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span>
                        Alterações ficam pendentes até você clicar em <strong>Salvar alterações</strong>.
                      </span>
                      {pendingChanges.length > 0 && (
                        <span>
                          Você tem <strong>{pendingChanges.length}</strong> alterações pendentes.
                        </span>
                      )}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </Card>
      )}
    </div>
  );
}
