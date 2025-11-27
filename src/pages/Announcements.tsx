import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar } from "lucide-react";
import { format } from "date-fns";

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

  const getBannerTypeColor = (type: string) => {
    switch (type) {
      case "info":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "warning":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "urgent":
        return "bg-red-500/10 text-red-600 border-red-200";
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-200";
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando anúncios...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bell className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Anúncios</h1>
          </div>
          <p className="text-muted-foreground">
            Fique por dentro das últimas novidades e comunicados
          </p>
        </div>

        {banners.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Não há anúncios ativos no momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {banners.map((banner) => (
              <Card key={banner.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {banner.image_url && (
                  <div className="w-full h-48 overflow-hidden bg-muted">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-2xl">{banner.title}</CardTitle>
                    <Badge className={getBannerTypeColor(banner.type)}>
                      {getBannerTypeLabel(banner.type)}
                    </Badge>
                  </div>
                  {banner.created_at && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(banner.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {banner.message}
                  </p>
                  {banner.expires_at && (
                    <p className="text-sm text-muted-foreground mt-4 border-t pt-4">
                      Válido até: {format(new Date(banner.expires_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Announcements;
