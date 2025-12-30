import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MoreVertical, CheckCircle, XCircle, BookOpen, Clock, Users, History, Route } from "lucide-react";
import { Link } from "react-router-dom";
import { getRegraMinisterio } from "@/lib/voluntariado/triagem";

interface Candidato {
  id: string;
  nome_contato: string;
  telefone_contato: string | null;
  email_contato: string | null;
  ministerio: string;
  disponibilidade: string;
  experiencia: string;
  observacoes: string | null;
  status: string;
  created_at: string;
  pessoa_id: string | null;
}

const statusOptions = [
  { value: "todos", label: "Todos os status" },
  { value: "pendente", label: "Pendente" },
  { value: "em_analise", label: "Em Análise" },
  { value: "aprovado", label: "Aprovado" },
  { value: "em_trilha", label: "Em Trilha" },
  { value: "rejeitado", label: "Rejeitado" },
];

interface Jornada {
  id: string;
  titulo: string;
}

export default function Candidatos() {
  const { toast } = useToast();
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    fetchCandidatos();
    fetchJornadas();
  }, [statusFilter]);

  const fetchJornadas = async () => {
    const { data } = await supabase
      .from("jornadas")
      .select("id, titulo")
      .eq("ativo", true)
      .order("titulo");
    if (data) setJornadas(data);
  };

  const fetchCandidatos = async () => {
    setLoading(true);
    let query = supabase
      .from("candidatos_voluntario")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter !== "todos") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setCandidatos(data);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("candidatos_voluntario")
      .update({ status: newStatus, data_avaliacao: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status atualizado",
        description: `Candidato movido para ${newStatus}`,
      });
      fetchCandidatos();
    }
  };

  const enviarParaTrilha = async (candidato: Candidato, jornadaId: string) => {
    // Buscar perfil do usuário logado para registrar quem fez a ação
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    const { error } = await supabase
      .from("candidatos_voluntario")
      .update({
        status: "em_trilha",
        trilha_requerida_id: jornadaId,
        data_avaliacao: new Date().toISOString(),
        avaliado_por: userProfile?.id || null,
      })
      .eq("id", candidato.id);

    if (error) {
      toast({
        title: "Erro ao vincular trilha",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const trilhaNome = jornadas.find((j) => j.id === jornadaId)?.titulo;
      toast({
        title: "Trilha vinculada",
        description: `Candidato enviado para ${trilhaNome}`,
      });
      fetchCandidatos();
    }
  };

  const getTrilhaSugerida = (ministerio: string) => {
    const regra = getRegraMinisterio({ nome: ministerio });
    if (regra) {
      return jornadas.find((j) => 
        j.titulo.toLowerCase().includes(regra.trilhaTitulo.toLowerCase().replace("trilha ", ""))
      );
    }
    return jornadas.find((j) => j.titulo.toLowerCase().includes("integração"));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pendente: "bg-yellow-50 text-yellow-700 border-yellow-200",
      em_analise: "bg-blue-50 text-blue-700 border-blue-200",
      aprovado: "bg-green-50 text-green-700 border-green-200",
      em_trilha: "bg-purple-50 text-purple-700 border-purple-200",
      rejeitado: "bg-red-50 text-red-700 border-red-200",
    };
    const labels: Record<string, string> = {
      pendente: "Pendente",
      em_analise: "Em Análise",
      aprovado: "Aprovado",
      em_trilha: "Em Trilha",
      rejeitado: "Rejeitado",
    };
    return (
      <Badge variant="outline" className={styles[status] || ""}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  };

  const filteredCandidatos = candidatos.filter((c) =>
    c.nome_contato.toLowerCase().includes(search.toLowerCase()) ||
    c.ministerio.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: candidatos.length,
    pendentes: candidatos.filter((c) => c.status === "pendente").length,
    emAnalise: candidatos.filter((c) => c.status === "em_analise").length,
    aprovados: candidatos.filter((c) => c.status === "aprovado").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Candidatos a Voluntário</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie as inscrições de voluntariado
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/voluntariado/historico">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Em Análise</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{stats.emAnalise}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Aprovados</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.aprovados}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Candidatos</CardTitle>
          <CardDescription>
            Revise e gerencie as inscrições de voluntariado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou ministério..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : filteredCandidatos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum candidato encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidato</TableHead>
                    <TableHead>Ministério</TableHead>
                    <TableHead>Disponibilidade</TableHead>
                    <TableHead>Experiência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidatos.map((candidato) => (
                    <TableRow key={candidato.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(candidato.nome_contato)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{candidato.nome_contato}</p>
                            {candidato.telefone_contato && (
                              <p className="text-xs text-muted-foreground">{candidato.telefone_contato}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{candidato.ministerio}</TableCell>
                      <TableCell className="text-sm">{candidato.disponibilidade}</TableCell>
                      <TableCell className="text-sm">{candidato.experiencia}</TableCell>
                      <TableCell>{getStatusBadge(candidato.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(candidato.created_at), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(candidato.id, "em_analise")}>
                              <Search className="h-4 w-4 mr-2" />
                              Iniciar Análise
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(candidato.id, "aprovado")}>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Aprovar
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <BookOpen className="h-4 w-4 mr-2 text-purple-600" />
                                Enviar p/ Trilha
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {(() => {
                                  const sugerida = getTrilhaSugerida(candidato.ministerio);
                                  return jornadas.map((jornada) => (
                                    <DropdownMenuItem
                                      key={jornada.id}
                                      onClick={() => enviarParaTrilha(candidato, jornada.id)}
                                    >
                                      <Route className="h-4 w-4 mr-2" />
                                      {jornada.titulo}
                                      {sugerida?.id === jornada.id && (
                                        <Badge variant="secondary" className="ml-2 text-xs">
                                          Sugerida
                                        </Badge>
                                      )}
                                    </DropdownMenuItem>
                                  ));
                                })()}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuItem onClick={() => updateStatus(candidato.id, "rejeitado")}>
                              <XCircle className="h-4 w-4 mr-2 text-red-600" />
                              Rejeitar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
