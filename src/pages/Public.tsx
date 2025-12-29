import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, BookOpen, LogIn, ChevronRight, Clock, MapPin, Users, ExternalLink } from "lucide-react";
import BannerCarousel from "@/components/BannerCarousel";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoCarvalho from "@/assets/logo-carvalho.png";
import { PublicHeader } from "@/components/layout/PublicHeader";

interface Evento {
  id: string;
  titulo: string;
  tipo: "CULTO" | "RELOGIO" | "TAREFA" | "EVENTO" | "OUTRO";
  data_evento: string;
  local: string | null;
  endereco: string | null;
  tema: string | null;
}

export default function Public() {
  const navigate = useNavigate();
  const [proximosCultos, setProximosCultos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProximosCultos();
  }, []);

  const fetchProximosCultos = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("eventos")
        .select("id, titulo, tipo, data_evento, local, endereco, tema")
        .gte("data_evento", now)
        .eq("status", "confirmado")
        .order("data_evento", { ascending: true })
        .limit(4);

      if (error) throw error;

      const normalized: Evento[] = (data || []).map((d: Record<string, unknown>) => ({
        id: String(d.id),
        titulo: String(d.titulo || ''),
        data_evento: String(d.data_evento || ''),
        local: d.local as string | null,
        endereco: d.endereco as string | null,
        tema: d.tema as string | null,
        tipo: (d.tipo as string) as Evento["tipo"],
      }));

      setProximosCultos(normalized);
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
    return format(date, "dd 'de' MMMM", { locale: ptBR });
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
      case "culto_domingo": return "Evento Dominical";
      case "culto_semana": return "Evento de Semana";
      case "evento_especial": return "Evento Especial";
      case "celebracao": return "Celebração";
      default: return tipo;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/20">
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="container mx-auto px-4 py-12 md:py-16 relative">
          <div className="text-center max-w-2xl mx-auto">
            <div className="mb-6 animate-fade-in">
              <img 
                src={logoCarvalho} 
                alt="Igreja Carvalho" 
                className="h-24 md:h-32 w-auto mx-auto drop-shadow-lg"
              />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Bem-vindo à <span className="text-primary">Igreja Carvalho</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              Um lugar de fé, comunhão e propósito. Venha fazer parte da nossa família!
            </p>
          </div>
        </div>
      </section>

      {/* Banner Carousel */}
      <section className="pb-8">
        <BannerCarousel />
      </section>

      {/* Quick Actions */}
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent/50 border-border/50 shadow-sm hover:shadow-md transition-all"
            onClick={() => navigate("/agenda")}
          >
            <Calendar className="w-6 h-6 text-primary" />
            <span className="font-medium">Agenda</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent/50 border-border/50 shadow-sm hover:shadow-md transition-all"
            onClick={() => navigate("/announcements")}
          >
            <Users className="w-6 h-6 text-primary" />
            <span className="font-medium">Anúncios</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent/50 border-border/50 shadow-sm hover:shadow-md transition-all"
            onClick={() => navigate("/biblia")}
          >
            <BookOpen className="w-6 h-6 text-primary" />
            <span className="font-medium">Bíblia</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 bg-card hover:bg-accent/50 border-border/50 shadow-sm hover:shadow-md transition-all"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-6 h-6 text-primary" />
            <span className="font-medium">Área do Membro</span>
          </Button>
        </div>
      </section>

      {/* Próximos Cultos */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Próximos Cultos</h2>
            <p className="text-muted-foreground text-sm">Venha celebrar conosco</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/agenda")} className="text-primary">
            Ver todos
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                  <div className="h-6 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : proximosCultos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proximosCultos.map((culto, index) => (
              <Card 
                key={culto.id} 
                className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${getTipoColor(culto.tipo)}`}>
                        {getTipoLabel(culto.tipo)}
                      </span>
                      <h3 className="font-semibold text-foreground text-lg truncate">
                        {culto.titulo}
                      </h3>
                      {culto.tema && (
                        <p className="text-muted-foreground text-sm truncate mt-1">
                          {culto.tema}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-primary font-bold text-lg">
                        {formatCultoDate(culto.data_evento)}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-muted-foreground text-sm">
                        <Clock className="w-3 h-3" />
                        {formatCultoTime(culto.data_evento)}
                      </div>
                    </div>
                  </div>
                  {(culto.local || culto.endereco) && (
                    <a
                      href={getGoogleMapsUrl(culto.endereco, culto.local)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm mt-3 pt-3 border-t border-border/50 hover:text-primary transition-colors group"
                    >
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <span className="flex flex-col min-w-0 flex-1">
                        {culto.local && (
                          <span className="font-medium text-foreground/80 truncate">{culto.local}</span>
                        )}
                        {culto.endereco && (
                          <span className="text-xs text-muted-foreground truncate">{culto.endereco}</span>
                        )}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum culto agendado no momento</p>
              <p className="text-sm text-muted-foreground mt-1">Em breve novos eventos serão adicionados</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Bíblia CTA */}
      <section className="container mx-auto px-4 py-8">
        <Card 
          className="overflow-hidden bg-gradient-to-br from-primary/10 via-card to-accent/10 border-primary/20 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => navigate("/biblia")}
        >
          <CardContent className="p-6 md:p-8 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-foreground mb-1">Leia a Palavra</h3>
              <p className="text-muted-foreground text-sm">
                Acesse a Bíblia online e fortaleça sua fé através da Palavra de Deus
              </p>
            </div>
            <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </section>

      {/* Seja um Membro CTA */}
      <section className="container mx-auto px-4 py-8 pb-16">
        <Card className="bg-card border-border/50 overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="text-center max-w-md mx-auto">
              <h3 className="text-2xl font-bold text-foreground mb-3">Faça parte da nossa família</h3>
              <p className="text-muted-foreground mb-6">
                Como membro, você terá acesso a recursos exclusivos, poderá participar de grupos e muito mais.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={() => navigate("/auth")}
                  className="bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Criar minha conta
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate("/auth")}
                  size="lg"
                >
                  Já tenho conta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border/50 py-6">
        <div className="container mx-auto px-4 text-center">
          <img src={logoCarvalho} alt="Igreja Carvalho" className="h-8 w-auto mx-auto mb-3 opacity-60" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Igreja Carvalho. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
