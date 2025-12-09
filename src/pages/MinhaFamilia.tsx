import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Users, Baby, AlertTriangle, Pencil, Heart, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { differenceInYears, differenceInMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import AdicionarDependenteDrawer from "@/components/familia/AdicionarDependenteDrawer";
import EditarDependenteDrawer from "@/components/familia/EditarDependenteDrawer";

interface FamilyMember {
  id: string;
  nome: string;
  data_nascimento: string | null;
  avatar_url: string | null;
  alergias: string | null;
  necessidades_especiais: string | null;
  sexo: string | null;
  responsavel_legal: boolean | null;
  tipo_parentesco?: string;
}

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return "Idade não informada";
  
  const birth = new Date(birthDate);
  const years = differenceInYears(new Date(), birth);
  
  if (years < 1) {
    const months = differenceInMonths(new Date(), birth);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

function getParentescoInfo(tipo: string | undefined): { label: string; icon: React.ReactNode } {
  switch (tipo) {
    case 'filho':
    case 'filha':
      return { label: 'Filho(a)', icon: <Baby className="h-4 w-4 text-primary" /> };
    case 'conjuge':
    case 'esposo':
    case 'esposa':
      return { label: 'Cônjuge', icon: <Heart className="h-4 w-4 text-pink-500" /> };
    case 'pai':
    case 'mae':
      return { label: tipo === 'pai' ? 'Pai' : 'Mãe', icon: <User className="h-4 w-4 text-blue-500" /> };
    case 'irmao':
    case 'irma':
      return { label: 'Irmão(ã)', icon: <Users className="h-4 w-4 text-green-500" /> };
    default:
      return { label: tipo || 'Familiar', icon: <User className="h-4 w-4 text-muted-foreground" /> };
  }
}

export default function MinhaFamilia() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  // Fetch family members
  const { data: familyMembers, isLoading } = useQuery({
    queryKey: ['family-members', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Query familias table directly to get relationships
      const { data: relationships, error: relError } = await supabase
        .from('familias')
        .select('id, tipo_parentesco, familiar_id')
        .eq('pessoa_id', profile.id);

      if (relError) throw relError;

      if (!relationships || relationships.length === 0) return [];

      // Get familiar IDs
      const familiarIds = relationships.map(r => r.familiar_id).filter(Boolean);
      
      if (familiarIds.length === 0) return [];

      // Fetch profiles for those familiars
      const { data: familiarProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, data_nascimento, avatar_url, alergias, necessidades_especiais, sexo, responsavel_legal, status')
        .in('id', familiarIds);

      if (profilesError) throw profilesError;

      // Create a map for quick lookup
      const profileMap = new Map(familiarProfiles?.map(p => [p.id, p]) || []);

      // Transform to FamilyMember format
      const members: FamilyMember[] = relationships
        .filter(r => r.familiar_id && profileMap.has(r.familiar_id))
        .map(r => {
          const familiar = profileMap.get(r.familiar_id)!;
          return {
            id: familiar.id,
            nome: familiar.nome,
            data_nascimento: familiar.data_nascimento,
            avatar_url: familiar.avatar_url,
            alergias: familiar.alergias,
            necessidades_especiais: familiar.necessidades_especiais,
            sexo: familiar.sexo,
            responsavel_legal: familiar.responsavel_legal,
            tipo_parentesco: r.tipo_parentesco
          };
        });

      return members;
    },
    enabled: !!profile?.id,
  });

  const handleEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditDrawerOpen(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['family-members'] });
    setDrawerOpen(false);
    setEditDrawerOpen(false);
    setSelectedMember(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/perfil')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Minha Família</h1>
              <p className="text-xs text-muted-foreground">Gerencie seus dependentes</p>
            </div>
          </div>
          <Button onClick={() => setDrawerOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : familyMembers && familyMembers.length > 0 ? (
          <div className="space-y-3">
            {familyMembers.map((member) => {
              const parentescoInfo = getParentescoInfo(member.tipo_parentesco);
              return (
                <Card 
                  key={member.id} 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleEditMember(member)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl">
                          {member.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{member.nome}</h3>
                          <span className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full shrink-0">
                            {parentescoInfo.icon}
                            <span className="hidden sm:inline">{parentescoInfo.label}</span>
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {calculateAge(member.data_nascimento)}
                        </p>
                        {member.alergias && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="text-xs text-destructive truncate">
                              {member.alergias}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-1">Nenhum familiar cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Adicione seus familiares e dependentes
              </p>
              <Button onClick={() => setDrawerOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Familiar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Drawers */}
      <AdicionarDependenteDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={handleSuccess}
        parentProfileId={profile?.id || ''}
      />

      {selectedMember && (
        <EditarDependenteDrawer
          open={editDrawerOpen}
          onOpenChange={setEditDrawerOpen}
          onSuccess={handleSuccess}
          member={selectedMember}
        />
      )}
    </div>
  );
}
