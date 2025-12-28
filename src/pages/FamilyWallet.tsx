import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { differenceInYears, differenceInMonths, format } from "date-fns";
import { 
  ArrowLeft, 
  Plus, 
  QrCode, 
  User, 
  MoreVertical,
  Baby,
  Users,
  Loader2,
  X,
  ScanLine,
  CheckCircle,
  Clock,
  BookOpen,
  Smile,
  Frown,
  Droplets,
  Cloud,
  Zap,
  Meh
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import AdicionarDependenteDrawer from "@/components/familia/AdicionarDependenteDrawer";
import EditarDependenteDrawer from "@/components/familia/EditarDependenteDrawer";
import VincularResponsavelDialog from "@/components/familia/VincularResponsavelDialog";

// --- Tipos e Utilitários ---
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

interface KidsCheckin {
  id: string;
  crianca_id: string;
  crianca_nome: string;
  checkin_at: string;
  responsavel_id: string;
}

interface KidsDiary {
  id: string;
  crianca_id: string;
  humor: string | null;
  comportamento_tags: string[] | null;
  necessidades_tags: string[] | null;
  observacoes: string | null;
}

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return "";
  try {
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return "";
    
    const years = differenceInYears(new Date(), birth);
    if (years < 1) {
      const months = differenceInMonths(new Date(), birth);
      return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    }
    return `${years} anos`;
  } catch (e) {
    return "";
  }
}

function getMoodEmoji(mood: string | null): { emoji: string; label: string } {
  const moods: Record<string, { emoji: string; label: string }> = {
    feliz: { emoji: "😊", label: "Feliz" },
    triste: { emoji: "😔", label: "Triste" },
    agitado: { emoji: "🤪", label: "Agitado" },
    neutro: { emoji: "😐", label: "Neutro" },
    choroso: { emoji: "😢", label: "Choroso" },
    sonolento: { emoji: "😴", label: "Sonolento" },
  };
  return moods[mood || ""] || { emoji: "🙂", label: "Bem" };
}

/**
 * Função auxiliar para inverter o papel de parentesco
 * Quando alguém me adiciona, preciso ver o papel do ponto de vista dela
 * 
 * @param storedRole - O papel armazenado no banco (ex: 'pai', 'mãe', 'filha')
 * @param isReverse - Se true, estamos no fluxo reverso (pessoa me adicionou)
 * @param memberSex - Sexo do membro ('M', 'F', ou null)
 * @returns O papel que devo exibir
 */
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

export default function FamilyWallet() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, loading } = useAuth(); 
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [vincularResponsavelOpen, setVincularResponsavelOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  // --- BUSCA REAL NO BANCO DE DADOS (BIDIRECIONAL) ---
  const { data: familyMembers, isLoading: isFamilyLoading } = useQuery({
    queryKey: ['family-members', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Query bidirecional: busca os dois lados da relação
      // Fetch duas queries separadas e combina os resultados
      const [relationshipsAsPessoa, relationshipsAsFamiliar] = await Promise.all([
        supabase
          .from('familias')
          .select('id, pessoa_id, familiar_id, tipo_parentesco')
          .eq('pessoa_id', profile.id),
        supabase
          .from('familias')
          .select('id, pessoa_id, familiar_id, tipo_parentesco')
          .eq('familiar_id', profile.id)
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

        if (item.pessoa_id === profile.id) {
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

      // Busca dados dos familiares
      const { data: familiarProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, data_nascimento, avatar_url, alergias, necessidades_especiais, sexo, responsavel_legal, status')
        .in('id', Array.from(familiarIds));

      if (profilesError) throw profilesError;

      const profileMap = new Map(familiarProfiles?.map(p => [p.id, p]) || []);

      // Montar resultado final com inversão de papel se necessário
      const members = Array.from(familiarIds)
        .filter(id => profileMap.has(id))
        .map(id => {
          const familiar = profileMap.get(id)!;
          const relationData = familiarMap.get(id)!;

          // Lógica de inversão de papel (labels)
          const displayRole = getDisplayRole(
            relationData.storedRole,
            relationData.isReverse,
            familiar.sexo
          );

          return {
            id: familiar.id,
            nome: familiar.nome,
            data_nascimento: familiar.data_nascimento,
            avatar_url: familiar.avatar_url,
            alergias: familiar.alergias,
            necessidades_especiais: familiar.necessidades_especiais,
            sexo: familiar.sexo,
            responsavel_legal: familiar.responsavel_legal,
            tipo_parentesco: displayRole,
            _isReverse: relationData.isReverse, // Marcador interno para debug
          };
        });

      return members;
    },
    enabled: !!profile?.id,
    staleTime: 0, // Sempre buscar dados frescos
  });

  // Query para buscar responsáveis/autorizados (pessoas que podem buscar as crianças)
  const { data: responsaveisAutorizados = [] } = useQuery({
    queryKey: ["responsaveis-autorizados", familyMembers],
    queryFn: async () => {
      if (!familyMembers || familyMembers.length === 0) return [];

      // Buscar todas as pessoas que foram vinculadas às crianças da família
      const childrenIds = familyMembers
        .filter(m => {
          if (!m.data_nascimento) return false;
          const age = calculateAge(m.data_nascimento);
          return (age.includes('anos') && parseInt(age) < 13) || age.includes('mês') || age.includes('meses');
        })
        .map(m => m.id);

      if (childrenIds.length === 0) return [];

      // Query: buscar responsáveis que foram vinculados a essas crianças
      const { data: relationships, error } = await supabase
        .from("familias")
        .select("pessoa_id, tipo_parentesco")
        .in("familiar_id", childrenIds)
        .neq("pessoa_id", profile?.id);

      if (error) {
        console.error("Erro ao buscar responsáveis autorizados:", error);
        return [];
      }

      if (!relationships || relationships.length === 0) return [];

      // Deduplica pessoas
      const pessoasIds = Array.from(new Set(relationships.map(r => r.pessoa_id)));

      // Buscar dados das pessoas
      const { data: pessoas, error: pessoasError } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, email, telefone")
        .in("id", pessoasIds);

      if (pessoasError) throw pessoasError;

      // Mapear relacionamentos
      const relationshipMap = new Map<string, string[]>();
      relationships.forEach(r => {
        if (!relationshipMap.has(r.pessoa_id)) {
          relationshipMap.set(r.pessoa_id, []);
        }
        relationshipMap.get(r.pessoa_id)?.push(r.tipo_parentesco);
      });

      return (pessoas || []).map(p => ({
        id: p.id,
        nome: p.nome,
        avatar_url: p.avatar_url,
        email: p.email,
        telefone: p.telefone,
        parentescos: Array.from(new Set(relationshipMap.get(p.id) || [])),
      }));
    },
    enabled: !!familyMembers,
  });

  // Query para buscar check-ins ativos das crianças da família
  const { data: activeCheckins = [], refetch: refetchCheckins } = useQuery({
    queryKey: ["kids-checkins-ativos", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from("view_kids_checkins_ativos")
        .select("*")
        .eq("responsavel_id", profile.id);

      if (error) {
        console.error("Erro ao buscar check-ins:", error);
        return [];
      }

      return data || [];
    },
    enabled: !!profile?.id,
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Query para buscar diários de hoje das crianças
  const { data: todayDiaries = {} } = useQuery({
    queryKey: ["kids-diaries-today", familyMembers],
    queryFn: async () => {
      if (!familyMembers || familyMembers.length === 0) return {};

      const childrenIds = familyMembers.map(m => m.id);
      const today = format(new Date(), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("kids_diario")
        .select("*")
        .in("crianca_id", childrenIds)
        .eq("data", today);

      if (error) {
        console.error("Erro ao buscar diários:", error);
        return {};
      }

      // Criar mapa de crianca_id -> diário
      const diaryMap: Record<string, KidsDiary> = {};
      data?.forEach(diary => {
        diaryMap[diary.crianca_id] = diary;
      });

      return diaryMap;
    },
    enabled: !!familyMembers && familyMembers.length > 0,
  });

  const handleEditMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setEditDrawerOpen(true);
  };

  // Mutation para fazer checkout de uma criança
  const checkoutMutation = useMutation({
    mutationFn: async (checkinId: string) => {
      const { error } = await supabase
        .from("kids_checkins")
        .update({
          checkout_at: new Date().toISOString(),
          checkout_por: profile?.id,
        })
        .eq("id", checkinId)
        .is("checkout_at", null);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchCheckins();
      toast.success("Criança retirada do Kids com sucesso!");
    },
    onError: (error: unknown) => {
      console.error("Erro ao fazer checkout:", error);
      toast.error("Erro ao retirar criança do Kids");
    },
  });

  const handleCheckout = (checkinId: string, childName: string) => {
    if (confirm(`Retirar ${childName.split(' ')[0]} do Kids?`)) {
      checkoutMutation.mutate(checkinId);
    }
  };

  // Mutation para remover um responsável autorizado
  const removerResponsavelMutation = useMutation({
    mutationFn: async (responsavelId: string) => {
      // Buscar todas as crianças da família
      const childrenIds = familyMembers
        .filter(m => {
          if (!m.data_nascimento) return false;
          const age = calculateAge(m.data_nascimento);
          return (age.includes('anos') && parseInt(age) < 13) || age.includes('mês') || age.includes('meses');
        })
        .map(m => m.id);

      // Deletar todos os relacionamentos entre o responsável e as crianças
      const { error } = await supabase
        .from("familias")
        .delete()
        .eq("pessoa_id", responsavelId)
        .in("familiar_id", childrenIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["responsaveis-autorizados"] });
      queryClient.invalidateQueries({ queryKey: ["family-members"] });
    },
    onError: (error: unknown) => {
      console.error("Erro ao remover responsável:", error);
      toast.error("Erro ao remover responsável");
    },
  });

  const handleRemoverResponsavel = (responsavel: { id: string; nome: string }) => {
    if (confirm(`Remover acesso de ${responsavel.nome}?`)) {
      removerResponsavelMutation.mutate(responsavel.id);
    }
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['family-members'] });
    setDrawerOpen(false);
    setEditDrawerOpen(false);
    setSelectedMember(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const firstName = profile?.nome ? profile.nome.split(' ')[0] : "Usuário";
  // Gera URL do QR Code usando API pública e segura (apenas para visualização)
  // O dado embutido é o ID do perfil do pai/mãe
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${profile?.id}&color=000000&bgcolor=ffffff`;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 animate-in fade-in duration-500">
      
      {/* 1. HEADER */}
      <div className="bg-white sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-sm border-b border-gray-100">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="-ml-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="h-6 w-6 text-gray-700" />
        </Button>
        <h1 className="text-lg font-semibold text-gray-800">Carteira da Família</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setVincularResponsavelOpen(true)}
          className="hover:bg-gray-100 rounded-full text-gray-700"
          title="Gerenciar responsáveis"
        >
          <Users className="h-6 w-6" />
        </Button>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        
        {/* ALERTA: Crianças no Kids */}
        {activeCheckins.length > 0 && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 mb-1">
                    {activeCheckins.length} {activeCheckins.length === 1 ? 'Criança' : 'Crianças'} no Kids
                  </h3>
                  <div className="space-y-1">
                    {activeCheckins.map(checkin => (
                      <p key={checkin.id} className="text-sm text-green-700">
                        • {checkin.crianca_nome.split(' ')[0]} - desde {new Date(checkin.checkin_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    ✨ Seus filhos estão sendo bem cuidados!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* 2. PASSAPORTE KIDS (Zero Click) */}
        <Card className="bg-primary text-primary-foreground overflow-hidden border-0 shadow-lg relative">
          <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
          
          <CardContent className="p-6 flex flex-col items-center text-center gap-4 relative z-10">
            {/* QR Code visível diretamente */}
            <div className="bg-white p-4 rounded-xl shadow-md relative">
              <img 
                src={qrCodeUrl} 
                alt="QR Code do Usuário" 
                className="w-40 h-40 object-contain"
              />
              {/* Logo Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                <Baby className="w-12 h-12 text-black" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                Passaporte Kids <ScanLine className="h-4 w-4 opacity-70" />
              </h3>
              <p className="text-primary-foreground/90 text-sm mt-1">
                Aproxime este código do Scanner
              </p>
              <p className="text-primary-foreground/60 text-xs mt-2 uppercase tracking-widest">
                {profile?.nome?.split(' ')[0]} · {profile?.id?.slice(0, 8)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. LISTA DE FAMILIARES */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Minha Família</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-full"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-3">
            {/* Card do Usuário Logado */}
            {profile && (
               <Card className="overflow-hidden border-gray-100 shadow-sm bg-white/80">
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
                    <AvatarImage src={profile.avatar_url || ""} />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      Eu ({firstName})
                    </h3>
                    <p className="text-sm text-gray-500">Responsável</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isFamilyLoading && [1, 2].map((i) => (
              <Card key={i}><CardContent className="p-4 flex gap-4"><Skeleton className="h-14 w-14 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div></CardContent></Card>
            ))}

            {/* Lista Real de Dependentes */}
            {familyMembers?.map((member) => {
              const age = calculateAge(member.data_nascimento);
              const isChild = (age.includes('anos') && parseInt(age) < 12) || age.includes('mês') || age.includes('meses');
              const checkinStatus = activeCheckins.find(c => c.crianca_id === member.id);
              const isCheckedIn = !!checkinStatus;
              const diary = todayDiaries[member.id];
              const mood = diary ? getMoodEmoji(diary.humor) : null;
              
              return (
                <Card key={member.id} className={`overflow-hidden shadow-sm hover:shadow-md transition-all group bg-white ${isCheckedIn ? 'border-2 border-green-400' : 'border-gray-100'}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Seção de Informações Cadastrais */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-white shadow-sm relative shrink-0">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback className={`${isChild ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                          {isChild ? <Baby className="h-6 w-6" /> : <Users className="h-6 w-6" />}
                        </AvatarFallback>
                        {isCheckedIn && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">{member.nome}</h3>
                          {isCheckedIn && (
                            <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs gap-1">
                              <Clock className="w-3 h-3" />
                              No Kids
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="capitalize">{member.tipo_parentesco || 'Familiar'}</span>
                          {member.data_nascimento && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>{age}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 shrink-0">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isCheckedIn && (
                            <DropdownMenuItem 
                              onClick={() => handleCheckout(checkinStatus.id, member.nome)}
                              className="text-green-600 focus:text-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Retirar do Kids
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleEditMember(member)}>
                            Editar Dados
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Seção de Boletim do Dia (Diário de Classe) */}
                    {diary && (
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-semibold text-primary">Hoje no Kids:</h4>
                        </div>

                        {/* Humor */}
                        {mood && (
                          <div className="flex items-center gap-2 p-2 bg-white rounded-md border border-primary/20">
                            <span className="text-2xl">{mood.emoji}</span>
                            <div>
                              <p className="text-xs text-gray-600">Humor</p>
                              <p className="font-medium text-sm">{mood.label}</p>
                            </div>
                          </div>
                        )}

                        {/* Comportamentos */}
                        {diary.comportamento_tags && diary.comportamento_tags.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1 font-medium">Atividades:</p>
                            <div className="flex flex-wrap gap-1">
                              {diary.comportamento_tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                                  ✓ {tag.replace(/_/g, " ").charAt(0).toUpperCase() + tag.replace(/_/g, " ").slice(1)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Necessidades */}
                        {diary.necessidades_tags && diary.necessidades_tags.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-600 mb-1 font-medium">Atendidas:</p>
                            <div className="flex flex-wrap gap-1">
                              {diary.necessidades_tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                  {tag.replace(/_/g, " ").charAt(0).toUpperCase() + tag.replace(/_/g, " ").slice(1)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recado do Professor */}
                        {diary.observacoes && (
                          <div className="p-2 bg-yellow-50 border-l-2 border-yellow-400 rounded text-sm italic text-yellow-900">
                            <p className="font-semibold text-xs mb-1">📝 Recado do Professor:</p>
                            <p>{diary.observacoes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 4. DICA VISUAL */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3 text-sm text-blue-800 mt-6">
          <div className="mt-0.5">💡</div>
          <p>
            Mantenha as alergias das crianças atualizadas para garantir a segurança no Kids.
          </p>
        </div>

        {/* 5. RESPONSÁVEIS AUTORIZADOS */}
        {responsaveisAutorizados.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Quem Pode Buscar</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 text-primary border-primary/20 hover:bg-primary/5 rounded-full"
                onClick={() => setVincularResponsavelOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {responsaveisAutorizados.map((responsavel) => (
                <Card key={responsavel.id} className="overflow-hidden border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-sm shrink-0">
                        <AvatarImage src={responsavel.avatar_url || ""} />
                        <AvatarFallback className="bg-purple-100 text-purple-600">
                          {responsavel.nome.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{responsavel.nome}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {responsavel.parentescos.map((parentesco) => (
                            <Badge 
                              key={parentesco} 
                              variant="secondary" 
                              className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                            >
                              {parentesco.replace(/_/g, " ").charAt(0).toUpperCase() + parentesco.replace(/_/g, " ").slice(1)}
                            </Badge>
                          ))}
                        </div>
                        {(responsavel.email || responsavel.telefone) && (
                          <p className="text-xs text-gray-500 mt-1">
                            {responsavel.email || responsavel.telefone}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 shrink-0">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleRemoverResponsavel(responsavel)}
                            className="text-red-600 focus:text-red-700"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Remover Acesso
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Drawers Auxiliares */}
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

      <VincularResponsavelDialog
        open={vincularResponsavelOpen}
        onOpenChange={setVincularResponsavelOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}