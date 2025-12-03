import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const Telao = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const { data: comunicados = [] } = useQuery({
    queryKey: ["comunicados-telao"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("comunicados")
        .select("*")
        .eq("ativo", true)
        .eq("exibir_telao", true)
        .or(`data_inicio.is.null,data_inicio.lte.${now}`)
        .or(`data_fim.is.null,data_fim.gte.${now}`)
        .order("ordem_telao", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  const nextSlide = useCallback(() => {
    if (comunicados.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % comunicados.length);
    }
  }, [comunicados.length]);

  const prevSlide = useCallback(() => {
    if (comunicados.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + comunicados.length) % comunicados.length);
    }
  }, [comunicados.length]);

  // Auto-advance slideshow
  useEffect(() => {
    if (isPaused || comunicados.length <= 1) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 8000); // 8 seconds per slide

    return () => clearInterval(interval);
  }, [isPaused, comunicados.length, nextSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          nextSlide();
          break;
        case "ArrowLeft":
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide]);

  const currentItem = comunicados[currentIndex];

  if (comunicados.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white/30 text-2xl font-light">
          Nenhum conteúdo para exibir
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!currentItem) return null;

    const imageUrl = currentItem.url_arquivo_telao || currentItem.imagem_url;

    // Check if it's a video
    if (imageUrl && (imageUrl.includes(".mp4") || imageUrl.includes(".webm") || imageUrl.includes(".mov"))) {
      return (
        <video
          key={currentItem.id}
          src={imageUrl}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-contain"
        />
      );
    }

    // Image or text alert
    if (imageUrl) {
      return (
        <motion.img
          key={currentItem.id}
          src={imageUrl}
          alt={currentItem.titulo}
          className="w-full h-full object-contain"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8 }}
        />
      );
    }

    // Text-only alert
    return (
      <motion.div
        key={currentItem.id}
        className="flex flex-col items-center justify-center h-full p-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-6xl font-bold text-white mb-8 leading-tight">
          {currentItem.titulo}
        </h1>
        {currentItem.descricao && (
          <p className="text-3xl text-white/80 max-w-4xl leading-relaxed">
            {currentItem.descricao}
          </p>
        )}
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

      {/* Progress indicator */}
      {comunicados.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {comunicados.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? "bg-white w-8" 
                  : "bg-white/30"
              }`}
            />
          ))}
        </div>
      )}

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-4 right-4 text-white/50 text-sm">
          PAUSADO
        </div>
      )}
    </div>
  );
};

export default Telao;
