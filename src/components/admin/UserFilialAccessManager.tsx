import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilialInfo } from "@/hooks/useFilialInfo";
import { useUserFilialAccess } from "@/hooks/useUserFilialAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MapPin, Shield, User } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  nome: string;
  email: string | null;
}

export function UserFilialAccessManager() {
  const { igrejaId, filiais } = useFilialInfo();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Buscar usuários da igreja
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["users-for-filial-access", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("igreja_id", igrejaId)
        .order("nome");

      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: !!igrejaId,
  });

  // Buscar role do usuário selecionado
  const { data: userRole } = useQuery({
    queryKey: ["user-role", selectedUserId, igrejaId],
    queryFn: async () => {
      if (!selectedUserId || !igrejaId) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", selectedUserId)
        .eq("igreja_id", igrejaId)
        .maybeSingle();

      if (error) throw error;
      return data?.role || "membro";
    },
    enabled: !!selectedUserId && !!igrejaId,
  });

  const {
    userAccess,
    allowedFilialIds,
    hasExplicitRestrictions,
    isLoading: loadingAccess,
    grantAccess,
    revokeAccess,
    clearAllRestrictions,
  } = useUserFilialAccess(selectedUserId || undefined, igrejaId || undefined);

  // Sincronizar estado local com dados do servidor
  useEffect(() => {
    if (!selectedUserId) {
      setPendingChanges({});
      return;
    }

    const newState: Record<string, boolean> = {};
    filiais.forEach(f => {
      newState[f.id] = allowedFilialIds.includes(f.id);
    });
    setPendingChanges(newState);
  }, [selectedUserId, allowedFilialIds, filiais]);

  const handleCheckboxChange = (filialId: string, checked: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      [filialId]: checked,
    }));
  };

  const handleSave = async () => {
    if (!selectedUserId) return;

    setIsSaving(true);
    try {
      // Verificar se todas estão marcadas ou nenhuma
      const checkedCount = Object.values(pendingChanges).filter(Boolean).length;
      
      if (checkedCount === 0 || checkedCount === filiais.length) {
        // Limpar restrições = acesso total
        await clearAllRestrictions.mutateAsync();
      } else {
        // Aplicar mudanças individuais
        for (const [filialId, shouldHaveAccess] of Object.entries(pendingChanges)) {
          const currentlyHasAccess = allowedFilialIds.includes(filialId);
          
          if (shouldHaveAccess && !currentlyHasAccess) {
            await grantAccess.mutateAsync({ filialId });
          } else if (!shouldHaveAccess && currentlyHasAccess) {
            await revokeAccess.mutateAsync(filialId);
          }
        }
        
        // Se não havia restrições antes, adicionar todas as marcadas
        if (!hasExplicitRestrictions && checkedCount < filiais.length) {
          for (const [filialId, shouldHaveAccess] of Object.entries(pendingChanges)) {
            if (shouldHaveAccess) {
              await grantAccess.mutateAsync({ filialId });
            }
          }
        }
        
        toast.success("Permissões de filial atualizadas");
      }
    } catch (error) {
      console.error("Erro ao salvar permissões:", error);
      toast.error("Erro ao salvar permissões");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearRestrictions = async () => {
    if (!selectedUserId) return;
    await clearAllRestrictions.mutateAsync();
  };

  const selectedUser = users?.find(u => u.id === selectedUserId);
  const hasChanges = JSON.stringify(pendingChanges) !== JSON.stringify(
    Object.fromEntries(filiais.map(f => [f.id, allowedFilialIds.includes(f.id)]))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Acesso por Filial
        </CardTitle>
        <CardDescription>
          Defina quais filiais cada usuário pode acessar. Usuários sem restrições explícitas
          herdam o acesso baseado em seu cargo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seletor de usuário */}
        <div className="space-y-2">
          <Label>Selecionar Usuário</Label>
          <Select
            value={selectedUserId || ""}
            onValueChange={(value) => setSelectedUserId(value || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Escolha um usuário..." />
            </SelectTrigger>
            <SelectContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{user.nome}</span>
                      {user.email && (
                        <span className="text-muted-foreground text-xs">
                          ({user.email})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Info do usuário selecionado */}
        {selectedUser && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedUser.nome}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{userRole || "..."}</Badge>
              </div>
            </div>

            {!hasExplicitRestrictions && (
              <div className="text-sm text-muted-foreground bg-background rounded p-2">
                ℹ️ Este usuário não tem restrições de filial - acesso baseado no cargo.
              </div>
            )}
          </div>
        )}

        {/* Lista de filiais com checkboxes */}
        {selectedUserId && (
          <div className="space-y-3">
            <Label>Filiais com Acesso</Label>
            
            {loadingAccess ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-2">
                {filiais.map((filial) => {
                  const isChecked = pendingChanges[filial.id] ?? false;
                  
                  return (
                    <div
                      key={filial.id}
                      className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={`filial-${filial.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(filial.id, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`filial-${filial.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        {filial.nome}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearRestrictions}
                disabled={!hasExplicitRestrictions || isSaving}
              >
                Remover Restrições (Acesso Total)
              </Button>
              
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}

        {/* Placeholder quando nenhum usuário selecionado */}
        {!selectedUserId && (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Selecione um usuário para gerenciar seus acessos por filial</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
