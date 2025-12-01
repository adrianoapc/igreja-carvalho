import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Mail, MapPin, Calendar, Briefcase, Church, Edit } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { EditarDadosPessoaisDialog } from "@/components/pessoas/EditarDadosPessoaisDialog";
import { EditarContatosDialog } from "@/components/pessoas/EditarContatosDialog";
import { EditarDadosEclesiasticosDialog } from "@/components/pessoas/EditarDadosEclesiasticosDialog";

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

export default function Perfil() {
  const { profile } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [funcoes, setFuncoes] = useState<FuncaoIgreja[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPessoaisOpen, setEditPessoaisOpen] = useState(false);
  const [editContatosOpen, setEditContatosOpen] = useState(false);
  const [editEclesiasticosOpen, setEditEclesiasticosOpen] = useState(false);

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
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center text-2xl font-bold text-primary">
            {profileData.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profileData.nome}</h1>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="capitalize">
                {profileData.status}
              </Badge>
              {profileData.e_pastor && <Badge>Pastor</Badge>}
              {profileData.e_lider && <Badge>Líder</Badge>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="pessoais">Pessoais</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="igreja">Igreja</TabsTrigger>
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
        </>
      )}
    </div>
  );
}
