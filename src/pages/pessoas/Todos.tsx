import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Phone, Mail, Calendar, User, ArrowLeft, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportToExcel, formatDateForExport } from "@/lib/exportUtils";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatarTelefone } from "@/lib/validators";
interface Pessoa {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  status: "visitante" | "frequentador" | "membro";
  data_primeira_visita: string | null;
  numero_visitas: number;
  user_id: string | null;
}
const ITEMS_PER_PAGE = 10;
export default function TodosPessoas() {
  const [displayedPessoas, setDisplayedPessoas] = useState<Pessoa[]>([]);
  const [allPessoas, setAllPessoas] = useState<Pessoa[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "visitante" | "frequentador" | "membro">("todos");
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const fetchPessoas = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from("profiles").select("id, nome, telefone, email, status, data_primeira_visita, numero_visitas, user_id").order("nome");
      if (error) throw error;
      setAllPessoas(data || []);
      setDisplayedPessoas((data || []).slice(0, ITEMS_PER_PAGE));
    } catch (error) {
      console.error("Erro ao buscar pessoas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as pessoas",
        variant: "destructive"
      });
    }
  };
  useEffect(() => {
    fetchPessoas();
  }, []);
  const loadMore = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      const nextPage = page + 1;
      const start = nextPage * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const newItems = allPessoas.slice(start, end);
      if (newItems.length > 0) {
        setDisplayedPessoas(prev => [...prev, ...newItems]);
        setPage(nextPage);
      }
      if (end >= allPessoas.length) {
        setHasMore(false);
      }
      setIsLoading(false);
    }, 500);
  }, [allPessoas]);
  const {
    loadMoreRef,
    isLoading,
    hasMore,
    page,
    setIsLoading,
    setHasMore,
    setPage
  } = useInfiniteScroll(loadMore);
  const filteredPessoas = displayedPessoas.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.telefone?.includes(searchTerm) || p.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const countByStatus = {
    todos: allPessoas.length,
    visitante: allPessoas.filter(p => p.status === "visitante").length,
    frequentador: allPessoas.filter(p => p.status === "frequentador").length,
    membro: allPessoas.filter(p => p.status === "membro").length
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "visitante":
        return <Badge variant="outline" className="text-xs">Visitante</Badge>;
      case "frequentador":
        return <Badge variant="secondary" className="text-xs">Frequentador</Badge>;
      case "membro":
        return <Badge variant="default" className="text-xs">Membro</Badge>;
      default:
        return null;
    }
  };

  const handleExportar = () => {
    try {
      if (!filteredPessoas || filteredPessoas.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há dados para exportar",
          variant: "destructive"
        });
        return;
      }

      const dadosExportacao = filteredPessoas.map(p => ({
        'Nome': p.nome,
        'Status': p.status,
        'Email': p.email || '',
        'Telefone': formatarTelefone(p.telefone || ''),
        'Número de Visitas': p.numero_visitas,
        'Data Primeira Visita': formatDateForExport(p.data_primeira_visita),
      }));

      exportToExcel(dadosExportacao, 'Pessoas', 'Pessoas');
      toast({
        title: "Sucesso",
        description: "Dados exportados com sucesso!"
      });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro",
        description: "Erro ao exportar dados",
        variant: "destructive"
      });
    }
  };
  return <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pessoas")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Todas as Pessoas</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Visualize todas as pessoas cadastradas</p>
        </div>
        <Button 
          variant="outline"
          size="sm"
          onClick={handleExportar}
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6 space-y-4">
          <Tabs value={statusFilter} onValueChange={value => setStatusFilter(value as typeof statusFilter)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-auto">
              <TabsTrigger value="todos" className="text-xs md:text-sm">
                Todos ({countByStatus.todos})
              </TabsTrigger>
              <TabsTrigger value="visitante" className="text-xs md:text-sm">
                Visitantes ({countByStatus.visitante})
              </TabsTrigger>
              <TabsTrigger value="frequentador" className="text-xs md:text-sm">
                Frequentadores ({countByStatus.frequentador})
              </TabsTrigger>
              <TabsTrigger value="membro" className="text-xs md:text-sm">
                Membros ({countByStatus.membro})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, telefone ou email..." className="pl-10 text-sm md:text-base" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {filteredPessoas.map((pessoa, index) => <div key={pessoa.id} ref={index === filteredPessoas.length - 1 ? loadMoreRef : null} onClick={() => navigate(`/pessoas/${pessoa.id}`)} className="flex flex-col gap-3 p-3 md:p-4 rounded-lg transition-colors cursor-pointer bg-[#eff0cf]">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-base md:text-lg flex-shrink-0">
                    {pessoa.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm md:text-base text-foreground truncate">{pessoa.nome}</p>
                    <div className="flex flex-col gap-1 mt-1">
                      {pessoa.telefone && <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {formatarTelefone(pessoa.telefone)}
                        </span>}
                      {pessoa.email && <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{pessoa.email}</span>
                        </span>}
                      {pessoa.data_primeira_visita && <span className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3 flex-shrink-0" />
                          Cadastrado em: {format(new Date(pessoa.data_primeira_visita), "dd/MM/yyyy", {
                      locale: ptBR
                    })}
                        </span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(pessoa.status)}
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    {pessoa.numero_visitas} {pessoa.numero_visitas === 1 ? 'visita' : 'visitas'}
                  </Badge>
                  {pessoa.user_id && <Badge variant="outline" className="text-xs">
                      <User className="w-3 h-3 mr-1" />
                      Usuário da plataforma
                    </Badge>}
                </div>
              </div>)}
            
            {isLoading && <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-secondary">
                    <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>)}
              </div>}
            
            {!hasMore && filteredPessoas.length > 0 && <div className="text-center py-4 text-sm text-muted-foreground">
                Todas as pessoas foram carregadas
              </div>}
            
            {filteredPessoas.length === 0 && !isLoading && <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTerm ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
              </div>}
          </div>
        </CardContent>
      </Card>
    </div>;
}