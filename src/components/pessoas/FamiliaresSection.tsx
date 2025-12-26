import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  UserCheck,
  User,
  UserPlus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
    avatar_url?: string | null;
    status: string;
  };
  _isReverse?: boolean;
}

interface FamiliaresSectionProps {
  pessoaId: string;
  pessoaNome: string;
  readOnly?: boolean;
}

interface StatusConfig {
  variant: "default" | "secondary" | "outline";
  label: string;
}

// Configuração centralizada de status
const STATUS_CONFIG: Record<string, StatusConfig> = {
  membro: { variant: "default", label: "Membro" },
  frequentador: { variant: "secondary", label: "Frequentador" },
  visitante: { variant: "outline", label: "Visitante" },
};

function getDisplayRole(
  storedRole: string | null | undefined,
  isReverse: boolean,
  memberSex?: string | null
): string {
  if (!storedRole) return "Familiar";
  if (!isReverse) return storedRole;

  const role = storedRole.toLowerCase();
  if (["marido", "esposa", "cônjuge"].includes(role)) return "Cônjuge";
  if (role === "pai" || role === "mãe") return memberSex === "M" ? "Filho" : "Filha";
  if (role === "filho" || role === "filha") return "Responsável";

  return "Familiar";
}

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.visitante;
}

async function fetchFamiliares(pessoaId: string): Promise<Familiar[]> {
  if (!pessoaId) return [];

  const [relationshipsAsPessoa, relationshipsAsFamiliar] = await Promise.all([
    supabase
      .from("familias")
      .select("id, pessoa_id, familiar_id, tipo_parentesco")
      .eq("pessoa_id", pessoaId),
    supabase
      .from("familias")
      .select("id, pessoa_id, familiar_id, tipo_parentesco")
      .eq("familiar_id", pessoaId),
  ]);

  if (relationshipsAsPessoa.error) throw relationshipsAsPessoa.error;
  if (relationshipsAsFamiliar.error) throw relationshipsAsFamiliar.error;

  const relationships = [
    ...(relationshipsAsPessoa.data || []),
    ...(relationshipsAsFamiliar.data || []),
  ];

  if (relationships.length === 0) return [];

  const familiarIds = new Set<string>();
  const familiarMap = new Map<
    string,
    { familiarId: string; storedRole: string; isReverse: boolean }
  >();

  relationships.forEach((item) => {
    let targetId: string;
    let isReverse = false;

    if (item.pessoa_id === pessoaId) {
      targetId = item.familiar_id;
      isReverse = false;
    } else {
      targetId = item.pessoa_id;
      isReverse = true;
    }

    if (targetId && !familiarMap.has(targetId)) {
      familiarIds.add(targetId);
      familiarMap.set(targetId, {
        familiarId: targetId,
        storedRole: item.tipo_parentesco,
        isReverse,
      });
    }
  });

  if (familiarIds.size === 0) return [];

  const { data: familiarProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, nome, avatar_url, sexo, status")
    .in("id", Array.from(familiarIds));

  if (profilesError) throw profilesError;

  const profileMap = new Map(familiarProfiles?.map((p) => [p.id, p]) || []);

  return Array.from(familiarIds)
    .filter((id) => profileMap.has(id))
    .map((id) => {
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
}

export function FamiliaresSection({
  pessoaId,
  pessoaNome,
  readOnly = false,
}: FamiliaresSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [familiarParaDeletar, setFamiliarParaDeletar] = useState<string | null>(null);
  const [familiarParaConverter, setFamiliarParaConverter] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [deletando, setDeletando] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: familiares = [], isLoading } = useQuery({
    queryKey: ["familiares-section", pessoaId],
    queryFn: () => fetchFamiliares(pessoaId),
    enabled: !!pessoaId,
    staleTime: 0,
  });

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

      queryClient.invalidateQueries({ queryKey: ["familiares-section", pessoaId] });
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

  const handleAdicionarSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["familiares-section", pessoaId] });
  };

  const handleConverterSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["familiares-section", pessoaId] });
    setFamiliarParaConverter(null);
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-5 bg-gradient-to-r from-green-500/5 to-transparent">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <CardTitle className="text-base md:text-lg">Família</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-4 md:p-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : familiares.length > 0 ? (
                <div className="space-y-3">
                  {familiares.map((familiar) => (
                    <FamiliarCard
                      key={familiar.id}
                      familiar={familiar}
                      readOnly={readOnly}
                      onDelete={() => setFamiliarParaDeletar(familiar.id)}
                      onConvert={() =>
                        setFamiliarParaConverter({
                          id: familiar.id,
                          nome: familiar.nome_familiar || "",
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <AdicionarFamiliarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pessoaId={pessoaId}
        pessoaNome={pessoaNome}
        onSuccess={handleAdicionarSuccess}
      />

      {familiarParaConverter && (
        <ConverterFamiliarDialog
          open={!!familiarParaConverter}
          onOpenChange={(open) => !open && setFamiliarParaConverter(null)}
          familiaId={familiarParaConverter.id}
          nomeFamiliar={familiarParaConverter.nome}
          onSuccess={handleConverterSuccess}
        />
      )}

      <ConfirmDeleteDialog
        open={!!familiarParaDeletar}
        onOpenChange={(open) => !open && setFamiliarParaDeletar(null)}
        onConfirm={handleDeletar}
        isDeleting={deletando}
      />
    </>
  );
}

interface FamiliarCardProps {
  familiar: Familiar;
  readOnly: boolean;
  onDelete: () => void;
  onConvert: () => void;
}

function FamiliarCard({ familiar, readOnly, onDelete, onConvert }: FamiliarCardProps) {
  const nome = familiar.familiar?.nome || familiar.nome_familiar || "?";
  const statusConfig = getStatusConfig(familiar.familiar?.status || "visitante");

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3 sm:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Avatar className="w-10 h-10 flex-shrink-0 mt-0.5">
          <AvatarImage src={familiar.familiar?.avatar_url || undefined} alt={nome} />
          <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/60 text-secondary-foreground font-bold text-sm">
            {nome.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {familiar.familiar_id ? (
              <UserCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <p className="font-medium text-sm truncate">{nome}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs whitespace-nowrap">
              {familiar.tipo_parentesco}
            </Badge>
            {familiar._isReverse && (
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                Adicionou você
              </Badge>
            )}
            {familiar.familiar_id ? (
              <Badge variant={statusConfig.variant} className="text-xs whitespace-nowrap">
                {statusConfig.label}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                Não cadastrado
              </Badge>
            )}
          </div>
        </div>
      </div>
      {!readOnly && (
        <div className="flex gap-1 flex-shrink-0 self-center sm:self-start">
          {!familiar.familiar_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={onConvert}
              className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              title="Converter em cadastro completo"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Remover familiar"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
      <p>Nenhum familiar cadastrado</p>
    </div>
  );
}

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover familiar</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover este familiar? Esta ação não pode ser
            desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
