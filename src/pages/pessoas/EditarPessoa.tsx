import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarUpload } from "@/components/perfil/AvatarUpload";
import { FamiliaresSection } from "@/components/pessoas/FamiliaresSection";
import { VidaIgrejaEnvolvimento } from "@/components/pessoas/VidaIgrejaEnvolvimento";
import { EditarDadosPessoaisDialog } from "@/components/pessoas/EditarDadosPessoaisDialog";
import { EditarContatosDialog } from "@/components/pessoas/EditarContatosDialog";
import { EditarDadosEclesiasticosDialog } from "@/components/pessoas/EditarDadosEclesiasticosDialog";
import { EditarDadosAdicionaisDialog } from "@/components/pessoas/EditarDadosAdicionaisDialog";
import { EditarStatusDialog } from "@/components/pessoas/EditarStatusDialog";
import { ConfigurarDisponibilidadeDialog } from "@/components/membros/ConfigurarDisponibilidadeDialog";
import { ArrowLeft, Check, Clock, Edit, Mail, MapPin, Phone, Shield, Sparkles, User, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatarCEP, formatarTelefone } from "@/lib/validators";

interface DisponibilidadeDia {
  ativo: boolean;
  inicio?: string;
  fim?: string;
}

interface DisponibilidadeAgenda {
  [key: string]: DisponibilidadeDia;
}

interface Pessoa {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  status: "visitante" | "frequentador" | "membro";
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
  autorizado_bot_financeiro: boolean | null;
  disponibilidade_agenda: DisponibilidadeAgenda | null;
}

const DIAS_SEMANA_LABELS: Record<string, string> = {
  "0": "Dom",
  "1": "Seg",
  "2": "Ter",
  "3": "Qua",
  "4": "Qui",
  "5": "Sex",
  "6": "Sáb",
};

const TABS = [
  { id: "pessoais", label: "Pessoais", icon: User },
  { id: "contatos", label: "Contatos", icon: Phone },
  { id: "igreja", label: "Igreja", icon: Shield },
  { id: "familia", label: "Família", icon: "👨‍👩‍👧" },
  { id: "extras", label: "Extras", icon: Sparkles },
];

export default function EditarPessoa() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pessoais");
  const [editarPessoaisOpen, setEditarPessoaisOpen] = useState(false);
  const [editarContatosOpen, setEditarContatosOpen] = useState(false);
  const [editarEclesiasticosOpen, setEditarEclesiasticosOpen] = useState(false);
  const [editarAdicionaisOpen, setEditarAdicionaisOpen] = useState(false);
  const [editarStatusOpen, setEditarStatusOpen] = useState(false);
  const [disponibilidadeOpen, setDisponibilidadeOpen] = useState(false);

  const fetchPessoa = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      setPessoa({
        ...data,
        disponibilidade_agenda: data.disponibilidade_agenda as unknown as DisponibilidadeAgenda | null,
      } as Pessoa);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchPessoa();
  }, [fetchPessoa]);

  const statusVariant = useMemo(() => {
    if (!pessoa) return "default" as const;
    switch (pessoa.status) {
      case "membro":
        return "default" as const;
      case "frequentador":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  }, [pessoa]);

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
            <Shield className="w-5 h-5 flex-shrink-0" />
            Não encontramos os dados dessa pessoa.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Edição</p>
          <h1 className="text-xl md:text-2xl font-bold truncate">Editar Pessoa</h1>
        </div>
      </div>

      {/* Card do Perfil */}
      <Card className="shadow-soft">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
            <div className="flex-shrink-0 flex justify-center sm:block">
              <AvatarUpload
                userId={pessoa.id}
                currentAvatarUrl={pessoa.avatar_url}
                userName={pessoa.nome}
                onAvatarUpdated={fetchPessoa}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold truncate">{pessoa.nome}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: {pessoa.id.substring(0, 8)}...
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant} className="text-xs whitespace-nowrap">
                    {pessoa.status}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditarStatusOpen(true)}
                    className="text-xs h-8"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Mudar status
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                    <span>Edição centralizada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navegação Mobile via Select */}
      <div className="block md:hidden">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma seção" />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((tab) => (
              <SelectItem key={tab.id} value={tab.id}>
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Navegação Desktop via Buttons */}
      <div className="hidden md:grid grid-cols-5 gap-2 bg-muted/30 p-2 rounded-lg">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="text-xs"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Conteúdo das Abas */}
      <div className="space-y-4">
        {/* Pessoais */}
        {activeTab === "pessoais" && (
          <Card>
            <CardHeader className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Dados Pessoais
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditarPessoaisOpen(true)}
                className="w-full sm:w-auto text-xs"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Info label="Sexo" value={pessoa.sexo} />
                <Info label="Data de nascimento" value={pessoa.data_nascimento} />
                <Info label="Estado civil" value={pessoa.estado_civil} />
                <Info label="Data de casamento" value={pessoa.data_casamento} />
                <Info label="RG" value={pessoa.rg} />
                <Info label="CPF" value={pessoa.cpf} />
                <Info label="Necessidades especiais" value={pessoa.necessidades_especiais} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contatos */}
        {activeTab === "contatos" && (
          <Card>
            <CardHeader className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary" />
                Contatos
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditarContatosOpen(true)}
                className="w-full sm:w-auto text-xs"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Info 
                  label="Telefone" 
                  value={pessoa.telefone ? formatarTelefone(pessoa.telefone) : null}
                  icon={<Phone className="w-4 h-4 text-muted-foreground" />} 
                />
                <Info 
                  label="E-mail" 
                  value={pessoa.email}
                  icon={<Mail className="w-4 h-4 text-muted-foreground" />} 
                />
                <Info 
                  label="CEP" 
                  value={pessoa.cep ? formatarCEP(pessoa.cep) : null}
                  icon={<MapPin className="w-4 h-4 text-muted-foreground" />} 
                />
                <Info label="Endereço" value={pessoa.endereco} />
                <Info label="Bairro" value={pessoa.bairro} />
                <Info 
                  label="Cidade/UF" 
                  value={pessoa.cidade ? `${pessoa.cidade}${pessoa.estado ? ` - ${pessoa.estado}` : ""}` : null} 
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Igreja */}
        {activeTab === "igreja" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Dados Eclesiásticos
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditarEclesiasticosOpen(true)}
                  className="w-full sm:w-auto text-xs"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </CardHeader>
              <CardContent className="p-4 md:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Info label="Status igreja" value={pessoa.status_igreja} />
                  <Info label="Entrou por" value={pessoa.entrou_por} />
                  <Info label="Data de entrada" value={pessoa.data_entrada} />
                  <Info label="Conversão" value={pessoa.data_conversao} />
                  <Info label="Batizado" value={pessoa.batizado ? "Sim" : "Não"} />
                  <Info label="Data batismo" value={pessoa.data_batismo} />
                  <Info label="Líder" value={pessoa.e_lider ? "Sim" : "Não"} />
                  <Info label="Pastor" value={pessoa.e_pastor ? "Sim" : "Não"} />
                </div>
              </CardContent>
            </Card>

            {/* Disponibilidade - Apenas para pastores/líderes */}
            {(pessoa.e_pastor || pessoa.e_lider) && (
              <Card>
                <CardHeader className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Disponibilidade
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setDisponibilidadeOpen(true)}
                    className="w-full sm:w-auto text-xs"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Configurar
                  </Button>
                </CardHeader>
                <CardContent className="p-4 md:p-5">
                  {pessoa.disponibilidade_agenda && Object.values(pessoa.disponibilidade_agenda).some(d => d.ativo) ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(pessoa.disponibilidade_agenda)
                        .filter(([_, config]) => config.ativo)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([diaKey, config]) => (
                          <Badge key={diaKey} variant="secondary" className="text-xs whitespace-nowrap">
                            {DIAS_SEMANA_LABELS[diaKey]}: {config.inicio} - {config.fim}
                          </Badge>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum horário de atendimento configurado
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Funções & Times */}
            <Collapsible defaultOpen>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="p-4 md:p-5 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="text-base md:text-lg flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        Funções & Times
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-4 md:p-5">
                    <VidaIgrejaEnvolvimento pessoaId={pessoa.id} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        )}

        {/* Família */}
        {activeTab === "familia" && (
          <FamiliaresSection pessoaId={pessoa.id} pessoaNome={pessoa.nome} />
        )}

        {/* Extras */}
        {activeTab === "extras" && (
          <Card>
            <CardHeader className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Informações Adicionais
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditarAdicionaisOpen(true)}
                className="w-full sm:w-auto text-xs"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Info label="Escolaridade" value={pessoa.escolaridade} />
                <Info label="Profissão" value={pessoa.profissao} />
                <Info label="Nacionalidade" value={pessoa.nacionalidade} />
                <Info label="Naturalidade" value={pessoa.naturalidade} />
                <Info label="Entrevistado por" value={pessoa.entrevistado_por} />
                <Info label="Cadastrado por" value={pessoa.cadastrado_por} />
                <Info label="Tipo sanguíneo" value={pessoa.tipo_sanguineo} />
                <Info label="Alergias" value={pessoa.alergias} />
                <Info label="Observações" value={pessoa.observacoes} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
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
          autorizado_bot_financeiro: pessoa.autorizado_bot_financeiro,
        }}
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

      <ConfigurarDisponibilidadeDialog
        open={disponibilidadeOpen}
        onOpenChange={setDisponibilidadeOpen}
        profileId={pessoa.id}
        initialData={pessoa.disponibilidade_agenda}
        onSuccess={fetchPessoa}
      />
    </div>
  );
}

function Info({ 
  label, 
  value, 
  icon 
}: { 
  label: string; 
  value: string | null; 
  icon?: React.ReactNode 
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value || "Não informado"}</p>
    </div>
  );
}
