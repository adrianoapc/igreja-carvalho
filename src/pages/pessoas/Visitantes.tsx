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
import { Search, Plus, Phone, Mail, Check, X, Gift, Calendar, PhoneCall, ArrowLeft, Filter } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RegistrarVisitanteDialog } from "@/components/visitantes/RegistrarVisitanteDialog";
import { AgendarContatoDialog } from "@/components/visitantes/AgendarContatoDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatarTelefone } from "@/lib/validators";

interface Visitante {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  avatar_url?: string | null;
  data_primeira_visita: string | null;
  data_ultima_visita: string | null;
  numero_visitas: number;
  aceitou_jesus: boolean | null;
  batizado: boolean | null;
  deseja_contato: boolean | null;
  recebeu_brinde: boolean | null;
  status: "visitante" | "frequentador" | "membro";
  user_id: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function Visitantes() {
  const [displayedVisitantes, setDisplayedVisitantes] = useState<Visitante[]>([]);
  const [allVisitantes, setAllVisitantes] = useState<Visitante[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "visitante" | "frequentador">("todos");
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [agendarContatoOpen, setAgendarContatoOpen] = useState(false);
  const [selectedVisitante, setSelectedVisitante] = useState<Visitante | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchVisitantes = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("status", ["visitante", "frequentador"])
        .order("data_primeira_visita", { ascending: false });

      if (error) throw error;
      setAllVisitantes(data || []);
      setDisplayedVisitantes((data || []).slice(0, ITEMS_PER_PAGE));
    } catch (error) {
      console.error("Erro ao buscar visitantes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os visitantes",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchVisitantes();
  }, []);

  const { loadMoreRef, isLoading, hasMore, page, setIsLoading, setHasMore, setPage } = useInfiniteScroll();

  useEffect(() => {
    if (page === 1 || allVisitantes.length === 0) return;

    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const newItems = allVisitantes.slice(start, end);

    if (newItems.length > 0) {
      setDisplayedVisitantes((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.id));
        return [...prev, ...uniqueNewItems];
      });
    }

    if (end >= allVisitantes.length) {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [page, allVisitantes, setHasMore, setIsLoading]);

  const filteredVisitantes = displayedVisitantes
    .filter((v) => {
      const matchesSearch =
        v.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.telefone?.includes(searchTerm) ||
        v.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "todos" || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .filter((v) => (filterHasPhone ? !!v.telefone : true))
    .filter((v) => (filterHasEmail ? !!v.email : true));

  const countByStatus = {
    todos: allVisitantes.length,
    visitante: allVisitantes.filter((v) => v.status === "visitante").length,
    frequentador: allVisitantes.filter((v) => v.status === "frequentador").length,
  };

  const handleOpenDetails = (visitante: Visitante) => {
    navigate(`/pessoas/${visitante.id}`);
  };

  const handleAgendarContato = (visitante: Visitante) => {
    setSelectedVisitante(visitante);
    setAgendarContatoOpen(true);
  };

  const renderStatusBadges = (visitante: Visitante) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={visitante.status === "visitante" ? "default" : "secondary"} className="text-xs">
        {visitante.status === "visitante" ? "Visitante" : "Frequentador"}
      </Badge>
      <Badge variant="outline" className="text-xs bg-primary/10">
        {visitante.numero_visitas} {visitante.numero_visitas === 1 ? "visita" : "visitas"}
      </Badge>
      {visitante.status === "visitante" && visitante.numero_visitas >= 2 && (
        <Badge variant="outline" className="text-xs bg-accent/10 text-accent-foreground">
          Próxima visita = Frequentador
        </Badge>
      )}
      {visitante.aceitou_jesus && (
        <Badge variant="outline" className="text-xs">
          <Check className="w-3 h-3 mr-1" /> Aceitou Jesus
        </Badge>
      )}
      {visitante.batizado && (
        <Badge variant="outline" className="text-xs bg-primary/10">
          <Check className="w-3 h-3 mr-1" /> Convertido
        </Badge>
      )}
      {visitante.deseja_contato && (
        <Badge variant="outline" className="text-xs">
          <PhoneCall className="w-3 h-3 mr-1" /> Deseja contato
        </Badge>
      )}
      {visitante.recebeu_brinde && (
        <Badge variant="outline" className="text-xs">
          <Gift className="w-3 h-3 mr-1" /> Brinde
        </Badge>
      )}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pessoas")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Visitantes</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Registre e acompanhe visitantes e frequentadores
          </p>
        </div>
        <Button className="bg-gradient-primary shadow-soft w-full sm:w-auto" onClick={() => setRegistrarOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Registrar Pessoa</span>
          <span className="sm:hidden">Registrar</span>
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
                onChange={(e) => setSearchTerm(e.target.value)}
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
                {filteredVisitantes.map((visitante, index) => (
                  <TableRow key={visitante.id} ref={index === filteredVisitantes.length - 1 ? loadMoreRef : null}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={visitante.avatar_url || undefined} alt={visitante.nome} />
                          <AvatarFallback className="bg-gradient-accent text-accent-foreground font-bold">
                            {visitante.nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{visitante.nome}</p>
                          {visitante.user_id && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="w-3 h-3" /> Usuário da plataforma
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {visitante.telefone && (
                          <span className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {formatarTelefone(visitante.telefone)}
                          </span>
                        )}
                        {visitante.email && (
                          <span className="flex items-center gap-2 truncate">
                            <Mail className="w-4 h-4" />
                            <span className="truncate">{visitante.email}</span>
                          </span>
                        )}
                        {visitante.data_primeira_visita && (
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            1ª visita: {format(new Date(visitante.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {visitante.data_ultima_visita && (
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Última: {format(new Date(visitante.data_ultima_visita), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadges(visitante)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-primary/10">
                        {visitante.numero_visitas} {visitante.numero_visitas === 1 ? "visita" : "visitas"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => handleOpenDetails(visitante)}>
                        Detalhes
                      </Button>
                      <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => handleAgendarContato(visitante)}>
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

                {!isLoading && filteredVisitantes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {searchTerm ? "Nenhum visitante encontrado" : "Nenhum visitante cadastrado"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="block md:hidden space-y-4">
            {filteredVisitantes.map((visitante, index) => (
              <div
                key={visitante.id}
                ref={index === filteredVisitantes.length - 1 ? loadMoreRef : null}
                className="flex flex-col gap-3 p-3 rounded-lg bg-[#eff0cf]"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={visitante.avatar_url || undefined} alt={visitante.nome} />
                    <AvatarFallback className="bg-gradient-accent text-accent-foreground font-bold">
                      {visitante.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{visitante.nome}</p>
                    <div className="flex flex-col gap-1 mt-1">
                      {visitante.telefone && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          {formatarTelefone(visitante.telefone)}
                        </span>
                      )}
                      {visitante.email && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{visitante.email}</span>
                        </span>
                      )}
                      {visitante.data_primeira_visita && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          1ª visita: {format(new Date(visitante.data_primeira_visita), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {visitante.data_ultima_visita && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          Última: {format(new Date(visitante.data_ultima_visita), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {renderStatusBadges(visitante)}

                <div className="flex gap-2">
                  <Button className="flex-1 min-h-[44px]" onClick={() => handleOpenDetails(visitante)}>
                    Detalhes
                  </Button>
                  <Button variant="outline" className="flex-1 min-h-[44px]" onClick={() => handleAgendarContato(visitante)}>
                    Agendar
                  </Button>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
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

            {filteredVisitantes.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTerm ? "Nenhum visitante encontrado" : "Nenhum visitante cadastrado"}
              </div>
            )}
          </div>

          {!hasMore && filteredVisitantes.length > 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Todos os visitantes foram carregados
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
                <p className="text-xs text-muted-foreground">Oculta visitantes sem número cadastrado.</p>
              </div>
              <Switch checked={filterHasPhone} onCheckedChange={setFilterHasPhone} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Somente com e-mail</Label>
                <p className="text-xs text-muted-foreground">Oculta visitantes sem e-mail cadastrado.</p>
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

      <RegistrarVisitanteDialog open={registrarOpen} onOpenChange={setRegistrarOpen} onSuccess={fetchVisitantes} />
      {selectedVisitante && (
        <AgendarContatoDialog
          open={agendarContatoOpen}
          onOpenChange={setAgendarContatoOpen}
          visitanteId={selectedVisitante.id}
          visitanteNome={selectedVisitante.nome}
          onSuccess={fetchVisitantes}
        />
      )}
    </div>
  );
}
