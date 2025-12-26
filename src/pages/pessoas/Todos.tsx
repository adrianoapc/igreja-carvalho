import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, Phone, Mail, Calendar, User, ArrowLeft, Download, Filter } from "lucide-react";
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
  avatar_url?: string | null;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const fetchPessoas = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, nome, telefone, email, status, avatar_url, data_primeira_visita, numero_visitas, user_id"
        )
        .order("nome");

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
  const {
    loadMoreRef,
    isLoading,
    hasMore,
    page,
    setIsLoading,
    setHasMore,
    setPage
  } = useInfiniteScroll();

  // Load more when page changes and it's not the initial page
  useEffect(() => {
    if (page === 1 || allPessoas.length === 0) return;
    
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const newItems = allPessoas.slice(start, end);
    
    if (newItems.length > 0) {
      setDisplayedPessoas(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueNewItems = newItems.filter(item => !existingIds.has(item.id));
        return [...prev, ...uniqueNewItems];
      });
    }
    
    if (end >= allPessoas.length) {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [page, allPessoas, setHasMore, setIsLoading]);

  const filteredPessoas = displayedPessoas
    .filter(p => {
      const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.telefone?.includes(searchTerm) || p.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .filter(p => (filterHasPhone ? !!p.telefone : true))
    .filter(p => (filterHasEmail ? !!p.email : true));
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
  
  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
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
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nome, telefone ou email..." 
                className="pl-10 text-base md:text-lg" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos ({countByStatus.todos})</SelectItem>
                <SelectItem value="visitante">Visitantes ({countByStatus.visitante})</SelectItem>
                <SelectItem value="frequentador">Frequentadores ({countByStatus.frequentador})</SelectItem>
                <SelectItem value="membro">Membros ({countByStatus.membro})</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="md:w-auto" onClick={() => setFiltersOpen(true)}>
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6">
          <div className="space-y-5">
            {/* Desktop Table */}
            <Table className="hidden md:table table-auto w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPessoas.map((pessoa, index) => (
                  <TableRow key={pessoa.id} ref={index === filteredPessoas.length - 1 ? loadMoreRef : null}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={pessoa.avatar_url || undefined} alt={pessoa.nome} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold">
                            {pessoa.nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{pessoa.nome}</p>
                          {pessoa.user_id && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="w-3 h-3" /> Usuário da plataforma
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {pessoa.telefone && (
                          <span className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {formatarTelefone(pessoa.telefone)}
                          </span>
                        )}
                        {pessoa.email && (
                          <span className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            <span className="truncate">{pessoa.email}</span>
                          </span>
                        )}
                        {pessoa.data_primeira_visita && (
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(pessoa.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(pessoa.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-primary/10">
                        {pessoa.numero_visitas} {pessoa.numero_visitas === 1 ? "visita" : "visitas"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => navigate(`/pessoas/${pessoa.id}`)}>
                        Detalhes
                      </Button>
                      <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => navigate(`/cultos/nova-agenda?membroId=${pessoa.id}`)}>
                        Agendar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading && filteredPessoas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {searchTerm ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="block md:hidden space-y-4">
            {filteredPessoas.map((pessoa, index) => (
              <div
                key={pessoa.id}
                ref={index === filteredPessoas.length - 1 ? loadMoreRef : null}
                className="flex flex-col gap-3 p-3 rounded-lg bg-[#eff0cf]"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={pessoa.avatar_url || undefined} alt={pessoa.nome} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-bold">
                      {pessoa.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{pessoa.nome}</p>
                    <div className="flex flex-col gap-1 mt-1">
                      {pessoa.telefone && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          {formatarTelefone(pessoa.telefone)}
                        </span>
                      )}
                      {pessoa.email && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{pessoa.email}</span>
                        </span>
                      )}
                      {pessoa.data_primeira_visita && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(pessoa.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {getStatusBadge(pessoa.status)}
                  <Badge variant="outline" className="text-xs bg-primary/10">
                    {pessoa.numero_visitas} {pessoa.numero_visitas === 1 ? "visita" : "visitas"}
                  </Badge>
                  {pessoa.user_id && (
                    <Badge variant="outline" className="text-xs">
                      <User className="w-3 h-3 mr-1" /> Usuário da plataforma
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1 min-h-[44px]" onClick={() => navigate(`/pessoas/${pessoa.id}`)}>
                    Detalhes
                  </Button>
                  <Button variant="outline" className="flex-1 min-h-[44px]" onClick={() => navigate(`/cultos/nova-agenda?membroId=${pessoa.id}`)}>
                    Agendar
                  </Button>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredPessoas.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTerm ? "Nenhuma pessoa encontrada" : "Nenhuma pessoa cadastrada"}
              </div>
            )}
          </div>

          {!hasMore && filteredPessoas.length > 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Todas as pessoas foram carregadas
            </div>
          )}
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        dialogContentProps={{ className: "sm:max-w-[420px]" }}
        drawerContentProps={{ className: "max-h-[90vh]" }}
      >
        <div className="p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold">Filtros</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Somente com telefone</Label>
                <p className="text-xs text-muted-foreground">Oculta pessoas sem número cadastrado.</p>
              </div>
              <Switch checked={filterHasPhone} onCheckedChange={setFilterHasPhone} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Somente com e-mail</Label>
                <p className="text-xs text-muted-foreground">Oculta pessoas sem e-mail cadastrado.</p>
              </div>
              <Switch checked={filterHasEmail} onCheckedChange={setFilterHasEmail} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => {
              setFilterHasPhone(false);
              setFilterHasEmail(false);
            }}>
              Limpar
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              Aplicar
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
