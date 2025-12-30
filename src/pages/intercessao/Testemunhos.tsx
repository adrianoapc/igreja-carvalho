import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Heart,
  Clock,
  ArrowLeft,
  Search,
  Filter,
  Download,
  Church,
  Home,
  Briefcase,
  DollarSign,
  Users,
  Smile,
} from "lucide-react";
import { exportToExcel, formatDateTimeForExport } from "@/lib/exportUtils";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NovoTestemunhoDialog } from "@/components/testemunhos/NovoTestemunhoDialog";
import { TestemunhoDetailsDialog } from "@/components/testemunhos/TestemunhoDetailsDialog";

// UX Update 2025-12-30

interface Testemunho {
  id: string;
  titulo: string;
  mensagem: string;
  categoria: string;
  status: string;
  publicar: boolean;
  data_publicacao: string | null;
  created_at: string;
  autor_id: string;
  anonimo: boolean;
  nome_externo: string | null;
  email_externo: string | null;
  telefone_externo: string | null;
  pessoa_id: string | null;
  profiles: {
    nome: string;
  } | null;
}

const CATEGORIAS = [
  { value: "todos", label: "Todos", icon: Smile },
  { value: "espiritual", label: "Área Espiritual", icon: Church },
  { value: "casamento", label: "Casamento", icon: Heart },
  { value: "familia", label: "Família", icon: Home },
  { value: "saude", label: "Saúde", icon: Heart },
  { value: "trabalho", label: "Trabalho", icon: Briefcase },
  { value: "financeiro", label: "Vida Financeira", icon: DollarSign },
  { value: "ministerial", label: "Vida Ministerial", icon: Users },
  { value: "outro", label: "Outros", icon: Smile },
];

interface LocationState {
  openNew?: boolean;
  content?: string;
}

export default function Testemunhos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [testemunhos, setTestemunhos] = useState<Testemunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<
    "aberto" | "publico" | "arquivado"
  >("aberto");
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const [selectedTestemunho, setSelectedTestemunho] =
    useState<Testemunho | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [initialContent, setInitialContent] = useState<string>("");

  const fetchTestemunhos = async () => {
    try {
      const { data, error } = await supabase
        .from("testemunhos")
        .select(
          `
          *,
          profiles!testemunhos_autor_id_fkey(nome)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTestemunhos(data || []);
    } catch (error) {
      console.error("Erro ao buscar testemunhos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os testemunhos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNomeExibicao = (testemunho: Testemunho) => {
    if (testemunho.anonimo) return "Anônimo";
    if (testemunho.profiles?.nome) return testemunho.profiles.nome;
    if (testemunho.nome_externo) return testemunho.nome_externo;
    return "Não identificado";
  };

  // Check for navigation state to auto-open dialog with pre-filled content
  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.openNew) {
      setInitialContent(state.content || "");
      setNovoDialogOpen(true);
      // Clear the state to prevent re-opening on navigation
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    fetchTestemunhos();
  }, []);

  const filteredTestemunhos = testemunhos.filter((t) => {
    const nomeExibido = getNomeExibicao(t);
    const matchesSearch =
      nomeExibido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mensagem.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria =
      categoriaFilter === "todos" || t.categoria === categoriaFilter;
    const matchesStatus = t.status === statusFilter;
    return matchesSearch && matchesCategoria && matchesStatus;
  });

  const getCategoriaLabel = (categoria: string) => {
    const item = CATEGORIAS.find((c) => c.value === categoria);
    return item?.label || categoria;
  };

  const testemunhosPorStatus = {
    aberto: testemunhos.filter((t) => t.status === "aberto").length,
    publico: testemunhos.filter((t) => t.status === "publico").length,
    arquivado: testemunhos.filter((t) => t.status === "arquivado").length,
  };

  const handleExportar = () => {
    try {
      if (!filteredTestemunhos || filteredTestemunhos.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há dados para exportar",
          variant: "destructive",
        });
        return;
      }

      const dadosExportacao = filteredTestemunhos.map((t) => ({
        Autor: getNomeExibicao(t),
        Título: t.titulo,
        Mensagem: t.mensagem,
        Categoria: getCategoriaLabel(t.categoria),
        Status: t.status,
        Publicar: t.publicar ? "Sim" : "Não",
        "Data Criação": formatDateTimeForExport(t.created_at),
        "Data Publicação": formatDateTimeForExport(t.data_publicacao),
      }));

      exportToExcel(dadosExportacao, "Testemunhos", "Testemunhos");
      toast({
        title: "Sucesso",
        description: "Dados exportados com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro",
        description: "Erro ao exportar dados",
        variant: "destructive",
      });
    }
  };

  // Renderizar layout mesmo durante loading

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/intercessao")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Testemunhos
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Compartilhe as bênçãos e milagres
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button
            className="bg-gradient-primary shadow-soft"
            onClick={() => setNovoDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Novo Testemunho</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Busca e Filtros */}
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, autor, mensagem..."
                className="pl-10 text-base md:text-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">
                  Meus ({testemunhosPorStatus.aberto.length})
                </SelectItem>
                <SelectItem value="publico">
                  Públicos ({testemunhosPorStatus.publico.length})
                </SelectItem>
                <SelectItem value="arquivado">
                  Arquivados ({testemunhosPorStatus.arquivado.length})
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((categoria) => {
                  const Icon = categoria.icon;
                  const count = testemunhos.filter(
                    (t) =>
                      (categoria.value === "todos" ||
                        t.categoria === categoria.value) &&
                      t.status === statusFilter
                  ).length;
                  return (
                    <SelectItem key={categoria.value} value={categoria.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {categoria.label} ({count})
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3 md:space-y-4">
        {loading ? (
          <Card className="shadow-soft">
            <CardContent className="p-8 md:p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Carregando testemunhos...
              </p>
            </CardContent>
          </Card>
        ) : filteredTestemunhos.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="p-8 md:p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Heart className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">
                    {searchTerm || categoriaFilter !== "todos"
                      ? "Nenhum testemunho encontrado"
                      : "Nenhum testemunho nesta categoria"}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {searchTerm || categoriaFilter !== "todos"
                      ? "Tente ajustar os filtros ou termos de busca"
                      : "Os testemunhos aparecerão aqui conforme forem compartilhados"}
                  </p>
                </div>
                {!searchTerm &&
                  categoriaFilter === "todos" &&
                  statusFilter === "aberto" && (
                    <Button
                      size="sm"
                      className="bg-gradient-primary shadow-soft mt-2"
                      onClick={() => setNovoDialogOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Compartilhar Testemunho
                    </Button>
                  )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {filteredTestemunhos.map((testemunho) => (
              <Card
                key={testemunho.id}
                className="shadow-soft hover:shadow-medium transition-all duration-200 border-l-4"
                style={{
                  borderLeftColor: testemunho.publicar
                    ? "rgb(34, 197, 94)"
                    : "rgb(249, 115, 22)",
                }}
              >
                <CardHeader className="pb-3 p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center flex-shrink-0">
                        <Heart className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base md:text-lg truncate">
                          {testemunho.titulo}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground font-medium">
                            {getNomeExibicao(testemunho)}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                testemunho.created_at
                              ).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {getCategoriaLabel(testemunho.categoria)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {testemunho.publicar ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 whitespace-nowrap text-xs shadow-soft">
                        Publicado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 whitespace-nowrap text-xs shadow-soft">
                        Pendente
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  <p className="text-sm md:text-base text-muted-foreground line-clamp-3 mb-4">
                    {testemunho.mensagem}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto text-xs md:text-sm shadow-soft"
                      onClick={() => {
                        setSelectedTestemunho(testemunho);
                        setDetailsDialogOpen(true);
                      }}
                    >
                      Ver Detalhes
                    </Button>
                    {!testemunho.publicar && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950 w-full sm:w-auto text-xs md:text-sm shadow-soft"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("testemunhos")
                              .update({
                                publicar: true,
                                data_publicacao: new Date().toISOString(),
                              })
                              .eq("id", testemunho.id);

                            if (error) throw error;

                            toast({
                              title: "Sucesso",
                              description: "Testemunho publicado com sucesso",
                            });

                            fetchTestemunhos();
                          } catch (error) {
                            console.error("Erro ao publicar:", error);
                            toast({
                              title: "Erro",
                              description:
                                "Não foi possível publicar o testemunho",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Publicar
                      </Button>
                    )}
                    {testemunho.status === "aberto" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-primary w-full sm:w-auto text-xs md:text-sm shadow-soft"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("testemunhos")
                              .update({ status: "publico" })
                              .eq("id", testemunho.id);

                            if (error) throw error;

                            toast({
                              title: "Sucesso",
                              description: "Testemunho tornado público",
                            });

                            fetchTestemunhos();
                          } catch (error) {
                            console.error("Erro ao tornar público:", error);
                            toast({
                              title: "Erro",
                              description:
                                "Não foi possível tornar o testemunho público",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Tornar Público
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NovoTestemunhoDialog
        open={novoDialogOpen}
        onOpenChange={(open) => {
          setNovoDialogOpen(open);
          if (!open) setInitialContent("");
        }}
        onSuccess={fetchTestemunhos}
        initialContent={initialContent}
      />

      <TestemunhoDetailsDialog
        testemunho={selectedTestemunho}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onSuccess={fetchTestemunhos}
      />
    </div>
  );
}
