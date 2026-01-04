import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Webhook, Save, MessageSquare, Key, Loader2, Link2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";

// Tipos para os Webhooks Genéricos
interface WebhookConfig {
  key: string;
  name: string;
  description: string;
  placeholder: string;
  isConfigured: boolean;
}

const GENERIC_WEBHOOKS: Omit<WebhookConfig, 'isConfigured'>[] = [
  {
    key: "MAKE_WEBHOOK_URL",
    name: "Make.com (Geral)",
    description: "Notificações gerais e alertas críticos.",
    placeholder: "https://hook.us1.make.com/...",
  },
  {
    key: "MAKE_WEBHOOK_ESCALAS",
    name: "Make.com (Escalas)",
    description: "Envio de convites e lembretes de voluntários.",
    placeholder: "https://hook.us1.make.com/...",
  },
  {
    key: "MAKE_WEBHOOK_SECRET",
    name: "Make.com (Liturgia)",
    description: "Distribuição de repertório aos times de louvor.",
    placeholder: "https://hook.us1.make.com/...",
  },
];

interface Props {
  onBack?: () => void;
}

export default function Webhooks({ onBack }: Props) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  
  // Estado do Provedor de Mensagem
  const [whatsappConfig, setWhatsappConfig] = useState({
    provider: "make_webhook",
    token: "",
    instanceId: ""
  });

  // Estado dos Webhooks Genéricos
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    if (!igrejaLoading) {
      loadData();
    }
  }, [igrejaLoading, igrejaId]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!igrejaId) {
        setLoading(false);
        return;
      }

      // 1. Carregar Configuração do Banco (Provedor de Whats)
      const { data: dbConfig, error } = await supabase
        .from("configuracoes_igreja")
        .select("whatsapp_provider, whatsapp_token, whatsapp_instance_id") 
        .eq("igreja_id", igrejaId)
        .maybeSingle();

      if (!error && dbConfig) {
        setWhatsappConfig({
          provider: dbConfig.whatsapp_provider || "make_webhook",
          token: dbConfig.whatsapp_token || "",
          instanceId: dbConfig.whatsapp_instance_id || ""
        });
      }

      // 2. Mockar status dos secrets
      const configList = GENERIC_WEBHOOKS.map(webhook => ({
        ...webhook,
        isConfigured: true 
      }));
      setConfigs(configList);

    } catch (error: unknown) {
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWhatsapp = async () => {
    setSaving(true);
    try {
      if (!igrejaId) {
        throw new Error("Igreja não identificada para salvar configurações.");
      }

      const { error } = await supabase
        .from("configuracoes_igreja")
        .update({
          whatsapp_provider: whatsappConfig.provider,
          whatsapp_token: whatsappConfig.token,
          whatsapp_instance_id: whatsappConfig.instanceId
        })
        .eq('igreja_id', igrejaId);

      if (error) throw error;
      toast.success("Configuração de WhatsApp salva!");
    } catch (error: unknown) {
      toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWebhook = async (key: string) => {
    if (!newValue.trim()) return toast.error("Digite a URL");
    toast.info(`Em produção, isto atualizaria o Secret: ${key}`);
    setEditingKey(null);
    setNewValue("");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Carregando integrações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
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
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-muted-foreground">Configure gateways de mensagem e webhooks do sistema.</p>
        </div>
      </div>

      {/* 1. SEÇÃO WHATSAPP */}
      <Card className="border-l-4 border-l-green-500 shadow-sm overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600">
               <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Canal de Mensagens</CardTitle>
              <CardDescription className="text-xs">
                Serviço usado para disparos automáticos (WhatsApp).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <div className="grid gap-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Provedor Ativo</Label>
            <Select
              value={whatsappConfig.provider}
              onValueChange={(val) => setWhatsappConfig(prev => ({ ...prev, provider: val }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="make_webhook">Make.com (Via Webhook)</SelectItem>
                <SelectItem value="meta_official">Meta Cloud API (Oficial)</SelectItem>
                <SelectItem value="evolution_api">Evolution API (Unofficial)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Configuração: META */}
          {whatsappConfig.provider === 'meta_official' && (
            <div className="grid gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-2">
              <div className="grid gap-2">
                <Label>Token de Acesso (Permanente)</Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9 font-mono text-sm" 
                    type="password"
                    placeholder="EAAG..." 
                    value={whatsappConfig.token || ""}
                    onChange={e => setWhatsappConfig(prev => ({ ...prev, token: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Phone Number ID</Label>
                <Input 
                  className="font-mono text-sm" 
                  placeholder="123456789..." 
                  value={whatsappConfig.instanceId || ""}
                  onChange={e => setWhatsappConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Configuração: EVOLUTION */}
          {whatsappConfig.provider === 'evolution_api' && (
            <div className="grid gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-2">
              <div className="grid gap-2">
                <Label>API Key Global</Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9 font-mono text-sm" 
                    type="password"
                    placeholder="Token da API..." 
                    value={whatsappConfig.token || ""}
                    onChange={e => setWhatsappConfig(prev => ({ ...prev, token: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Nome da Instância</Label>
                <Input 
                  className="font-mono text-sm" 
                  placeholder="Ex: igreja-bot" 
                  value={whatsappConfig.instanceId || ""}
                  onChange={e => setWhatsappConfig(prev => ({ ...prev, instanceId: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Configuração: MAKE */}
          {whatsappConfig.provider === 'make_webhook' && (
            <div className="flex items-start gap-3 p-3 border rounded-lg bg-blue-50/50 text-blue-900 animate-in fade-in slide-in-from-top-2">
              <Webhook className="h-4 w-4 mt-0.5 text-blue-600" />
              <div className="text-xs leading-relaxed">
                <p className="font-medium">Modo Webhook</p>
                <p className="opacity-90">
                  O sistema enviará os dados para a URL configurada no campo <strong>Make.com (Geral)</strong> abaixo.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveWhatsapp} disabled={saving} size="sm">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Conexão"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator className="opacity-50" />

      {/* 2. SEÇÃO WEBHOOKS GENÉRICOS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Webhooks de Eventos</h3>
        </div>

        <div className="grid gap-3">
          {configs.map((config) => (
            <Card key={config.key} className="overflow-hidden hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{config.name}</span>
                        <Badge variant={config.isConfigured ? "outline" : "secondary"} className="text-[10px] h-5 px-1.5 font-normal">
                          {config.isConfigured ? "Ativo" : "Pendente"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{config.description}</p>
                    </div>
                    {editingKey !== config.key && (
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditingKey(config.key)}>
                        Alterar
                      </Button>
                    )}
                  </div>

                  {editingKey === config.key && (
                    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2 pt-2 border-t mt-1">
                      <Input 
                        value={newValue} 
                        onChange={e => setNewValue(e.target.value)} 
                        placeholder={config.placeholder}
                        className="font-mono text-xs h-8"
                        autoFocus
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => handleSaveWebhook(config.key)}>Salvar</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingKey(null)}>Cancelar</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    </div>
  );
}
