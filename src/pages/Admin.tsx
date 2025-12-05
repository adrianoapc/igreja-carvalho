import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, UserCog, Shield, ArrowUpCircle, Trash2, Heart, Calendar as CalendarIcon, AlertTriangle, Settings, Plus, Edit2 } from "lucide-react";
import { z } from "zod";
import EdgeFunctionCard from "@/components/admin/EdgeFunctionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const updateUserSchema = z.object({
  status: z.enum(["visitante", "frequentador", "membro"]),
  observacoes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional()
});

interface UserProfile {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: "visitante" | "frequentador" | "membro";
  data_primeira_visita: string;
  data_cadastro_membro: string | null;
  observacoes: string | null;
  roles?: string[];
}

interface UserRole {
  role: string;
}

interface ModulePermission {
  id: string;
  module_name: string;
  role: string;
  access_level: string;
}

type AppRole = "admin" | "basico" | "intercessor" | "lider" | "membro" | "pastor" | "secretario" | "tesoureiro";
type AccessLevel = "visualizar" | "criar_editar" | "aprovar_gerenciar" | "acesso_completo";

const AVAILABLE_ROLES: AppRole[] = ["admin", "pastor", "lider", "secretario", "tesoureiro", "intercessor", "membro", "basico"];
const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "visualizar", label: "Visualizar" },
  { value: "criar_editar", label: "Criar/Editar" },
  { value: "aprovar_gerenciar", label: "Aprovar/Gerenciar" },
  { value: "acesso_completo", label: "Acesso Completo" },
];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  lider: "Líder",
  secretario: "Secretário(a)",
  tesoureiro: "Tesoureiro(a)",
  intercessor: "Intercessor",
  membro: "Membro",
  basico: "Básico",
};

export default function Admin() {
  const { toast } = useToast();
  const { hasAccess, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Permissions state
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [editingPermission, setEditingPermission] = useState<ModulePermission | null>(null);
  const [newPermission, setNewPermission] = useState({ module_name: "", role: "", access_level: "" });
  const [showAddPermission, setShowAddPermission] = useState(false);

  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    // Aguardar o carregamento da autenticação
    if (authLoading || initialCheckDone) return;
    
    setInitialCheckDone(true);
    
    if (!hasAccess("membros", "acesso_completo")) {
      setAccessDenied(true);
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive"
      });
      return;
    }
    loadUsers();
    loadPermissions();
  }, [authLoading]);

  useEffect(() => {
    let filtered = users.filter(user =>
      user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (roleFilter !== "all") {
      filtered = filtered.filter(user =>
        user.roles?.includes(roleFilter)
      );
    }

    setFilteredUsers(filtered);
  }, [searchTerm, users, roleFilter]);

  const loadUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("nome");

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: rolesData
          ?.filter(r => r.user_id === profile.user_id)
          .map(r => r.role) || []
      })) || [];

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários",
        variant: "destructive"
      });
    }
  };

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from("module_permissions")
        .select("*")
        .order("module_name, role");

      if (error) throw error;

      setPermissions(data || []);
      const uniqueModules = [...new Set(data?.map(p => p.module_name) || [])];
      setModules(uniqueModules);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as permissões",
        variant: "destructive"
      });
    }
  };

  const loadUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      setUserRoles(data?.map((r: UserRole) => r.role) || []);
    } catch (error: any) {
      console.error("Error loading roles:", error);
    }
  };

  const handlePromoteUser = async (userId: string, newStatus: "visitante" | "frequentador" | "membro") => {
    setIsLoading(true);
    try {
      const validation = updateUserSchema.safeParse({ status: newStatus });
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }
      const updateData: any = { status: newStatus };
      if (newStatus === "membro") {
        updateData.data_cadastro_membro = new Date().toISOString();
      }
      const { error } = await supabase.from("profiles").update(updateData).eq("user_id", userId);
      if (error) throw error;
      toast({
        title: "Sucesso!",
        description: `Usuário promovido para ${newStatus}`
      });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRole = async (userId: string, role: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: role as any
      }]);

      if (error) throw error;

      const timestamp = new Date().toLocaleString("pt-BR");
      const currentObs = selectedUser?.observacoes || "";
      const newObs = `${currentObs}\n[${timestamp}] Cargo "${role}" atribuído pelo admin`.trim();

      await supabase
        .from("profiles")
        .update({ observacoes: newObs })
        .eq("user_id", userId);

      toast({
        title: "Sucesso!",
        description: `Cargo ${role} atribuído`
      });

      loadUserRoles(userId);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);

      if (error) throw error;

      const timestamp = new Date().toLocaleString("pt-BR");
      const currentObs = selectedUser?.observacoes || "";
      const newObs = `${currentObs}\n[${timestamp}] Cargo "${role}" removido pelo admin`.trim();

      await supabase
        .from("profiles")
        .update({ observacoes: newObs })
        .eq("user_id", userId);

      toast({
        title: "Sucesso!",
        description: `Cargo ${role} removido`
      });

      loadUserRoles(userId);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromoteBasicoToMembro = async (userId: string) => {
    setIsLoading(true);
    try {
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "basico");

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{ user_id: userId, role: "membro" }]);

      if (roleError) throw roleError;

      const timestamp = new Date().toLocaleString("pt-BR");
      const currentObs = selectedUser?.observacoes || "";
      const newObs = `${currentObs}\n[${timestamp}] Promovido de "básico" para "membro" pelo admin`.trim();

      await supabase
        .from("profiles")
        .update({ observacoes: newObs })
        .eq("user_id", userId);

      toast({
        title: "Usuário promovido!",
        description: "Usuário agora tem acesso completo como membro"
      });

      loadUserRoles(userId);
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePermission = async (permission: ModulePermission, newAccessLevel: string) => {
    try {
      const { error } = await supabase
        .from("module_permissions")
        .update({ access_level: newAccessLevel as any })
        .eq("id", permission.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Permissão atualizada"
      });
      loadPermissions();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeletePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from("module_permissions")
        .delete()
        .eq("id", permissionId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Permissão removida"
      });
      loadPermissions();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleAddPermission = async () => {
    if (!newPermission.module_name || !newPermission.role || !newPermission.access_level) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("module_permissions")
        .insert([{
          module_name: newPermission.module_name,
          role: newPermission.role as any,
          access_level: newPermission.access_level as any
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Permissão adicionada"
      });
      setNewPermission({ module_name: "", role: "", access_level: "" });
      setShowAddPermission(false);
      loadPermissions();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      visitante: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      frequentador: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      membro: "bg-green-500/10 text-green-500 border-green-500/20"
    };
    return colors[status as keyof typeof colors] || "";
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-red-500/10 text-red-500 border-red-500/20",
      pastor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      lider: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      tesoureiro: "bg-green-500/10 text-green-500 border-green-500/20",
      secretario: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
      intercessor: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      membro: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      basico: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return colors[role] || "bg-muted";
  };

  const getAccessLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      visualizar: "bg-gray-500/10 text-gray-500",
      criar_editar: "bg-blue-500/10 text-blue-500",
      aprovar_gerenciar: "bg-amber-500/10 text-amber-500",
      acesso_completo: "bg-green-500/10 text-green-500",
    };
    return colors[level] || "bg-muted";
  };

  const getPermissionForRoleAndModule = (role: string, module: string) => {
    return permissions.find(p => p.role === role && p.module_name === module);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Shield className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold">Acesso Negado</h2>
        <p className="text-muted-foreground mt-2">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Administração</h1>
          <p className="text-muted-foreground mt-1">Gerencie usuários, permissões e configurações do sistema</p>
        </div>
        <Shield className="w-12 h-12 text-primary opacity-20" />
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="permissions">Permissões</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={roleFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRoleFilter("all")}
                  >
                    Todos ({users.length})
                  </Button>
                  {AVAILABLE_ROLES.map(role => {
                    const count = users.filter(u => u.roles?.includes(role)).length;
                    if (count === 0) return null;
                    return (
                      <Button
                        key={role}
                        variant={roleFilter === role ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRoleFilter(role)}
                      >
                        {ROLE_LABELS[role]} ({count})
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-gradient-accent flex items-center justify-center text-accent-foreground font-bold text-lg">
                        {user.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{user.nome}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge className={getStatusBadge(user.status)}>
                            {user.status}
                          </Badge>
                          {user.roles?.map(role => (
                            <Badge key={role} className={getRoleBadgeColor(role)}>
                              {ROLE_LABELS[role as AppRole] || role}
                            </Badge>
                          ))}
                          {(!user.roles || user.roles.length === 0) && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem cargo
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedUser(user);
                          loadUserRoles(user.user_id);
                        }}>
                          <UserCog className="w-4 h-4 mr-2" />
                          Gerenciar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Gerenciar Usuário</DialogTitle>
                          <DialogDescription>
                            {selectedUser?.nome} - {selectedUser?.email}
                          </DialogDescription>
                        </DialogHeader>
                        {selectedUser && (
                          <div className="space-y-6">
                            {/* Status */}
                            <div className="space-y-2">
                              <Label>Status Atual</Label>
                              <div className="flex items-center gap-2">
                                <Badge className={getStatusBadge(selectedUser.status)}>
                                  {selectedUser.status}
                                </Badge>
                                {selectedUser.status !== "membro" && (
                                  <Button size="sm" onClick={() => handlePromoteUser(selectedUser.user_id, selectedUser.status === "visitante" ? "frequentador" : "membro")} disabled={isLoading}>
                                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                                    Promover para {selectedUser.status === "visitante" ? "Frequentador" : "Membro"}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Promoção de Básico para Membro */}
                            {userRoles.includes("basico") && !userRoles.includes("membro") && (
                              <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
                                <Label className="flex items-center gap-2">
                                  <ArrowUpCircle className="w-4 h-4 text-primary" />
                                  Promoção de Acesso
                                </Label>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Este usuário tem acesso básico. Promova para membro para liberar acesso completo ao sistema.
                                </p>
                                <Button
                                  onClick={() => handlePromoteBasicoToMembro(selectedUser.user_id)}
                                  disabled={isLoading}
                                  className="w-full"
                                >
                                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                                  Promover para Membro
                                </Button>
                              </div>
                            )}

                            {/* Roles */}
                            <div className="space-y-2">
                              <Label>Cargos Atuais</Label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {userRoles.map(role => (
                                  <Badge key={role} className={`${getRoleBadgeColor(role)} gap-2`}>
                                    {ROLE_LABELS[role as AppRole] || role}
                                    {role !== "basico" && (
                                      <button
                                        onClick={() => handleRemoveRole(selectedUser.user_id, role)}
                                        className="hover:text-destructive"
                                        disabled={isLoading}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </Badge>
                                ))}
                                {userRoles.length === 0 && (
                                  <p className="text-sm text-muted-foreground">Nenhum cargo atribuído</p>
                                )}
                              </div>

                              {!userRoles.includes("basico") && (
                                <Select
                                  onValueChange={(role: string) => handleAddRole(selectedUser.user_id, role)}
                                  disabled={isLoading}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Adicionar cargo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AVAILABLE_ROLES.filter(role => !userRoles.includes(role)).map(role => (
                                      <SelectItem key={role} value={role}>
                                        {ROLE_LABELS[role]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>

                            {/* Histórico */}
                            {selectedUser.observacoes && (
                              <div className="space-y-2">
                                <Label>Histórico de Promoções</Label>
                                <div className="p-3 rounded-lg bg-muted/50 border border-border max-h-40 overflow-y-auto">
                                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                                    {selectedUser.observacoes}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* Info */}
                            <div className="space-y-2">
                              <Label>Informações</Label>
                              <div className="text-sm space-y-1">
                                <p>
                                  <span className="text-muted-foreground">Primeira visita:</span>{" "}
                                  {new Date(selectedUser.data_primeira_visita).toLocaleDateString("pt-BR")}
                                </p>
                                {selectedUser.data_cadastro_membro && (
                                  <p>
                                    <span className="text-muted-foreground">Membro desde:</span>{" "}
                                    {new Date(selectedUser.data_cadastro_membro).toLocaleDateString("pt-BR")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Matriz de Permissões</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure quais cargos têm acesso a cada módulo do sistema
                </p>
              </div>
              <Dialog open={showAddPermission} onOpenChange={setShowAddPermission}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Permissão
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Permissão</DialogTitle>
                    <DialogDescription>
                      Configure acesso de um cargo a um módulo específico
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Módulo</Label>
                      <Input
                        placeholder="Nome do módulo (ex: financas, membros)"
                        value={newPermission.module_name}
                        onChange={e => setNewPermission({ ...newPermission, module_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cargo</Label>
                      <Select
                        value={newPermission.role}
                        onValueChange={role => setNewPermission({ ...newPermission, role })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_ROLES.map(role => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nível de Acesso</Label>
                      <Select
                        value={newPermission.access_level}
                        onValueChange={level => setNewPermission({ ...newPermission, access_level: level })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o nível" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCESS_LEVELS.map(level => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddPermission} className="w-full">
                      Adicionar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Módulo</TableHead>
                      {AVAILABLE_ROLES.map(role => (
                        <TableHead key={role} className="text-center min-w-[120px]">
                          <Badge className={getRoleBadgeColor(role)}>
                            {ROLE_LABELS[role]}
                          </Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map(module => (
                      <TableRow key={module}>
                        <TableCell className="font-medium capitalize">{module}</TableCell>
                        {AVAILABLE_ROLES.map(role => {
                          const permission = getPermissionForRoleAndModule(role, module);
                          return (
                            <TableCell key={`${module}-${role}`} className="text-center">
                              {permission ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Select
                                    value={permission.access_level}
                                    onValueChange={(value) => handleUpdatePermission(permission, value)}
                                  >
                                    <SelectTrigger className="w-auto h-7 text-xs">
                                      <Badge className={`${getAccessLevelBadge(permission.access_level)} text-xs`}>
                                        {ACCESS_LEVELS.find(l => l.value === permission.access_level)?.label || permission.access_level}
                                      </Badge>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ACCESS_LEVELS.map(level => (
                                        <SelectItem key={level.value} value={level.value}>
                                          {level.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => handleDeletePermission(permission.id)}
                                  >
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
                <h4 className="font-medium text-sm mb-2">Níveis de Acesso</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {ACCESS_LEVELS.map(level => (
                    <div key={level.value} className="flex items-center gap-2">
                      <Badge className={getAccessLevelBadge(level.value)}>
                        {level.label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Automações e Edge Functions</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Gerencie as funções automáticas: ative/desative, configure horários e execute manualmente.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <EdgeFunctionCard title="Sentimentos Diários" description="Notificação diária perguntando aos membros como estão se sentindo" functionName="notificar-sentimentos-diario" icon={<Heart className="w-5 h-5" />} />

                <EdgeFunctionCard title="Alertas Críticos" description="Verifica membros com sentimentos negativos repetidos e notifica líderes" functionName="verificar-sentimentos-criticos" icon={<AlertTriangle className="w-5 h-5" />} />

                <EdgeFunctionCard title="Aniversários" description="Notifica sobre aniversários, casamentos e batismos do dia seguinte" functionName="notificar-aniversarios" icon={<CalendarIcon className="w-5 h-5" />} />
              </div>

              <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Como Usar
                    </h3>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li><strong>Ativar/Desativar:</strong> Use o toggle para pausar temporariamente uma função sem deletá-la</li>
                  <li><strong>Configurar Horário:</strong> Clique no ícone de engrenagem para alterar o horário de execução</li>
                  <li><strong>Executar Manualmente:</strong> Use "Executar Agora" para testar ou forçar uma execução</li>
                  <li><strong>Horários:</strong> Todos os horários são no fuso de Brasília (UTC-3)</li>
                  <li><strong>Status:</strong> O badge mostra se a função está ativa ou desativada</li>
                  <li><strong>Contador:</strong> Acompanhe quantas vezes cada função foi executada</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
