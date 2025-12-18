import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Save, X, AlertTriangle, Bell, Phone, MessageSquare, Webhook } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppConfig } from "@/hooks/useAppConfig";
import InputMask from "react-input-mask";
import { useNavigate } from "react-router-dom";
export default function ConfiguracoesIgreja() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [config, setConfig] = useState({
    id: "",
    nome_igreja: "Igreja App",
    subtitulo: "Gestão Completa",
    logo_url: null as string | null,
    whatsapp_provider: "make_webhook" as string,
    whatsapp_token: null as string | null,
    whatsapp_instance_id: null as string | null,
    telefone_plantao_pastoral: null as string | null
  });
  const [novoLogo, setNovoLogo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Hook para gerenciar modo de manutenção
  const { 
    config: maintenanceConfig, 
    isLoading: maintenanceLoading, 
    updateConfig: updateMaintenanceConfig 
  } = useAppConfig();

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (novoLogo) {
      const url = URL.createObjectURL(novoLogo);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [novoLogo]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes_igreja")
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        setConfig(data);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar configurações", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Arquivo inválido", {
          description: "Por favor, selecione uma imagem"
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Arquivo muito grande", {
          description: "O logo deve ter no máximo 2MB"
        });
        return;
      }
      setNovoLogo(file);
    }
  };

  const handleRemoverLogo = () => {
    setNovoLogo(null);
    setPreviewUrl(null);
    setConfig(prev => ({ ...prev, logo_url: null }));
  };

  const handleMaintenanceModeChange = async (enabled: boolean) => {
    const success = await updateMaintenanceConfig({ maintenance_mode: enabled });
    if (success) {
      toast.success(
        enabled ? "Modo de manutenção ativado" : "Modo de manutenção desativado",
        {
          description: enabled 
            ? "O sistema está bloqueado para usuários comuns" 
            : "O sistema voltou ao normal"
        }
      );
    }
  };

  const handlePublicAccessChange = async (enabled: boolean) => {
    const success = await updateMaintenanceConfig({ allow_public_access: enabled });
    if (success) {
      toast.success(
        enabled ? "Acesso público liberado" : "Acesso público bloqueado",
        {
          description: enabled
            ? "Formulários de cadastro estão acessíveis"
            : "Formulários de cadastro foram bloqueados"
        }
      );
    }
  };

  const handleMaintenanceMessageChange = async (message: string) => {
    const success = await updateMaintenanceConfig({ maintenance_message: message });
    if (success) {
      toast.success("Mensagem atualizada");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let logoUrl = config.logo_url;

      // Upload do novo logo se existir
      if (novoLogo) {
        setUploading(true);
        
        // Deletar logo antigo se existir
        if (config.logo_url) {
          const oldPath = config.logo_url.split('/').pop();
          if (oldPath) {
            await supabase.storage
              .from('igreja-logo')
              .remove([oldPath]);
          }
        }

        // Upload do novo logo
        const fileName = `logo-${Date.now()}.${novoLogo.name.split('.').pop()}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('igreja-logo')
          .upload(fileName, novoLogo, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('igreja-logo')
          .getPublicUrl(uploadData.path);

        logoUrl = publicUrl;
        setUploading(false);
      }

      // Atualizar configurações no banco
      const { error } = await supabase
        .from("configuracoes_igreja")
        .update({
          nome_igreja: config.nome_igreja,
          subtitulo: config.subtitulo,
          logo_url: logoUrl,
          whatsapp_provider: config.whatsapp_provider,
          whatsapp_token: config.whatsapp_token,
          whatsapp_instance_id: config.whatsapp_instance_id,
          telefone_plantao_pastoral: config.telefone_plantao_pastoral?.replace(/\D/g, '') || null
        })
        .eq("id", config.id);

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
      setNovoLogo(null);
      setPreviewUrl(null);
      loadConfig();
      
      // Recarregar a página para atualizar a sidebar
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      toast.error("Erro ao salvar configurações", {
        description: error.message
      });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações da Igreja</h1>
          <p className="text-muted-foreground mt-1">Carregando...</p>
        </div>
      </div>
    );
  }

  const displayLogoUrl = previewUrl || config.logo_url;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações da Igreja</h1>
        <p className="text-muted-foreground mt-1">
          Personalize as informações da sua igreja
        </p>
      </div>

      {/* Painel de Modo de Manutenção */}
      <Card className={maintenanceConfig.maintenance_mode ? "border-orange-500 border-2" : ""}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className={maintenanceConfig.maintenance_mode ? "text-orange-500" : "text-muted-foreground"} />
            <CardTitle>Modo de Manutenção</CardTitle>
          </div>
          <CardDescription>
            Controle o acesso ao sistema durante manutenções e atualizações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ativar/Desativar Manutenção */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance-mode" className="text-base">
                Ativar Modo de Manutenção
              </Label>
              <p className="text-sm text-muted-foreground">
                Bloqueia o acesso para usuários comuns. Administradores e técnicos continuam com acesso total.
              </p>
            </div>
            <Switch
              id="maintenance-mode"
              checked={maintenanceConfig.maintenance_mode}
              onCheckedChange={handleMaintenanceModeChange}
              disabled={maintenanceLoading}
            />
          </div>

          {/* Liberar Formulários Públicos (só aparece se manutenção ativa) */}
          {maintenanceConfig.maintenance_mode && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="public-access" className="text-base">
                    Liberar Formulários Públicos
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Mantém acessíveis as páginas de cadastro de visitantes e membros
                  </p>
                </div>
                <Switch
                  id="public-access"
                  checked={maintenanceConfig.allow_public_access}
                  onCheckedChange={handlePublicAccessChange}
                  disabled={maintenanceLoading}
                />
              </div>

              {/* Mensagem Personalizada */}
              <div className="space-y-2">
                <Label htmlFor="maintenance-message">Mensagem de Manutenção</Label>
                <Textarea
                  id="maintenance-message"
                  value={maintenanceConfig.maintenance_message || ""}
                  onChange={(e) => {
                    // Update local state for preview
                  }}
                  onBlur={(e) => handleMaintenanceMessageChange(e.target.value)}
                  placeholder="Digite uma mensagem personalizada para os usuários..."
                  rows={3}
                  disabled={maintenanceLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Esta mensagem será exibida na tela de manutenção
                </p>
              </div>

              {/* Aviso de Status */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="text-orange-500 w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-orange-900">
                      Sistema em Manutenção
                    </p>
                    <p className="text-xs text-orange-700">
                      Você está vendo o sistema normalmente porque é {" "}
                      <strong>administrador/técnico</strong>. 
                      Usuários comuns estão vendo a tela de manutenção.
                      {maintenanceConfig.allow_public_access && (
                        <span className="block mt-1">
                          ✓ Formulários públicos de cadastro estão liberados
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>
            Configure o nome, subtítulo e logo da igreja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo da Igreja</Label>
            {displayLogoUrl && (
              <div className="relative w-32 h-32 border rounded-lg p-2">
                <img
                  src={displayLogoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={handleRemoverLogo}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {displayLogoUrl ? "Trocar Logo" : "Fazer Upload"}
                  </span>
                </Button>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: JPG, PNG, SVG. Tamanho máximo: 2MB
            </p>
          </div>

          {/* Nome da Igreja */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Igreja</Label>
            <Input
              id="nome"
              value={config.nome_igreja}
              onChange={(e) => setConfig(prev => ({ ...prev, nome_igreja: e.target.value }))}
              placeholder="Nome da Igreja"
            />
          </div>

          {/* Subtítulo */}
          <div className="space-y-2">
            <Label htmlFor="subtitulo">Subtítulo</Label>
            <Input
              id="subtitulo"
              value={config.subtitulo || ""}
              onChange={(e) => setConfig(prev => ({ ...prev, subtitulo: e.target.value }))}
              placeholder="Subtítulo ou slogan"
            />
          </div>


          {/* Botão Salvar */}
          <Button 
            onClick={handleSave} 
            disabled={saving || uploading}
            className="w-full"
          >
            <Save className="w-4 h-4 mr-2" />
            {uploading ? "Fazendo upload..." : saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Card de Webhooks */}
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="text-primary" />
            <CardTitle>Webhooks de Integração</CardTitle>
          </div>
          <CardDescription>
            Gerencie URLs de webhook para Make.com e outras integrações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/webhooks')}
            className="w-full"
          >
            <Webhook className="w-4 h-4 mr-2" />
            Gerenciar Webhooks
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Configure de forma segura os webhooks de escalas, liturgia e notificações
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="text-primary" />
            <CardTitle>Notificações & Plantão Pastoral</CardTitle>
          </div>
          <CardDescription>
            Configure alertas críticos e integrações de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Telefone Plantão */}
          <div className="space-y-2">
            <Label htmlFor="telefone-plantao" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Telefone do Plantão Pastoral
            </Label>
            <InputMask
              mask="(99) 99999-9999"
              value={config.telefone_plantao_pastoral || ""}
              onChange={(e) => setConfig(prev => ({ ...prev, telefone_plantao_pastoral: e.target.value }))}
            >
              {(inputProps: any) => (
                <Input
                  {...inputProps}
                  id="telefone-plantao"
                  placeholder="(11) 99999-9999"
                />
              )}
            </InputMask>
            <p className="text-xs text-muted-foreground">
              Número que receberá alertas críticos de sentimentos negativos
            </p>
          </div>

          {/* Provedor WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp-provider" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Provedor WhatsApp
            </Label>
            <Select
              value={config.whatsapp_provider}
              onValueChange={(value) => setConfig(prev => ({ ...prev, whatsapp_provider: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="make_webhook">Make.com (Webhook)</SelectItem>
                <SelectItem value="meta_official">Meta Official API</SelectItem>
                <SelectItem value="evolution_api">Evolution API</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Escolha como os alertas serão enviados via WhatsApp
            </p>
          </div>

          {/* Campos condicionais baseados no provedor */}
          {config.whatsapp_provider === 'meta_official' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-token">Token de Acesso (Meta)</Label>
                <Input
                  id="whatsapp-token"
                  type="password"
                  value={config.whatsapp_token || ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_token: e.target.value }))}
                  placeholder="EAAxxxxxx..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-instance">Phone Number ID</Label>
                <Input
                  id="whatsapp-instance"
                  value={config.whatsapp_instance_id || ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_instance_id: e.target.value }))}
                  placeholder="1234567890123456"
                />
              </div>
            </>
          )}

          {config.whatsapp_provider === 'evolution_api' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-token">API Key (Evolution)</Label>
                <Input
                  id="whatsapp-token"
                  type="password"
                  value={config.whatsapp_token || ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_token: e.target.value }))}
                  placeholder="B6D711FCDE4D4FD5936544120E713976"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp-instance">Nome da Instância</Label>
                <Input
                  id="whatsapp-instance"
                  value={config.whatsapp_instance_id || ""}
                  onChange={(e) => setConfig(prev => ({ ...prev, whatsapp_instance_id: e.target.value }))}
                  placeholder="minha-instancia"
                />
              </div>
            </>
          )}

          {config.whatsapp_provider === 'make_webhook' && (
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                📌 Usando webhook Make.com configurado acima para envios de WhatsApp.
              </p>
            </div>
          )}

          {/* Botão Salvar Notificações */}
          <Button 
            onClick={handleSave} 
            disabled={saving}
            variant="outline"
            className="w-full"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Configurações de Notificação
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}