import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Save, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast'; // Ou o hook de toast que você usa

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

export default function AdminPermissions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de Dados
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [matrix, setMatrix] = useState<RolePermission[]>([]);

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

    } catch (error: any) {
      console.error('Erro ao carregar permissões:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar",
        description: "Não foi possível buscar as permissões do sistema."
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para checar se está ativo
  const hasPermission = (roleId: number, permId: number) => {
    return matrix.some(p => p.role_id === roleId && p.permission_id === permId);
  };

  // Função de Toggle (Ligar/Desligar)
  const handleToggle = async (roleId: number, permId: number) => {
    const isActive = hasPermission(roleId, permId);
    
    // Otimistic update (atualiza tela antes do banco para parecer rápido)
    const originalMatrix = [...matrix];
    if (isActive) {
      setMatrix(prev => prev.filter(p => !(p.role_id === roleId && p.permission_id === permId)));
    } else {
      setMatrix(prev => [...prev, { role_id: roleId, permission_id: permId }]);
    }

    try {
      if (isActive) {
        // Remover permissão
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .match({ role_id: roleId, permission_id: permId });
        if (error) throw error;
      } else {
        // Adicionar permissão
        const { error } = await supabase
          .from('role_permissions')
          .insert({ role_id: roleId, permission_id: permId });
        if (error) throw error;
      }
    } catch (error) {
      // Reverter em caso de erro
      setMatrix(originalMatrix);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a permissão."
      });
    }
  };

  // Agrupar permissões por módulo para as Abas
  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {} as Record<string, AppPermission[]>);

  const modules = Object.keys(groupedPermissions);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Shield className="h-6 w-6 text-primary" /> 
            Matriz de Permissões
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie o que cada cargo pode acessar no sistema.
          </p>
        </div>
        <div className="flex gap-2">
           {/* Botão placeholder para futuro "Novo Cargo" */}
          <Button variant="outline" size="sm" onClick={fetchData}>
            Atualizar Dados
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-sm bg-card">
        <CardHeader className="p-0">
          <Tabs defaultValue={modules[0] || 'system'} className="w-full">
            
            {/* Lista de Abas (Módulos) */}
            <div className="px-6 pt-6 pb-2 border-b bg-muted/20">
              <TabsList className="bg-transparent p-0 h-auto flex flex-wrap gap-2 justify-start">
                {modules.map(modKey => (
                  <TabsTrigger 
                    key={modKey} 
                    value={modKey}
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20 rounded-md px-4 py-2 capitalize"
                  >
                    {modKey === 'finance' ? 'Financeiro' : 
                     modKey === 'members' ? 'Membros' : 
                     modKey === 'worship' ? 'Cultos' : 
                     modKey === 'system' ? 'Sistema' : modKey}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Conteúdo das Abas */}
            {modules.map(moduleKey => (
              <TabsContent key={moduleKey} value={moduleKey} className="m-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-medium text-xs">
                      <tr>
                        <th className="px-6 py-4 w-[300px] min-w-[200px]">Ação / Permissão</th>
                        {roles.map(role => (
                          <th key={role.id} className="px-4 py-4 text-center min-w-[100px]">
                            <div className="flex flex-col items-center gap-1">
                              <Badge 
                                variant={role.name === 'admin' ? "default" : "outline"} 
                                className="capitalize whitespace-nowrap"
                              >
                                {role.name}
                              </Badge>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {groupedPermissions[moduleKey].map((perm) => (
                        <tr key={perm.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{perm.name}</span>
                              <span className="text-xs text-muted-foreground font-mono mt-0.5">{perm.key}</span>
                              {perm.description && (
                                <span className="text-[10px] text-muted-foreground/70 mt-1 line-clamp-1">
                                  {perm.description}
                                </span>
                              )}
                            </div>
                          </td>
                          {roles.map(role => {
                            const isActive = hasPermission(role.id, perm.id);
                            const isAdmin = role.name === 'admin';
                            
                            return (
                              <td key={role.id} className="px-4 py-4 text-center">
                                <button
                                  onClick={() => handleToggle(role.id, perm.id)}
                                  disabled={isAdmin} // Admin sempre tem tudo, bloqueia edição pra segurança
                                  className={`
                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                                    ${isAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    ${isActive || isAdmin ? 'bg-primary' : 'bg-input'}
                                  `}
                                >
                                  <span
                                    className={`
                                      inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform duration-200
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
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-100 dark:border-amber-900/50 flex items-center gap-3 text-sm text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>
                    Alterações nas permissões são salvas automaticamente e têm efeito imediato para os usuários.
                  </span>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardHeader>
      </Card>
    </div>
  );
}