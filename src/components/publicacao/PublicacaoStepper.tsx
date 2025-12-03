import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  X, Image as ImageIcon, Video, Megaphone, 
  Smartphone, Monitor, Globe, Check, ChevronRight, ChevronLeft,
  Users, Bell, FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaPickerDialog } from "./MediaPickerDialog";

interface Culto {
  id: string;
  titulo: string;
  data_culto: string;
}

interface MidiaSelecionada {
  id: string;
  titulo: string;
  url: string;
  tipo: string;
}

interface PublicacaoStepperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicacao?: any | null;
  onSuccess: () => void;
}

const TAGS_MOMENTO = [
  { value: "abertura", label: "Abertura", cor: "#3B82F6" },
  { value: "adoracao", label: "Adoração", cor: "#8B5CF6" },
  { value: "oferta", label: "Oferta", cor: "#F59E0B" },
  { value: "palavra", label: "Palavra", cor: "#10B981" },
  { value: "ceia", label: "Ceia", cor: "#EC4899" },
  { value: "avisos", label: "Avisos", cor: "#6366F1" },
  { value: "encerramento", label: "Encerramento", cor: "#EF4444" },
];

const PUBLICOS = [
  { value: "todos", label: "Todos" },
  { value: "lideranca", label: "Liderança" },
  { value: "jovens", label: "Jovens" },
  { value: "kids", label: "Kids" },
  { value: "mulheres", label: "Mulheres" },
  { value: "homens", label: "Homens" },
];

export function PublicacaoStepper({ open, onOpenChange, publicacao, onSuccess }: PublicacaoStepperProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [cultos, setCultos] = useState<Culto[]>([]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<"main" | "telao">("main");
  
  // Mídia selecionada do acervo
  const [midiaSelecionada, setMidiaSelecionada] = useState<MidiaSelecionada | null>(null);
  const [midiaTelaoSelecionada, setMidiaTelaoSelecionada] = useState<MidiaSelecionada | null>(null);

  // Step 1: Conteúdo
  const [formData, setFormData] = useState({
    tipo: "banner" as "banner" | "video" | "alerta",
    titulo: "",
    descricao: "",
    nivel_urgencia: "info",
    data_inicio: undefined as Date | undefined,
    data_fim: undefined as Date | undefined,
    ativo: true,
  });

  // Step 2: Distribuição
  const [distribuicao, setDistribuicao] = useState({
    exibir_app: true,
    exibir_telao: false,
    exibir_site: false,
    enviar_push: false,
    tags: [] as string[],
    culto_id: "",
    ordem_telao: 0,
  });

  // Step 3: Segmentação
  const [segmentacao, setSegmentacao] = useState({
    publico_alvo: "todos",
  });

  useEffect(() => {
    if (open) {
      loadCultos();
      if (publicacao) {
        // Preencher dados para edição
        setFormData({
          tipo: publicacao.tipo === "alerta" ? "alerta" : publicacao.tipo === "video" ? "video" : "banner",
          titulo: publicacao.titulo || "",
          descricao: publicacao.descricao || "",
          nivel_urgencia: publicacao.nivel_urgencia || "info",
          data_inicio: publicacao.data_inicio ? new Date(publicacao.data_inicio) : undefined,
          data_fim: publicacao.data_fim ? new Date(publicacao.data_fim) : undefined,
          ativo: publicacao.ativo ?? true,
        });
        setDistribuicao({
          exibir_app: publicacao.exibir_app ?? true,
          exibir_telao: publicacao.exibir_telao ?? false,
          exibir_site: publicacao.exibir_site ?? false,
          enviar_push: false,
          tags: publicacao.tags || [],
          culto_id: publicacao.culto_id || "",
          ordem_telao: publicacao.ordem_telao || 0,
        });
        // Carregar mídia vinculada
        if (publicacao.midia_id) {
          loadMidia(publicacao.midia_id, "main");
        }
      } else {
        resetForm();
      }
    }
  }, [publicacao, open]);

  const loadMidia = async (midiaId: string, target: "main" | "telao") => {
    try {
      const { data } = await supabase
        .from("midias")
        .select("id, titulo, url, tipo")
        .eq("id", midiaId)
        .single();
      if (data) {
        if (target === "main") {
          setMidiaSelecionada(data);
        } else {
          setMidiaTelaoSelecionada(data);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar mídia:", error);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      tipo: "banner",
      titulo: "",
      descricao: "",
      nivel_urgencia: "info",
      data_inicio: undefined,
      data_fim: undefined,
      ativo: true,
    });
    setDistribuicao({
      exibir_app: true,
      exibir_telao: false,
      exibir_site: false,
      enviar_push: false,
      tags: [],
      culto_id: "",
      ordem_telao: 0,
    });
    setSegmentacao({ publico_alvo: "todos" });
    setMidiaSelecionada(null);
    setMidiaTelaoSelecionada(null);
  };

  const loadCultos = async () => {
    try {
      const { data } = await supabase
        .from("cultos")
        .select("id, titulo, data_culto")
        .gte("data_culto", new Date().toISOString())
        .order("data_culto", { ascending: true })
        .limit(20);
      setCultos(data || []);
    } catch (error) {
      console.error("Erro ao carregar cultos:", error);
    }
  };

  const openMediaPicker = (target: "main" | "telao") => {
    setMediaPickerTarget(target);
    setMediaPickerOpen(true);
  };

  const handleMediaSelect = (midia: any) => {
    if (mediaPickerTarget === "main") {
      setMidiaSelecionada(midia);
    } else {
      setMidiaTelaoSelecionada(midia);
    }
  };

  const toggleTag = (tag: string) => {
    setDistribuicao(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag) 
        : [...prev.tags, tag]
    }));
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.titulo.trim()) {
        toast({ title: "Título obrigatório", variant: "destructive" });
        return false;
      }
      if (formData.tipo === "banner" && !midiaSelecionada) {
        toast({ title: "Selecione uma imagem do acervo", variant: "destructive" });
        return false;
      }
      if (formData.tipo === "video" && !midiaSelecionada) {
        toast({ title: "Selecione um vídeo do acervo", variant: "destructive" });
        return false;
      }
      if (formData.tipo === "alerta" && !formData.descricao.trim()) {
        toast({ title: "Mensagem obrigatória para alerta", variant: "destructive" });
        return false;
      }
    }
    if (step === 2) {
      if (!distribuicao.exibir_app && !distribuicao.exibir_telao && !distribuicao.exibir_site) {
        toast({ title: "Selecione ao menos um canal", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2)) return;

    setIsLoading(true);
    try {
      const tipoDb: "alerta" | "banner" = formData.tipo === "alerta" ? "alerta" : "banner";
      
      const payload = {
        titulo: formData.titulo,
        descricao: formData.descricao || null,
        tipo: tipoDb,
        nivel_urgencia: formData.tipo === "alerta" ? formData.nivel_urgencia : null,
        midia_id: formData.tipo !== "alerta" ? midiaSelecionada?.id : null,
        imagem_url: formData.tipo !== "alerta" ? midiaSelecionada?.url : null,
        ativo: formData.ativo,
        data_inicio: formData.data_inicio?.toISOString() || new Date().toISOString(),
        data_fim: formData.data_fim?.toISOString() || null,
        exibir_app: distribuicao.exibir_app,
        exibir_telao: distribuicao.exibir_telao,
        exibir_site: distribuicao.exibir_site,
        url_arquivo_telao: distribuicao.exibir_telao && midiaTelaoSelecionada ? midiaTelaoSelecionada.url : null,
        ordem_telao: distribuicao.exibir_telao ? distribuicao.ordem_telao : 0,
        tags: distribuicao.exibir_telao ? distribuicao.tags : [],
        culto_id: distribuicao.exibir_telao && distribuicao.culto_id ? distribuicao.culto_id : null,
        categoria_midia: segmentacao.publico_alvo,
      };

      if (publicacao) {
        const { error } = await supabase.from("comunicados").update(payload).eq("id", publicacao.id);
        if (error) throw error;
        toast({ title: "Publicação atualizada!" });
      } else {
        const { error } = await supabase.from("comunicados").insert([payload]);
        if (error) throw error;
        toast({ title: "Publicação criada!" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Conteúdo", subtitle: "O que?" },
    { number: 2, title: "Distribuição", subtitle: "Onde?" },
    { number: 3, title: "Segmentação", subtitle: "Quem?" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{publicacao ? "Editar Publicação" : "Nova Publicação"}</DialogTitle>
        </DialogHeader>

        {/* Stepper Header */}
        <div className="flex items-center justify-between mb-6 px-2">
          {steps.map((step, idx) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  currentStep >= step.number 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
                </div>
                <div className="text-center mt-2">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.subtitle}</p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className={cn(
                  "w-16 md:w-24 h-0.5 mx-2 md:mx-4 transition-colors",
                  currentStep > step.number ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Conteúdo */}
        {currentStep === 1 && (
          <div className="space-y-5">
            {/* Tipo de Mídia */}
            <div className="space-y-2">
              <Label>Tipo de Mídia</Label>
              <RadioGroup
                value={formData.tipo}
                onValueChange={(v: "banner" | "video" | "alerta") => setFormData({ ...formData, tipo: v })}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: "banner", icon: ImageIcon, label: "Banner/Imagem", color: "text-purple-500" },
                  { value: "video", icon: Video, label: "Vídeo", color: "text-blue-500" },
                  { value: "alerta", icon: Megaphone, label: "Alerta de Texto", color: "text-orange-500" },
                ].map(item => (
                  <Label
                    key={item.value}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-all",
                      formData.tipo === item.value 
                        ? "border-primary bg-primary/5 ring-2 ring-primary" 
                        : "border-input hover:border-primary/50"
                    )}
                  >
                    <RadioGroupItem value={item.value} className="sr-only" />
                    <item.icon className={cn("h-6 w-6", item.color)} />
                    <span className="text-sm font-medium text-center">{item.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {/* Dados Básicos */}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Culto Especial de Domingo"
              />
            </div>

            {/* Seletor de Mídia - Banner/Video */}
            {formData.tipo !== "alerta" && (
              <div className="space-y-2">
                <Label>Mídia do Acervo *</Label>
                {midiaSelecionada ? (
                  <div className="relative">
                    {formData.tipo === "video" || midiaSelecionada.tipo === "video" ? (
                      <div className="w-full h-40 bg-muted rounded-lg flex items-center justify-center">
                        <Video className="h-10 w-10 text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">{midiaSelecionada.titulo}</span>
                      </div>
                    ) : (
                      <img src={midiaSelecionada.url} alt={midiaSelecionada.titulo} className="w-full h-40 object-cover rounded-lg" />
                    )}
                    <div className="absolute bottom-2 left-2 right-10">
                      <Badge variant="secondary" className="text-xs truncate max-w-full">
                        {midiaSelecionada.titulo}
                      </Badge>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => setMidiaSelecionada(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openMediaPicker("main")}
                    className="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
                  >
                    <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-primary font-medium">Selecionar Mídia do Acervo</p>
                    <p className="text-xs text-muted-foreground">
                      {formData.tipo === "video" ? "Selecione um vídeo" : "Selecione uma imagem"}
                    </p>
                  </button>
                )}
              </div>
            )}

            {/* Alerta - Mensagem */}
            {formData.tipo === "alerta" && (
              <>
                <div className="space-y-2">
                  <Label>Mensagem do Alerta *</Label>
                  <Textarea
                    value={formData.descricao}
                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Digite a mensagem..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nível de Urgência</Label>
                  <Select
                    value={formData.nivel_urgencia}
                    onValueChange={v => setFormData({ ...formData, nivel_urgencia: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" /> Info (Azul)
                        </span>
                      </SelectItem>
                      <SelectItem value="warning">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-yellow-500" /> Atenção (Amarelo)
                        </span>
                      </SelectItem>
                      <SelectItem value="destructive">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" /> Crítico (Vermelho)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Descrição para Banner */}
            {formData.tipo !== "alerta" && (
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={formData.descricao}
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Texto curto sobre o conteúdo"
                />
              </div>
            )}

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <DateTimePicker
                  value={formData.data_inicio}
                  onChange={d => setFormData({ ...formData, data_inicio: d })}
                  placeholder="Agora"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Fim</Label>
                <DateTimePicker
                  value={formData.data_fim}
                  onChange={d => setFormData({ ...formData, data_fim: d })}
                  placeholder="Sem expiração"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Distribuição */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">Selecione onde este conteúdo será exibido:</p>
            
            <div className="grid gap-4">
              {/* App/Dashboard */}
              <Card 
                className={cn(
                  "cursor-pointer transition-all",
                  distribuicao.exibir_app ? "ring-2 ring-primary border-primary" : ""
                )}
                onClick={() => setDistribuicao({ ...distribuicao, exibir_app: !distribuicao.exibir_app })}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center",
                    distribuicao.exibir_app ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">App/Dashboard</h4>
                      <Checkbox checked={distribuicao.exibir_app} />
                    </div>
                    <p className="text-sm text-muted-foreground">Aparece na Home do aplicativo</p>
                    {distribuicao.exibir_app && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-sm cursor-pointer">Enviar Push Notification?</Label>
                        <Checkbox 
                          checked={distribuicao.enviar_push} 
                          onCheckedChange={c => setDistribuicao({ ...distribuicao, enviar_push: !!c })}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Telão */}
              <Card 
                className={cn(
                  "cursor-pointer transition-all",
                  distribuicao.exibir_telao ? "ring-2 ring-primary border-primary" : ""
                )}
                onClick={() => setDistribuicao({ ...distribuicao, exibir_telao: !distribuicao.exibir_telao })}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center",
                    distribuicao.exibir_telao ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Telão (Projeção)</h4>
                      <Checkbox checked={distribuicao.exibir_telao} />
                    </div>
                    <p className="text-sm text-muted-foreground">Playlist do ProPresenter/Telão</p>
                    
                    {distribuicao.exibir_telao && (
                      <div className="mt-4 pt-4 border-t space-y-4" onClick={e => e.stopPropagation()}>
                        {/* Tags de Momento */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">TAGS DE MOMENTO</Label>
                          <div className="flex flex-wrap gap-2">
                            {TAGS_MOMENTO.map(tag => (
                              <Badge
                                key={tag.value}
                                variant={distribuicao.tags.includes(tag.value) ? "default" : "outline"}
                                className="cursor-pointer transition-all"
                                style={distribuicao.tags.includes(tag.value) ? { backgroundColor: tag.cor } : { borderColor: tag.cor, color: tag.cor }}
                                onClick={() => toggleTag(tag.value)}
                              >
                                {tag.label}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Vincular Culto */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">VINCULAR A CULTO (OPCIONAL)</Label>
                        <Select
                            value={distribuicao.culto_id || "none"}
                            onValueChange={v => setDistribuicao({ ...distribuicao, culto_id: v === "none" ? "" : v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um culto..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum (Geral)</SelectItem>
                              {cultos.map(culto => (
                                <SelectItem key={culto.id} value={culto.id}>
                                  {culto.titulo} - {new Date(culto.data_culto).toLocaleDateString("pt-BR")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Arte alternativa Telão */}
                        {formData.tipo !== "alerta" && (
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">ARTE ALTERNATIVA PARA TELÃO (16:9)</Label>
                            {midiaTelaoSelecionada ? (
                              <div className="relative">
                                <img src={midiaTelaoSelecionada.url} alt={midiaTelaoSelecionada.titulo} className="w-full h-24 object-cover rounded-lg" />
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 h-6 w-6"
                                  onClick={(e) => { e.stopPropagation(); setMidiaTelaoSelecionada(null); }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openMediaPicker("telao"); }}
                                className="w-full border border-dashed rounded-lg p-3 text-center hover:border-primary/50 transition-colors"
                              >
                                <span className="text-xs text-muted-foreground">Selecionar do acervo (16:9)</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Ordem */}
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">ORDEM NA PLAYLIST</Label>
                          <Input
                            type="number"
                            value={distribuicao.ordem_telao}
                            onChange={e => setDistribuicao({ ...distribuicao, ordem_telao: parseInt(e.target.value) || 0 })}
                            className="w-24"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Site */}
              <Card 
                className={cn(
                  "cursor-pointer transition-all",
                  distribuicao.exibir_site ? "ring-2 ring-primary border-primary" : ""
                )}
                onClick={() => setDistribuicao({ ...distribuicao, exibir_site: !distribuicao.exibir_site })}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center",
                    distribuicao.exibir_site ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Site</h4>
                      <Checkbox checked={distribuicao.exibir_site} />
                    </div>
                    <p className="text-sm text-muted-foreground">Carrossel de notícias do site</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 3: Segmentação */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Público Alvo
              </Label>
              <Select
                value={segmentacao.publico_alvo}
                onValueChange={v => setSegmentacao({ ...segmentacao, publico_alvo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUBLICOS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Resumo */}
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-semibold text-sm">Resumo da Publicação</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="capitalize">{formData.tipo}</span>
                  <span className="text-muted-foreground">Título:</span>
                  <span className="truncate">{formData.titulo}</span>
                  <span className="text-muted-foreground">Canais:</span>
                  <div className="flex flex-wrap gap-1">
                    {distribuicao.exibir_app && <Badge variant="secondary" className="text-xs">App</Badge>}
                    {distribuicao.exibir_telao && <Badge variant="secondary" className="text-xs">Telão</Badge>}
                    {distribuicao.exibir_site && <Badge variant="secondary" className="text-xs">Site</Badge>}
                  </div>
                  <span className="text-muted-foreground">Público:</span>
                  <span>{PUBLICOS.find(p => p.value === segmentacao.publico_alvo)?.label}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={c => setFormData({ ...formData, ativo: !!c })}
              />
              <Label htmlFor="ativo" className="cursor-pointer">Publicar imediatamente (ativo)</Label>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          {currentStep < 3 ? (
            <Button onClick={handleNext}>
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Salvando..." : publicacao ? "Atualizar" : "Criar Publicação"}
            </Button>
          )}
        </div>
      </DialogContent>

      {/* Media Picker Dialog */}
      <MediaPickerDialog
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        onSelect={handleMediaSelect}
        selectedId={mediaPickerTarget === "main" ? midiaSelecionada?.id : midiaTelaoSelecionada?.id}
        tipoFiltro={formData.tipo === "video" ? "video" : "imagem"}
      />
    </Dialog>
  );
}
