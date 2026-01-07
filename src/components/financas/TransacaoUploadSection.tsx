import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, Eye, FileText, Loader2, Paperclip, X } from "lucide-react";

interface TransacaoUploadSectionProps {
  anexoPreview: string;
  anexoUrl: string;
  anexoFile: File | null;
  anexoIsPdf: boolean;
  isMobile: boolean;
  aiProcessing: boolean;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  onViewDocument: () => void;
}

export function TransacaoUploadSection({
  anexoPreview,
  anexoUrl,
  anexoFile,
  anexoIsPdf,
  isMobile,
  aiProcessing,
  onFileSelected,
  onClear,
  onViewDocument,
}: TransacaoUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-3">
      {!anexoPreview && !anexoUrl && !anexoFile ? (
        <div className="border-2 border-dashed border-primary/30 rounded-xl p-4 md:p-6 bg-primary/5 hover:bg-primary/10 transition-colors">
          {aiProcessing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando com IA...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {isMobile ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      className="flex-1 gap-2"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="w-5 h-5" />
                      Tirar Foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="flex-1 gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="w-5 h-5" />
                      Anexar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-5 h-5" />
                    Anexar Nota ou PDF
                  </Button>
                )}
                <p className="text-xs text-center text-muted-foreground">A IA irá extrair os dados automaticamente</p>
              </div>

              {/* Input para câmera (mobile) */}
              <input
                ref={cameraInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelected(file);
                }}
              />
              
              {/* Input para arquivos (galeria/PDFs) */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFileSelected(file);
                }}
              />
            </>
          )}
        </div>
      ) : (
        <div className="relative">
          <div
            className={cn(
              "relative rounded-lg overflow-hidden border cursor-pointer group bg-muted/20",
              isMobile ? "h-[120px]" : "aspect-[3/4] w-full",
            )}
            onClick={onViewDocument}
          >
            {anexoPreview ? (
              <>
                <img
                  src={anexoPreview}
                  alt={anexoIsPdf ? "Preview do PDF" : "Nota fiscal"}
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-8 h-8 text-white" />
                </div>
                {anexoIsPdf && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    PDF
                  </div>
                )}
              </>
            ) : anexoUrl && !anexoIsPdf ? (
              <>
                <img src={anexoUrl} alt="Nota fiscal" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-8 h-8 text-white" />
                </div>
              </>
            ) : anexoIsPdf || (anexoFile && !anexoPreview) ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                <FileText className="w-16 h-16 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground text-center truncate max-w-full">
                  {anexoFile?.name || "Documento anexado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {anexoIsPdf ? "Clique para abrir em nova aba" : "Clique para visualizar"}
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-muted-foreground">Arquivo anexado</p>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 z-10"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X className="w-4 h-4" />
          </Button>

          {isMobile && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2 gap-1 shadow-lg"
              onClick={onViewDocument}
            >
              <Eye className="w-4 h-4" />
              {anexoIsPdf ? "Abrir PDF" : "Ver Nota"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
