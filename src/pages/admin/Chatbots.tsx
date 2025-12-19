import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bot, ArrowLeft, Save, Plus, Pencil, Trash2, Eye, EyeOff, MessageSquare, Mic, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ChatbotConfig {
  id: string;
  nome: string;
  descricao: string | null;
  edge_function_name: string;
  ativo: boolean;
  modelo_texto: string;
  modelo_audio: string;
  modelo_visao: string;
  role_texto: string | null;
  role_audio: string | null;
  role_visao: string | null;
  created_at: string;
  updated_at: string;
}

// Lista fixa de modelos disponíveis
const MODELOS_TEXTO = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (Rápido)" },
  { value: "gpt-4o", label: "GPT-4o (Avançado)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Econômico)" },
];

const MODELOS_AUDIO = [
  { value: "whisper-1", label: "Whisper (OpenAI)" },
];

const MODELOS_VISAO = [
  { value: "gpt-4o", label: "GPT-4o (Vision)" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo (Vision)" },
];

export default function Chatbots() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chatbots, setChatbots] = useState<ChatbotConfig[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotConfig | null>(null);
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    edge_function_name: "",
    ativo: true,
    modelo_texto: "gpt-4o-mini",
    modelo_audio: "whisper-1",
    modelo_visao: "gpt-4o",
    role_texto: "",
    role_audio: "Transcreva o áudio fielmente, mantendo o contexto e a intenção do falante.",
    role_visao: "Analise a imagem e extraia informações relevantes como texto, dados ou elementos visuais.",
  });

  useEffect(() => {
    fetchChatbots();
  }, []);

  const fetchChatbots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chatbot_configs")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setChatbots(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar chatbots", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setSelectedChatbot(null);
    setFormData({
      nome: "",
      descricao: "",
      edge_function_name: "",
      ativo: true,
      modelo_texto: "gpt-4o-mini",
      modelo_audio: "whisper-1",
      modelo_visao: "gpt-4o",
      role_texto: "",
      role_audio: "Transcreva o áudio fielmente, mantendo o contexto e a intenção do falante.",
      role_visao: "Analise a imagem e extraia informações relevantes como texto, dados ou elementos visuais.",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (chatbot: ChatbotConfig) => {
    setSelectedChatbot(chatbot);
    setFormData({
      nome: chatbot.nome,
      descricao: chatbot.descricao || "",
      edge_function_name: chatbot.edge_function_name,
      ativo: chatbot.ativo,
      modelo_texto: chatbot.modelo_texto,
      modelo_audio: chatbot.modelo_audio,
      modelo_visao: chatbot.modelo_visao,
      role_texto: chatbot.role_texto || "",
      role_audio: chatbot.role_audio || "",
      role_visao: chatbot.role_visao || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim() || !formData.edge_function_name.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        edge_function_name: formData.edge_function_name.trim(),
        ativo: formData.ativo,
        modelo_texto: formData.modelo_texto,
        modelo_audio: formData.modelo_audio,
        modelo_visao: formData.modelo_visao,
        role_texto: formData.role_texto.trim() || null,
        role_audio: formData.role_audio.trim() || null,
        role_visao: formData.role_visao.trim() || null,
      };

      if (selectedChatbot) {
        const { error } = await supabase
          .from("chatbot_configs")
          .update(payload)
          .eq("id", selectedChatbot.id);
        if (error) throw error;
        toast.success("Chatbot atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("chatbot_configs")
          .insert(payload);
        if (error) throw error;
        toast.success("Chatbot criado com sucesso!");
      }

      setDialogOpen(false);
      fetchChatbots();
    } catch (error: any) {
      toast.error("Erro ao salvar chatbot", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedChatbot) return;

    try {
      const { error } = await supabase
        .from("chatbot_configs")
        .delete()
        .eq("id", selectedChatbot.id);

      if (error) throw error;
      toast.success("Chatbot removido com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedChatbot(null);
      fetchChatbots();
    } catch (error: any) {
      toast.error("Erro ao remover chatbot", { description: error.message });
    }
  };

  const handleToggleActive = async (chatbot: ChatbotConfig) => {
    try {
      const { error } = await supabase
        .from("chatbot_configs")
        .update({ ativo: !chatbot.ativo })
        .eq("id", chatbot.id);

      if (error) throw error;
      toast.success(chatbot.ativo ? "Chatbot desativado" : "Chatbot ativado");
      fetchChatbots();
    } catch (error: any) {
      toast.error("Erro ao alterar status", { description: error.message });
    }
  };

  const toggleRoleExpanded = (id: string) => {
    setExpandedRoles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const truncateText = (text: string | null, maxLength: number = 100) => {
    if (!text) return "Não configurado";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Chatbots & IAs</h1>
            <p className="text-muted-foreground mt-1">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Chatbots & IAs</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as configurações dos chatbots e modelos de IA
            </p>
          </div>
        </div>
        <Button onClick={handleOpenNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Chatbot
        </Button>
      </div>

      {/* Aviso Informativo */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Bot className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900">
                Configuração de Chatbots
              </p>
              <p className="text-xs text-blue-700">
                Cada chatbot está vinculado a uma Edge Function. Configure os modelos de IA e os prompts (roles) 
                para texto, áudio e visão de forma independente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Chatbots */}
      {chatbots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum chatbot configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro chatbot para começar a usar IA no sistema.
            </p>
            <Button onClick={handleOpenNew}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Chatbot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {chatbots.map((chatbot) => (
            <Card key={chatbot.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {chatbot.nome}
                        <Badge variant={chatbot.ativo ? "default" : "secondary"}>
                          {chatbot.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{chatbot.descricao || "Sem descrição"}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={chatbot.ativo}
                      onCheckedChange={() => handleToggleActive(chatbot)}
                    />
                    <Button variant="outline" size="icon" onClick={() => handleOpenEdit(chatbot)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="text-destructive"
                      onClick={() => {
                        setSelectedChatbot(chatbot);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Edge Function */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Edge Function:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs">{chatbot.edge_function_name}</code>
                </div>

                {/* Modelos */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Texto: </span>
                      <span className="font-medium">{chatbot.modelo_texto}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-green-500" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Áudio: </span>
                      <span className="font-medium">{chatbot.modelo_audio}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Image className="h-4 w-4 text-purple-500" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Visão: </span>
                      <span className="font-medium">{chatbot.modelo_visao}</span>
                    </div>
                  </div>
                </div>

                {/* Roles Preview */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => toggleRoleExpanded(chatbot.id)}
                  >
                    {expandedRoles[chatbot.id] ? (
                      <><EyeOff className="h-3 w-3 mr-1" /> Ocultar prompts</>
                    ) : (
                      <><Eye className="h-3 w-3 mr-1" /> Ver prompts</>
                    )}
                  </Button>
                  
                  {expandedRoles[chatbot.id] && (
                    <div className="grid gap-2 mt-2">
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Role Texto
                        </p>
                        <p className="text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {chatbot.role_texto || "Não configurado"}
                        </p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Mic className="h-3 w-3" /> Role Áudio
                        </p>
                        <p className="text-xs">{chatbot.role_audio || "Não configurado"}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-md">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Image className="h-3 w-3" /> Role Visão
                        </p>
                        <p className="text-xs">{chatbot.role_visao || "Não configurado"}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedChatbot ? "Editar Chatbot" : "Novo Chatbot"}</DialogTitle>
            <DialogDescription>
              Configure os modelos e prompts do chatbot
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="texto">Texto</TabsTrigger>
              <TabsTrigger value="audio">Áudio</TabsTrigger>
              <TabsTrigger value="visao">Visão</TabsTrigger>
            </TabsList>

            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Chatbot Intercessão"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Breve descrição do chatbot"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edge_function_name">Nome da Edge Function *</Label>
                <Input
                  id="edge_function_name"
                  value={formData.edge_function_name}
                  onChange={(e) => setFormData({ ...formData, edge_function_name: e.target.value })}
                  placeholder="Ex: chatbot-triagem"
                  disabled={!!selectedChatbot}
                />
                <p className="text-xs text-muted-foreground">
                  Nome da função em supabase/functions/
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Chatbot ativo</Label>
              </div>
            </TabsContent>

            <TabsContent value="texto" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="modelo_texto">Modelo de Texto</Label>
                <Select
                  value={formData.modelo_texto}
                  onValueChange={(value) => setFormData({ ...formData, modelo_texto: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELOS_TEXTO.map((modelo) => (
                      <SelectItem key={modelo.value} value={modelo.value}>
                        {modelo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_texto">System Prompt (Role)</Label>
                <Textarea
                  id="role_texto"
                  value={formData.role_texto}
                  onChange={(e) => setFormData({ ...formData, role_texto: e.target.value })}
                  placeholder="Instruções para o modelo de texto..."
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Define o comportamento e personalidade do chatbot
                </p>
              </div>
            </TabsContent>

            <TabsContent value="audio" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="modelo_audio">Modelo de Áudio</Label>
                <Select
                  value={formData.modelo_audio}
                  onValueChange={(value) => setFormData({ ...formData, modelo_audio: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELOS_AUDIO.map((modelo) => (
                      <SelectItem key={modelo.value} value={modelo.value}>
                        {modelo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_audio">Instruções de Transcrição</Label>
                <Textarea
                  id="role_audio"
                  value={formData.role_audio}
                  onChange={(e) => setFormData({ ...formData, role_audio: e.target.value })}
                  placeholder="Instruções para transcrição de áudio..."
                  className="min-h-[100px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Orienta como o áudio deve ser transcrito
                </p>
              </div>
            </TabsContent>

            <TabsContent value="visao" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="modelo_visao">Modelo de Visão</Label>
                <Select
                  value={formData.modelo_visao}
                  onValueChange={(value) => setFormData({ ...formData, modelo_visao: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELOS_VISAO.map((modelo) => (
                      <SelectItem key={modelo.value} value={modelo.value}>
                        {modelo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_visao">Instruções de Análise Visual</Label>
                <Textarea
                  id="role_visao"
                  value={formData.role_visao}
                  onChange={(e) => setFormData({ ...formData, role_visao: e.target.value })}
                  placeholder="Instruções para análise de imagens..."
                  className="min-h-[100px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Define como as imagens devem ser analisadas
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o chatbot "{selectedChatbot?.nome}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
