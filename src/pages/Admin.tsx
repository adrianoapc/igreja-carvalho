import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, UserCog, Shield, ArrowUpCircle, Trash2, Heart, Calendar as CalendarIcon, AlertTriangle, Settings } from "lucide-react";
import { z } from "zod";
import EdgeFunctionCard from "@/components/admin/EdgeFunctionCard";

const updateUserSchema = z.object({
  status: z.enum(["visitante", "frequentador", "membro"]),
  observacoes: z.string().max(500, "Observações devem ter no máximo 500 caracteres").optional(),
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
}

interface UserRole {
  role: string;
}

export default function Admin() {
  const { toast } = useToast();
  const { hasAccess } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hasAccess("membros", "acesso_completo")) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive",
      });
      return;
    }
    loadUsers();
  }, []);

  useEffect(() => {
    const filtered = users.filter(user =>
      user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("nome");

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários",
        variant: "destructive",
      });
    }
  };

  const loadUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

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

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Usuário promovido para ${newStatus}`,
      });

      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRole = async (userId: string, role: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert([{ user_id: userId, role: role as any }]);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Cargo ${role} atribuído`,
      });

      loadUserRoles(userId);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
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

      toast({
        title: "Sucesso!",
        description: `Cargo ${role} removido`,
      });

      loadUserRoles(userId);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      visitante: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      frequentador: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      membro: "bg-green-500/10 text-green-500 border-green-500/20",
    };
    return colors[status as keyof typeof colors] || "";
  };

  const availableRoles = ["admin", "pastor", "lider", "secretario", "tesoureiro", "professor", "membro"];

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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-accent flex items-center justify-center text-accent-foreground font-bold text-lg">
                        {user.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{user.nome}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <Badge className={getStatusBadge(user.status)}>
                          {user.status}
                        </Badge>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            loadUserRoles(user.user_id);
                          }}
                        >
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
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handlePromoteUser(
                                        selectedUser.user_id,
                                        selectedUser.status === "visitante"
                                          ? "frequentador"
                                          : "membro"
                                      )
                                    }
                                    disabled={isLoading}
                                  >
                                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                                    Promover para {selectedUser.status === "visitante" ? "Frequentador" : "Membro"}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Roles (apenas para membros) */}
                            {selectedUser.status === "membro" && (
                              <div className="space-y-2">
                                <Label>Cargos</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {userRoles.map((role) => (
                                    <Badge key={role} variant="secondary" className="gap-2">
                                      {role}
                                      <button
                                        onClick={() => handleRemoveRole(selectedUser.user_id, role)}
                                        className="hover:text-destructive"
                                        disabled={isLoading}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </Badge>
                                  ))}
                                  {userRoles.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Nenhum cargo atribuído</p>
                                  )}
                                </div>
                                <Select
                                  onValueChange={(role: string) => handleAddRole(selectedUser.user_id, role)}
                                  disabled={isLoading}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Adicionar cargo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableRoles
                                      .filter((role) => !userRoles.includes(role))
                                      .map((role) => (
                                        <SelectItem key={role} value={role}>
                                          {role}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
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
            <CardHeader>
              <CardTitle>Permissões por Cargo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  As permissões são definidas no banco de dados e controlam o acesso aos módulos do sistema.
                  Para modificar permissões, acesse o backend.
                </p>
                <div className="grid gap-4">
                  {availableRoles.map((role) => (
                    <div key={role} className="p-4 rounded-lg bg-secondary">
                      <h3 className="font-medium text-foreground mb-2 capitalize">{role}</h3>
                      <p className="text-sm text-muted-foreground">
                        Permissões configuradas no backend
                      </p>
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
                <EdgeFunctionCard
                  title="Sentimentos Diários"
                  description="Notificação diária perguntando aos membros como estão se sentindo"
                  functionName="notificar-sentimentos-diario"
                  icon={<Heart className="w-5 h-5" />}
                />
                
                <EdgeFunctionCard
                  title="Alertas Críticos"
                  description="Verifica membros com sentimentos negativos repetidos e notifica líderes"
                  functionName="verificar-sentimentos-criticos"
                  icon={<AlertTriangle className="w-5 h-5" />}
                />
                
                <EdgeFunctionCard
                  title="Aniversários"
                  description="Notifica sobre aniversários, casamentos e batismos do dia seguinte"
                  functionName="notificar-aniversarios"
                  icon={<CalendarIcon className="w-5 h-5" />}
                />
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
