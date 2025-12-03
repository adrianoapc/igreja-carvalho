import { useState, useEffect, useCallback } from "react";
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
}

const TelaoLiturgia = () => {
  const { id } = useParams<{ id: string }>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: itemLiturgia } = useQuery({
    queryKey: ["liturgia-item", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("liturgia_culto")
        .select("titulo, culto_id")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: recursos = [] } = useQuery({
    queryKey: ["liturgia-recursos-telao", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("liturgia_recursos")
        .select(`
          id,
          ordem,
          duracao_segundos,
          midia:midias(id, titulo, tipo, url)
        `)
        .eq("liturgia_item_id", id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return (data || []).filter(r => r.midia) as Recurso[];
    },
    enabled: !!id,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const currentRecurso = recursos[currentIndex];
  const currentDuration = currentRecurso?.duracao_segundos || 10;

  const nextSlide = useCallback(() => {
    if (recursos.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % recursos.length);
      setProgress(0);
    }
  }, [recursos.length]);

  const prevSlide = useCallback(() => {
    if (recursos.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + recursos.length) % recursos.length);
      setProgress(0);
    }
  }, [recursos.length]);

  // Auto-advance slideshow with individual durations
  useEffect(() => {
    if (isPaused || recursos.length === 0) return;

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
  }, [isPaused, recursos.length, currentDuration, nextSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevSlide();
          break;
        case "p":
        case "P":
          setIsPaused((prev) => !prev);
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
  }, [nextSlide, prevSlide]);

  if (!id) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white/30 text-2xl font-light">
          ID do item não informado
        </div>
      </div>
    );
  }

  if (recursos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white/30 text-2xl font-light mb-2">
            Nenhum recurso para exibir
          </div>
          {itemLiturgia?.titulo && (
            <div className="text-white/20 text-lg">
              {itemLiturgia.titulo}
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
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div 
          className="h-full bg-white/50 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Slide indicators */}
      {recursos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {recursos.map((_, index) => (
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
        {currentIndex + 1}/{recursos.length}
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
        F: Fullscreen • P: Pausar • ←→: Navegar
      </div>
    </div>
  );
};

export default TelaoLiturgia;
