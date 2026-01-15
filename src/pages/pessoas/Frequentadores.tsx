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
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Phone,
  Mail,
  Calendar,
  UserCheck,
  ArrowLeft,
  Filter,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { formatarTelefone } from "@/lib/validators";
import { useAuthContext } from "@/contexts/AuthContextProvider";

interface Frequentador {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  avatar_url?: string | null;
  data_primeira_visita: string | null;
  data_ultima_visita: string | null;
  numero_visitas: number;
  user_id: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function Frequentadores() {
  const [allFrequentadores, setAllFrequentadores] = useState<Frequentador[]>(
    []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: authLoading,
  } = useAuthContext();

  const fetchFrequentadores = async () => {
    try {
      if (!igrejaId) return;

      let query = supabase
        .from("profiles")
        .select(
          "id, nome, telefone, email, avatar_url, data_primeira_visita, data_ultima_visita, numero_visitas, user_id"
        )
        .eq("status", "frequentador")
        .eq("igreja_id", igrejaId)
        .order("nome");

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAllFrequentadores(data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Erro ao buscar frequentadores:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os frequentadores",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchFrequentadores();
    }
  }, [igrejaId, filialId, isAllFiliais, authLoading]);

  const filteredFrequentadores = allFrequentadores
    .filter(
      (f) =>
        f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.telefone?.includes(searchTerm) ||
        f.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((f) => (filterHasPhone ? !!f.telefone : true))
    .filter((f) => (filterHasEmail ? !!f.email : true));

  // Pagination logic
  const totalPages = Math.ceil(filteredFrequentadores.length / ITEMS_PER_PAGE);
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedFrequentadores = filteredFrequentadores.slice(start, end);

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/pessoas")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Frequentadores
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Pessoas que visitaram mais de 2 vezes e têm acesso ao app
          </p>
        </div>
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
            <Button
              variant="outline"
              className="md:w-auto"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 md:p-6 space-y-4">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Visitas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedFrequentadores.map((freq) => (
                  <TableRow key={freq.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage
                            src={freq.avatar_url || undefined}
                            alt={freq.nome}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/60 text-secondary-foreground font-semibold">
                            {freq.nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {freq.nome}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Frequentador
                            </Badge>
                            {freq.user_id && (
                              <Badge variant="outline" className="text-xs">
                                <UserCheck className="w-3 h-3 mr-1" /> Acesso
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {freq.telefone && (
                          <span className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {formatarTelefone(freq.telefone)}
                          </span>
                        )}
                        {freq.email && (
                          <span className="flex items-center gap-2 truncate">
                            <Mail className="w-4 h-4" />
                            <span className="truncate">{freq.email}</span>
                          </span>
                        )}
                        {freq.data_primeira_visita && (
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            1ª visita:{" "}
                            {format(
                              new Date(freq.data_primeira_visita),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )}
                          </span>
                        )}
                        {freq.data_ultima_visita && (
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Última:{" "}
                            {format(
                              new Date(freq.data_ultima_visita),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs bg-primary/10"
                      >
                        {freq.numero_visitas}{" "}
                        {freq.numero_visitas === 1 ? "visita" : "visitas"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => navigate(`/pessoas/${freq.id}`)}
                      >
                        Ver Perfil
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4}>
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

                {!isLoading && filteredFrequentadores.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Nenhum frequentador encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="block md:hidden space-y-4">
            {paginatedFrequentadores.map((freq) => (
              <Card key={freq.id} className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarImage
                          src={freq.avatar_url || undefined}
                          alt={freq.nome}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-secondary to-secondary/60 text-secondary-foreground font-semibold">
                          {freq.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-base text-foreground truncate">
                          {freq.nome}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            Frequentador
                          </Badge>
                          {freq.user_id && (
                            <Badge variant="outline" className="text-xs">
                              <UserCheck className="w-3 h-3 mr-1" /> Acesso
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-primary/10">
                      {freq.numero_visitas}{" "}
                      {freq.numero_visitas === 1 ? "visita" : "visitas"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    {freq.telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <span>{formatarTelefone(freq.telefone)}</span>
                      </div>
                    )}
                    {freq.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{freq.email}</span>
                      </div>
                    )}
                    {freq.data_primeira_visita && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          1ª visita:{" "}
                          {format(
                            new Date(freq.data_primeira_visita),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                        </span>
                      </div>
                    )}
                    {freq.data_ultima_visita && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Última:{" "}
                          {format(
                            new Date(freq.data_ultima_visita),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 min-h-[44px]"
                      onClick={() => navigate(`/pessoas/${freq.id}`)}
                    >
                      Ver Perfil
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {isLoading && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary"
                  >
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {paginatedFrequentadores.length === 0 && !isLoading && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchTerm
                  ? "Nenhum frequentador encontrado"
                  : "Nenhum frequentador cadastrado"}
              </div>
            )}
          </div>

          {filteredFrequentadores.length > 0 && (
            <Pagination className="mt-6">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
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
                <p className="text-xs text-muted-foreground">
                  Oculta frequentadores sem número cadastrado.
                </p>
              </div>
              <Switch
                checked={filterHasPhone}
                onCheckedChange={setFilterHasPhone}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm">Somente com e-mail</Label>
                <p className="text-xs text-muted-foreground">
                  Oculta frequentadores sem e-mail cadastrado.
                </p>
              </div>
              <Switch
                checked={filterHasEmail}
                onCheckedChange={setFilterHasEmail}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setFilterHasPhone(false);
                setFilterHasEmail(false);
              }}
            >
              Limpar
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Aplicar</Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
