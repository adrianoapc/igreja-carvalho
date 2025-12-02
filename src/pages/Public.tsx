import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, BookOpen, Bell, ChevronRight, Clock, MapPin, ExternalLink } from "lucide-react";
import BannerCarousel from "@/components/BannerCarousel";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoCarvalho from "@/assets/logo-carvalho.png";

interface Culto {
  id: string;
  titulo: string;
  tipo: string;
  data_culto: string;
  local: string | null;
  endereco: string | null;
  tema: string | null;
}

export default function Public() {
  const navigate = useNavigate();
  const [proximosCultos, setProximosCultos] = useState<Culto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProximosCultos();
  }, []);

  const fetchProximosCultos = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("cultos")
        .select("id, titulo, tipo, data_culto, local, endereco, tema")
        .gte("data_culto", now)
        .eq("status", "confirmado")
        .order("data_culto", { ascending: true })
        .limit(3);

      if (error) throw error;
      setProximosCultos(data || []);
    } catch (error) {
      console.error("Error fetching cultos:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGoogleMapsUrl = (endereco: string | null, local: string | null) => {
    const searchQuery = endereco || local || "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  };

  const formatCultoDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    if (isThisWeek(date)) return format(date, "EEEE", { locale: ptBR });
    return format(date, "dd/MM", { locale: ptBR });
  };

  const formatCultoTime = (dateString: string) => {
    return format(parseISO(dateString), "HH:mm");
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case "culto_domingo": return "bg-primary/10 text-primary";
      case "culto_semana": return "bg-accent text-accent-foreground";
      case "evento_especial": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "culto_domingo": return "Dominical";
      case "culto_semana": return "Semana";
      case "evento_especial": return "Especial";
      case "celebracao": return "Celebração";
      default: return tipo;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header Compacto */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoCarvalho} alt="Igreja Carvalho" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <h1 className="font-semibold text-foreground leading-tight">Igreja Carvalho</h1>
              <p className="text-xs text-muted-foreground">Fé, comunhão e propósito</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/install")}>
              Instalar
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
          </div>
        </div>
      </header>

      {/* Banner Carousel - Destaque Principal */}
      <section className="py-4">
        <BannerCarousel />
      </section>

      {/* Quick Actions - Navegação Principal */}
      <section className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent/50 border-border/50 shadow-sm hover:shadow-md transition-all"
            onClick={() => navigate("/agenda")}
          >
            <Calendar className="w-6 h-6 text-primary" />
            <span className="font-medium text-sm">Agenda</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent/50 border-border/50 shadow-sm hover:shadow-md transition-all"
            onClick={() => navigate("/announcements")}
          >
            <Bell className="w-6 h-6 text-primary" />
            <span className="font-medium text-sm">Anúncios</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent/50 border-border/50 shadow-sm hover:shadow-md transition-all"
            onClick={() => navigate("/biblia")}
          >
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="font-medium text-sm">Bíblia</span>
          </Button>
        </div>
      </section>

      {/* Próximos Cultos */}
      <section className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Próximos Cultos</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/agenda")} className="text-primary text-sm">
            Ver todos
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-5 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : proximosCultos.length > 0 ? (
          <div className="space-y-3">
            {proximosCultos.map((culto, index) => (
              <Card 
                key={culto.id} 
                className="overflow-hidden hover:shadow-md transition-all duration-300 border-border/50 animate-fade-in cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate("/agenda")}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Data destacada */}
                    <div className="text-center min-w-[60px]">
                      <p className="text-primary font-bold text-lg leading-tight">
                        {formatCultoDate(culto.data_culto)}
                      </p>
                      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                        <Clock className="w-3 h-3" />
                        {formatCultoTime(culto.data_culto)}
                      </div>
                    </div>
                    
                    {/* Divisor */}
                    <div className="w-px h-12 bg-border/50" />
                    
                    {/* Info do culto */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getTipoColor(culto.tipo)}`}>
                          {getTipoLabel(culto.tipo)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground truncate">
                        {culto.titulo}
                      </h3>
                      {culto.local && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{culto.local}</span>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-6 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground text-sm">Nenhum culto agendado</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Footer Minimalista */}
      <footer className="mt-auto py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Igreja Carvalho
          </p>
        </div>
      </footer>
    </div>
  );
}
