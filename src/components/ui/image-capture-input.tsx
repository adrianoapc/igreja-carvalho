import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X, Crop, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { Area } from "react-easy-crop";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { compressImage, getCroppedImg } from "@/lib/imageUtils";

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
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processingFile, setProcessingFile] = useState<File | null>(null);
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
      async (blob) => {
        if (!blob) {
          toast.error("Erro ao capturar foto");
          return;
        }

        const file = new File([blob], `foto-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        stopCamera();
        setShowCameraDialog(false);
        
        await processImageFile(file);
      },
      "image/jpeg",
      0.95
    );
  };

  const processImageFile = async (file: File) => {
    try {
      toast.loading("Processando imagem...", { id: "process-image" });

      // Compress image if it's too large
      let processedFile = file;
      const sizeMB = file.size / 1024 / 1024;
      
      if (sizeMB > 2) {
        processedFile = await compressImage(file, 2, 1920);
        toast.success("Imagem comprimida automaticamente", { id: "process-image" });
      } else {
        toast.dismiss("process-image");
      }

      // Validate final size
      if (processedFile.size > maxSizeMB * 1024 * 1024) {
        toast.error(`Arquivo muito grande. Máximo ${maxSizeMB}MB`);
        return;
      }

      // Show crop dialog
      setProcessingFile(processedFile);
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Erro ao processar imagem");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    await processImageFile(file);
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!imageToCrop || !croppedAreaPixels || !processingFile) return;

    try {
      toast.loading("Aplicando recorte...", { id: "crop-image" });

      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const croppedFile = new File(
        [croppedBlob],
        processingFile.name,
        { type: "image/jpeg" }
      );

      toast.success("Imagem processada com sucesso!", { id: "crop-image" });
      
      onFileSelected(croppedFile);
      setShowCropDialog(false);
      setImageToCrop(null);
      setProcessingFile(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (error) {
      console.error("Error cropping image:", error);
      toast.error("Erro ao recortar imagem", { id: "crop-image" });
    }
  };

  const handleCropCancel = () => {
    setShowCropDialog(false);
    setImageToCrop(null);
    setProcessingFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
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

      {/* Dialog de Recorte */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ajustar Imagem</DialogTitle>
            <DialogDescription>
              Recorte e ajuste o enquadramento da imagem
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative h-[400px] bg-black rounded-lg overflow-hidden">
              {imageToCrop && (
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0])}
                  min={1}
                  max={3}
                  step={0.1}
                  className="flex-1"
                />
                <ZoomIn className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Use o controle para ajustar o zoom
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCropCancel}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleCropConfirm}>
                <Crop className="w-4 h-4 mr-2" />
                Aplicar Recorte
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
