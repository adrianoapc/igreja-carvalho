import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ImageCaptureInputProps {
  onFileSelected: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
  previewUrl?: string;
  onClear?: () => void;
  className?: string;
}

export function ImageCaptureInput({
  onFileSelected,
  accept = "image/*",
  maxSizeMB = 20,
  previewUrl,
  onClear,
  className = "",
}: ImageCaptureInputProps) {
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Preferir câmera traseira
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error: any) {
      console.error("Erro ao acessar câmera:", error);
      toast.error("Não foi possível acessar a câmera", {
        description: "Verifique as permissões do navegador",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Erro ao capturar foto");
          return;
        }

        // Validar tamanho
        if (blob.size > maxSizeMB * 1024 * 1024) {
          toast.error(`Foto muito grande. Máximo ${maxSizeMB}MB`);
          return;
        }

        const file = new File([blob], `foto-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        onFileSelected(file);
        stopCamera();
        setShowCameraDialog(false);
        toast.success("Foto capturada!");
      },
      "image/jpeg",
      0.95
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo ${maxSizeMB}MB`);
      return;
    }

    onFileSelected(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      stopCamera();
    }
    setShowCameraDialog(open);
  };

  return (
    <>
      {/* Área de Upload/Preview */}
      {!previewUrl ? (
        <div className={`space-y-2 ${className}`}>
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
            <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto"
              >
                <Upload className="w-4 h-4 mr-2" />
                Escolher Arquivo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCameraDialog(true);
                  startCamera();
                }}
                className="w-full sm:w-auto"
              >
                <Camera className="w-4 h-4 mr-2" />
                Tirar Foto
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Máximo {maxSizeMB}MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={accept}
            onChange={handleFileSelect}
          />
        </div>
      ) : (
        <div className={`relative ${className}`}>
          <div className="relative rounded-lg overflow-hidden border">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-48 object-cover"
            />
            {onClear && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={onClear}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Dialog da Câmera */}
      <Dialog open={showCameraDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Capturar Foto</DialogTitle>
            <DialogDescription>
              Posicione a câmera e clique em "Capturar" quando estiver pronto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogClose(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={capturePhoto} disabled={!stream}>
                <Camera className="w-4 h-4 mr-2" />
                Capturar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
