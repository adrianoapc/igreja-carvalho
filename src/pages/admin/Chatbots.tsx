import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bot, Save, Plus, Pencil, Trash2, Eye, EyeOff, MessageSquare, Mic, Image, Loader2, ArrowLeft } from "lucide-react";
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

interface Props {
  onBack?: () => void;
}

export default function Chatbots({ onBack }: Props) {
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
    } catch (error: unknown) {
      toast.error("Erro ao carregar chatbots", { description: error instanceof Error ? error.message : String(error) });
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
    } catch (error: unknown) {
      toast.error("Erro ao salvar chatbot", { description: error instanceof Error ? error.message : String(error) });
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
    } catch (error: unknown) {
      toast.error("Erro ao remover chatbot", { description: error instanceof Error ? error.message : String(error) });
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
    } catch (error: unknown) {
      toast.error("Erro ao alterar status", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const toggleRoleExpanded = (id: string) => {
    setExpandedRoles(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Carregando agentes inteligentes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Agentes & Chatbots</h1>
            <p className="text-muted-foreground">Gerencie os cérebros de IA que operam no sistema.</p>
          </div>
        </div>
        <Button onClick={handleOpenNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Agente
        </Button>
      </div>

      {/* Lista de Chatbots */}
      {chatbots.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="py-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum chatbot configurado</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Crie seu primeiro agente para habilitar funcionalidades de IA como análise de sentimentos ou transcrição.
            </p>
            <Button onClick={handleOpenNew} variant="outline">
              Criar Primeiro Chatbot
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {chatbots.map((chatbot) => (
            <Card key={chatbot.id} className="overflow-hidden hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3 bg-muted/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {chatbot.nome}
                        <Badge variant={chatbot.ativo ? "default" : "secondary"} className="text-[10px] h-5 px-1.5">
                          {chatbot.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="line-clamp-1 text-xs mt-0.5">
                        {chatbot.descricao || "Sem descrição"} • {chatbot.edge_function_name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={chatbot.ativo}
                      onCheckedChange={() => handleToggleActive(chatbot)}
                      className="scale-75 mr-2"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(chatbot)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
              
              <CardContent className="pt-4 space-y-4">
                {/* Modelos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 p-2 rounded bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                    <span className="truncate text-xs font-medium">{chatbot.modelo_texto}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/20">
                    <Mic className="h-3.5 w-3.5 text-green-500" />
                    <span className="truncate text-xs font-medium">{chatbot.modelo_audio}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/20">
                    <Image className="h-3.5 w-3.5 text-purple-500" />
                    <span className="truncate text-xs font-medium">{chatbot.modelo_visao}</span>
                  </div>
                </div>

                {/* Roles Preview */}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-0 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => toggleRoleExpanded(chatbot.id)}
                  >
                    {expandedRoles[chatbot.id] ? (
                      <><EyeOff className="h-3 w-3 mr-1.5" /> Ocultar prompts</>
                    ) : (
                      <><Eye className="h-3 w-3 mr-1.5" /> Ver system prompts</>
                    )}
                  </Button>
                  
                  {expandedRoles[chatbot.id] && (
                    <div className="grid gap-3 mt-3 animate-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Texto</span>
                        <div className="bg-muted p-2 rounded text-xs font-mono text-muted-foreground max-h-24 overflow-y-auto">
                          {chatbot.role_texto || "Padrão"}
                        </div>
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
            <DialogTitle>{selectedChatbot ? "Editar Agente" : "Novo Agente de IA"}</DialogTitle>
            <DialogDescription>
              Configure os modelos, funções e personalidade do chatbot.
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
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Identificador</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Pastor Virtual"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição (Interna)</Label>
                  <Input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Para que serve este agente?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edge_function_name">Edge Function Vinculada</Label>
                  <div className="relative">
                    <Bot className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edge_function_name"
                      value={formData.edge_function_name}
                      onChange={(e) => setFormData({ ...formData, edge_function_name: e.target.value })}
                      placeholder="chatbot-triagem"
                      className="pl-9 font-mono"
                      disabled={!!selectedChatbot}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Nome da pasta em <code>supabase/functions/</code> que executa este bot.
                  </p>
                </div>

                <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
                  <Label htmlFor="ativo" className="cursor-pointer">Status Ativo</Label>
                  <Switch
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="texto" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Modelo de Linguagem (LLM)</Label>
                <Select
                  value={formData.modelo_texto}
                  onValueChange={(value) => setFormData({ ...formData, modelo_texto: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>System Prompt (Personalidade)</Label>
                <Textarea
                  value={formData.role_texto}
                  onChange={(e) => setFormData({ ...formData, role_texto: e.target.value })}
                  placeholder="Você é um assistente útil..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="audio" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Modelo de Transcrição (STT)</Label>
                <Select
                  value={formData.modelo_audio}
                  onValueChange={(value) => setFormData({ ...formData, modelo_audio: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Prompt de Contexto para Áudio</Label>
                <Textarea
                  value={formData.role_audio}
                  onChange={(e) => setFormData({ ...formData, role_audio: e.target.value })}
                  placeholder="Instruções para melhorar a transcrição..."
                  className="min-h-[100px] font-mono text-sm"
                />
              </div>
            </TabsContent>

            <TabsContent value="visao" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Modelo de Visão Computacional</Label>
                <Select
                  value={formData.modelo_visao}
                  onValueChange={(value) => setFormData({ ...formData, modelo_visao: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Prompt de Análise Visual</Label>
                <Textarea
                  value={formData.role_visao}
                  onChange={(e) => setFormData({ ...formData, role_visao: e.target.value })}
                  placeholder="O que procurar nas imagens..."
                  className="min-h-[100px] font-mono text-sm"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente a configuração do bot <strong>{selectedChatbot?.nome}</strong>. 
              Edge Functions vinculadas não serão deletadas do servidor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}