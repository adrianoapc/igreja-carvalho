import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Phone, Mail, Check, X, Gift, Calendar, PhoneCall } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RegistrarVisitanteDialog } from "@/components/visitantes/RegistrarVisitanteDialog";
import { AgendarContatoDialog } from "@/components/visitantes/AgendarContatoDialog";
import { VisitanteDetailsDialog } from "@/components/visitantes/VisitanteDetailsDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Visitante {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  data_primeira_visita: string | null;
  data_ultima_visita: string | null;
  numero_visitas: number;
  aceitou_jesus: boolean | null;
  deseja_contato: boolean | null;
  recebeu_brinde: boolean | null;
}

const ITEMS_PER_PAGE = 10;

export default function Visitantes() {
  const [displayedVisitantes, setDisplayedVisitantes] = useState<Visitante[]>([]);
  const [allVisitantes, setAllVisitantes] = useState<Visitante[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [agendarContatoOpen, setAgendarContatoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedVisitante, setSelectedVisitante] = useState<Visitante | null>(null);
  const { toast } = useToast();

  const fetchVisitantes = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "visitante")
        .order("data_primeira_visita", { ascending: false });

      if (error) throw error;
      
      setAllVisitantes(data || []);
      setDisplayedVisitantes((data || []).slice(0, ITEMS_PER_PAGE));
    } catch (error) {
      console.error("Erro ao buscar visitantes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os visitantes",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchVisitantes();
  }, []);

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
    }, 500);
  }, [allVisitantes]);

  const { loadMoreRef, isLoading, hasMore, page, setIsLoading, setHasMore, setPage } = useInfiniteScroll(loadMore);

  const filteredVisitantes = displayedVisitantes.filter(v =>
    v.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.telefone?.includes(searchTerm) ||
    v.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDetails = (visitante: Visitante) => {
    setSelectedVisitante(visitante);
    setDetailsOpen(true);
  };

  const handleAgendarContato = (visitante: Visitante) => {
    setSelectedVisitante(visitante);
    setAgendarContatoOpen(true);
  };

  const handleAgendarFromDetails = () => {
    setDetailsOpen(false);
    setAgendarContatoOpen(true);
  };
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Visitantes</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Registre e acompanhe os visitantes</p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft w-full sm:w-auto"
          onClick={() => setRegistrarOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Registrar Visitante</span>
          <span className="sm:hidden">Registrar</span>
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar visitantes..." 
                className="pl-10 text-sm md:text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {filteredVisitantes.map((visitante, index) => (
              <div 
                key={visitante.id} 
                ref={index === filteredVisitantes.length - 1 ? loadMoreRef : null}
                className="flex flex-col gap-3 p-3 md:p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-accent flex items-center justify-center text-accent-foreground font-bold text-base md:text-lg flex-shrink-0">
                    {visitante.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base text-foreground truncate">{visitante.nome}</p>
                    <div className="flex flex-col gap-1 mt-1">
                      {visitante.telefone && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {visitante.telefone}
                        </span>
                      )}
                      {visitante.email && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{visitante.email}</span>
                        </span>
                      )}
                      {visitante.data_primeira_visita && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          1ª visita: {format(new Date(visitante.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {visitante.data_ultima_visita && visitante.data_ultima_visita !== visitante.data_primeira_visita && (
                        <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          Última: {format(new Date(visitante.data_ultima_visita), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    {visitante.numero_visitas} {visitante.numero_visitas === 1 ? 'visita' : 'visitas'}
                  </Badge>
                  {visitante.aceitou_jesus && (
                    <Badge variant="outline" className="text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      Aceitou Jesus
                    </Badge>
                  )}
                  {visitante.deseja_contato && (
                    <Badge variant="outline" className="text-xs">
                      <PhoneCall className="w-3 h-3 mr-1" />
                      Deseja contato
                    </Badge>
                  )}
                  {visitante.recebeu_brinde && (
                    <Badge variant="outline" className="text-xs">
                      <Gift className="w-3 h-3 mr-1" />
                      Brinde
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs md:text-sm"
                    onClick={() => handleOpenDetails(visitante)}
                  >
                    Detalhes
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs md:text-sm"
                    onClick={() => handleAgendarContato(visitante)}
                  >
                    <PhoneCall className="w-3 h-3 mr-1" />
                    Agendar Contato
                  </Button>
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
            
            {!hasMore && filteredVisitantes.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Todos os visitantes foram carregados
              </div>
            )}
            
            {filteredVisitantes.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTerm ? "Nenhum visitante encontrado" : "Nenhum visitante cadastrado"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <RegistrarVisitanteDialog
        open={registrarOpen}
        onOpenChange={setRegistrarOpen}
        onSuccess={fetchVisitantes}
      />

      {selectedVisitante && (
        <>
          <AgendarContatoDialog
            open={agendarContatoOpen}
            onOpenChange={setAgendarContatoOpen}
            visitanteId={selectedVisitante.id}
            visitanteNome={selectedVisitante.nome}
            onSuccess={fetchVisitantes}
          />

          <VisitanteDetailsDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            visitante={selectedVisitante}
            onAgendarContato={handleAgendarFromDetails}
          />
        </>
      )}
    </div>
  );
}
