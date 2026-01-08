import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";
import Autoplay from "embla-carousel-autoplay";

interface Comunicado {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  nivel_urgencia: string | null;
  imagem_url: string | null;
  created_at: string | null;
}

interface BannerCarouselProps {
  compact?: boolean; // Nova prop para forçar modo compacto em dashboards se necessário
}

export default function BannerCarousel({
  compact = false,
}: BannerCarouselProps) {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComunicados();
  }, []);

  const fetchComunicados = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("comunicados")
        .select(
          "id, titulo, descricao, tipo, nivel_urgencia, imagem_url, created_at"
        )
        .eq("ativo", true)
        .eq("exibir_site", true)
        .eq("tipo", "banner")
        .or(`data_inicio.is.null,data_inicio.lte.${now}`)
        .or(`data_fim.is.null,data_fim.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setComunicados(data || []);
    } catch (error) {
      console.error("Error fetching comunicados:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgenciaColor = (nivel: string | null) => {
    switch (nivel) {
      case "info":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "warning":
        return "bg-amber-500/10 text-amber-600 border-amber-200";
      case "urgent":
        return "bg-red-500/10 text-red-600 border-red-200";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  const getUrgenciaLabel = (nivel: string | null) => {
    switch (nivel) {
      case "info":
        return "Informação";
      case "warning":
        return "Atenção";
      case "urgent":
        return "Urgente";
      default:
        return "Aviso";
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4">
        <Skeleton className="w-full h-[250px] md:h-[400px] rounded-xl" />
      </div>
    );
  }

  if (comunicados.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-0 md:px-4">
      <Carousel
        opts={{ align: "center", loop: true }}
        plugins={[Autoplay({ delay: 6000, stopOnInteraction: true })]}
        className="w-full"
      >
        <CarouselContent>
          {comunicados.map((comunicado, index) => (
            <CarouselItem key={comunicado.id}>
              <Card className="border-0 shadow-lg overflow-hidden bg-black md:rounded-xl rounded-none">
                <CardContent className="p-0 relative">
                  {comunicado.imagem_url ? (
                    <div
                      className={`relative w-full bg-black/90 flex items-center justify-center 
                      ${
                        compact
                          ? "h-[200px] md:h-[300px]"
                          : "aspect-video md:aspect-auto md:h-[450px]"
                      } 
                    `}
                    >
                      {/* LÓGICA CORRIGIDA:
                         - Mobile: aspect-video (16:9)
                         - Desktop: Altura fixa (450px) para não ficar gigante, 
                           com object-contain para mostrar TUDO sem cortar.
                      */}
                      <OptimizedImage
                        src={comunicado.imagem_url}
                        alt={comunicado.titulo}
                        priority={index === 0}
                        className="w-full h-full object-contain"
                      />

                      {/* Gradiente para leitura do texto */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none" />

                      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 text-white z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <h3 className="text-lg md:text-2xl font-bold leading-tight drop-shadow-md line-clamp-1">
                            {comunicado.titulo}
                          </h3>
                          {comunicado.nivel_urgencia && (
                            <Badge
                              className={`${getUrgenciaColor(
                                comunicado.nivel_urgencia
                              )} border-0 bg-white/95 backdrop-blur-sm self-start shadow-sm`}
                            >
                              {getUrgenciaLabel(comunicado.nivel_urgencia)}
                            </Badge>
                          )}
                        </div>
                        {comunicado.descricao && !compact && (
                          <p className="text-sm md:text-base text-gray-200 line-clamp-2 drop-shadow-md hidden md:block max-w-3xl">
                            {comunicado.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Fallback sem imagem */
                    <div
                      className={`${
                        compact ? "h-[200px]" : "h-[250px] md:h-[400px]"
                      } flex flex-col justify-center p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white`}
                    >
                      <div className="flex flex-col gap-3 max-w-2xl mx-auto text-center items-center">
                        <Badge className="bg-white/20 text-white hover:bg-white/30 border-0 mb-2">
                          {getUrgenciaLabel(comunicado.nivel_urgencia)}
                        </Badge>
                        <h3 className="text-2xl md:text-4xl font-bold">
                          {comunicado.titulo}
                        </h3>
                        {comunicado.descricao && (
                          <p className="text-base md:text-lg text-slate-300 line-clamp-3">
                            {comunicado.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4 bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm hidden md:flex" />
        <CarouselNext className="right-4 bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm hidden md:flex" />
      </Carousel>
    </div>
  );
}
