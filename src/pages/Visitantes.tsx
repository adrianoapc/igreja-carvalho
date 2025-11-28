import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Phone, Calendar } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const allVisitantes = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  nome: `Visitante ${i + 1}`,
  telefone: `(11) ${98765 + i}-${1111 + i}`,
  primeiraVisita: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
  ultimaVisita: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
  vezes: Math.floor(Math.random() * 10) + 1,
}));

const ITEMS_PER_PAGE = 8;

export default function Visitantes() {
  const [displayedVisitantes, setDisplayedVisitantes] = useState(allVisitantes.slice(0, ITEMS_PER_PAGE));
  
  const loadMore = useCallback(() => {
    setIsLoading(true);
    
    setTimeout(() => {
      const nextPage = page + 1;
      const start = nextPage * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const newItems = allVisitantes.slice(start, end);
      
      if (newItems.length > 0) {
        setDisplayedVisitantes(prev => [...prev, ...newItems]);
        setPage(nextPage);
      }
      
      if (end >= allVisitantes.length) {
        setHasMore(false);
      }
      
      setIsLoading(false);
    }, 800);
  }, []);

  const { loadMoreRef, isLoading, hasMore, page, setIsLoading, setHasMore, setPage } = useInfiniteScroll(loadMore);
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Visitantes</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Registre e acompanhe os visitantes</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Registrar Visitante</span>
          <span className="sm:hidden">Registrar</span>
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar visitantes..." className="pl-10 text-sm md:text-base" />
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {displayedVisitantes.map((visitante, index) => (
              <div 
                key={visitante.id} 
                ref={index === displayedVisitantes.length - 1 ? loadMoreRef : null}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 md:p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-accent flex items-center justify-center text-accent-foreground font-bold text-base md:text-lg flex-shrink-0">
                    {visitante.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base text-foreground truncate">{visitante.nome}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {visitante.telefone}
                      </span>
                      <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {visitante.vezes}x visitou
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Última visita</p>
                    <p className="text-xs md:text-sm font-medium text-primary">{visitante.ultimaVisita}</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs md:text-sm">Detalhes</Button>
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
            
            {!hasMore && displayedVisitantes.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Todos os visitantes foram carregados
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
