import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Save, X, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppConfig } from "@/hooks/useAppConfig";

export default function ConfiguracoesIgreja() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [config, setConfig] = useState({
    id: "",
    nome_igreja: "Igreja App",
    subtitulo: "Gestão Completa",
    logo_url: null as string | null,
    webhook_make_liturgia: null as string | null
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
          webhook_make_liturgia: config.webhook_make_liturgia
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

          {/* Webhook Make Liturgia */}
          <div className="space-y-2">
            <Label htmlFor="webhook">Webhook Make.com (Liturgia)</Label>
            <Input
              id="webhook"
              type="url"
              value={config.webhook_make_liturgia || ""}
              onChange={(e) => setConfig(prev => ({ ...prev, webhook_make_liturgia: e.target.value }))}
              placeholder="https://hook.us1.make.com/..."
            />
            <p className="text-xs text-muted-foreground">
              URL do webhook do Make.com para receber notificações de liturgia
            </p>
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
    </div>
  );
}