import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Heart, Award, Frown, Smile, Meh, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  pessoaId: string;
}

interface TimelineItem {
  id: string;
  type: "pedido" | "sentimento" | "testemunho";
  date: string;
  title: string;
  description: string;
  status?: string;
  sentiment?: string;
}

export function VidaIgrejaIntercessao({ pessoaId }: Props) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [pessoaId]);

  const loadData = async () => {
    try {
      const items: TimelineItem[] = [];

      // Buscar pedidos de oração
      const { data: pedidosData } = await supabase
        .from("pedidos_oracao")
        .select("id, pedido, status, tipo, created_at")
        .eq("pessoa_id", pessoaId)
        .order("created_at", { ascending: false })
        .limit(20);

      pedidosData?.forEach(p => {
        items.push({
          id: `pedido-${p.id}`,
          type: "pedido",
          date: p.created_at || "",
          title: `Pedido de Oração (${p.tipo})`,
          description: p.pedido.substring(0, 100) + (p.pedido.length > 100 ? "..." : ""),
          status: p.status,
        });
      });

      // Buscar sentimentos
      const { data: sentimentosData } = await supabase
        .from("sentimentos_membros")
        .select("id, sentimento, mensagem, data_registro")
        .eq("pessoa_id", pessoaId)
        .order("data_registro", { ascending: false })
        .limit(20);

      sentimentosData?.forEach(s => {
        items.push({
          id: `sentimento-${s.id}`,
          type: "sentimento",
          date: s.data_registro,
          title: "Registro de Sentimento",
          description: s.mensagem || "",
          sentiment: s.sentimento,
        });
      });

      // Buscar testemunhos
      const { data: testemunhosData } = await supabase
        .from("testemunhos")
        .select("id, titulo, mensagem, status, created_at")
        .or(`autor_id.eq.${pessoaId},pessoa_id.eq.${pessoaId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      testemunhosData?.forEach(t => {
        items.push({
          id: `testemunho-${t.id}`,
          type: "testemunho",
          date: t.created_at,
          title: t.titulo,
          description: t.mensagem.substring(0, 100) + (t.mensagem.length > 100 ? "..." : ""),
          status: t.status,
        });
      });

      // Ordenar por data
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTimeline(items);
    } catch (error) {
      console.error("Erro ao carregar timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (item: TimelineItem) => {
    if (item.type === "pedido") {
      return <MessageCircle className="w-4 h-4" />;
    }
    if (item.type === "testemunho") {
      return <Award className="w-4 h-4" />;
    }
    // Sentimento
    switch (item.sentiment) {
      case "feliz":
      case "grato":
        return <Smile className="w-4 h-4" />;
      case "triste":
      case "angustiado":
      case "sozinho":
        return <Frown className="w-4 h-4" />;
      default:
        return <Meh className="w-4 h-4" />;
    }
  };

  const getColor = (item: TimelineItem) => {
    if (item.type === "pedido") return "bg-blue-500";
    if (item.type === "testemunho") return "bg-amber-500";
    
    // Sentimento
    switch (item.sentiment) {
      case "feliz":
      case "grato":
        return "bg-green-500";
      case "triste":
      case "angustiado":
      case "sozinho":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    const labels: Record<string, string> = {
      feliz: "Feliz",
      grato: "Grato",
      triste: "Triste",
      angustiado: "Angustiado",
      sozinho: "Sozinho",
      doente: "Doente",
      com_pouca_fe: "Com pouca fé",
      ansioso: "Ansioso",
      normal: "Normal",
    };
    return labels[sentiment] || sentiment;
  };

  const getStatusBadge = (item: TimelineItem) => {
    if (item.type === "pedido") {
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        pendente: "outline",
        em_oracao: "secondary",
        respondido: "default",
        arquivado: "destructive",
      };
      return (
        <Badge variant={variants[item.status || "pendente"]} className="text-xs">
          {item.status === "em_oracao" ? "Em oração" : item.status}
        </Badge>
      );
    }
    if (item.type === "testemunho") {
      return (
        <Badge variant={item.status === "publico" ? "default" : "outline"} className="text-xs">
          {item.status}
        </Badge>
      );
    }
    if (item.type === "sentimento" && item.sentiment) {
      const isNegative = ["triste", "angustiado", "sozinho", "doente", "com_pouca_fe"].includes(item.sentiment);
      return (
        <Badge 
          variant={isNegative ? "destructive" : "default"} 
          className={`text-xs ${!isNegative ? "bg-green-600" : ""}`}
        >
          {getSentimentLabel(item.sentiment)}
        </Badge>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse flex gap-4">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Heart className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum registro de intercessão encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <MessageCircle className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{timeline.filter(t => t.type === "pedido").length}</p>
            <p className="text-xs text-muted-foreground">Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Heart className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{timeline.filter(t => t.type === "sentimento").length}</p>
            <p className="text-xs text-muted-foreground">Sentimentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Award className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{timeline.filter(t => t.type === "testemunho").length}</p>
            <p className="text-xs text-muted-foreground">Testemunhos</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas críticos */}
      {timeline.some(t => t.type === "sentimento" && ["triste", "angustiado", "sozinho"].includes(t.sentiment || "")) && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive font-medium">
              Esta pessoa registrou sentimentos negativos recentemente
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
            <div className="space-y-6">
              {timeline.map((item) => (
                <div key={item.id} className="relative flex gap-4 pl-2">
                  <div className={`w-8 h-8 rounded-full ${getColor(item)} flex items-center justify-center text-white z-10`}>
                    {getIcon(item)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      {getStatusBadge(item)}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.date), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
