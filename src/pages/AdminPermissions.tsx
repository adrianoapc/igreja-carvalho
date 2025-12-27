import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, AlertCircle, Loader2, RotateCcw, CheckCircle2, XCircle, Users, History, ChevronDown, ArrowLeft, Copy, MoreHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ToastAction } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { PermissionsHistoryTab } from '@/components/admin/PermissionsHistoryTab';
import { useNavigate } from 'react-router-dom';

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

interface Props {
  onBack?: () => void;
}

export default function AdminPermissions({ onBack }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'matrix' | 'history'>('matrix');

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
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

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
      
      // 1. Buscar Cargos
      const { data: rolesData, error: rolesError } = await supabase
        .from('app_roles')
        .select('*')
        .order('id');
      if (rolesError) throw rolesError;

      // 2. Buscar Permissões
      const { data: permsData, error: permsError } = await supabase
        .from('app_permissions')
        .select('*')
        .order('module, id');
      if (permsError) throw permsError;

      // 3. Buscar Matriz
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

  // Verificar permissão
  const hasPermission = (roleId: number, permId: number) => {
    return matrixSet.has(`${roleId}:${permId}`);
  };

  // Estado efetivo considerando mudanças pendentes
  const getEffectiveState = (roleId: number, permId: number) => {
    return effectiveSet.has(`${roleId}:${permId}`);
  };

  // Indica se célula tem alteração pendente
  const isCellPending = (roleId: number, permId: number) => {
    return pendingChanges.some(
      (c) => c.roleId === roleId && c.permissionId === permId
    );
  };

  // Helpers
  const findPermissionIdByKey = useCallback((key: string) => {
    const perm = permissions.find((p) => p.key === key);
    return perm?.id;
  }, [permissions]);

  const getViewKeyFromManageKey = (manageKey: string) => {
    return manageKey.endsWith('.manage')
      ? manageKey.replace(/\.manage$/, '.view')
      : undefined;
  };

  // Toggle permissão
  const handleToggle = useCallback((roleId: number, permId: number) => {
    const perm = permissions.find((p) => p.id === permId);
    if (!perm) return;

    const isActive = hasPermission(roleId, permId);
    const isManage = perm.key.endsWith('.manage');
    const isView = perm.key.endsWith('.view');

    // Bloquear desativar .view se .manage estiver ativo
    if (isView && isActive) {
      const manageKey = perm.key.replace(/\.view$/, '.manage');
      const managePermId = findPermissionIdByKey(manageKey);
      if (managePermId) {
        const manageActive = hasPermission(roleId, managePermId);
        if (manageActive) {
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
          return;
        }
      }
    }

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

      // Atualizar pendingChanges
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

  // Ações em lote por módulo
  const handleBulkToggleModule = useCallback(
    (roleId: number, moduleKey: string, action: 'activate' | 'deactivate') => {
      const role = roles.find(r => r.id === roleId);
      if (!role || role.name === 'admin') return;

      const permsInModule = permissions.filter(p => p.module === moduleKey);
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

  // Função para clonar permissões de um cargo para outro
  const handleCloneRole = useCallback(
    (targetRoleId: number, sourceRoleId: number) => {
      const targetRole = roles.find(r => r.id === targetRoleId);
      const sourceRole = roles.find(r => r.id === sourceRoleId);
      
      if (!targetRole || !sourceRole) return;
      if (targetRole.is_system) {
        toast({
          title: "Operação não permitida",
          description: "Não é possível clonar permissões para cargos de sistema.",
          variant: "destructive",
        });
        return;
      }

      // Calcular diferenças baseadas no estado efetivo (incluindo pendingChanges)
      const newMatrix = { ...matrix };
      const newPendingChanges = { ...pendingChanges };
      let changesCount = 0;

      permissions.forEach(perm => {
        const sourceHasPerm = getEffectiveState(sourceRoleId, perm.id);
        const targetHasPerm = getEffectiveState(targetRoleId, perm.id);
        
        // Se estados diferem, precisa ajustar
        if (sourceHasPerm !== targetHasPerm) {
          const key = `${targetRoleId}-${perm.id}`;
          const wasOriginallyActive = originalMatrix[key] || false;
          
          if (sourceHasPerm) {
            // Source tem, Target não tem -> Adicionar ao Target
            newMatrix[key] = true;
            if (!wasOriginallyActive) {
              newPendingChanges[key] = 'add';
            } else {
              delete newPendingChanges[key];
            }
          } else {
            // Source não tem, Target tem -> Remover do Target
            newMatrix[key] = false;
            if (wasOriginallyActive) {
              newPendingChanges[key] = 'remove';
            } else {
              delete newPendingChanges[key];
            }
          }
          changesCount++;
        }
      });

      setMatrix(newMatrix);
      setPendingChanges(newPendingChanges);

      toast({
        title: "Permissões copiadas",
        description: `Permissões de "${sourceRole.name}" copiadas para "${targetRole.name}". ${changesCount} alterações pendentes.`,
      });
    },
    [roles, permissions, matrix, pendingChanges, originalMatrix, getEffectiveState, toast]
  );

  // Agrupar permissões por módulo
  const groupedPermissions = useMemo(() => {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) acc[perm.module] = [];
      acc[perm.module].push(perm);
      return acc;
    }, {} as Record<string, AppPermission[]>);
  }, [permissions]);

  // Filtro inteligente: se uma permissão der match, expandir módulo
  const filteredGroups = useMemo(() => {
    const result: Record<string, AppPermission[]> = {};
    const modulesToExpand = new Set<string>();

    for (const [moduleName, perms] of Object.entries(groupedPermissions)) {
      const filtered = perms.filter((perm) => {
        if (!searchTerm) return true;

        const q = searchTerm.toLowerCase();
        return (
          perm.name.toLowerCase().includes(q) ||
          perm.key.toLowerCase().includes(q) ||
          (perm.description ? perm.description.toLowerCase().includes(q) : false)
        );
      });

      if (filtered.length > 0) {
        result[moduleName] = filtered;
        // Auto-expand se houver match
        if (searchTerm) {
          modulesToExpand.add(moduleName);
        }
      }
    }

    // Aplicar auto-expand
    if (searchTerm && modulesToExpand.size > 0) {
      setExpandedModules(prev => {
        const updated = new Set(prev);
        modulesToExpand.forEach(m => updated.add(m));
        return updated;
      });
    }

    return result;
  }, [groupedPermissions, searchTerm]);

  // Toggle módulo
  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => {
      const updated = new Set(prev);
      if (updated.has(moduleName)) {
        updated.delete(moduleName);
      } else {
        updated.add(moduleName);
      }
      return updated;
    });
  };

  // UUID v4
  const generateUUID = () => crypto.randomUUID();

  // Salvar mudanças
  const handleSaveChanges = async () => {
    if (pendingChanges.length === 0 || saving) return;
    
    try {
      setSaving(true);
      const requestId = generateUUID();
      
      const { error: contextError } = await supabase.rpc('set_audit_context', {
        p_request_id: requestId,
        p_source: 'admin-ui'
      });
      
      if (contextError) {
        console.warn('Aviso: não foi possível definir contexto de auditoria:', contextError);
      }
      
      const previousSnapshot = [...originalMatrix];
      const toAdd = pendingChanges.filter(c => c.action === 'add');
      const toRemove = pendingChanges.filter(c => c.action === 'remove');
      
      // Remover
      if (toRemove.length > 0) {
        for (const condition of toRemove) {
          const { error } = await supabase
            .from('role_permissions')
            .delete()
            .match({ role_id: condition.roleId, permission_id: condition.permissionId });
          if (error) throw error;
        }
      }
      
      // Adicionar
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

  // Desfazer
  const handleUndoLastSave = async () => {
    if (!lastSavedMatrix || saving) return;
    try {
      setSaving(true);
      
      const requestId = generateUUID();
      await supabase.rpc('set_audit_context', {
        p_request_id: requestId,
        p_source: 'admin-ui-undo'
      });
      
      const current = originalMatrix;
      const previous = lastSavedMatrix;

      const currentSet = new Set(current.map((x) => `${x.role_id}:${x.permission_id}`));
      const previousSet = new Set(previous.map((x) => `${x.role_id}:${x.permission_id}`));

      const toRemove: RolePermission[] = current.filter(
        (x) => !previousSet.has(`${x.role_id}:${x.permission_id}`)
      );
      const toAdd: RolePermission[] = previous.filter(
        (x) => !currentSet.has(`${x.role_id}:${x.permission_id}`)
      );

      if (toRemove.length > 0) {
        for (const item of toRemove) {
          const { error } = await supabase
            .from('role_permissions')
            .delete()
            .match({ role_id: item.role_id, permission_id: item.permission_id });
          if (error) throw error;
        }
      }

      if (toAdd.length > 0) {
        const insertData = toAdd.map((x) => ({ role_id: x.role_id, permission_id: x.permission_id }));
        const { error } = await supabase
          .from('role_permissions')
          .insert(insertData);
        if (error) throw error;
      }

      setOriginalMatrix(previous);
      setMatrix(previous);
      setPendingChanges([]);

      const t = toast({
        title: 'Desfeito',
        description: 'As alterações foram revertidas para o estado anterior.',
        action: (
          <ToastAction altText="Fechar" onClick={() => t.dismiss()}>
            Fechar
          </ToastAction>
        ),
      });
    } catch (error: any) {
      console.error('Erro ao desfazer alterações:', error);
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
    } finally {
      setSaving(false);
    }
  };

  // Render
  const targetRoles = selectedRoleId === 'all' ? roles : roles.filter(r => r.id === selectedRoleId as number);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Matriz de Permissões</h1>
            <p className="text-muted-foreground">Gerencie permissões por módulo e cargo de forma centralizada e escalável.</p>
          </div>
        </div>
      </div>

      {/* Abas: Matrix | History */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition ${
            activeTab === 'matrix' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Matriz de Permissões
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
            activeTab === 'history' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="h-4 w-4" />
          Histórico
        </button>
      </div>

      {activeTab === 'history' && <PermissionsHistoryTab roles={roles} permissions={permissions} />}

      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Controles */}
          <Card className="p-4">
            <div className="space-y-4">
              {/* Busca */}
              <div>
                <Input
                  placeholder="Buscar permissão (nome, chave ou descrição)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Seleção de Cargo */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <span className="text-sm font-medium text-muted-foreground">Filtrar por cargo:</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedRoleId === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedRoleId('all')}
                  >
                    Todos
                  </Button>
                  {roles.map(role => (
                    <Button
                      key={role.id}
                      variant={selectedRoleId === role.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedRoleId(role.id)}
                    >
                      {role.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {Object.keys(filteredGroups).length} módulo(s), {Object.values(filteredGroups).flat().length} permissão(ões)
                </span>
                {pendingChanges.length > 0 && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-400">
                    {pendingChanges.length} pendente(s)
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* Header */}
                  <thead className="sticky top-0 z-20 bg-background border-b border-border">
                    <tr>
                      <th className="sticky left-0 z-10 bg-background text-left px-4 py-3 font-semibold text-sm text-muted-foreground border-r border-border">
                        Permissão
                      </th>
                      {targetRoles.map(role => (
                        <th
                          key={role.id}
                          className="px-4 py-3 text-center font-semibold text-sm text-muted-foreground whitespace-nowrap"
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span>{role.name}</span>
                            {role.name !== 'admin' && (
                              <div className="flex gap-1">
                                <button
                                  title="Ativar tudo"
                                  onClick={() => {
                                    Object.keys(filteredGroups).forEach(mod => {
                                      handleBulkToggleModule(role.id, mod, 'activate');
                                    });
                                  }}
                                  className="hover:bg-primary/10 p-1 rounded transition"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                </button>
                                <button
                                  title="Desativar tudo"
                                  onClick={() => {
                                    Object.keys(filteredGroups).forEach(mod => {
                                      handleBulkToggleModule(role.id, mod, 'deactivate');
                                    });
                                  }}
                                  className="hover:bg-destructive/10 p-1 rounded transition"
                                >
                                  <XCircle className="h-3 w-3" />
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      title="Copiar permissões de outro cargo"
                                      className="hover:bg-accent/10 p-1 rounded transition"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                      Copiar permissões de:
                                    </div>
                                    {targetRoles
                                      .filter(sourceRole => 
                                        sourceRole.id !== role.id && 
                                        !sourceRole.is_system
                                      )
                                      .map(sourceRole => (
                                        <DropdownMenuItem
                                          key={sourceRole.id}
                                          onClick={() => handleCloneRole(role.id, sourceRole.id)}
                                          className="cursor-pointer"
                                        >
                                          <Copy className="h-3 w-3 mr-2" />
                                          {sourceRole.name}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Módulos Agrupados */}
                    {Object.entries(filteredGroups).map(([moduleName, perms]) => {
                      const isExpanded = expandedModules.has(moduleName);
                      
                      return (
                        <React.Fragment key={moduleName}>
                          {/* Linha do Módulo (Cabeçalho do Accordion) */}
                          <tr className="bg-muted/50 hover:bg-muted border-b border-border transition-colors">
                            {/* Primeira célula: Nome do módulo (sticky, clicável para expandir) */}
                            <td
                              onClick={() => toggleModule(moduleName)}
                              className="sticky left-0 z-10 bg-muted/50 hover:bg-muted px-4 py-3 cursor-pointer border-r border-border"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronDown
                                  className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                                />
                                <span className="font-bold uppercase text-xs tracking-wider text-foreground">
                                  {moduleName}
                                </span>
                                <Badge variant="outline" className="ml-auto">
                                  {perms.length}
                                </Badge>
                              </div>
                            </td>

                            {/* Células de controle em massa para cada cargo */}
                            {targetRoles.map((role) => {
                              // Calcular estado tri-state do módulo para este cargo
                              const modulePerms = perms.filter(p => p.module === moduleName);
                              const activeCount = modulePerms.filter(p => getEffectiveState(role.id, p.id)).length;
                              const totalCount = modulePerms.length;
                              
                              const state = activeCount === 0 ? 'none' : 
                                           activeCount === totalCount ? 'all' : 
                                           'some';
                              
                              const isAdmin = role.name === 'admin';

                              return (
                                <td
                                  key={role.id}
                                  className="bg-muted/50 hover:bg-muted px-4 py-3 text-center border-r border-border/50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdmin) return;
                                    
                                    // Se vazio ou parcial -> ativar todas
                                    // Se cheio -> desativar todas
                                    const action = state === 'all' ? 'deactivate' : 'activate';
                                    handleBulkToggleModule(role.id, moduleName, action);
                                  }}
                                >
                                  <button
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
                                      isAdmin 
                                        ? 'opacity-50 cursor-not-allowed' 
                                        : 'cursor-pointer hover:bg-background/80'
                                    }`}
                                    disabled={isAdmin}
                                    title={
                                      isAdmin 
                                        ? 'Admin tem todas as permissões' 
                                        : state === 'all' 
                                          ? 'Desativar todas' 
                                          : state === 'some' 
                                            ? 'Ativar todas (parcial)' 
                                            : 'Ativar todas'
                                    }
                                  >
                                    {state === 'all' ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    ) : state === 'some' ? (
                                      <div className="w-5 h-5 rounded border-2 border-yellow-600 flex items-center justify-center">
                                        <div className="w-2.5 h-0.5 bg-yellow-600" />
                                      </div>
                                    ) : (
                                      <XCircle className="h-5 w-5 text-muted-foreground/40" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>

                          {/* Linhas de Permissões (Expandidas) */}
                          {isExpanded && perms.map((perm) => (
                            <tr key={perm.id} className="hover:bg-muted/30 transition-colors border-b border-border/50">
                              <td className="sticky left-0 z-10 bg-background hover:bg-muted/30 px-4 py-3 border-r border-border">
                                <div className="pl-4 space-y-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-foreground text-sm line-clamp-1">{perm.name}</p>
                                      <p className="text-xs text-muted-foreground font-mono">{perm.key}</p>
                                      {perm.description && (
                                        <p className="text-xs text-muted-foreground/70 line-clamp-1 mt-0.5">{perm.description}</p>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 flex-shrink-0"
                                      title="Aplicar a todos"
                                      onClick={() => {
                                        const allActive = targetRoles.every(r => getEffectiveState(r.id, perm.id));
                                        targetRoles.filter(r => r.name !== 'admin').forEach(r => {
                                          const shouldToggle = allActive ? getEffectiveState(r.id, perm.id) : !getEffectiveState(r.id, perm.id);
                                          if (shouldToggle) {
                                            handleToggle(r.id, perm.id);
                                          }
                                        });
                                      }}
                                    >
                                      <Users className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </td>

                              {/* Toggles de Cargo */}
                              {targetRoles.map(role => {
                                const isActive = getEffectiveState(role.id, perm.id);
                                const pending = isCellPending(role.id, perm.id);
                                const isAdmin = role.name === 'admin';
                                
                                return (
                                  <td key={role.id} className="px-4 py-3 text-center">
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
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Aviso de Rodapé */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/50 flex items-start gap-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
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
            </Card>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedRoleId('all');
                setExpandedModules(new Set());
                fetchData();
              }}
              disabled={saving || loading}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={pendingChanges.length === 0 || saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Salvar Alterações ({pendingChanges.length})
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
