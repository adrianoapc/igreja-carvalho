import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { QRCodeSVG } from "qrcode.react";
import {
  DollarSign,
  HeartHandshake,
  Play,
  Calendar,
  BookOpen,
  ExternalLink,
  Heart,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Autoplay from "embla-carousel-autoplay";
import { OptimizedImage } from "@/components/OptimizedImage";
import MinhasTarefasWidget from "@/components/dashboard/MinhasTarefasWidget";
import RegistrarSentimentoDialog from "@/components/sentimentos/RegistrarSentimentoDialog";
import { WelcomeHeader } from "./WelcomeHeader";

interface Banner {
  id: string;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  link_acao: string | null;
}

export default function DashboardMember() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const firstName = profile?.nome?.split(" ")[0] || "Membro";
  const [banners, setBanners] = useState<Banner[]>([]);
  const [sentimentoDialogOpen, setSentimentoDialogOpen] = useState(false);
  const [alreadyRegisteredToday, setAlreadyRegisteredToday] = useState(false);

  useEffect(() => {
    fetchBanners();
    checkTodaySentimento();
  }, [profile?.id]);

  useEffect(() => {
    if (searchParams.get("sentimento") === "true") {
      setSentimentoDialogOpen(true);
      searchParams.delete("sentimento");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const checkTodaySentimento = async () => {
    if (!profile?.id) return;
    
    const today = new Date();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();

    const { data } = await supabase
      .from("sentimentos_membros")
      .select("id")
      .eq("pessoa_id", profile.id)
      .gte("data_registro", dayStart)
      .lte("data_registro", dayEnd)
      .limit(1);

    setAlreadyRegisteredToday(!!data && data.length > 0);
  };

  const fetchBanners = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("comunicados")
      .select("id, titulo, descricao, imagem_url, link_acao")
      .eq("ativo", true)
      .eq("exibir_app", true)
      .eq("tipo", "banner")
      .lte("data_inicio", now)
      .or(`data_fim.is.null,data_fim.gte.${now}`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setBanners(data as Banner[]);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  };

  const handleBannerClick = (banner: Banner) => {
    if (banner.link_acao) {
      window.open(banner.link_acao, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Personal Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
            <WelcomeHeader /> 
        {/* 
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Olá, {firstName}!</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>  */}
        </div>
        {!alreadyRegisteredToday && (
          <Button
            onClick={() => setSentimentoDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
          >
            <Heart className="w-4 h-4" />
            <span>Como você está?</span>
          </Button>
        )}
      </div>

      <RegistrarSentimentoDialog 
        open={sentimentoDialogOpen} 
        onOpenChange={(open) => {
          setSentimentoDialogOpen(open);
          if (!open) checkTodaySentimento(); // Atualiza estado ao fechar
        }} 
      />

      {/* Banners Carousel */}
      {banners.length > 0 && (
        <div>
          <Carousel opts={{ loop: true }} plugins={[Autoplay({ delay: 4000 })]}>
            <CarouselContent>
              {banners.map((banner) => (
                <CarouselItem key={banner.id}>
                  <Card>
                    {banner.imagem_url ? (
                      <div className="relative w-full bg-black">
                        <button
                          type="button"
                          onClick={() => handleBannerClick(banner)}
                          className="w-full"
                          aria-label={banner.titulo}
                        >
                          <OptimizedImage
                            src={banner.imagem_url}
                            alt={banner.titulo}
                            className="w-full h-auto max-h-[400px] md:max-h-[500px]"
                            fit="contain"
                          />
                        </button>
                        <div className="p-3">
                          <button
                            type="button"
                            onClick={() => handleBannerClick(banner)}
                            className="inline-block px-3 py-1 rounded-full bg-card/90 border border-border text-sm font-medium hover:scale-105 transition-transform"
                          >
                            {banner.titulo}
                          </button>
                        </div>
                        {banner.link_acao && (
                          <div className="flex items-center gap-1 mt-2 text-white/80 text-xs p-3">
                            <ExternalLink className="w-3 h-3" />
                            <span>Clique para saber mais</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <CardContent className="p-4 aspect-[16/9] flex flex-col justify-center bg-gradient-to-r from-primary/10 to-primary/5">
                        <h3 className="text-lg font-bold text-foreground">{banner.titulo}</h3>
                        {banner.descricao && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{banner.descricao}</p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            {banners.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        </div>
      )}

      {/* Carteirinha de Membro */}
      <Card className="shadow-soft bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4 flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/30">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-lg bg-primary/20 text-primary">{getInitials(profile?.nome || "")}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{profile?.nome}</p>
            <p className="text-sm text-muted-foreground capitalize">{profile?.status}</p>
          </div>
          <div className="p-1.5 bg-white rounded-lg border">
            <QRCodeSVG value={`checkin:${profile?.id || ""}`} size={52} level="M" includeMargin={false} />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
          onClick={() => {
            /* TODO: Implement Pix */
          }}
        >
          <DollarSign className="w-6 h-6 text-emerald-600" />
          <span className="text-xs">Contribuições (Pix)</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/30"
          onClick={() => navigate("/intercessao/pedidos?novo=true")}
        >
          <HeartHandshake className="w-6 h-6 text-blue-600" />
          <span className="text-xs">Pedido de Oração</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
          onClick={() => {
            /* TODO: Implement Live */
          }}
        >
          <Play className="w-6 h-6 text-red-600" />
          <span className="text-xs">Culto Ao Vivo</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex flex-col gap-2 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/30"
          onClick={() => navigate("/agenda")}
        >
          <Calendar className="w-6 h-6 text-purple-600" />
          <span className="text-xs">Agenda</span>
        </Button>
      </div>

      {/* Bíblia Access */}
      <Card className="shadow-soft cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/biblia")}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <BookOpen className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Bíblia Sagrada</p>
            <p className="text-sm text-muted-foreground">Leia e medite na Palavra</p>
          </div>
        </CardContent>
      </Card>

      {/* Minhas Tarefas Widget */}
      <MinhasTarefasWidget />
    </div>
  );
}
