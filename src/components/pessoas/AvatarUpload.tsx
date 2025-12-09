import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, X } from "lucide-react";

interface AvatarUploadProps {
  pessoaId: string;
  pessoaNome: string;
  avatarUrl?: string | null;
  onAvatarUpdate?: (newUrl: string) => void;
}

export function AvatarUpload({ pessoaId, pessoaNome, avatarUrl, onAvatarUpdate }: AvatarUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo e tamanho
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem válida",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 5MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${pessoaId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("profiles")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", pessoaId);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Avatar atualizado com sucesso",
      });

      onAvatarUpdate?.(publicUrl);
      setIsOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Erro ao fazer upload do avatar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível fazer upload do avatar",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Avatar removido com sucesso",
      });

      onAvatarUpdate?.(null);
      setIsOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Erro ao remover avatar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o avatar",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Alterar Foto</span>
        <span className="sm:hidden">Foto</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Foto de Perfil</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview */}
            <div className="flex justify-center">
              <Avatar className="w-24 h-24 border-4 border-border">
                <AvatarImage src={previewUrl || avatarUrl || undefined} alt={pessoaNome} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-2xl font-bold">
                  {pessoaNome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* File Input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="avatar-input" className="text-sm font-medium cursor-pointer">
                Escolher Imagem (PNG, JPG, WEBP - Máx. 5MB)
              </label>
              <input
                id="avatar-input"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("avatar-input")?.click()}
                disabled={isUploading}
              >
                Selecionar Imagem
              </Button>
            </div>

            {/* Selected file info */}
            {selectedFile && (
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                Arquivo selecionado: {selectedFile.name}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {avatarUrl && (
              <Button
                variant="destructive"
                onClick={handleRemoveAvatar}
                disabled={isUploading}
                className="flex-1 sm:flex-none"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Remover Foto
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isUploading}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="flex-1 sm:flex-none"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
