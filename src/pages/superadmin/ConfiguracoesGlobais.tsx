import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Webhook, Phone, Plus, Save, Trash2, Loader2, Globe, Edit, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface WebhookGlobal {
  id: string;
  tipo: string;
  url: string | null;
  enabled: boolean;
  created_at: string;
}

interface WhatsAppNumeroGlobal {
  id: string;
  phone_number_id: string | null;
  display_phone_number: string | null;
  provider: string;
  enabled: boolean;
  created_at: string;
}

const WEBHOOK_TIPOS = [
  { value: "whatsapp_make", label: "WhatsApp - Make.com" },
  { value: "whatsapp_meta", label: "WhatsApp - Meta API" },
  { value: "whatsapp_evolution", label: "WhatsApp - Evolution API" },
  { value: "make_geral", label: "Make.com - Geral" },
  { value: "make_escalas", label: "Make.com - Escalas" },
  { value: "make_liturgia", label: "Make.com - Liturgia" },
];

export default function ConfiguracoesGlobais() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("webhooks");
  
  // Webhook dialog state
  const [isWebhookDialogOpen, setIsWebhookDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookGlobal | null>(null);
  const [webhookForm, setWebhookForm] = useState({ tipo: "", url: "", enabled: true });

  // WhatsApp dialog state
  const [isWhatsAppDialogOpen, setIsWhatsAppDialogOpen] = useState(false);
  const [editingWhatsApp, setEditingWhatsApp] = useState<WhatsAppNumeroGlobal | null>(null);
  const [whatsappForm, setWhatsappForm] = useState({
    phone_number_id: "",
    display_phone_number: "",
    provider: "meta",
    enabled: true,
  });

  // Fetch global webhooks
  const { data: webhooks = [], isLoading: loadingWebhooks } = useQuery({
    queryKey: ["webhooks-globais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("id, tipo, url, enabled, created_at")
        .is("igreja_id", null)
        .is("filial_id", null)
        .order("tipo");

      if (error) throw error;
      return data as WebhookGlobal[];
    },
  });

  // Fetch global WhatsApp numbers
  const { data: whatsappNumeros = [], isLoading: loadingWhatsApp } = useQuery({
    queryKey: ["whatsapp-numeros-globais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_numeros")
        .select("id, phone_number_id, display_phone_number, provider, enabled, created_at")
        .is("igreja_id", null)
        .is("filial_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WhatsAppNumeroGlobal[];
    },
  });

  // Save webhook mutation
  const saveWebhookMutation = useMutation({
    mutationFn: async (data: typeof webhookForm & { id?: string }) => {
      const payload = {
        igreja_id: null,
        filial_id: null,
        tipo: data.tipo,
        url: data.url || null,
        enabled: data.enabled,
      };

      if (data.id) {
        const { error } = await supabase
          .from("webhooks")
          .update({ url: payload.url, enabled: payload.enabled })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("webhooks")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks-globais"] });
      toast.success(editingWebhook ? "Webhook atualizado!" : "Webhook cadastrado!");
      handleCloseWebhookDialog();
    },
    onError: (error) => {
      console.error("Erro ao salvar webhook:", error);
      toast.error("Erro ao salvar webhook");
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks-globais"] });
      toast.success("Webhook removido!");
    },
    onError: () => toast.error("Erro ao remover webhook"),
  });

  // Save WhatsApp mutation
  const saveWhatsAppMutation = useMutation({
    mutationFn: async (data: typeof whatsappForm & { id?: string }) => {
      const payload = {
        igreja_id: null,
        filial_id: null,
        phone_number_id: data.phone_number_id || null,
        display_phone_number: data.display_phone_number || null,
        provider: data.provider,
        enabled: data.enabled,
      };

      if (data.id) {
        const { error } = await supabase
          .from("whatsapp_numeros")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_numeros")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros-globais"] });
      toast.success(editingWhatsApp ? "Número atualizado!" : "Número cadastrado!");
      handleCloseWhatsAppDialog();
    },
    onError: (error) => {
      console.error("Erro ao salvar número:", error);
      toast.error("Erro ao salvar número");
    },
  });

  // Delete WhatsApp mutation
  const deleteWhatsAppMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_numeros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros-globais"] });
      toast.success("Número removido!");
    },
    onError: () => toast.error("Erro ao remover número"),
  });

  // Toggle mutations
  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("webhooks").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks-globais"] }),
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const toggleWhatsAppMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("whatsapp_numeros").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-numeros-globais"] }),
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // Dialog handlers
  const handleOpenWebhookDialog = (webhook?: WebhookGlobal) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setWebhookForm({ tipo: webhook.tipo, url: webhook.url || "", enabled: webhook.enabled });
    } else {
      setEditingWebhook(null);
      setWebhookForm({ tipo: "", url: "", enabled: true });
    }
    setIsWebhookDialogOpen(true);
  };

  const handleCloseWebhookDialog = () => {
    setIsWebhookDialogOpen(false);
    setEditingWebhook(null);
    setWebhookForm({ tipo: "", url: "", enabled: true });
  };

  const handleOpenWhatsAppDialog = (numero?: WhatsAppNumeroGlobal) => {
    if (numero) {
      setEditingWhatsApp(numero);
      setWhatsappForm({
        phone_number_id: numero.phone_number_id || "",
        display_phone_number: numero.display_phone_number || "",
        provider: numero.provider,
        enabled: numero.enabled,
      });
    } else {
      setEditingWhatsApp(null);
      setWhatsappForm({ phone_number_id: "", display_phone_number: "", provider: "meta", enabled: true });
    }
    setIsWhatsAppDialogOpen(true);
  };

  const handleCloseWhatsAppDialog = () => {
    setIsWhatsAppDialogOpen(false);
    setEditingWhatsApp(null);
    setWhatsappForm({ phone_number_id: "", display_phone_number: "", provider: "meta", enabled: true });
  };

  const getWebhookLabel = (tipo: string) => WEBHOOK_TIPOS.find(t => t.value === tipo)?.label || tipo;

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case "meta": return "Meta Cloud API";
      case "evolution": return "Evolution API";
      case "make": return "Make.com";
      default: return provider;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-6 w-6 text-purple-600" />
          Configurações Globais do Sistema
        </h1>
        <p className="text-muted-foreground">
          Gerencie webhooks e números WhatsApp padrão disponíveis para todas as igrejas
        </p>
      </div>

      {/* Aviso */}
      <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm text-purple-700 dark:text-purple-300">
        <Globe className="h-4 w-4 flex-shrink-0" />
        <span>
          Estas configurações são usadas como fallback quando uma igreja não possui configurações próprias.
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <Phone className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* WEBHOOKS TAB */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Webhooks Globais</h2>
            <Dialog open={isWebhookDialogOpen} onOpenChange={setIsWebhookDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenWebhookDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Webhook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingWebhook ? "Editar Webhook" : "Novo Webhook Global"}</DialogTitle>
                  <DialogDescription>
                    Configure um webhook global do sistema.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tipo do Webhook</Label>
                    <Select
                      value={webhookForm.tipo}
                      onValueChange={(value) => setWebhookForm({ ...webhookForm, tipo: value })}
                      disabled={!!editingWebhook}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {WEBHOOK_TIPOS.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>URL do Webhook</Label>
                    <Input
                      placeholder="https://hook.us1.make.com/..."
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Ativo</Label>
                      <p className="text-xs text-muted-foreground">Habilitar este webhook</p>
                    </div>
                    <Switch
                      checked={webhookForm.enabled}
                      onCheckedChange={(checked) => setWebhookForm({ ...webhookForm, enabled: checked })}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseWebhookDialog}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => saveWebhookMutation.mutate({ ...webhookForm, id: editingWebhook?.id })}
                    disabled={saveWebhookMutation.isPending || !webhookForm.tipo}
                  >
                    {saveWebhookMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingWebhook ? "Salvar" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingWebhooks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum webhook global cadastrado</p>
                </div>
              ) : (
                <div className="divide-y">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <Link2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getWebhookLabel(webhook.tipo)}</span>
                            {!webhook.enabled && <Badge variant="secondary">Desativado</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground font-mono truncate max-w-md">
                            {webhook.url || "Não configurado"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={webhook.enabled}
                          onCheckedChange={(checked) => toggleWebhookMutation.mutate({ id: webhook.id, enabled: checked })}
                          disabled={toggleWebhookMutation.isPending}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleOpenWebhookDialog(webhook)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Remover este webhook global?")) {
                              deleteWebhookMutation.mutate(webhook.id);
                            }
                          }}
                          disabled={deleteWebhookMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WHATSAPP TAB */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Números WhatsApp Globais</h2>
            <Dialog open={isWhatsAppDialogOpen} onOpenChange={setIsWhatsAppDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenWhatsAppDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Número
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingWhatsApp ? "Editar Número" : "Novo Número WhatsApp Global"}</DialogTitle>
                  <DialogDescription>
                    Configure um número WhatsApp padrão do sistema.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Número de Telefone</Label>
                    <Input
                      placeholder="5517999999999"
                      value={whatsappForm.display_phone_number}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, display_phone_number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number ID (Meta)</Label>
                    <Input
                      placeholder="ID do número no Meta Business"
                      value={whatsappForm.phone_number_id}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, phone_number_id: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Provedor</Label>
                    <Select
                      value={whatsappForm.provider}
                      onValueChange={(value) => setWhatsappForm({ ...whatsappForm, provider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meta">Meta Cloud API</SelectItem>
                        <SelectItem value="evolution">Evolution API</SelectItem>
                        <SelectItem value="make">Make.com</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Ativo</Label>
                      <p className="text-xs text-muted-foreground">Habilitar envio de mensagens</p>
                    </div>
                    <Switch
                      checked={whatsappForm.enabled}
                      onCheckedChange={(checked) => setWhatsappForm({ ...whatsappForm, enabled: checked })}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseWhatsAppDialog}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => saveWhatsAppMutation.mutate({ ...whatsappForm, id: editingWhatsApp?.id })}
                    disabled={saveWhatsAppMutation.isPending || !whatsappForm.display_phone_number}
                  >
                    {saveWhatsAppMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingWhatsApp ? "Salvar" : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingWhatsApp ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : whatsappNumeros.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum número WhatsApp global cadastrado</p>
                </div>
              ) : (
                <div className="divide-y">
                  {whatsappNumeros.map((numero) => (
                    <div key={numero.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <Phone className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{numero.display_phone_number || "Sem número"}</span>
                            <Badge variant="outline">{getProviderLabel(numero.provider)}</Badge>
                            {!numero.enabled && <Badge variant="secondary">Desativado</Badge>}
                          </div>
                          {numero.phone_number_id && (
                            <p className="text-sm text-muted-foreground font-mono">
                              ID: {numero.phone_number_id}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={numero.enabled}
                          onCheckedChange={(checked) => toggleWhatsAppMutation.mutate({ id: numero.id, enabled: checked })}
                          disabled={toggleWhatsAppMutation.isPending}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleOpenWhatsAppDialog(numero)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Remover este número global?")) {
                              deleteWhatsAppMutation.mutate(numero.id);
                            }
                          }}
                          disabled={deleteWhatsAppMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
