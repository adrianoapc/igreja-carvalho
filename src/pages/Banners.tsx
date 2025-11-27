import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Eye, EyeOff, Megaphone, Upload, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";

const imageSchema = z.object({
  file: z.instanceof(File),
  width: z.number().max(1200, "Largura máxima: 1200px para compatibilidade mobile"),
  height: z.number().max(600, "Altura máxima: 600px para compatibilidade mobile"),
  size: z.number().max(2 * 1024 * 1024, "Tamanho máximo: 2MB"),
});

interface Banner {
  id: string;
  title: string;
  message: string;
  type: string;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Banners() {
  const { toast } = useToast();
  const { hasAccess } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newBanner, setNewBanner] = useState({
    title: "",
    message: "",
    type: "info",
  });

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar banners",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const validateImage = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    return new Promise((resolve) => {
      // Validar tipo
      if (!file.type.startsWith("image/")) {
        resolve({ valid: false, error: "Arquivo deve ser uma imagem" });
        return;
      }

      // Validar tamanho do arquivo
      if (file.size > 2 * 1024 * 1024) {
        resolve({ valid: false, error: "Tamanho máximo: 2MB" });
        return;
      }

      // Validar dimensões
      const img = new Image();
      img.onload = () => {
        if (img.width > 1200 || img.height > 600) {
          resolve({
            valid: false,
            error: `Dimensões máximas: 1200x600px (atual: ${img.width}x${img.height}px)`,
          });
        } else {
          resolve({ valid: true });
        }
      };
      img.onerror = () => {
        resolve({ valid: false, error: "Erro ao carregar imagem" });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateImage(file);
    if (!validation.valid) {
      toast({
        title: "Imagem inválida",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("banner-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("banner-images")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: "Erro ao fazer upload",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const handleCreate = async () => {
    if (!newBanner.title || !newBanner.message) {
      toast({
        title: "Erro",
        description: "Preencha título e mensagem",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase.from("banners").insert({
        title: newBanner.title,
        message: newBanner.message,
        type: newBanner.type,
        image_url: imageUrl,
        active: true,
      });

      if (error) throw error;

      toast({
        title: "Banner criado!",
        description: "O banner está ativo e visível para todos.",
      });

      setIsCreating(false);
      setNewBanner({ title: "", message: "", type: "info" });
      setImageFile(null);
      setImagePreview(null);
      loadBanners();
    } catch (error: any) {
      toast({
        title: "Erro ao criar banner",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("banners")
        .update({ active: !currentActive })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: "Banner atualizado com sucesso.",
      });

      loadBanners();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteBanner = async (id: string, imageUrl: string | null) => {
    try {
      // Deletar imagem do storage se existir
      if (imageUrl) {
        const path = imageUrl.split("/").pop();
        if (path) {
          await supabase.storage.from("banner-images").remove([path]);
        }
      }

      const { error } = await supabase.from("banners").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Banner removido",
        description: "Banner excluído permanentemente.",
      });

      loadBanners();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "urgent":
        return "destructive";
      case "warning":
        return "default";
      case "success":
        return "default";
      default:
        return "secondary";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "urgent":
        return "Urgente";
      case "warning":
        return "Aviso";
      case "success":
        return "Sucesso";
      default:
        return "Info";
    }
  };

  if (!hasAccess("banners", "criar_editar")) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Você não tem permissão para gerenciar banners.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Banners e Avisos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie comunicações importantes para os membros
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2 bg-gradient-primary">
          <Plus className="w-4 h-4" />
          Novo Banner
        </Button>
      </div>

      {isCreating && (
        <Card className="border-primary/20 shadow-soft">
          <CardHeader>
            <CardTitle>Criar Novo Banner</CardTitle>
            <CardDescription>Preencha as informações do banner</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={newBanner.title}
                onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                placeholder="Ex: Culto Especial de Domingo"
                className="mt-1"
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={newBanner.message}
                onChange={(e) => setNewBanner({ ...newBanner, message: e.target.value })}
                placeholder="Digite a mensagem completa do banner..."
                className="mt-1 min-h-[100px]"
                maxLength={500}
              />
            </div>

            <div>
              <Label htmlFor="type">Tipo</Label>
              <select
                id="type"
                value={newBanner.type}
                onChange={(e) => setNewBanner({ ...newBanner, type: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
              >
                <option value="info">Informação</option>
                <option value="success">Sucesso</option>
                <option value="warning">Aviso</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <Label htmlFor="image">Imagem (Opcional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Máximo: 1200x600px, 2MB. Recomendado para visualização mobile.
              </p>
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  <input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <label htmlFor="image" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                      <div className="flex items-center gap-2 text-primary">
                        <Upload className="w-4 h-4" />
                        <span className="font-medium">Clique para adicionar imagem</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG ou WEBP até 2MB
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setImageFile(null);
                  setImagePreview(null);
                }}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar Banner"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {banners.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">Nenhum banner criado ainda</p>
            </CardContent>
          </Card>
        ) : (
          banners.map((banner) => (
            <Card key={banner.id} className={`shadow-soft ${!banner.active ? "opacity-60" : ""}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Megaphone className="w-5 h-5 text-primary" />
                      <CardTitle className="text-xl">{banner.title}</CardTitle>
                      <Badge variant={getTypeColor(banner.type)}>
                        {getTypeLabel(banner.type)}
                      </Badge>
                      {banner.active ? (
                        <Badge variant="outline" className="gap-1">
                          <Eye className="w-3 h-3" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <EyeOff className="w-3 h-3" />
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="whitespace-pre-wrap">{banner.message}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(banner.id, banner.active)}
                    >
                      {banner.active ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteBanner(banner.id, banner.image_url)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {banner.image_url && (
                <CardContent className="pt-0">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </CardContent>
              )}
              <CardContent className={banner.image_url ? "" : "pt-0"}>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>
                    Criado: {new Date(banner.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
