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
import Autoplay from "embla-carousel-autoplay";

interface Banner {
  id: string;
  title: string;
  message: string;
  type: string;
  image_url: string | null;
}

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestBanners();
  }, []);

  const fetchLatestBanners = async () => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("banners")
        .select("id, title, message, type, image_url")
        .eq("active", true)
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBannerTypeColor = (type: string) => {
    switch (type) {
      case "info":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "warning":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "urgent":
        return "bg-red-500/10 text-red-600 border-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getBannerTypeLabel = (type: string) => {
    switch (type) {
      case "info":
        return "Informação";
      case "warning":
        return "Atenção";
      case "urgent":
        return "Urgente";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4">
        <Skeleton className="w-full h-[400px] rounded-lg" />
      </div>
    );
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[
          Autoplay({
            delay: 5000,
          }),
        ]}
        className="w-full"
      >
        <CarouselContent>
          {banners.map((banner) => (
            <CarouselItem key={banner.id}>
              <Card className="border-0 shadow-lg overflow-hidden">
                <CardContent className="p-0">
                  {banner.image_url ? (
                    <div className="relative">
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        className="w-full h-[300px] object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h3 className="text-2xl font-bold text-foreground">
                            {banner.title}
                          </h3>
                          <Badge className={getBannerTypeColor(banner.type)}>
                            {getBannerTypeLabel(banner.type)}
                          </Badge>
                        </div>
                        <p className="text-foreground/90 line-clamp-3">
                          {banner.message}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 min-h-[300px] flex flex-col justify-center bg-gradient-to-br from-secondary to-secondary/50">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h3 className="text-2xl font-bold text-foreground">
                          {banner.title}
                        </h3>
                        <Badge className={getBannerTypeColor(banner.type)}>
                          {getBannerTypeLabel(banner.type)}
                        </Badge>
                      </div>
                      <p className="text-foreground/80 line-clamp-6">
                        {banner.message}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4" />
        <CarouselNext className="right-4" />
      </Carousel>
    </div>
  );
}
