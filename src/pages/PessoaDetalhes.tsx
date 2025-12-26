import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Plus,
  Trash2,
  CalendarDays,
  MessageCircle,
  Activity,
  ChevronDown,
  ChevronUp,
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
import { AvatarUpload } from "@/components/perfil/AvatarUpload";
import { FamiliaresSection } from "@/components/pessoas/FamiliaresSection";
import { VidaIgrejaFrequencia } from "@/components/pessoas/VidaIgrejaFrequencia";
import { VidaIgrejaIntercessao } from "@/components/pessoas/VidaIgrejaIntercessao";
import { VidaIgrejaEnvolvimento } from "@/components/pessoas/VidaIgrejaEnvolvimento";
import { formatarCPF, formatarTelefone, formatarCEP } from "@/lib/validators";

interface PessoaDetalhesData {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatar_url?: string | null;
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
  alergias: string | null;
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
  const [activeTab, setActiveTab] = useState("perfil");
  const [editarPessoaisOpen, setEditarPessoaisOpen] = useState(false);
  const [editarContatosOpen, setEditarContatosOpen] = useState(false);
  const [editarEclesiasticosOpen, setEditarEclesiasticosOpen] = useState(false);
  const [editarAdicionaisOpen, setEditarAdicionaisOpen] = useState(false);
  const [editarStatusOpen, setEditarStatusOpen] = useState(false);
  const [atribuirFuncaoOpen, setAtribuirFuncaoOpen] = useState(false);
  const [dadosCivisOpen, setDadosCivisOpen] = useState(true);
  const [dadosEclesiasticosOpen, setDadosEclesiasticosOpen] = useState(true);
  const [dadosContatosOpen, setDadosContatosOpen] = useState(true);
  const [dadosAdicionaisOpen, setDadosAdicionaisOpen] = useState(true);
  const [documentosOpen, setDocumentosOpen] = useState(true);

  const handleAvatarUpdate = (newUrl: string | null) => {
    if (pessoa) {
      setPessoa({ ...pessoa, avatar_url: newUrl });
    }
  };

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

  const calcularIdade = (dataNascimento: string | null): string => {
    if (!dataNascimento) return "—";
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return `${idade} anos`;
  };

  const calcularTempoDeCasa = (dataEntrada: string | null): string => {
    if (!dataEntrada) return "—";
    const hoje = new Date();
    const entrada = new Date(dataEntrada);
    const anos = hoje.getFullYear() - entrada.getFullYear();
    const meses = hoje.getMonth() - entrada.getMonth();
    
    if (anos > 0) {
      return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
    } else if (meses > 0) {
      return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    } else {
      return "Recente";
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-0">
      {/* Back Button */}
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mb-2">
        <ArrowLeft className="w-5 h-5" />
      </Button>

      {/* NOVO HEADER UNIFICADO PREMIUM */}
      <Card className="shadow-lg border-0 bg-gradient-to-br from-background to-muted/20">
        <CardContent className="p-4 sm:p-6 md:p-8">
          <div className="flex flex-col items-center md:flex-row md:items-start gap-4 md:gap-6">
            {/* Avatar interativo */}
            <div className="flex-shrink-0">
              <AvatarUpload
                userId={pessoa.id}
                currentAvatarUrl={pessoa.avatar_url}
                userName={pessoa.nome}
                onAvatarUpdated={fetchPessoa}
              />
            </div>

            {/* Dados principais reorganizados */}
            <div className="flex-1 space-y-3 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{pessoa.nome}</h1>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 self-center md:self-start"
                  onClick={() => navigate(`/pessoas/${pessoa.id}/editar`)}
                >
                  <Edit className="w-4 h-4" />
                  <span className="hidden sm:inline">Editar perfil</span>
                  <span className="sm:hidden">Editar</span>
                </Button>
              </div>

              <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:gap-2 text-xs md:text-sm text-muted-foreground gap-1">
                {pessoa.email && (
                  <span className="flex items-center gap-1 justify-center md:justify-start truncate">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    {pessoa.email}
                  </span>
                )}
                {pessoa.email && pessoa.telefone && <span className="hidden md:inline">•</span>}
                {pessoa.telefone && (
                  <span className="flex items-center gap-1 justify-center md:justify-start">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    {formatarTelefone(pessoa.telefone)}
                  </span>
                )}
                {(pessoa.email || pessoa.telefone) && <span className="hidden md:inline">•</span>}
                <span className="flex items-center gap-1 justify-center md:justify-start">
                  <IdCard className="w-4 h-4 flex-shrink-0" />
                  ID: {pessoa.id.slice(0, 8)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                <Badge
                  variant={getStatusBadgeVariant(pessoa.status)}
                  className="text-xs font-semibold px-3 py-1 capitalize"
                >
                  {getStatusLabel(pessoa.status).toLowerCase()}
                </Badge>

                {funcoes
                  .filter((f) => f.ativo)
                  .map((funcao) => (
                    <Badge
                      key={funcao.id}
                      variant="secondary"
                      className="text-xs bg-primary/10 text-primary border-primary/20 capitalize"
                    >
                      <Crown className="w-3 h-3 mr-1" />
                      {funcao.nome.toLowerCase()}
                    </Badge>
                  ))}

                {pessoa.user_id && (
                  <Badge variant="outline" className="text-xs border-green-500 text-green-700 capitalize">
                    <Check className="w-3 h-3 mr-1" />
                    Usuário App
                  </Badge>
                )}

                {pessoa.status_igreja && (
                  <Badge className="text-xs bg-green-600 hover:bg-green-700 capitalize">
                    {pessoa.status_igreja.toLowerCase()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="hidden md:grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1">
          <TabsTrigger value="perfil" className="flex-col gap-1 py-2 px-1 text-xs">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="mais" className="flex-col gap-1 py-2 px-1 text-xs">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Dados Adicionais</span>
          </TabsTrigger>
          <TabsTrigger value="envolvimento" className="flex-col gap-1 py-2 px-1 text-xs">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Envolvimento</span>
          </TabsTrigger>
          <TabsTrigger value="frequencia" className="flex-col gap-1 py-2 px-1 text-xs">
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Frequência</span>
          </TabsTrigger>
          <TabsTrigger value="intercessao" className="flex-col gap-1 py-2 px-1 text-xs">
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Sentimentos</span>
          </TabsTrigger>
        </TabsList>

        {/* Mobile Navigation - Select */}
        <div className="md:hidden mb-4">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="perfil">Perfil</SelectItem>
              <SelectItem value="mais">Dados Adicionais</SelectItem>
              <SelectItem value="envolvimento">Envolvimento</SelectItem>
              <SelectItem value="frequencia">Frequência</SelectItem>
              <SelectItem value="intercessao">Sentimentos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tab: Perfil */}
        <TabsContent value="perfil" className="space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-base md:text-lg font-semibold">Informações do Perfil</h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Visualização consolidada dos dados cadastrais. Use as outras abas para editar.
              </p>
            </div>
          </div>
          
          {/* Grid de Informações Principais - Versão Limpa */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Card: Dados Civis */}
            <Collapsible open={dadosCivisOpen} onOpenChange={setDadosCivisOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Dados Civis
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditarPessoaisOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {dadosCivisOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Sexo:</span>
                      <span className="text-sm font-semibold text-right">{pessoa.sexo || "—"}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Nascimento:</span>
                      <span className="text-sm font-semibold text-right">
                        {pessoa.data_nascimento
                          ? `${format(new Date(pessoa.data_nascimento), "dd/MM/yyyy")} (${calcularIdade(pessoa.data_nascimento)})`
                          : "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Estado Civil:</span>
                      <span className="text-sm font-semibold text-right">{pessoa.estado_civil || "—"}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">CPF:</span>
                      <span className="text-sm font-semibold text-right">
                        {pessoa.cpf ? formatarCPF(pessoa.cpf) : "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">RG:</span>
                      <span className="text-sm font-semibold text-right">{pessoa.rg || "—"}</span>
                    </div>
                    {pessoa.necessidades_especiais && (
                      <>
                        <Separator />
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-muted-foreground">Necessidades:</span>
                          <span className="text-sm font-semibold text-right">{pessoa.necessidades_especiais}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Card: Dados de Contatos */}
            <Collapsible open={dadosContatosOpen} onOpenChange={setDadosContatosOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-5 h-5 text-primary" />
                        Contatos
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditarContatosOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {dadosContatosOpen ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Celular:</span>
                      <span className="text-sm font-semibold text-right">
                        {pessoa.telefone ? formatarTelefone(pessoa.telefone) : "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">E-mail:</span>
                      <span className="text-sm font-semibold text-right break-all">
                        {pessoa.email || "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">CEP:</span>
                      <span className="text-sm font-semibold text-right">
                        {pessoa.cep ? formatarCEP(pessoa.cep) : "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Cidade:</span>
                      <span className="text-sm font-semibold text-right">
                        {pessoa.cidade && pessoa.estado 
                          ? `${pessoa.cidade} - ${pessoa.estado}`
                          : pessoa.cidade || pessoa.estado || "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Bairro:</span>
                      <span className="text-sm font-semibold text-right">{pessoa.bairro || "—"}</span>
                    </div>
                    {pessoa.endereco && (
                      <>
                        <Separator />
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-muted-foreground">Endereço:</span>
                          <span className="text-sm font-semibold text-right">{pessoa.endereco}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Card: Dados Eclesiásticos */}
            <Collapsible open={dadosEclesiasticosOpen} onOpenChange={setDadosEclesiasticosOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Church className="w-5 h-5 text-primary" />
                        Dados Eclesiásticos
                      </div>
                      {dadosEclesiasticosOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Batizado:</span>
                      <div className="flex items-center gap-1">
                        {pessoa.batizado ? (
                          <><Check className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold">Sim</span></>
                        ) : (
                          <><X className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-semibold">Não</span></>
                        )}
                      </div>
                    </div>
                    {pessoa.data_batismo && (
                      <>
                        <Separator />
                        <div className="flex justify-between items-start">
                          <span className="text-sm text-muted-foreground">Data Batismo:</span>
                          <span className="text-sm font-semibold text-right">
                            {format(new Date(pessoa.data_batismo), "dd/MM/yyyy")}
                          </span>
                        </div>
                      </>
                    )}
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">É Líder:</span>
                      <div className="flex items-center gap-1">
                        {pessoa.e_lider ? (
                          <><Crown className="w-4 h-4 text-amber-600" /><span className="text-sm font-semibold">Sim</span></>
                        ) : (
                          <><X className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-semibold">Não</span></>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Conversão:</span>
                      <span className="text-sm font-semibold text-right">
                        {pessoa.data_conversao
                          ? format(new Date(pessoa.data_conversao), "dd/MM/yyyy")
                          : "—"}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-muted-foreground">Entrou por:</span>
                      <span className="text-sm font-semibold text-right">{pessoa.entrou_por || "—"}</span>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Família */}
          <FamiliaresSection pessoaId={pessoa.id} pessoaNome={pessoa.nome} readOnly />
        </TabsContent>

        {/* Tab: Frequência */}
        <TabsContent value="frequencia" className="space-y-4">
          <VidaIgrejaFrequencia pessoaId={pessoa.id} />
        </TabsContent>

        {/* Tab: Intercessão & Sentimentos */}
        <TabsContent value="intercessao" className="space-y-4">
          <VidaIgrejaIntercessao pessoaId={pessoa.id} />
        </TabsContent>

        {/* Tab: Envolvimento */}
        <TabsContent value="envolvimento" className="space-y-4">
          <VidaIgrejaEnvolvimento pessoaId={pessoa.id} />
        </TabsContent>

        {/* Tab: Mais */}
        <TabsContent value="mais" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card: Dados Adicionais */}
            <Collapsible open={dadosAdicionaisOpen} onOpenChange={setDadosAdicionaisOpen}>
              <Card className="shadow-soft">
                <CardHeader className="p-4 md:p-5 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-base md:text-lg">Dados Adicionais</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditarAdicionaisOpen(true)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {dadosAdicionaisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="p-4 md:p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Escolaridade</p>
                        <p className="font-medium">{pessoa.escolaridade || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Profissão</p>
                        <p className="font-medium">{pessoa.profissao || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Nacionalidade</p>
                        <p className="font-medium">{pessoa.nacionalidade || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Naturalidade</p>
                        <p className="font-medium">{pessoa.naturalidade || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Tipo sanguíneo</p>
                        <p className="font-medium">{pessoa.tipo_sanguineo || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Entrevistado por</p>
                        <p className="font-medium">{pessoa.entrevistado_por || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Cadastrado por</p>
                        <p className="font-medium">{pessoa.cadastrado_por || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Alergias</p>
                        <p className="font-medium">{pessoa.alergias || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Necessidades Especiais</p>
                        <p className="font-medium">{pessoa.necessidades_especiais || "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Observações</p>
                        <p className="font-medium">{pessoa.observacoes || "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Card: Documentos */}
            <Collapsible open={documentosOpen} onOpenChange={setDocumentosOpen}>
              <Card className="shadow-soft">
                <CardHeader className="p-4 md:p-5 bg-gradient-to-r from-primary/5 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-base md:text-lg">Documentos</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                          {documentosOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="p-4 md:p-5">
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Nenhum documento anexado</p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
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
              alergias: pessoa.alergias,
              necessidades_especiais: pessoa.necessidades_especiais,
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
