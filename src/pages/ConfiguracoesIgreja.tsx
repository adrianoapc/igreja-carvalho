import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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