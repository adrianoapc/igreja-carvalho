import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Phone, Mail, Calendar, UserCheck, ArrowLeft } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatarTelefone } from "@/lib/validators";

interface Frequentador {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_primeira_visita: string | null;
  data_ultima_visita: string | null;
  numero_visitas: number;
  user_id: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function Frequentadores() {
  const [displayedFrequentadores, setDisplayedFrequentadores] = useState<Frequentador[]>([]);
  const [allFrequentadores, setAllFrequentadores] = useState<Frequentador[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchFrequentadores = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, telefone, email, data_primeira_visita, data_ultima_visita, numero_visitas, user_id")
        .eq("status", "frequentador")
        .order("nome");

      if (error) throw error;
      
      setAllFrequentadores(data || []);
      setDisplayedFrequentadores((data || []).slice(0, ITEMS_PER_PAGE));
    } catch (error) {
      console.error("Erro ao buscar frequentadores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os frequentadores",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchFrequentadores();
  }, []);

  const { loadMoreRef, isLoading, hasMore, page, setIsLoading, setHasMore, setPage } = useInfiniteScroll();

  // Load more when page changes and it's not the initial page
  useEffect(() => {
    if (page === 1 || allFrequentadores.length === 0) return;
    
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const newItems = allFrequentadores.slice(start, end);
    
    if (newItems.length > 0) {
      setDisplayedFrequentadores(prev => {
        const existingIds = new Set(prev.map(f => f.id));
        const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
        return [...prev, ...uniqueNewItems];
      });
    }
    
    if (end >= allFrequentadores.length) {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [page, allFrequentadores, setHasMore, setIsLoading]);

  const filteredFrequentadores = displayedFrequentadores.filter(f =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.telefone?.includes(searchTerm) ||
    f.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pessoas")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Frequentadores</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Pessoas que visitaram mais de 2 vezes e têm acesso ao app
          </p>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, telefone ou email..." 
              className="pl-10 text-sm md:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {filteredFrequentadores.map((freq, index) => (
              <div 
                key={freq.id} 
                ref={index === filteredFrequentadores.length - 1 ? loadMoreRef : null}
                className="flex flex-col gap-3 p-3 md:p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer"
                onClick={() => navigate(`/pessoas/${freq.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center text-secondary-foreground font-bold text-base md:text-lg flex-shrink-0">
                    {freq.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base text-foreground truncate">{freq.nome}</p>
                    <div className="flex flex-col gap-1 mt-1">
                      {freq.telefone && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {formatarTelefone(freq.telefone)}
                        </span>
                      )}
                      {freq.email && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{freq.email}</span>
                        </span>
                      )}
                      {freq.data_primeira_visita && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          1ª visita: {format(new Date(freq.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {freq.data_ultima_visita && freq.data_ultima_visita !== freq.data_primeira_visita && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          Última: {format(new Date(freq.data_ultima_visita), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Frequentador
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    {freq.numero_visitas} {freq.numero_visitas === 1 ? 'visita' : 'visitas'}
                  </Badge>
                  {freq.user_id && (
                    <Badge variant="outline" className="text-xs">
                      <UserCheck className="w-3 h-3 mr-1" />
                      Com acesso ao app
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-secondary">
                    <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!hasMore && filteredFrequentadores.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Todos os frequentadores foram carregados
              </div>
            )}
            
            {filteredFrequentadores.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTerm ? "Nenhum frequentador encontrado" : "Nenhum frequentador cadastrado"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
