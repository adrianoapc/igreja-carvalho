import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Midia {
  id: string;
  titulo: string;
  tipo: string;
  url: string;
}

interface Recurso {
  id: string;
  ordem: number;
  duracao_segundos: number;
  midia: Midia;
  liturgia_titulo: string;
  liturgia_tipo: string;
}

interface LiturgiaItem {
  id: string;
  ordem: number;
  titulo: string;
  tipo: string;
}

type ScreenMode = 'content' | 'black' | 'clear';

const TelaoLiturgia = () => {
  const { id: cultoId } = useParams<{ id: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [screenMode, setScreenMode] = useState<ScreenMode>('content');

  // Fetch culto info
  const { data: culto } = useQuery({
    queryKey: ["telao-culto", cultoId],
    queryFn: async () => {
      if (!cultoId) return null;
      const { data, error } = await supabase
        .from("cultos")
        .select("titulo, data_culto")
        .eq("id", cultoId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!cultoId,
  });

  // Fetch liturgia items and their recursos
  const { data: liturgiaItems = [], refetch: refetchLiturgia } = useQuery({
    queryKey: ["telao-liturgia", cultoId],
    queryFn: async () => {
      if (!cultoId) return [];
      const { data, error } = await supabase
        .from("liturgia_culto")
        .select("id, ordem, titulo, tipo")
        .eq("culto_id", cultoId)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return (data || []) as LiturgiaItem[];
    },
    enabled: !!cultoId,
  });

  // Fetch all recursos for the liturgia items
  const { data: allRecursos = [], refetch: refetchRecursos } = useQuery({
    queryKey: ["telao-recursos", cultoId, liturgiaItems.map(l => l.id).join(',')],
    queryFn: async () => {
      if (!cultoId || liturgiaItems.length === 0) return [];
      
      const liturgiaIds = liturgiaItems.map(l => l.id);
      const { data, error } = await supabase
        .from("liturgia_recursos")
        .select(`
          id,
          ordem,
          duracao_segundos,
          liturgia_item_id,
          midias(id, titulo, tipo, url)
        `)
        .in("liturgia_item_id", liturgiaIds)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!cultoId && liturgiaItems.length > 0,
  });

  // Flatten into linear playlist
  const playlist = useMemo(() => {
    const result: Recurso[] = [];
    
    for (const liturgiaItem of liturgiaItems) {
      const itemRecursos = allRecursos
        .filter(r => r.liturgia_item_id === liturgiaItem.id && r.midias)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      
      for (const recurso of itemRecursos) {
        result.push({
          id: recurso.id,
          ordem: recurso.ordem || 0,
          duracao_segundos: recurso.duracao_segundos || 10,
          midia: recurso.midias as Midia,
          liturgia_titulo: liturgiaItem.titulo,
          liturgia_tipo: liturgiaItem.tipo,
        });
      }
    }
    
    return result;
  }, [liturgiaItems, allRecursos]);

  const currentRecurso = playlist[currentIndex];
  const currentDuration = currentRecurso?.duracao_segundos || 10;

  // Realtime subscription
  useEffect(() => {
    if (!cultoId) return;

    const channel = supabase
      .channel('telao-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'liturgia_recursos',
        },
        () => {
          refetchRecursos();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'liturgia_culto',
          filter: `culto_id=eq.${cultoId}`,
        },
        () => {
          refetchLiturgia();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cultoId, refetchLiturgia, refetchRecursos]);

  const nextSlide = useCallback(() => {
    if (playlist.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
      setProgress(0);
    }
  }, [playlist.length]);

  const prevSlide = useCallback(() => {
    if (playlist.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
      setProgress(0);
    }
  }, [playlist.length]);

  // Auto-advance slideshow
  useEffect(() => {
    if (isPaused || playlist.length === 0 || screenMode !== 'content') return;
    if (currentDuration <= 0) return; // No auto-advance if duration is 0

    const intervalMs = 100;
    const incrementPerInterval = 100 / (currentDuration * 10);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + incrementPerInterval;
        if (newProgress >= 100) {
          nextSlide();
          return 0;
        }
        return newProgress;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPaused, playlist.length, currentDuration, nextSlide, screenMode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          if (screenMode === 'content') {
            nextSlide();
          } else {
            setScreenMode('content');
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (screenMode === 'content') {
            prevSlide();
          } else {
            setScreenMode('content');
          }
          break;
        case "p":
        case "P":
          setIsPaused((prev) => !prev);
          break;
        case "b":
        case "B":
          setScreenMode((prev) => prev === 'black' ? 'content' : 'black');
          break;
        case "c":
        case "C":
          setScreenMode((prev) => prev === 'clear' ? 'content' : 'clear');
          break;
        case "f":
        case "F":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, screenMode]);

  // Black screen mode
  if (screenMode === 'black') {
    return (
      <div className="fixed inset-0 bg-black cursor-none select-none" />
    );
  }

  // Clear screen mode (logo/neutral)
  if (screenMode === 'clear') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center cursor-none select-none">
        <div className="text-white/10 text-4xl font-light tracking-widest">
          {culto?.titulo || "CULTO"}
        </div>
      </div>
    );
  }

  if (!cultoId) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white/30 text-2xl font-light">
          ID do culto não informado
        </div>
      </div>
    );
  }

  if (playlist.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white/30 text-2xl font-light mb-2">
            Nenhum recurso para exibir
          </div>
          {culto?.titulo && (
            <div className="text-white/20 text-lg">
              {culto.titulo}
            </div>
          )}
        </div>
      </div>
    );
  }

  const midia = currentRecurso?.midia;
  const isVideo = midia?.tipo?.toLowerCase() === 'vídeo' || 
    midia?.url?.match(/\.(mp4|webm|ogg|mov)$/i);
  const isImage = midia?.tipo?.toLowerCase() === 'imagem' || 
    midia?.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  const renderContent = () => {
    if (!midia) return null;

    if (isVideo) {
      return (
        <video
          key={currentRecurso.id}
          src={midia.url}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-contain"
        />
      );
    }

    if (isImage) {
      return (
        <motion.img
          key={currentRecurso.id}
          src={midia.url}
          alt={midia.titulo}
          className="w-full h-full object-contain"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.6 }}
        />
      );
    }

    // Fallback for other types
    return (
      <motion.div
        key={currentRecurso.id}
        className="flex flex-col items-center justify-center h-full p-16 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-5xl font-bold text-white mb-4">
          {midia.titulo}
        </h1>
        <p className="text-xl text-white/60">
          {midia.tipo}
        </p>
      </motion.div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black cursor-none select-none"
      onClick={nextSlide}
    >
      <AnimatePresence mode="wait">
        {renderContent()}
      </AnimatePresence>

      {/* Progress bar */}
      {currentDuration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-white/50 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Slide indicators */}
      {playlist.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {playlist.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
                setProgress(0);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? "bg-white w-8" 
                  : "bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      )}

      {/* Info overlay (subtle) */}
      <div className="absolute top-4 left-4 text-white/30 text-sm pointer-events-none">
        <div>{currentIndex + 1}/{playlist.length}</div>
        <div className="text-xs text-white/20 mt-1">{currentRecurso?.liturgia_titulo}</div>
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-4 right-4 flex items-center gap-2 text-white/50 text-sm">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          PAUSADO
        </div>
      )}

      {/* Controls hint (fades after 3s) */}
      <div className="absolute bottom-12 right-4 text-white/20 text-xs pointer-events-none">
        F: Fullscreen • P: Pausar • B: Black • C: Clear • ←→: Navegar
      </div>
    </div>
  );
};

export default TelaoLiturgia;
