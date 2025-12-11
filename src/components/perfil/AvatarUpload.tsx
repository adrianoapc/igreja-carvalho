import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageCaptureInput } from "@/components/ui/image-capture-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  userName: string;
  onAvatarUpdated: () => void;
}

export function AvatarUpload({ userId, currentAvatarUrl, userName, onAvatarUpdated }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearPreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleUploadConfirm = async () => {
    if (!selectedFile) return;

    try {

      setUploading(true);

      // Obter user_id do auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Gerar nome único para o arquivo
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Deletar avatar antigo se existir e pertence ao usuário atual
      if (currentAvatarUrl && currentAvatarUrl.includes(`/${user.id}/`)) {
        const oldPath = currentAvatarUrl.split("/").slice(-2).join("/");
        // Validate path before deletion
        if (oldPath && oldPath.startsWith(user.id)) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      }

      // Upload do novo arquivo
      const { error: uploadError, data } = await supabase.storage
        .from("avatars")
        .upload(fileName, selectedFile, {
          upsert: true,
          contentType: selectedFile.type,
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Atualizar profile com nova URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      toast.success("Foto de perfil atualizada com sucesso!");
      onAvatarUpdated();
      setShowUploadDialog(false);
      handleClearPreview();
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao atualizar foto de perfil");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="relative group">
        <Avatar className="h-24 w-24 md:h-32 md:w-32">
          <AvatarImage src={currentAvatarUrl || undefined} alt={userName} />
          <AvatarFallback className="text-2xl md:text-4xl bg-gradient-accent text-primary">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <button
          type="button"
          onClick={() => setShowUploadDialog(true)}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <Camera className="h-8 w-8 text-white" />
          )}
        </button>
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Foto de Perfil</DialogTitle>
            <DialogDescription>
              Escolha um arquivo ou tire uma foto para atualizar seu avatar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ImageCaptureInput
              onFileSelected={handleFileSelected}
              accept="image/*"
              maxSizeMB={2}
              previewUrl={previewUrl || undefined}
              onClear={handleClearPreview}
            />

            {selectedFile && (
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowUploadDialog(false)}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button onClick={handleUploadConfirm} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
