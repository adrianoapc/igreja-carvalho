import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { User, Phone, Mail, MapPin, Calendar, Briefcase, Church, Edit, Lock, Fingerprint, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditarDadosPessoaisDialog } from "@/components/pessoas/EditarDadosPessoaisDialog";
import { EditarContatosDialog } from "@/components/pessoas/EditarContatosDialog";
import { EditarDadosEclesiasticosDialog } from "@/components/pessoas/EditarDadosEclesiasticosDialog";
import { AvatarUpload } from "@/components/perfil/AvatarUpload";
import { AlterarSenhaDialog } from "@/components/perfil/AlterarSenhaDialog";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

interface ProfileData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  necessidades_especiais: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  cpf: string | null;
  rg: string | null;
  profissao: string | null;
  escolaridade: string | null;
  status: string;
  batizado: boolean | null;
  data_batismo: string | null;
  aceitou_jesus: boolean | null;
  data_conversao: string | null;
  data_cadastro_membro: string | null;
  e_lider: boolean | null;
  e_pastor: boolean | null;
  observacoes: string | null;
  data_casamento: string | null;
  entrou_por: string | null;
  data_entrada: string | null;
  status_igreja: string | null;
  avatar_url: string | null;
}

interface FuncaoIgreja {
  id: string;
  funcao_id: string;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean | null;
  funcoes_igreja: {
    nome: string;
    descricao: string | null;
  };
}

interface FamilyMember {
  id: string;
  nome: string;
  avatar_url: string | null;
  sexo: string | null;
  tipo_parentesco: string;
  data_nascimento: string | null;
  _isReverse?: boolean;
}

export default function Perfil() {
  const { profile, user } = useAuth();
  const { isSupported, isEnabled, enableBiometric, disableBiometric } = useBiometricAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [funcoes, setFuncoes] = useState<FuncaoIgreja[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPessoaisOpen, setEditPessoaisOpen] = useState(false);
  const [editContatosOpen, setEditContatosOpen] = useState(false);
  const [editEclesiasticosOpen, setEditEclesiasticosOpen] = useState(false);
  const [alterarSenhaOpen, setAlterarSenhaOpen] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const handleBiometricToggle = async (enabled: boolean) => {
    if (!user?.id) return;
    
    setBiometricLoading(true);
    try {
      if (enabled) {
        const success = await enableBiometric(user.id);
        if (success) {
          toast.success("Biometria ativada com sucesso!");
        } else {
          toast.error("Não foi possível ativar a biometria.");
        }
      } else {
        disableBiometric();
        toast.success("Biometria desativada.");
      }
    } catch (error) {
      toast.error("Erro ao alterar configuração de biometria.");
    } finally {
      setBiometricLoading(false);
    }
  };

  /**
   * Função auxiliar para inverter o papel de parentesco
   * Quando alguém me adiciona, preciso ver o papel do ponto de vista dela
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

  const loadProfileData = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      // Carregar dados do perfil
      const { data: profileInfo, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profile.id)
        .single();

      if (profileError) throw profileError;
      setProfileData(profileInfo);

      // Carregar funções da igreja
      const { data: funcoesData, error: funcoesError } = await supabase
        .from("membro_funcoes")
        .select(`
          id,
          funcao_id,
          data_inicio,
          data_fim,
          ativo,
          funcoes_igreja (
            nome,
            descricao
          )
        `)
        .eq("membro_id", profile.id)
        .eq("ativo", true)
        .order("data_inicio", { ascending: false });

      if (funcoesError) throw funcoesError;
      setFuncoes(funcoesData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do perfil");
    } finally {
      setLoading(false);
    }
  };

  // Hook para carregar familiares com React Query
  const { data: queryFamilyMembers = [] } = useQuery({
    queryKey: ['perfil-family-members', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Query bidirecional: busca os dois lados da relação
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
          targetId = item.familiar_id;
          isReverse = false;
        } else {
          targetId = item.pessoa_id;
          isReverse = true;
        }

        if (targetId) {
          familiarIds.add(targetId);
          
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
        .select('id, nome, avatar_url, sexo, data_nascimento')
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
            nome: familiar.nome,
            avatar_url: familiar.avatar_url,
            sexo: familiar.sexo,
            tipo_parentesco: displayRole,
            data_nascimento: familiar.data_nascimento,
            _isReverse: relationData.isReverse,
          };
        });

      return members;
    },
    enabled: !!profile?.id,
    staleTime: 0, // Sempre buscar dados frescos
  });

  // Sincronizar com o estado local
  useEffect(() => {
    setFamilyMembers(queryFamilyMembers);
  }, [queryFamilyMembers]);

  useEffect(() => {
    loadProfileData();
  }, [profile?.id]);

  const handleDataUpdated = () => {
    loadProfileData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Perfil não encontrado</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
        <AvatarUpload
          userId={profileData.id}
          currentAvatarUrl={profileData.avatar_url}
          userName={profileData.nome}
          onAvatarUpdated={loadProfileData}
        />
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{profileData.nome}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="capitalize">
              {profileData.status}
            </Badge>
            {profileData.e_pastor && <Badge>Pastor</Badge>}
            {profileData.e_lider && <Badge>Líder</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAlterarSenhaOpen(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              Alterar Senha
            </Button>
            
            {isSupported && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/30">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Biometria</span>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={handleBiometricToggle}
                  disabled={biometricLoading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="pessoais">Pessoais</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="igreja">Igreja</TabsTrigger>
          <TabsTrigger value="mais">Mais</TabsTrigger>
        </TabsList>

        {/* Tab Perfil */}
        <TabsContent value="perfil" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{profileData.nome}</p>
                  </div>
                </div>
                {profileData.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{profileData.email}</p>
                    </div>
                  </div>
                )}
                {profileData.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{profileData.telefone}</p>
                    </div>
                  </div>
                )}
                {profileData.data_nascimento && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                      <p className="font-medium">
                        {format(new Date(profileData.data_nascimento), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                )}
                {profileData.profissao && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Profissão</p>
                      <p className="font-medium">{profileData.profissao}</p>
                    </div>
                  </div>
                )}
                {(profileData.cidade || profileData.estado) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Localização</p>
                      <p className="font-medium">
                        {[profileData.cidade, profileData.estado].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {funcoes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Church className="h-5 w-5" />
                  Funções na Igreja
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {funcoes.map((funcao) => (
                    <div
                      key={funcao.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{funcao.funcoes_igreja.nome}</p>
                        {funcao.funcoes_igreja.descricao && (
                          <p className="text-sm text-muted-foreground">
                            {funcao.funcoes_igreja.descricao}
                          </p>
                        )}
                      </div>
                      {funcao.data_inicio && (
                        <Badge variant="outline">
                          Desde {format(new Date(funcao.data_inicio), "MM/yyyy")}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Pessoais */}
        <TabsContent value="pessoais" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dados Pessoais</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditPessoaisOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                  <p className="font-medium">
                    {profileData.data_nascimento
                      ? format(new Date(profileData.data_nascimento), "dd/MM/yyyy")
                      : "Não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sexo</p>
                  <p className="font-medium">{profileData.sexo || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado Civil</p>
                  <p className="font-medium">{profileData.estado_civil || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RG</p>
                  <p className="font-medium">{profileData.rg || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CPF</p>
                  <p className="font-medium">{profileData.cpf || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Escolaridade</p>
                  <p className="font-medium">{profileData.escolaridade || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profissão</p>
                  <p className="font-medium">{profileData.profissao || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Necessidades Especiais</p>
                  <p className="font-medium">
                    {profileData.necessidades_especiais || "Nenhuma"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Contatos */}
        <TabsContent value="contatos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dados de Contato</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditContatosOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profileData.email || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{profileData.telefone || "Não informado"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="font-medium">{profileData.endereco || "Não informado"}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Bairro</p>
                    <p className="font-medium">{profileData.bairro || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CEP</p>
                    <p className="font-medium">{profileData.cep || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cidade</p>
                    <p className="font-medium">{profileData.cidade || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Estado</p>
                    <p className="font-medium">{profileData.estado || "Não informado"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Igreja */}
        <TabsContent value="igreja" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dados Eclesiásticos</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditEclesiasticosOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{profileData.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Batizado</p>
                  <p className="font-medium">{profileData.batizado ? "Sim" : "Não"}</p>
                </div>
                {profileData.data_batismo && (
                  <div>
                    <p className="text-sm text-muted-foreground">Data do Batismo</p>
                    <p className="font-medium">
                      {format(new Date(profileData.data_batismo), "dd/MM/yyyy")}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Aceitou Jesus</p>
                  <p className="font-medium">{profileData.aceitou_jesus ? "Sim" : "Não"}</p>
                </div>
                {profileData.data_conversao && (
                  <div>
                    <p className="text-sm text-muted-foreground">Data da Conversão</p>
                    <p className="font-medium">
                      {format(new Date(profileData.data_conversao), "dd/MM/yyyy")}
                    </p>
                  </div>
                )}
                {profileData.data_cadastro_membro && (
                  <div>
                    <p className="text-sm text-muted-foreground">Membro desde</p>
                    <p className="font-medium">
                      {format(new Date(profileData.data_cadastro_membro), "dd/MM/yyyy")}
                    </p>
                  </div>
                )}
              </div>

              {funcoes.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Funções na Igreja</p>
                    <div className="space-y-2">
                      {funcoes.map((funcao) => (
                        <div
                          key={funcao.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div>
                            <p className="font-medium">{funcao.funcoes_igreja.nome}</p>
                            {funcao.funcoes_igreja.descricao && (
                              <p className="text-sm text-muted-foreground">
                                {funcao.funcoes_igreja.descricao}
                              </p>
                            )}
                          </div>
                          {funcao.data_inicio && (
                            <Badge variant="outline">
                              Desde {format(new Date(funcao.data_inicio), "MM/yyyy")}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {profileData.observacoes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Observações</p>
                    <p className="text-sm whitespace-pre-wrap">{profileData.observacoes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Mais */}
        <TabsContent value="mais" className="space-y-4">
          {/* Familiares */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Familiares
              </CardTitle>
            </CardHeader>
            <CardContent>
              {familyMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum familiar adicionado. Adicione via FamilyWallet.
                </p>
              ) : (
                <div className="space-y-3">
                  {familyMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.avatar_url || undefined} alt={member.nome} />
                          <AvatarFallback>
                            {member.nome
                              .split(" ")
                              .map(n => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{member.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{member.tipo_parentesco}</Badge>
                            {member._isReverse && (
                              <Badge variant="secondary" className="text-xs">
                                Adicionou você
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {member.data_nascimento && (
                        <div className="text-right text-sm text-muted-foreground">
                          <p className="text-xs">
                            {new Date().getFullYear() - new Date(member.data_nascimento).getFullYear()} anos
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs de Edição */}
      {profileData && (
        <>
          <EditarDadosPessoaisDialog
            open={editPessoaisOpen}
            onOpenChange={setEditPessoaisOpen}
            pessoaId={profileData.id}
            dadosAtuais={profileData}
            onSuccess={handleDataUpdated}
          />
          <EditarContatosDialog
            open={editContatosOpen}
            onOpenChange={setEditContatosOpen}
            pessoaId={profileData.id}
            dadosAtuais={profileData}
            onSuccess={handleDataUpdated}
          />
          <EditarDadosEclesiasticosDialog
            open={editEclesiasticosOpen}
            onOpenChange={setEditEclesiasticosOpen}
            pessoaId={profileData.id}
            dadosAtuais={profileData}
            onSuccess={handleDataUpdated}
          />
          <AlterarSenhaDialog
            open={alterarSenhaOpen}
            onOpenChange={setAlterarSenhaOpen}
          />
        </>
      )}
    </div>
  );
}
