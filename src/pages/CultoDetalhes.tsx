import { useParams, useNavigate } from "react-router-dom";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Save
} from "lucide-react";
import LiturgiaTabContent from "@/components/cultos/LiturgiaTabContent";

interface Culto {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_culto: string;
  duracao_minutos: number | null;
  local: string | null;
  endereco: string | null;
  pregador: string | null;
  tema: string | null;
  status: string;
  observacoes: string | null;
  exibir_preletor: boolean;
}

const STATUS_OPTIONS = [
  { value: "planejado", label: "Planejado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planejado: { label: "Planejado", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" },
  confirmado: { label: "Confirmado", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  realizado: { label: "Realizado", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
};

export default function CultoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [culto, setCulto] = useState<Culto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [escalasCount, setEscalasCount] = useState(0);
  const [liturgiaCount, setLiturgiaCount] = useState(0);

  // Form state
  const [tema, setTema] = useState("");
  const [pregador, setPregador] = useState("");
  const [local, setLocal] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("planejado");

  useEffect(() => {
    if (id) {
      loadCulto();
      loadStats();
    }
  }, [id]);

  const loadCulto = async () => {
    try {
      const { data, error } = await supabase
        .from("cultos")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      setCulto(data);
      setTema(data.tema || "");
      setPregador(data.pregador || "");
      setLocal(data.local || "");
      setObservacoes(data.observacoes || "");
      setStatus(data.status);
    } catch (error: any) {
      toast.error("Erro ao carregar culto", { description: error.message });
      navigate("/cultos/geral");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [escalasRes, liturgiaRes] = await Promise.all([
        supabase.from("escalas_culto").select("id", { count: "exact" }).eq("culto_id", id!),
        supabase.from("liturgia_culto").select("id", { count: "exact" }).eq("culto_id", id!),
      ]);

      setEscalasCount(escalasRes.count || 0);
      setLiturgiaCount(liturgiaRes.count || 0);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const handleSave = async () => {
    if (!culto) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from("cultos")
        .update({
          tema,
          pregador,
          local,
          observacoes,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", culto.id);

      if (error) throw error;

      toast.success("Alterações salvas com sucesso!");
      loadCulto();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
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

  if (!culto) {
    return null;
  }

  const dataCulto = new Date(culto.data_culto);
  const statusConfig = STATUS_CONFIG[culto.status] || STATUS_CONFIG.planejado;

  return (
    <div className="space-y-6">
      {/* Header Fixo */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card rounded-lg p-4 md:p-6 shadow-sm border">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/cultos/geral")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold">{culto.titulo}</h1>
              <Badge variant="outline">{culto.tipo}</Badge>
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(dataCulto, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(dataCulto, "HH:mm")}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => window.open(`/telao/liturgia/${culto.id}`, "_blank")}
          >
            <Presentation className="h-4 w-4 mr-2" />
            Modo Apresentação
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="visao-geral" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="liturgia" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Liturgia</span>
          </TabsTrigger>
          <TabsTrigger value="musica" className="flex items-center gap-2">
            <ListMusic className="h-4 w-4" />
            <span className="hidden sm:inline">Música</span>
          </TabsTrigger>
          <TabsTrigger value="escalas" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Escalas</span>
          </TabsTrigger>
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
                  <p className="text-sm text-muted-foreground">Duração Estimada</p>
                  <p className="text-2xl font-bold">
                    {culto.duracao_minutos ? `${culto.duracao_minutos} min` : "—"}
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
                  <p className="text-sm text-muted-foreground">Voluntários Escalados</p>
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
                  <p className="text-sm text-muted-foreground">Itens na Liturgia</p>
                  <p className="text-2xl font-bold">{liturgiaCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Formulário de Edição */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Culto</CardTitle>
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

        {/* Tab: Liturgia */}
        <TabsContent value="liturgia" className="mt-6">
          <LiturgiaTabContent cultoId={culto.id} />
        </TabsContent>

        {/* Tab: Música (placeholder) */}
        <TabsContent value="musica" className="mt-6">
          <Card>
            <CardContent className="p-8 text-center">
              <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Gestão de Músicas</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie as músicas e canções do culto aqui. (Em desenvolvimento)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Escalas (placeholder) */}
        <TabsContent value="escalas" className="mt-6">
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Gestão de Escalas</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie as escalas de voluntários do culto aqui. (Em desenvolvimento)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
