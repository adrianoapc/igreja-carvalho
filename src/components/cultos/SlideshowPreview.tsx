import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useCallback } from "react";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  X,
  Video,
  FileText,
  Maximize2
} from "lucide-react";

interface Midia {
  id: string;
  titulo: string;
  tipo: string;
  url: string;
}

interface RecursoLiturgia {
  id: string;
  ordem: number;
  duracao_segundos: number;
  midia?: Midia;
}

interface SlideshowPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recursos: RecursoLiturgia[];
  titulo: string;
}

export default function SlideshowPreview({ 
  open, 
  onOpenChange, 
  recursos,
  titulo 
}: SlideshowPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentRecurso = recursos[currentIndex];
  const currentDuration = currentRecurso?.duracao_segundos || 10;

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % recursos.length);
    setProgress(0);
  }, [recursos.length]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + recursos.length) % recursos.length);
    setProgress(0);
  }, [recursos.length]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!open || !isPlaying || recursos.length === 0) return;

    const intervalMs = 100; // Update every 100ms for smooth progress
    const incrementPerInterval = (100 / (currentDuration * 10));

    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + incrementPerInterval;
        if (newProgress >= 100) {
          goToNext();
          return 0;
        }
        return newProgress;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [open, isPlaying, currentDuration, goToNext, recursos.length]);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setProgress(0);
      setIsPlaying(true);
    }
  }, [open]);

  // Keyboard controls
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'p':
        case 'P':
          setIsPlaying(prev => !prev);
          break;
        case 'Escape':
          onOpenChange(false);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goToNext, goToPrevious, onOpenChange]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (recursos.length === 0) return null;

  const midia = currentRecurso?.midia;
  const isImage = midia?.tipo?.toLowerCase() === 'imagem' || midia?.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = midia?.tipo?.toLowerCase() === 'vídeo' || midia?.url?.match(/\.(mp4|webm|ogg)$/i);

  // Calculate total duration
  const totalDuration = recursos.reduce((acc, r) => acc + (r.duracao_segundos || 10), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black border-none overflow-hidden">
        {/* Header overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-lg">{titulo}</h2>
              <p className="text-white/70 text-sm">
                Slide {currentIndex + 1} de {recursos.length} • Duração total: {totalDuration}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center h-full">
          {isImage && midia?.url ? (
            <img 
              src={midia.url} 
              alt={midia.titulo}
              className="max-w-full max-h-full object-contain"
            />
          ) : isVideo && midia?.url ? (
            <video 
              src={midia.url}
              className="max-w-full max-h-full object-contain"
              autoPlay
              muted
              loop
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/50">
              {isVideo ? (
                <Video className="w-24 h-24 mb-4" />
              ) : (
                <FileText className="w-24 h-24 mb-4" />
              )}
              <p className="text-lg">{midia?.titulo || 'Sem conteúdo'}</p>
              <Badge variant="secondary" className="mt-2">
                {midia?.tipo}
              </Badge>
            </div>
          )}
        </div>

        {/* Bottom controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress bar */}
          <div className="mb-4">
            <Progress value={progress} className="h-1 bg-white/20" />
          </div>

          <div className="flex items-center justify-between">
            {/* Slide info */}
            <div className="text-white">
              <p className="font-medium truncate max-w-xs">{midia?.titulo}</p>
              <p className="text-white/70 text-sm">{currentDuration}s</p>
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={goToPrevious}
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 w-12 h-12"
                onClick={() => setIsPlaying(prev => !prev)}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={goToNext}
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="text-white/50 text-xs hidden md:block">
              <span className="mr-3">← → Navegar</span>
              <span className="mr-3">P Pausar</span>
              <span>F Fullscreen</span>
            </div>
          </div>

          {/* Thumbnails strip */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {recursos.map((recurso, index) => {
              const thumbMidia = recurso.midia;
              const thumbIsImage = thumbMidia?.tipo?.toLowerCase() === 'imagem' || thumbMidia?.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              
              return (
                <button
                  key={recurso.id}
                  onClick={() => {
                    setCurrentIndex(index);
                    setProgress(0);
                  }}
                  className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                    index === currentIndex 
                      ? 'border-primary ring-2 ring-primary/50' 
                      : 'border-white/20 hover:border-white/50'
                  }`}
                >
                  {thumbIsImage && thumbMidia?.url ? (
                    <img 
                      src={thumbMidia.url} 
                      alt={thumbMidia.titulo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-xs text-white/50">{index + 1}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
