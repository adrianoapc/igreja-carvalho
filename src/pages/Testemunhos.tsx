import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Heart, Clock } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

const allTestemunhos = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  nome: `Pessoa ${i + 1}`,
  testemunho: `Testemunho de fé e gratidão a Deus número ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
  data: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
  categoria: ["Cura", "Provisão", "Relacionamento", "Salvação", "Outro"][i % 5],
  aprovado: Math.random() > 0.3,
}));

const ITEMS_PER_PAGE = 6;

export default function Testemunhos() {
  const [displayedTestemunhos, setDisplayedTestemunhos] = useState(allTestemunhos.slice(0, ITEMS_PER_PAGE));
  
  const loadMore = useCallback(() => {
    setIsLoading(true);
    
    setTimeout(() => {
      const nextPage = page + 1;
      const start = nextPage * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const newItems = allTestemunhos.slice(start, end);
      
      if (newItems.length > 0) {
        setDisplayedTestemunhos(prev => [...prev, ...newItems]);
        setPage(nextPage);
      }
      
      if (end >= allTestemunhos.length) {
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Testemunhos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Compartilhe as bênçãos e milagres</p>
        </div>
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Testemunho</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      <div className="grid gap-3 md:gap-4">
        {displayedTestemunhos.map((testemunho, index) => (
          <Card 
            key={testemunho.id} 
            ref={index === displayedTestemunhos.length - 1 ? loadMoreRef : null}
            className="shadow-soft hover:shadow-medium transition-shadow"
          >
            <CardHeader className="pb-3 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-accent flex items-center justify-center flex-shrink-0">
                    <Heart className="w-4 h-4 md:w-5 md:h-5 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base md:text-lg truncate">{testemunho.nome}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{testemunho.data}</span>
                      <Badge variant="outline" className="text-xs">{testemunho.categoria}</Badge>
                    </div>
                  </div>
                </div>
                {testemunho.aprovado ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 whitespace-nowrap">Aprovado</Badge>
                ) : (
                  <Badge className="bg-accent/20 text-accent-foreground whitespace-nowrap">Pendente</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <p className="text-sm md:text-base text-muted-foreground line-clamp-3">{testemunho.testemunho}</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3 md:mt-4">
                <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs md:text-sm">Ver Detalhes</Button>
                {!testemunho.aprovado && (
                  <Button variant="outline" size="sm" className="text-primary w-full sm:w-auto text-xs md:text-sm">Aprovar</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {isLoading && (
          <div className="grid gap-3 md:gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="shadow-soft">
                <CardHeader className="pb-3 p-4 md:p-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {!hasMore && displayedTestemunhos.length > 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Todos os testemunhos foram carregados
          </div>
        )}
      </div>
    </div>
  );
}
