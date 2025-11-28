import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Heart, Clock, ArrowLeft, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

// Mock data - será substituído por dados reais do Supabase
const allTestemunhos = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  nome: `Pessoa ${i + 1}`,
  testemunho: `Testemunho de fé e gratidão a Deus número ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
  data: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
  categoria: ["saude", "familia", "financeiro", "trabalho", "espiritual", "ministerial", "casamento", "outro"][i % 8],
  status: ["aberto", "publico", "arquivado"][i % 3],
  aprovado: Math.random() > 0.3,
}));

const CATEGORIAS = [
  { value: "todos", label: "Todos" },
  { value: "espiritual", label: "Área Espiritual" },
  { value: "casamento", label: "Casamento" },
  { value: "familia", label: "Família" },
  { value: "saude", label: "Saúde" },
  { value: "trabalho", label: "Trabalho" },
  { value: "financeiro", label: "Vida Financeira" },
  { value: "ministerial", label: "Vida Ministerial" },
  { value: "outro", label: "Outros" },
];

const ITEMS_PER_PAGE = 6;

export default function Testemunhos() {
  const navigate = useNavigate();
  const [displayedTestemunhos, setDisplayedTestemunhos] = useState(allTestemunhos.slice(0, ITEMS_PER_PAGE));
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [statusTab, setStatusTab] = useState("aberto");
  
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

  const filteredTestemunhos = displayedTestemunhos.filter(t => {
    const matchesSearch = t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.testemunho.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaFilter === "todos" || t.categoria === categoriaFilter;
    const matchesStatus = t.status === statusTab;
    return matchesSearch && matchesCategoria && matchesStatus;
  });

  const getCategoriaLabel = (categoria: string) => {
    const item = CATEGORIAS.find(c => c.value === categoria);
    return item?.label || categoria;
  };

  const testemunhosPorStatus = {
    aberto: allTestemunhos.filter(t => t.status === "aberto").length,
    publico: allTestemunhos.filter(t => t.status === "publico").length,
    arquivado: allTestemunhos.filter(t => t.status === "arquivado").length,
  };

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/intercessao")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Testemunhos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Compartilhe as bênçãos e milagres
          </p>
        </div>
        <Button className="bg-gradient-primary shadow-soft">
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Testemunho</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 md:p-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquise aqui"
              className="pl-10 text-sm md:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {CATEGORIAS.map((categoria) => (
              <Button
                key={categoria.value}
                variant={categoriaFilter === categoria.value ? "default" : "outline"}
                size="sm"
                className="whitespace-nowrap text-xs"
                onClick={() => setCategoriaFilter(categoria.value)}
              >
                {categoria.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="aberto" className="text-xs md:text-sm">
            Testemunhos em aberto ({testemunhosPorStatus.aberto})
          </TabsTrigger>
          <TabsTrigger value="publico" className="text-xs md:text-sm">
            Testemunhos públicos ({testemunhosPorStatus.publico})
          </TabsTrigger>
          <TabsTrigger value="arquivado" className="text-xs md:text-sm">
            Histórico ({testemunhosPorStatus.arquivado})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusTab} className="space-y-3 md:space-y-4 mt-4 md:mt-6">
          <div className="grid gap-3 md:gap-4">
            {filteredTestemunhos.map((testemunho, index) => (
              <Card 
                key={testemunho.id} 
                ref={index === filteredTestemunhos.length - 1 ? loadMoreRef : null}
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
                          <Badge variant="outline" className="text-xs">
                            {getCategoriaLabel(testemunho.categoria)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {testemunho.aprovado ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 whitespace-nowrap text-xs">
                        Aprovado
                      </Badge>
                    ) : (
                      <Badge className="bg-accent/20 text-accent-foreground whitespace-nowrap text-xs">
                        Pendente
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  <p className="text-sm md:text-base text-muted-foreground line-clamp-3">
                    {testemunho.testemunho}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-3 md:mt-4">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs md:text-sm">
                      Ver Detalhes
                    </Button>
                    {!testemunho.aprovado && (
                      <Button variant="outline" size="sm" className="text-primary w-full sm:w-auto text-xs md:text-sm">
                        Aprovar
                      </Button>
                    )}
                    {testemunho.status === "aberto" && (
                      <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs md:text-sm">
                        Tornar Público
                      </Button>
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
            
            {!hasMore && filteredTestemunhos.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Todos os testemunhos foram carregados
              </div>
            )}

            {filteredTestemunhos.length === 0 && !isLoading && (
              <Card className="p-6 md:p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {searchTerm || categoriaFilter !== "todos" 
                    ? "Nenhum testemunho encontrado com os filtros aplicados"
                    : "Nenhum testemunho nesta categoria"}
                </p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
