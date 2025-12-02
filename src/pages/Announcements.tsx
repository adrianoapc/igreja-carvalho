import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, Clock, AlertTriangle, Info, AlertCircle, Megaphone } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";

interface Banner {
  id: string;
  title: string;
  message: string;
  type: string;
  image_url: string | null;
  created_at: string | null;
  scheduled_at: string | null;
  expires_at: string | null;
}

const Announcements = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBanners();
  }, []);

  const fetchActiveBanners = async () => {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("active", true)
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBannerTypeConfig = (type: string) => {
    switch (type) {
      case "info":
        return {
          color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400",
          icon: Info,
          label: "Informação",
          accent: "border-l-blue-500"
        };
      case "warning":
        return {
          color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400",
          icon: AlertTriangle,
          label: "Atenção",
          accent: "border-l-amber-500"
        };
      case "urgent":
        return {
          color: "bg-red-500/10 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400",
          icon: AlertCircle,
          label: "Urgente",
          accent: "border-l-red-500"
        };
      default:
        return {
          color: "bg-primary/10 text-primary border-primary/20",
          icon: Bell,
          label: "Aviso",
          accent: "border-l-primary"
        };
    }
  };

  const getTimeAgo = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <PublicHeader showBackButton title="Anúncios" subtitle="Fique por dentro das novidades" />

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header com contador */}
        {!loading && banners.length > 0 && (
          <div className="flex items-center gap-2 mb-6 animate-fade-in">
            <div className="p-2 rounded-full bg-primary/10">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">
              {banners.length} {banners.length === 1 ? 'anúncio ativo' : 'anúncios ativos'}
            </span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                  <Skeleton className="h-20 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : banners.length === 0 ? (
          <Card className="text-center py-16 border-dashed bg-card/50 backdrop-blur-sm animate-fade-in">
            <CardContent className="space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                <Bell className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground mb-1">Nenhum anúncio</h3>
                <p className="text-muted-foreground text-sm">
                  Não há anúncios ativos no momento.<br />
                  Volte mais tarde para novidades!
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {banners.map((banner, index) => {
              const config = getBannerTypeConfig(banner.type);
              const TypeIcon = config.icon;
              
              return (
                <Card 
                  key={banner.id} 
                  className={`overflow-hidden border-l-4 ${config.accent} hover:shadow-lg transition-all duration-300 animate-fade-in bg-card/80 backdrop-blur-sm`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Imagem do banner */}
                  {banner.image_url && (
                    <div className="relative w-full aspect-video overflow-hidden bg-muted">
                      <OptimizedImage
                        src={banner.image_url}
                        alt={banner.title}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <Badge className={`absolute top-3 right-3 ${config.color}`}>
                        <TypeIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-4">
                    {/* Header do card */}
                    <div className="flex items-start gap-3 mb-3">
                      {!banner.image_url && (
                        <div className={`p-2.5 rounded-full ${config.color} flex-shrink-0`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-base md:text-lg text-foreground leading-tight">
                            {banner.title}
                          </h3>
                          {!banner.image_url && (
                            <Badge variant="outline" className={`${config.color} flex-shrink-0 text-xs`}>
                              {config.label}
                            </Badge>
                          )}
                        </div>
                        {banner.created_at && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{getTimeAgo(banner.created_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mensagem */}
                    <p className="text-sm md:text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {banner.message}
                    </p>

                    {/* Footer com validade */}
                    {banner.expires_at && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          Válido até {format(new Date(banner.expires_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Announcements;
