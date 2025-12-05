import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { OptimizedImage } from "@/components/OptimizedImage";

interface Comunicado {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  nivel_urgencia: string | null;
  imagem_url: string | null;
  link_acao: string | null;
  created_at: string | null;
  data_inicio: string | null;
  data_fim: string | null;
}

export default function AnnouncementsAdmin() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchComunicados(); }, []);

  const fetchComunicados = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("comunicados")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComunicados(data || []);
    } catch (error) {
      console.error("Error fetching comunicados:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (date: string) => formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Anúncios (Admin)</h2>
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <Card key={i}><div className="p-4"><Skeleton className="h-20 w-full" /></div></Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {comunicados.map(c => (
            <Card key={c.id} className="overflow-hidden">
              {c.imagem_url && (
                <div className="w-full bg-black">
                  <a href={c.link_acao || '#'} target="_blank" rel="noreferrer" className="block w-full">
                    <OptimizedImage src={c.imagem_url} alt={c.titulo} className="w-full h-auto max-h-[400px] md:max-h-[500px]" fit="contain" />
                  </a>
                </div>
              )}
              <CardContent>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.titulo}</h3>
                  {c.created_at && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{getTimeAgo(c.created_at)}</span>
                    </div>
                  )}
                </div>
                {c.descricao && <p className="mt-2 text-sm text-foreground/80">{c.descricao}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
