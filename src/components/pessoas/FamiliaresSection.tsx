import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Loader2, UserCheck, User, UserPlus } from "lucide-react";
import { AdicionarFamiliarDialog } from "./AdicionarFamiliarDialog";
import { ConverterFamiliarDialog } from "./ConverterFamiliarDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Familiar {
  id: string;
  familiar_id: string | null;
  nome_familiar: string | null;
  tipo_parentesco: string;
  familiar?: {
    id: string;
    nome: string;
    status: string;
  };
  _isReverse?: boolean; // Marcador interno para relações reversas
}

interface FamiliaresSectionProps {
  pessoaId: string;
  pessoaNome: string;
}

// Mesma função de inversão de papel do Perfil e FamilyWallet
function getDisplayRole(storedRole: string | null | undefined, isReverse: boolean, memberSex?: string | null): string {
  if (!storedRole) return "Familiar";
  if (!isReverse) return storedRole; // Fluxo normal: exibe como está

  // Fluxo reverso: precisa inverter
  const role = storedRole.toLowerCase();

  // Se são conjuges, mantém "Cônjuge"
  if (["marido", "esposa", "cônjuge"].includes(role)) {
    return "Cônjuge";
  }

  // Se eu cadastrei como pai/mãe e ele me adicionou, ele é meu filho/filha
  if (role === "pai" || role === "mãe") {
    return memberSex === "M" ? "Filho" : "Filha";
  }

  // Se eu cadastrei como filho/filha e ele me adicionou, ele é meu responsável
  if (role === "filho" || role === "filha") {
    return "Responsável";
  }

  // Outros casos genéricos
  return "Familiar";
}

export function FamiliaresSection({ pessoaId, pessoaNome }: FamiliaresSectionProps) {
  const [familiares, setFamiliares] = useState<Familiar[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [familiarParaDeletar, setFamiliarParaDeletar] = useState<string | null>(null);
  const [familiarParaConverter, setFamiliarParaConverter] = useState<{ id: string; nome: string } | null>(null);
  const [deletando, setDeletando] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query bidirecional para familiares
  const { data: queryFamiliares = [], isLoading } = useQuery({
    queryKey: ['familiares-section', pessoaId],
    queryFn: async () => {
      if (!pessoaId) return [];

      // Query bidirecional: busca os dois lados da relação
      const [relationshipsAsPessoa, relationshipsAsFamiliar] = await Promise.all([
        supabase
          .from('familias')
          .select('id, pessoa_id, familiar_id, tipo_parentesco')
          .eq('pessoa_id', pessoaId),
        supabase
          .from('familias')
          .select('id, pessoa_id, familiar_id, tipo_parentesco')
          .eq('familiar_id', pessoaId)
      ]);

      if (relationshipsAsPessoa.error) throw relationshipsAsPessoa.error;
      if (relationshipsAsFamiliar.error) throw relationshipsAsFamiliar.error;

      // Combinar ambas as queries
      const relationships = [
        ...(relationshipsAsPessoa.data || []),
        ...(relationshipsAsFamiliar.data || [])
      ];

      if (relationships.length === 0) return [];

      // Identificação inteligente do alvo (evitar duplicatas)
      const familiarIds = new Set<string>();
      const familiarMap = new Map<string, {
        familiarId: string;
        storedRole: string;
        isReverse: boolean;
      }>();

      relationships.forEach(item => {
        let targetId: string;
        let isReverse = false;

        if (item.pessoa_id === pessoaId) {
          // Fluxo normal: EU sou pessoa_id, o familiar é familiar_id
          targetId = item.familiar_id;
          isReverse = false;
        } else {
          // Fluxo reverso: EU sou familiar_id, a pessoa me adicionou
          targetId = item.pessoa_id;
          isReverse = true;
        }

        if (targetId) {
          familiarIds.add(targetId);
          
          // Se já tem esse familiar, manter o registro anterior (preferir fluxo normal)
          if (!familiarMap.has(targetId)) {
            familiarMap.set(targetId, {
              familiarId: targetId,
              storedRole: item.tipo_parentesco,
              isReverse,
            });
          }
        }
      });

      if (familiarIds.size === 0) return [];

      // Buscar dados dos familiares
      const { data: familiarProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, sexo, status')
        .in('id', Array.from(familiarIds));

      if (profilesError) throw profilesError;

      const profileMap = new Map(familiarProfiles?.map(p => [p.id, p]) || []);

      // Montar resultado final com inversão de papel
      const members = Array.from(familiarIds)
        .filter(id => profileMap.has(id))
        .map(id => {
          const familiar = profileMap.get(id)!;
          const relationData = familiarMap.get(id)!;

          const displayRole = getDisplayRole(
            relationData.storedRole,
            relationData.isReverse,
            familiar.sexo
          );

          return {
            id: familiar.id,
            familiar_id: familiar.id,
            nome_familiar: familiar.nome,
            tipo_parentesco: displayRole,
            familiar: {
              id: familiar.id,
              nome: familiar.nome,
              status: familiar.status,
            },
            _isReverse: relationData.isReverse,
          };
        });

      return members;
    },
    enabled: !!pessoaId,
    staleTime: 0,
  });

  // Sincronizar com o estado local
  useEffect(() => {
    setFamiliares(queryFamiliares);
  }, [queryFamiliares]);

  const handleDeletar = async () => {
    if (!familiarParaDeletar) return;

    setDeletando(true);
    try {
      const { error } = await supabase
        .from("familias")
        .delete()
        .eq("id", familiarParaDeletar);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Familiar removido com sucesso",
      });

      queryClient.invalidateQueries({ queryKey: ['familiares-section', pessoaId] });
    } catch (error) {
      console.error("Erro ao deletar familiar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o familiar",
        variant: "destructive",
      });
    } finally {
      setDeletando(false);
      setFamiliarParaDeletar(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "membro":
        return "default";
      case "frequentador":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "membro":
        return "Membro";
      case "frequentador":
        return "Frequentador";
      default:
        return "Visitante";
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-green-600 rounded" />
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Família
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Familiar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : familiares.length > 0 ? (
            <div className="space-y-3">
              {familiares.map((familiar) => (
                <div
                  key={familiar.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {familiar.familiar_id ? (
                        <UserCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className="font-medium truncate">
                        {familiar.familiar?.nome || familiar.nome_familiar}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 ml-6">
                      <Badge variant="outline" className="text-xs">
                        {familiar.tipo_parentesco}
                      </Badge>
                      {familiar._isReverse && (
                        <Badge variant="secondary" className="text-xs">
                          Adicionou você
                        </Badge>
                      )}
                      {familiar.familiar_id && familiar.familiar && (
                        <Badge variant={getStatusBadgeVariant(familiar.familiar.status)} className="text-xs">
                          {getStatusLabel(familiar.familiar.status)}
                        </Badge>
                      )}
                      {!familiar.familiar_id && (
                        <Badge variant="secondary" className="text-xs">
                          Não cadastrado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!familiar.familiar_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFamiliarParaConverter({ id: familiar.id, nome: familiar.nome_familiar || "" })}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Converter em cadastro completo"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFamiliarParaDeletar(familiar.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>Nenhum familiar cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AdicionarFamiliarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pessoaId={pessoaId}
        pessoaNome={pessoaNome}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['familiares-section', pessoaId] })}
      />

      {familiarParaConverter && (
        <ConverterFamiliarDialog
          open={!!familiarParaConverter}
          onOpenChange={(open) => !open && setFamiliarParaConverter(null)}
          familiaId={familiarParaConverter.id}
          nomeFamiliar={familiarParaConverter.nome}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['familiares-section', pessoaId] })}
        />
      )}

      <AlertDialog open={!!familiarParaDeletar} onOpenChange={(open) => !open && setFamiliarParaDeletar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover familiar</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este familiar? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletar}
              disabled={deletando}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
