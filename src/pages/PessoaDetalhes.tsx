import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Heart,
  Users,
  BookOpen,
  MoreHorizontal,
  Edit,
  Check,
  X,
  Gift,
  Shield,
  Church,
  IdCard,
  Home,
  Briefcase,
  FileText,
  Cake,
  Droplets,
  Crown,
  UserCheck,
  AlertCircle,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EditarDadosPessoaisDialog } from "@/components/pessoas/EditarDadosPessoaisDialog";
import { EditarContatosDialog } from "@/components/pessoas/EditarContatosDialog";
import { EditarDadosEclesiasticosDialog } from "@/components/pessoas/EditarDadosEclesiasticosDialog";
import { EditarDadosAdicionaisDialog } from "@/components/pessoas/EditarDadosAdicionaisDialog";
import { EditarStatusDialog } from "@/components/pessoas/EditarStatusDialog";
import { AtribuirFuncaoDialog } from "@/components/membros/AtribuirFuncaoDialog";
import { formatarCPF, formatarTelefone, formatarCEP } from "@/lib/validators";

interface PessoaDetalhesData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: "visitante" | "frequentador" | "membro";
  data_primeira_visita: string | null;
  data_ultima_visita: string | null;
  numero_visitas: number;
  aceitou_jesus: boolean | null;
  deseja_contato: boolean | null;
  recebeu_brinde: boolean | null;
  user_id: string | null;
  sexo: string | null;
  data_nascimento: string | null;
  estado_civil: string | null;
  data_casamento: string | null;
  rg: string | null;
  cpf: string | null;
  necessidades_especiais: string | null;
  cep: string | null;
  cidade: string | null;
  bairro: string | null;
  estado: string | null;
  endereco: string | null;
  entrou_por: string | null;
  data_entrada: string | null;
  status_igreja: string | null;
  data_conversao: string | null;
  batizado: boolean | null;
  data_batismo: string | null;
  e_lider: boolean | null;
  e_pastor: boolean | null;
  escolaridade: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  entrevistado_por: string | null;
  cadastrado_por: string | null;
  tipo_sanguineo: string | null;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Funcao {
  id: string;
  nome: string;
  data_inicio: string;
  ativo: boolean;
}

export default function PessoaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pessoa, setPessoa] = useState<PessoaDetalhesData | null>(null);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editarPessoaisOpen, setEditarPessoaisOpen] = useState(false);
  const [editarContatosOpen, setEditarContatosOpen] = useState(false);
  const [editarEclesiasticosOpen, setEditarEclesiasticosOpen] = useState(false);
  const [editarAdicionaisOpen, setEditarAdicionaisOpen] = useState(false);
  const [editarStatusOpen, setEditarStatusOpen] = useState(false);
  const [compactView, setCompactView] = useState(true);
  const [atribuirFuncaoOpen, setAtribuirFuncaoOpen] = useState(false);

  const fetchPessoa = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPessoa(data);

      // Buscar funções da pessoa
      const { data: funcoesData } = await supabase
        .from("membro_funcoes")
        .select(`
          id,
          data_inicio,
          ativo,
          funcoes_igreja (
            id,
            nome
          )
        `)
        .eq("membro_id", id)
        .order("data_inicio", { ascending: false });

      setFuncoes(
        funcoesData?.map((f: any) => ({
          id: f.id,
          nome: f.funcoes_igreja.nome,
          data_inicio: f.data_inicio,
          ativo: f.ativo,
        })) || []
      );
    } catch (error) {
      console.error("Erro ao buscar pessoa:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da pessoa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPessoa();
  }, [id, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Pessoa não encontrada.</p>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "visitante": return "outline";
      case "frequentador": return "secondary";
      case "membro": return "default";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "visitante": return "VISITANTE";
      case "frequentador": return "FREQUENTADOR";
      case "membro": return "MEMBRO";
      default: return status.toUpperCase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Profile Header */}
      <div className="flex items-start gap-4 mb-6">
        <Avatar className="w-20 h-20 border-4 border-green-500">
          <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            {pessoa.nome.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{pessoa.nome}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={getStatusBadgeVariant(pessoa.status)}>
                  {getStatusLabel(pessoa.status)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditarStatusOpen(true)}
                  className="h-7 px-2 text-xs"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Alterar Status
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {pessoa.user_id ? (
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-green-500" />
                é usuário da plataforma
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <X className="w-4 h-4 text-muted-foreground" />
                não é usuário da plataforma
              </span>
            )}
            <Separator orientation="vertical" className="h-4" />
            <span>ID do perfil: {pessoa.id.slice(0, 8)}</span>
          </div>
        </div>
      </div>

      {/* Church Info */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Igreja Carvalho</h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Funções:</span>
                {funcoes.length > 0 ? (
                  funcoes
                    .filter((f) => f.ativo)
                    .map((funcao) => (
                      <Badge key={funcao.id} variant="outline">
                        {funcao.nome}
                      </Badge>
                    ))
                ) : (
                  <Badge variant="outline">Nenhum</Badge>
                )}
              </div>
            </div>
            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
              {pessoa.status_igreja?.toUpperCase() || "ATIVO"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="perfil">
            <User className="w-4 h-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="pessoais">
            <Heart className="w-4 h-4 mr-2" />
            Pessoais
          </TabsTrigger>
          <TabsTrigger value="contatos">
            <Phone className="w-4 h-4 mr-2" />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="igreja">
            <Church className="w-4 h-4 mr-2" />
            Igreja
          </TabsTrigger>
          <TabsTrigger value="mais">
            <MoreHorizontal className="w-4 h-4 mr-2" />
            Mais
          </TabsTrigger>
        </TabsList>

        {/* Tab: Perfil */}
        <TabsContent value="perfil" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Informações do Perfil</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Visualização consolidada dos dados cadastrais. Use as outras abas para editar.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompactView(!compactView)}
              className="gap-2"
            >
              {compactView ? (
                <>
                  <Maximize2 className="w-4 h-4" />
                  Expandir
                </>
              ) : (
                <>
                  <Minimize2 className="w-4 h-4" />
                  Compactar
                </>
              )}
            </Button>
          </div>
          
          <div className={`grid gap-4 ${compactView ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'}`}>
            <Card className="border-l-4 border-l-primary/40 card-gradient-info profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Idade</p>
                  {compactView && <Cake className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none">
                  {pessoa.data_nascimento
                    ? `${new Date().getFullYear() - new Date(pessoa.data_nascimento).getFullYear()} anos`
                    : "—"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/40 card-gradient-info profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sexo</p>
                  {compactView && <User className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none truncate">{pessoa.sexo || "—"}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/40 card-gradient-info profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado Civil</p>
                  {compactView && <Heart className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none truncate">{pessoa.estado_civil || "—"}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/40 card-gradient-spiritual profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Batizado</p>
                  {compactView && <Droplets className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none">{pessoa.batizado ? "Sim" : "Não"}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/40 card-gradient-spiritual profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pastor</p>
                  {compactView && <BookOpen className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none">{pessoa.e_pastor ? "Sim" : "Não"}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/40 card-gradient-spiritual profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Liderança</p>
                  {compactView && <Crown className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none">{pessoa.e_lider ? "Sim" : "Não"}</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/40 card-gradient-success profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Telefone</p>
                  {compactView && <Phone className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none truncate">
                  {pessoa.telefone ? formatarTelefone(pessoa.telefone) : "—"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-primary/40 card-gradient-warning profile-card-hover overflow-hidden">
              <CardContent className={compactView ? "pt-6" : "pt-4"}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Necessidades</p>
                  {compactView && <AlertCircle className="w-4 h-4 text-primary/70" />}
                </div>
                <p className="text-sm font-semibold leading-none truncate">{pessoa.necessidades_especiais || "Nenhuma"}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Células</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Indicar para um líder
                </Button>
                <Button variant="outline" size="sm">
                  Adicionar Célula
                </Button>
              </div>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* Tab: Pessoais */}
        <TabsContent value="pessoais" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Dados pessoais</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditarPessoaisOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar dados pessoais
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Sexo:</p>
                  <p className="text-base font-semibold">{pessoa.sexo || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Data de nascimento:</p>
                  <p className="text-base font-semibold">
                    {pessoa.data_nascimento
                      ? format(new Date(pessoa.data_nascimento), "dd/MM/yyyy", { locale: ptBR })
                      : "Não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Estado civil:</p>
                  <p className="text-base font-semibold">{pessoa.estado_civil || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Data de casamento:</p>
                  <p className="text-base font-semibold">
                    {pessoa.data_casamento
                      ? format(new Date(pessoa.data_casamento), "dd/MM/yyyy", { locale: ptBR })
                      : "Não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">RG:</p>
                  <p className="text-base font-semibold">{pessoa.rg || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">CPF:</p>
                  <p className="text-base font-semibold">
                    {pessoa.cpf ? formatarCPF(pessoa.cpf) : "Não informado"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Necessidades especiais:</p>
                  <p className="text-base font-semibold">{pessoa.necessidades_especiais || "Não informado"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Família:</CardTitle>
              </div>
              <Button variant="outline" size="sm">
                Adicionar familiar
              </Button>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* Tab: Contatos */}
        <TabsContent value="contatos" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Contatos</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditarContatosOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar contato
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">CEP:</p>
                  <p className="text-base font-semibold">
                    {pessoa.cep ? formatarCEP(pessoa.cep) : "Não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cidade:</p>
                  <p className="text-base font-semibold">{pessoa.cidade || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Bairro:</p>
                  <p className="text-base font-semibold">{pessoa.bairro || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Estado:</p>
                  <p className="text-base font-semibold">{pessoa.estado || "Não informado"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Endereço:</p>
                  <p className="text-base font-semibold">{pessoa.endereco || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">E-mail:</p>
                  <p className="text-base font-semibold">{pessoa.email || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Celular:</p>
                  <p className="text-base font-semibold">
                    {pessoa.telefone ? formatarTelefone(pessoa.telefone) : "Não informado"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Igreja */}
        <TabsContent value="igreja" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Dados eclesiásticos</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditarEclesiasticosOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar dados eclesiásticos
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Entrou por:</p>
                  <p className="text-base font-semibold">{pessoa.entrou_por || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Data de entrada:</p>
                  <p className="text-base font-semibold">
                    {pessoa.data_entrada
                      ? format(new Date(pessoa.data_entrada), "dd/MM/yyyy", { locale: ptBR })
                      : "Não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Qual o status dessa pessoa na igreja?</p>
                  <p className="text-base font-semibold">{pessoa.status_igreja || "Ativo"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Data da conversão:</p>
                  <p className="text-base font-semibold">
                    {pessoa.data_conversao
                      ? format(new Date(pessoa.data_conversao), "dd/MM/yyyy", { locale: ptBR })
                      : "Não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Foi batizado(a)?</p>
                  <p className="text-base font-semibold">{pessoa.batizado ? "Sim" : "Não"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Data de batismo:</p>
                  <p className="text-base font-semibold">
                    {pessoa.data_batismo
                      ? format(new Date(pessoa.data_batismo), "dd/MM/yyyy", { locale: ptBR })
                      : "Não informado"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">É líder?</p>
                  <p className="text-base font-semibold">{pessoa.e_lider ? "Sim" : "Não"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">É pastor?</p>
                  <p className="text-base font-semibold">{pessoa.e_pastor ? "Sim" : "Não"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Funções na Igreja</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAtribuirFuncaoOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Atribuir função
              </Button>
            </CardHeader>
            <CardContent>
              {funcoes.length > 0 ? (
                <div className="space-y-3">
                  {funcoes.map((funcao) => (
                    <div
                      key={funcao.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold">{funcao.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Desde:{" "}
                          {format(new Date(funcao.data_inicio), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={funcao.ativo ? "default" : "secondary"}>
                          {funcao.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={async () => {
                            if (confirm("Deseja realmente remover esta função?")) {
                              try {
                                const { error } = await supabase
                                  .from("membro_funcoes")
                                  .delete()
                                  .eq("id", funcao.id);
                                
                                if (error) throw error;
                                
                                toast({
                                  title: "Sucesso",
                                  description: "Função removida com sucesso",
                                });
                                
                                fetchPessoa();
                              } catch (error: any) {
                                toast({
                                  title: "Erro",
                                  description: error.message || "Não foi possível remover a função",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhuma função atribuída</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Mais */}
        <TabsContent value="mais" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Dados adicionais</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditarAdicionaisOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar dados adicionais
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Escolaridade</p>
                  <p className="text-base font-semibold">{pessoa.escolaridade || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Profissão</p>
                  <p className="text-base font-semibold">{pessoa.profissao || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Nacionalidade</p>
                  <p className="text-base font-semibold">{pessoa.nacionalidade || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Naturalidade</p>
                  <p className="text-base font-semibold">{pessoa.naturalidade || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Entrevistado por</p>
                  <p className="text-base font-semibold">{pessoa.entrevistado_por || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Cadastrado por</p>
                  <p className="text-base font-semibold">{pessoa.cadastrado_por || "Não informado"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Tipo sanguíneo</p>
                  <p className="text-base font-semibold">{pessoa.tipo_sanguineo || "Não informado"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                  <p className="text-base font-semibold">{pessoa.observacoes || "Não informado"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-green-600 rounded" />
                <CardTitle>Documentos:</CardTitle>
              </div>
              <Button variant="outline" size="sm">
                Adicionar documento
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum documento anexado</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogos de Edição */}
      {pessoa && (
        <>
          <EditarDadosPessoaisDialog
            open={editarPessoaisOpen}
            onOpenChange={setEditarPessoaisOpen}
            pessoaId={pessoa.id}
            dadosAtuais={{
              sexo: pessoa.sexo,
              data_nascimento: pessoa.data_nascimento,
              estado_civil: pessoa.estado_civil,
              data_casamento: pessoa.data_casamento,
              rg: pessoa.rg,
              cpf: pessoa.cpf,
              necessidades_especiais: pessoa.necessidades_especiais,
            }}
            onSuccess={fetchPessoa}
          />

          <EditarContatosDialog
            open={editarContatosOpen}
            onOpenChange={setEditarContatosOpen}
            pessoaId={pessoa.id}
            dadosAtuais={{
              cep: pessoa.cep,
              cidade: pessoa.cidade,
              bairro: pessoa.bairro,
              estado: pessoa.estado,
              endereco: pessoa.endereco,
              email: pessoa.email,
              telefone: pessoa.telefone,
            }}
            onSuccess={fetchPessoa}
          />

          <EditarDadosEclesiasticosDialog
            open={editarEclesiasticosOpen}
            onOpenChange={setEditarEclesiasticosOpen}
            pessoaId={pessoa.id}
            dadosAtuais={{
              entrou_por: pessoa.entrou_por,
              data_entrada: pessoa.data_entrada,
              status_igreja: pessoa.status_igreja,
              data_conversao: pessoa.data_conversao,
              batizado: pessoa.batizado,
              data_batismo: pessoa.data_batismo,
              e_lider: pessoa.e_lider,
              e_pastor: pessoa.e_pastor,
            }}
            onSuccess={fetchPessoa}
          />

          <EditarDadosAdicionaisDialog
            open={editarAdicionaisOpen}
            onOpenChange={setEditarAdicionaisOpen}
            pessoaId={pessoa.id}
            dadosAtuais={{
              escolaridade: pessoa.escolaridade,
              profissao: pessoa.profissao,
              nacionalidade: pessoa.nacionalidade,
              naturalidade: pessoa.naturalidade,
              entrevistado_por: pessoa.entrevistado_por,
              cadastrado_por: pessoa.cadastrado_por,
              tipo_sanguineo: pessoa.tipo_sanguineo,
              observacoes: pessoa.observacoes,
            }}
            onSuccess={fetchPessoa}
          />

          <AtribuirFuncaoDialog
            open={atribuirFuncaoOpen}
            onOpenChange={setAtribuirFuncaoOpen}
            membroId={pessoa.id}
            membroNome={pessoa.nome}
            onSuccess={fetchPessoa}
          />

          <EditarStatusDialog
            open={editarStatusOpen}
            onOpenChange={setEditarStatusOpen}
            pessoaId={pessoa.id}
            statusAtual={pessoa.status}
            nome={pessoa.nome}
            onSuccess={fetchPessoa}
          />
        </>
      )}
    </div>
  );
}
