import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Webhook, Save, MessageSquare, Key, Loader2, Link2, ArrowLeft, ShieldCheck, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";

// Tipos para os Webhooks Genéricos
interface WebhookConfig {
  tipo: string;
  name: string;
  description: string;
  placeholder: string;
  isConfigured: boolean;
  value: string;
}

type WhatsappProvider = "make_webhook" | "meta_official" | "evolution_api";

interface WhatsAppConfig {
  token: string;
  endpoint: string;
  hasStoredSecret: boolean;
  secretHint: string;
}

const WEBHOOK_DEFINITIONS: Omit<WebhookConfig, 'isConfigured' | 'value'>[] = [
  {
    tipo: "make_geral",
    name: "Make.com (Geral)",
    description: "Notificações gerais e alertas críticos.",
    placeholder: "https://hook.us1.make.com/...",
  },
  {
    tipo: "make_escalas",
    name: "Make.com (Escalas)",
    description: "Envio de convites e lembretes de voluntários.",
    placeholder: "https://hook.us1.make.com/...",
  },
  {
    tipo: "make_liturgia",
    name: "Make.com (Liturgia)",
    description: "Distribuição de repertório aos times de louvor.",
    placeholder: "https://hook.us1.make.com/...",
  },
];

const WHATSAPP_PROVIDER_TO_TIPO: Record<WhatsappProvider, string> = {
  make_webhook: "whatsapp_make",
  meta_official: "whatsapp_meta",
  evolution_api: "whatsapp_evolution",
};

const TIPO_TO_WHATSAPP_PROVIDER: Record<string, WhatsappProvider> = {
  whatsapp_make: "make_webhook",
  whatsapp_meta: "meta_official",
  whatsapp_evolution: "evolution_api",
};

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
  const [whatsappProvider, setWhatsappProvider] = useState<WhatsappProvider>("make_webhook");
  const [whatsappConfigs, setWhatsappConfigs] = useState<Record<WhatsappProvider, WhatsAppConfig>>({
    make_webhook: { token: "", endpoint: "", hasStoredSecret: false, secretHint: "" },
    meta_official: { token: "", endpoint: "", hasStoredSecret: false, secretHint: "" },
    evolution_api: { token: "", endpoint: "", hasStoredSecret: false, secretHint: "" },
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

      // Usar a view segura que mascara os secrets
      const { data: webhooks, error } = await supabase
        .from("webhooks_safe")
        .select("tipo, url, secret_masked, has_secret, enabled")
        .eq("igreja_id", igrejaId);

      if (error) throw error;

      const webhookMap = new Map(webhooks?.map((row) => [row.tipo, row]) ?? []);
      const activeWhatsappRow = webhooks?.find(
        (row) => row.enabled && TIPO_TO_WHATSAPP_PROVIDER[row.tipo]
      );

      setWhatsappProvider(activeWhatsappRow ? TIPO_TO_WHATSAPP_PROVIDER[activeWhatsappRow.tipo] : "make_webhook");
      
      // Carregar configs WhatsApp com indicador de secret armazenado
      setWhatsappConfigs({
        make_webhook: {
          token: "", // Nunca pré-preenche - segurança
          endpoint: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.make_webhook)?.url ?? "",
          hasStoredSecret: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.make_webhook)?.has_secret ?? false,
          secretHint: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.make_webhook)?.secret_masked ?? "",
        },
        meta_official: {
          token: "",
          endpoint: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.meta_official)?.url ?? "",
          hasStoredSecret: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.meta_official)?.has_secret ?? false,
          secretHint: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.meta_official)?.secret_masked ?? "",
        },
        evolution_api: {
          token: "",
          endpoint: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.evolution_api)?.url ?? "",
          hasStoredSecret: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.evolution_api)?.has_secret ?? false,
          secretHint: webhookMap.get(WHATSAPP_PROVIDER_TO_TIPO.evolution_api)?.secret_masked ?? "",
        },
      });

      const configList = WEBHOOK_DEFINITIONS.map((webhook) => {
        const row = webhookMap.get(webhook.tipo);
        return {
          ...webhook,
          value: row?.url ?? "",
          isConfigured: Boolean(row?.url),
        };
      });
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

      // Primeiro, atualizar URLs e status enabled para todos os providers
      const urlPayload = (Object.keys(WHATSAPP_PROVIDER_TO_TIPO) as WhatsappProvider[]).map((provider) => {
        const config = whatsappConfigs[provider];
        return {
          igreja_id: igrejaId,
          tipo: WHATSAPP_PROVIDER_TO_TIPO[provider],
          url: config.endpoint.trim() ? config.endpoint.trim() : null,
          enabled: provider === whatsappProvider,
        };
      });

      const { error: urlError } = await supabase
        .from("webhooks")
        .upsert(urlPayload, { onConflict: "igreja_id,tipo" });

      if (urlError) throw urlError;

      // Depois, salvar secrets criptografados para tokens que foram preenchidos
      const activeConfig = whatsappConfigs[whatsappProvider];
      if (activeConfig.token.trim()) {
        const { error: secretError } = await supabase.rpc("set_webhook_secret", {
          p_igreja_id: igrejaId,
          p_tipo: WHATSAPP_PROVIDER_TO_TIPO[whatsappProvider],
          p_secret: activeConfig.token.trim(),
          p_encryption_key: import.meta.env.VITE_WEBHOOK_ENCRYPTION_KEY || "default-dev-key",
        });

        if (secretError) {
          console.error("Erro ao salvar secret:", secretError);
          toast.error("Erro ao salvar token de forma segura");
          return;
        }
      }

      toast.success("Configuração de WhatsApp salva com segurança!");
      
      // Limpar campo de token e recarregar para mostrar indicador atualizado
      setWhatsappConfigs(prev => ({
        ...prev,
        [whatsappProvider]: { ...prev[whatsappProvider], token: "" }
      }));
      await loadData();
      
    } catch (error: unknown) {
      toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWebhook = async (tipo: string) => {
    if (!igrejaId) {
      toast.error("Igreja não identificada.");
      return;
    }

    const value = newValue.trim();
    try {
      const { error } = await supabase
        .from("webhooks")
        .upsert(
          {
            igreja_id: igrejaId,
            tipo,
            url: value || null,
            enabled: Boolean(value),
          },
          { onConflict: "igreja_id,tipo" }
        );

      if (error) throw error;

      setConfigs((prev) =>
        prev.map((config) =>
          config.tipo === tipo
            ? { ...config, value, isConfigured: Boolean(value) }
            : config
        )
      );
      toast.success("Webhook salvo com sucesso!");
      setEditingKey(null);
      setNewValue("");
    } catch (error: unknown) {
      toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const activeWhatsappConfig = whatsappConfigs[whatsappProvider];
  const updateActiveWhatsappConfig = (updates: Partial<WhatsAppConfig>) => {
    setWhatsappConfigs((prev) => ({
      ...prev,
      [whatsappProvider]: { ...prev[whatsappProvider], ...updates },
    }));
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

      {/* Security Notice */}
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
        <ShieldCheck className="h-4 w-4 flex-shrink-0" />
        <span>Tokens são armazenados de forma criptografada. Por segurança, não é possível visualizar tokens salvos.</span>
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
              value={whatsappProvider}
              onValueChange={(val) => setWhatsappProvider(val as WhatsappProvider)}
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
          {whatsappProvider === 'meta_official' && (
            <div className="grid gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-2">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Token de Acesso (Permanente)</Label>
                  {activeWhatsappConfig.hasStoredSecret && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {activeWhatsappConfig.secretHint || "Configurado"}
                    </Badge>
                  )}
                </div>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9 font-mono text-sm" 
                    type="password"
                    placeholder={activeWhatsappConfig.hasStoredSecret ? "••••••••" : "EAAG..."}
                    value={activeWhatsappConfig.token}
                    onChange={e => updateActiveWhatsappConfig({ token: e.target.value })}
                  />
                </div>
                {activeWhatsappConfig.hasStoredSecret && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Digite um novo token para atualizar
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Phone Number ID</Label>
                <Input 
                  className="font-mono text-sm" 
                  placeholder="123456789..." 
                  value={activeWhatsappConfig.endpoint || ""}
                  onChange={e => updateActiveWhatsappConfig({ endpoint: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Configuração: EVOLUTION */}
          {whatsappProvider === 'evolution_api' && (
            <div className="grid gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 animate-in fade-in slide-in-from-top-2">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>API Key Global</Label>
                  {activeWhatsappConfig.hasStoredSecret && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {activeWhatsappConfig.secretHint || "Configurado"}
                    </Badge>
                  )}
                </div>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9 font-mono text-sm" 
                    type="password"
                    placeholder={activeWhatsappConfig.hasStoredSecret ? "••••••••" : "Token da API..."}
                    value={activeWhatsappConfig.token}
                    onChange={e => updateActiveWhatsappConfig({ token: e.target.value })}
                  />
                </div>
                {activeWhatsappConfig.hasStoredSecret && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Digite um novo token para atualizar
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Nome da Instância</Label>
                <Input 
                  className="font-mono text-sm" 
                  placeholder="Ex: igreja-bot" 
                  value={activeWhatsappConfig.endpoint || ""}
                  onChange={e => updateActiveWhatsappConfig({ endpoint: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Configuração: MAKE */}
          {whatsappProvider === 'make_webhook' && (
            <div className="grid gap-4 p-4 border rounded-lg bg-blue-50/50 text-blue-900 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <Webhook className="h-4 w-4 mt-0.5 text-blue-600" />
                <div className="text-xs leading-relaxed">
                  <p className="font-medium">Modo Webhook</p>
                  <p className="opacity-90">
                    Configure a URL do webhook que receberá as mensagens do WhatsApp.
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>URL do Webhook</Label>
                <div className="relative">
                  <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 font-mono text-sm"
                    placeholder="https://hook.us1.make.com/..."
                    value={activeWhatsappConfig.endpoint || ""}
                    onChange={(e) => updateActiveWhatsappConfig({ endpoint: e.target.value })}
                  />
                </div>
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
            <Card key={config.tipo} className="overflow-hidden hover:shadow-sm transition-shadow">
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
                    {editingKey !== config.tipo && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setEditingKey(config.tipo);
                          setNewValue(config.value);
                        }}
                      >
                        Alterar
                      </Button>
                    )}
                  </div>

                  {editingKey === config.tipo && (
                    <div className="flex gap-2 items-center animate-in fade-in slide-in-from-left-2 pt-2 border-t mt-1">
                      <Input 
                        value={newValue} 
                        onChange={e => setNewValue(e.target.value)} 
                        placeholder={config.placeholder}
                        className="font-mono text-xs h-8"
                        autoFocus
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => handleSaveWebhook(config.tipo)}>Salvar</Button>
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
