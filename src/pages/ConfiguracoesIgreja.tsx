import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Save, X, Phone, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, type InputHTMLAttributes } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import InputMask from "react-input-mask";

interface Props {
  onBack?: () => void;
}

export default function ConfiguracoesIgreja({ onBack }: Props) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [config, setConfig] = useState({
    id: "",
    nome_igreja: "Igreja App",
    subtitulo: "Gestão Completa",
    logo_url: null as string | null,
    telefone_plantao_pastoral: null as string | null
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
        .select("id, nome_igreja, subtitulo, logo_url, telefone_plantao_pastoral")
        .single();

      if (error) throw error;

      if (data) {
        setConfig(data);
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar configurações", {
        description: error instanceof Error ? error.message : String(error)
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
          telefone_plantao_pastoral: config.telefone_plantao_pastoral?.replace(/\D/g, '') || null
        })
        .eq("id", config.id);

      if (error) throw error;

      toast.success("Dados da igreja atualizados!");
      setNovoLogo(null);
      setPreviewUrl(null);
      loadConfig();
      
      // Recarregar a página para atualizar a sidebar se mudou o logo
      if (novoLogo || !logoUrl) {
         setTimeout(() => window.location.reload(), 1000);
      }

    } catch (error: unknown) {
      toast.error("Erro ao salvar configurações", {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Carregando dados institucionais...</div>;
  }

  const displayLogoUrl = previewUrl || config.logo_url;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
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
            <h1 className="text-2xl font-bold tracking-tight">Configurações da Igreja</h1>
            <p className="text-muted-foreground text-sm">Dados institucionais e identidade visual.</p>
          </div>
        </div>
      </div>
      
      {/* Dados de Identidade */}
      <Card>
        <CardHeader>
          <CardTitle>Identidade Visual</CardTitle>
          <CardDescription>
            Como a igreja aparece no aplicativo e nos relatórios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="space-y-2">
              <Label>Logotipo</Label>
              <div className="relative w-32 h-32 border rounded-lg p-2 bg-muted/10 flex items-center justify-center">
                {displayLogoUrl ? (
                  <>
                    <img
                      src={displayLogoUrl}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleRemoverLogo}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground text-center">Sem Logo</span>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4 w-full">
               <div className="space-y-2">
                <Label htmlFor="logo-upload">Alterar Imagem</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Label htmlFor="logo-upload" className="cursor-pointer">
                    <Button variant="outline" asChild size="sm">
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Escolher Arquivo
                      </span>
                    </Button>
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recomendado: PNG Transparente ou JPG. Máx 2MB.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Nome da Igreja */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Igreja</Label>
              <Input
                id="nome"
                value={config.nome_igreja}
                onChange={(e) => setConfig(prev => ({ ...prev, nome_igreja: e.target.value }))}
                placeholder="Ex: Igreja Batista Central"
              />
            </div>

            {/* Subtítulo */}
            <div className="space-y-2">
              <Label htmlFor="subtitulo">Slogan / Subtítulo</Label>
              <Input
                id="subtitulo"
                value={config.subtitulo || ""}
                onChange={(e) => setConfig(prev => ({ ...prev, subtitulo: e.target.value }))}
                placeholder="Ex: Um lugar de novos começos"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contato Institucional */}
      <Card>
        <CardHeader>
          <CardTitle>Contato Institucional</CardTitle>
          <CardDescription>
            Canais oficiais de atendimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="telefone-plantao" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Plantão Pastoral (Whatsapp/Tel)
            </Label>
            <InputMask
              mask="(99) 99999-9999"
              value={config.telefone_plantao_pastoral || ""}
              onChange={(e) => setConfig(prev => ({ ...prev, telefone_plantao_pastoral: e.target.value }))}
            >
              {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
                <Input
                  {...inputProps}
                  id="telefone-plantao"
                  placeholder="(11) 99999-9999"
                />
              )}
            </InputMask>
            <p className="text-xs text-muted-foreground">
              Este número será exibido aos membros em caso de urgência.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar */}
      <div className="flex justify-end pt-2">
        <Button 
          onClick={handleSave} 
          disabled={saving || uploading}
          className="w-full md:w-auto min-w-[150px]"
        >
          <Save className="w-4 h-4 mr-2" />
          {uploading ? "Enviando logo..." : saving ? "Salvando..." : "Salvar Dados"}
        </Button>
      </div>
    </div>
  );
}