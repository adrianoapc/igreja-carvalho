import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvatarUpload } from "@/components/perfil/AvatarUpload";
import { FamiliaresSection } from "@/components/pessoas/FamiliaresSection";
import { VidaIgrejaEnvolvimento } from "@/components/pessoas/VidaIgrejaEnvolvimento";
import { EditarDadosPessoaisDialog } from "@/components/pessoas/EditarDadosPessoaisDialog";
import { EditarContatosDialog } from "@/components/pessoas/EditarContatosDialog";
import { EditarDadosEclesiasticosDialog } from "@/components/pessoas/EditarDadosEclesiasticosDialog";
import { EditarDadosAdicionaisDialog } from "@/components/pessoas/EditarDadosAdicionaisDialog";
import { EditarStatusDialog } from "@/components/pessoas/EditarStatusDialog";
import { ConfigurarDisponibilidadeDialog } from "@/components/membros/ConfigurarDisponibilidadeDialog";
import { ArrowLeft, Check, Clock, Edit, Mail, MapPin, Phone, Shield, Sparkles, User } from "lucide-react";
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

export default function EditarPessoa() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [loading, setLoading] = useState(true);
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
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!pessoa) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
            <Shield className="w-5 h-5" />
            Não encontramos os dados dessa pessoa.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Edição</p>
          <h1 className="text-2xl font-bold">Editar Pessoa</h1>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 items-start">
          <div className="flex-shrink-0">
            <AvatarUpload
              userId={pessoa.id}
              currentAvatarUrl={pessoa.avatar_url}
              userName={pessoa.nome}
              onAvatarUpdated={fetchPessoa}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl md:text-2xl font-semibold truncate">{pessoa.nome}</h2>
              <Badge variant={statusVariant} className="text-xs">{pessoa.status}</Badge>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setEditarStatusOpen(true)}>
                <Edit className="w-4 h-4 mr-1" />
                Status
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-green-500" />
                Dados centralizados para edição
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                Fluxo simplificado
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pessoais" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 bg-muted/60">
          <TabsTrigger value="pessoais" className="text-sm">Pessoais</TabsTrigger>
          <TabsTrigger value="contatos" className="text-sm">Contatos</TabsTrigger>
          <TabsTrigger value="igreja" className="text-sm">Igreja</TabsTrigger>
          <TabsTrigger value="familia" className="text-sm">Família</TabsTrigger>
          <TabsTrigger value="extras" className="text-sm">Extras</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoais" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><User className="w-4 h-4" /> Dados pessoais</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditarPessoaisOpen(true)}>
                <Edit className="w-4 h-4 mr-2" /> Editar
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Info label="Sexo" value={pessoa.sexo} />
              <Info label="Data de nascimento" value={pessoa.data_nascimento} />
              <Info label="Estado civil" value={pessoa.estado_civil} />
              <Info label="Data de casamento" value={pessoa.data_casamento} />
              <Info label="RG" value={pessoa.rg} />
              <Info label="CPF" value={pessoa.cpf} />
              <Info label="Necessidades especiais" value={pessoa.necessidades_especiais} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contatos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Phone className="w-4 h-4" /> Contatos</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditarContatosOpen(true)}>
                <Edit className="w-4 h-4 mr-2" /> Editar
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Info label="Telefone" value={pessoa.telefone ? formatarTelefone(pessoa.telefone) : null} icon={<Phone className="w-4 h-4 text-muted-foreground" />} />
              <Info label="E-mail" value={pessoa.email} icon={<Mail className="w-4 h-4 text-muted-foreground" />} />
              <Info label="CEP" value={pessoa.cep ? formatarCEP(pessoa.cep) : null} icon={<MapPin className="w-4 h-4 text-muted-foreground" />} />
              <Info label="Endereço" value={pessoa.endereco} />
              <Info label="Bairro" value={pessoa.bairro} />
              <Info label="Cidade/UF" value={pessoa.cidade ? `${pessoa.cidade}${pessoa.estado ? ` - ${pessoa.estado}` : ""}` : null} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="igreja" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Dados eclesiásticos</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditarEclesiasticosOpen(true)}>
                <Edit className="w-4 h-4 mr-2" /> Editar
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Info label="Status igreja" value={pessoa.status_igreja} />
              <Info label="Entrou por" value={pessoa.entrou_por} />
              <Info label="Data de entrada" value={pessoa.data_entrada} />
              <Info label="Conversão" value={pessoa.data_conversao} />
              <Info label="Batizado" value={pessoa.batizado ? "Sim" : "Não"} />
              <Info label="Data batismo" value={pessoa.data_batismo} />
              <Info label="Líder" value={pessoa.e_lider ? "Sim" : "Não"} />
              <Info label="Pastor" value={pessoa.e_pastor ? "Sim" : "Não"} />
            </CardContent>
          </Card>

          {/* Card de Disponibilidade Pastoral - Apenas para pastores/líderes */}
          {(pessoa.e_pastor || pessoa.e_lider) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Disponibilidade para Atendimento
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setDisponibilidadeOpen(true)}>
                  <Edit className="w-4 h-4 mr-2" /> Configurar
                </Button>
              </CardHeader>
              <CardContent>
                {pessoa.disponibilidade_agenda && Object.values(pessoa.disponibilidade_agenda).some(d => d.ativo) ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(pessoa.disponibilidade_agenda)
                      .filter(([_, config]) => config.ativo)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([diaKey, config]) => (
                        <Badge key={diaKey} variant="secondary" className="text-xs">
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Funções & Times</CardTitle>
            </CardHeader>
            <CardContent>
              <VidaIgrejaEnvolvimento pessoaId={pessoa.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="familia" className="space-y-4">
          <FamiliaresSection pessoaId={pessoa.id} pessoaNome={pessoa.nome} />
        </TabsContent>

        <TabsContent value="extras" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Informações adicionais</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setEditarAdicionaisOpen(true)}>
                <Edit className="w-4 h-4 mr-2" /> Editar
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Info label="Escolaridade" value={pessoa.escolaridade} />
              <Info label="Profissão" value={pessoa.profissao} />
              <Info label="Nacionalidade" value={pessoa.nacionalidade} />
              <Info label="Naturalidade" value={pessoa.naturalidade} />
              <Info label="Entrevistado por" value={pessoa.entrevistado_por} />
              <Info label="Cadastrado por" value={pessoa.cadastrado_por} />
              <Info label="Tipo sanguíneo" value={pessoa.tipo_sanguineo} />
              <Info label="Observações" value={pessoa.observacoes} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

function Info({ label, value, icon }: { label: string; value: string | null; icon?: React.ReactNode }) {
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
