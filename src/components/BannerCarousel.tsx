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

export default function BannerCarousel() {
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
        .select("id, titulo, descricao, tipo, nivel_urgencia, imagem_url, created_at")
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
      <div className="w-full max-w-5xl mx-auto px-4">
        <Skeleton className="w-full h-[400px] rounded-lg" />
      </div>
    );
  }

  if (comunicados.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-2 md:px-4">
      <Carousel
        opts={{
          align: "center",
          loop: true,
          dragFree: false,
          containScroll: "trimSnaps",
          skipSnaps: false,
        }}
        plugins={[
          Autoplay({
            delay: 5000,
            stopOnInteraction: true,
            stopOnMouseEnter: true,
          }),
        ]}
        className="w-full touch-pan-y"
      >
        <CarouselContent>
          {comunicados.map((comunicado, index) => (
            <CarouselItem key={comunicado.id}>
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-0">
                  {comunicado.imagem_url ? (
                    <div className="relative">
                      <OptimizedImage
                        src={comunicado.imagem_url}
                        alt={comunicado.titulo}
                        aspectRatio="16/9"
                        priority={index === 0}
                        className="w-full h-[250px] md:h-[300px] object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 mb-2">
                          <h3 className="text-xl md:text-2xl font-bold text-foreground">
                            {comunicado.titulo}
                          </h3>
                          <Badge className={getUrgenciaColor(comunicado.nivel_urgencia) + " whitespace-nowrap"}>
                            {getUrgenciaLabel(comunicado.nivel_urgencia)}
                          </Badge>
                        </div>
                        {comunicado.descricao && (
                          <p className="text-sm md:text-base text-foreground/90 line-clamp-2 md:line-clamp-3">
                            {comunicado.descricao}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 md:p-6 min-h-[250px] md:min-h-[300px] flex flex-col justify-center bg-gradient-to-br from-secondary to-secondary/50">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 mb-4">
                        <h3 className="text-xl md:text-2xl font-bold text-foreground">
                          {comunicado.titulo}
                        </h3>
                        <Badge className={getUrgenciaColor(comunicado.nivel_urgencia) + " whitespace-nowrap"}>
                          {getUrgenciaLabel(comunicado.nivel_urgencia)}
                        </Badge>
                      </div>
                      {comunicado.descricao && (
                        <p className="text-sm md:text-base text-foreground/80 line-clamp-4 md:line-clamp-6">
                          {comunicado.descricao}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 md:left-4" />
        <CarouselNext className="right-2 md:right-4" />
      </Carousel>
    </div>
  );
}
