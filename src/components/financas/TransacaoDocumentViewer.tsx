import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Image as ImageIcon, X, ZoomIn, ZoomOut } from "lucide-react";
import React from "react";

interface TransacaoDocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url?: string | null;
  isPdf?: boolean;
  fileName?: string;
  imageZoom: number;
  setImageZoom: (zoom: number) => void;
}

export function TransacaoDocumentViewer({
  open,
  onOpenChange,
  url,
  isPdf: isPdfProp,
  fileName,
  imageZoom,
  setImageZoom,
}: TransacaoDocumentViewerProps) {
  const currentUrl = url || null;
  if (!currentUrl) return null;

  const isPdf = isPdfProp || currentUrl.toLowerCase().includes(".pdf");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = currentUrl;
    link.download = fileName || "documento";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 outline-none overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="h-10 w-10 shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
            {isPdf ? (
              <FileText className="w-5 h-5 text-destructive" />
            ) : (
              <ImageIcon className="w-5 h-5 text-primary" />
            )}
            <h3 className="font-semibold text-base md:text-lg truncate">{isPdf ? "Documento PDF" : "Imagem"}</h3>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            {!isPdf && (
              <div className="flex items-center gap-1 mr-1 md:mr-2">
                <Button variant="ghost" size="sm" onClick={() => setImageZoom(Math.max(0.5, imageZoom - 0.25))}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs md:text-sm text-muted-foreground min-w-[2.5rem] md:min-w-[3rem] text-center">
                  {Math.round(imageZoom * 100)}%
                </span>
                <Button variant="ghost" size="sm" onClick={() => setImageZoom(Math.min(3, imageZoom + 0.25))}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload} className="hidden md:flex">
              <Download className="w-4 h-4 mr-2" />
              Baixar
            </Button>
            <Button variant="outline" size="icon" onClick={handleDownload} className="md:hidden h-9 w-9">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 bg-muted/50 relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
          {isPdf ? (
            <div className="w-full h-full relative bg-card rounded shadow-sm overflow-hidden">
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(currentUrl)}&embedded=true`}
                className="w-full h-full border-0"
                frameBorder={0}
                title="Visualizador de PDF"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = currentUrl;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.click();
                  }}
                  className="shadow-lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Abrir Externamente
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full w-full overflow-auto">
              <img
                src={currentUrl}
                alt="Documento"
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{ transform: `scale(${imageZoom})` }}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
