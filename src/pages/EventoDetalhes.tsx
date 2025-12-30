import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Timer,
  CheckCircle2,
  Presentation,
  Eye,
  ListMusic,
  ClipboardList,
  Save,
  QrCode,
  Send,
  Loader2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import LiturgiaTab from "@/components/eventos/tabs/LiturgiaTab";
import LiturgiaTabContent from "@/components/cultos/LiturgiaTabContent";
import MusicaTabContent from "@/components/cultos/MusicaTabContent";
import EscalasTabContent from "@/components/cultos/EscalasTabContent";
import ConvitesTabContent from "@/components/eventos/ConvitesTabContent";
import EscalaTimeline from "@/components/escalas/EscalaTimeline";

interface Evento {
  id: string;
  tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
  subtipo_id: string | null;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  duracao_minutos: number | null;
  local: string | null;
  endereco: string | null;
  pregador: string | null;
  tema: string | null;
  status: string;
  observacoes: string | null;
  exibir_preletor: boolean;
  evento_subtipos?: { nome: string; cor: string | null } | null;
}

const STATUS_OPTIONS = [
  { value: "planejado", label: "Planejado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planejado: {
    label: "Planejado",
    color:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  },
  confirmado: {
    label: "Confirmado",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  },
  realizado: {
    label: "Realizado",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  },
  cancelado: {
    label: "Cancelado",
    color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  },
};

const TIPO_LABELS: Record<string, string> = {
  CULTO: "Culto",
  RELOGIO: "Relógio",
  TAREFA: "Tarefa",
  EVENTO: "Evento",
  OUTRO: "Outro",
};

export default function EventoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificando, setNotificando] = useState(false);
  const [escalasCount, setEscalasCount] = useState(0);
  const [liturgiaCount, setLiturgiaCount] = useState(0);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "visao-geral");

  // Form state
  const [tema, setTema] = useState("");
  const [pregador, setPregador] = useState("");
  const [local, setLocal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("planejado");

  useEffect(() => {
    if (id) {
      loadEvento();
      loadStats();
    }
  }, [id]);

  const loadEvento = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos")
        .select(`*, evento_subtipos ( nome, cor )`)
        .eq("id", id)
        .single();

      if (error) throw error;

      const normalized: Evento = {
        ...data,
        tipo: data.tipo as Evento["tipo"],
      };

      setEvento(normalized);
      setTema(normalized.tema || "");
      setPregador(normalized.pregador || "");
      setLocal(normalized.local || "");
      setObservacoes(normalized.observacoes || "");
      setStatus(normalized.status);
    } catch (error: unknown) {
      toast.error("Erro ao carregar evento", {
        description: error instanceof Error ? error.message : String(error),
      });
      navigate("/eventos/lista");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [escalasRes, liturgiaRes] = await Promise.all([
        supabase
          .from("escalas")
          .select("id", { count: "exact" })
          .eq("evento_id", id!),
        supabase
          .from("liturgias")
          .select("id", { count: "exact" })
          .eq("evento_id", id!),
      ]);

      setEscalasCount(escalasRes.count || 0);
      setLiturgiaCount(liturgiaRes.count || 0);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const handleSave = async () => {
    if (!evento) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("eventos")
        .update({
          tema,
          pregador,
          local,
          observacoes,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", evento.id);

      if (error) throw error;

      toast.success("Alterações salvas com sucesso!");
      loadEvento();
    } catch (error: unknown) {
      toast.error("Erro ao salvar", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNotificarEscalados = async () => {
    if (!evento) return;
    setNotificando(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "disparar-escala",
        {
          body: { evento_id: evento.id },
        }
      );

      if (error) throw error;

      if (data.success) {
        toast.success(data.message, {
          description: data.erros > 0 ? `${data.erros} falhas` : undefined,
        });
      } else {
        toast.error("Erro ao notificar", { description: data.message });
      }
    } catch (error: unknown) {
      toast.error("Erro ao notificar escalados", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setNotificando(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!evento) {
    return null;
  }

  const dataEvento = new Date(evento.data_evento);
  const statusConfig = STATUS_CONFIG[evento.status] || STATUS_CONFIG.planejado;
  const mostrarLiturgia = evento.tipo === "CULTO" || evento.tipo === "RELOGIO";
  const mostrarMusica = evento.tipo === "CULTO";
  const mostrarConvites = evento.tipo === "EVENTO";

  return (
    <div className="space-y-6">
      {/* Header Fixo */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card rounded-lg p-4 md:p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/eventos/lista")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold">{evento.titulo}</h1>
              <Badge variant="outline">{TIPO_LABELS[evento.tipo]}</Badge>
              {evento.evento_subtipos && (
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: evento.evento_subtipos.cor || undefined,
                  }}
                >
                  {evento.evento_subtipos.nome}
                </Badge>
              )}
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(dataEvento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(dataEvento, "HH:mm")}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <QrCode className="h-4 w-4 mr-2" />
                QR Check-in
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-center">
                  QR Code de Presença
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeSVG
                    value={`${window.location.origin}/checkin/culto/${evento.id}`}
                    size={200}
                    level="H"
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Escaneie para confirmar presença no culto
                </p>
                <p className="text-xs text-muted-foreground break-all text-center">
                  {`${window.location.origin}/checkin/culto/${evento.id}`}
                </p>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={handleNotificarEscalados}
            disabled={notificando || escalasCount === 0}
          >
            {notificando ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Notificar Escalados
          </Button>

          <Button
            variant="outline"
            onClick={() =>
              window.open(`/telao/liturgia/${evento.id}`, "_blank")
            }
          >
            <Presentation className="h-4 w-4 mr-2" />
            Modo Apresentação
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent flex-wrap">
          <TabsTrigger 
            value="visao-geral" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            <Eye className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          
          {mostrarLiturgia && (
            <TabsTrigger 
              value="liturgia"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Liturgia & Roteiro</span>
            </TabsTrigger>
          )}
          
          {mostrarMusica && (
            <TabsTrigger 
              value="musica"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <ListMusic className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Música</span>
            </TabsTrigger>
          )}
          
          <TabsTrigger 
            value="escalas"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            <Users className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Escalas</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="checkin"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
          >
            <QrCode className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Check-in</span>
          </TabsTrigger>
          
          {mostrarConvites && (
            <TabsTrigger 
              value="convites"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              <Send className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Convites</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-6 mt-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Timer className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Duração Estimada
                  </p>
                  <p className="text-2xl font-bold">
                    {evento.duracao_minutos
                      ? `${evento.duracao_minutos} min`
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Voluntários Escalados
                  </p>
                  <p className="text-2xl font-bold">{escalasCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Itens na Liturgia
                  </p>
                  <p className="text-2xl font-bold">{liturgiaCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Formulário de Edição */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tema">Tema</Label>
                  <Input
                    id="tema"
                    value={tema}
                    onChange={(e) => setTema(e.target.value)}
                    placeholder="Tema do culto"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pregador">Pregador</Label>
                  <Input
                    id="pregador"
                    value={pregador}
                    onChange={(e) => setPregador(e.target.value)}
                    placeholder="Nome do pregador"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="local">Local</Label>
                  <Input
                    id="local"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    placeholder="Local do evento"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais"
                  rows={4}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Liturgia (apenas CULTO) */}
        {mostrarLiturgia && (
          <TabsContent value="liturgia" className="mt-6">
            <LiturgiaTab eventoId={id!} />
          </TabsContent>
        )}

        {/* Tab: Música (apenas CULTO) */}
        {mostrarMusica && (
          <TabsContent value="musica" className="mt-6">
            <MusicaTabContent eventoId={id!} />
          </TabsContent>
        )}

        {/* Tab: Escalas (sempre) */}
        <TabsContent value="escalas" className="mt-6">
          {evento?.tipo === "RELOGIO" ? (
            <EscalaTimeline evento={evento} />
          ) : (
            <EscalasTabContent eventoId={id!} />
          )}
        </TabsContent>

        {/* Tab: Check-in (sempre) */}
        <TabsContent value="checkin" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Check-in do Evento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Funcionalidade de check-in em desenvolvimento.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Convites */}
        {mostrarConvites && (
          <TabsContent value="convites" className="mt-6">
            <ConvitesTabContent eventoId={evento.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
