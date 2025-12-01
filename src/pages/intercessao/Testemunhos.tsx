import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Heart, Clock, ArrowLeft, Search, Filter, Download } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, formatDateTimeForExport } from "@/lib/exportUtils";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NovoTestemunhoDialog } from "@/components/testemunhos/NovoTestemunhoDialog";
import { TestemunhoDetailsDialog } from "@/components/testemunhos/TestemunhoDetailsDialog";

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

export default function Testemunhos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [testemunhos, setTestemunhos] = useState<Testemunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [statusTab, setStatusTab] = useState("aberto");
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const [selectedTestemunho, setSelectedTestemunho] = useState<Testemunho | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const fetchTestemunhos = async () => {
    try {
      const { data, error } = await supabase
        .from("testemunhos")
        .select(`
          *,
          profiles!testemunhos_autor_id_fkey(nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTestemunhos(data || []);
    } catch (error) {
      console.error("Erro ao buscar testemunhos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os testemunhos",
        variant: "destructive"
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

  useEffect(() => {
    fetchTestemunhos();
  }, []);
  
  const filteredTestemunhos = testemunhos.filter(t => {
    const nomeExibido = getNomeExibicao(t);
    const matchesSearch = nomeExibido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mensagem.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoriaFilter === "todos" || t.categoria === categoriaFilter;
    const matchesStatus = t.status === statusTab;
    return matchesSearch && matchesCategoria && matchesStatus;
  });

  const getCategoriaLabel = (categoria: string) => {
    const item = CATEGORIAS.find(c => c.value === categoria);
    return item?.label || categoria;
  };

  const testemunhosPorStatus = {
    aberto: testemunhos.filter(t => t.status === "aberto").length,
    publico: testemunhos.filter(t => t.status === "publico").length,
    arquivado: testemunhos.filter(t => t.status === "arquivado").length,
  };

  const handleExportar = () => {
    try {
      if (!filteredTestemunhos || filteredTestemunhos.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há dados para exportar",
          variant: "destructive"
        });
        return;
      }

      const dadosExportacao = filteredTestemunhos.map(t => ({
        'Autor': getNomeExibicao(t),
        'Título': t.titulo,
        'Mensagem': t.mensagem,
        'Categoria': getCategoriaLabel(t.categoria),
        'Status': t.status,
        'Publicar': t.publicar ? 'Sim' : 'Não',
        'Data Criação': formatDateTimeForExport(t.created_at),
        'Data Publicação': formatDateTimeForExport(t.data_publicacao),
      }));

      exportToExcel(dadosExportacao, 'Testemunhos', 'Testemunhos');
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

  if (loading) {
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
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Carregando testemunhos...</p>
        </Card>
      </div>
    );
  }

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
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleExportar}
          >
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
            {filteredTestemunhos.map((testemunho) => (
              <Card 
                key={testemunho.id} 
                className="shadow-soft hover:shadow-medium transition-shadow"
              >
                <CardHeader className="pb-3 p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-accent flex items-center justify-center flex-shrink-0">
                        <Heart className="w-4 h-4 md:w-5 md:h-5 text-accent-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base md:text-lg truncate">{testemunho.titulo}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{getNomeExibicao(testemunho)}</span>
                          <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">
                            {new Date(testemunho.created_at).toLocaleDateString("pt-BR")}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getCategoriaLabel(testemunho.categoria)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {testemunho.publicar ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 whitespace-nowrap text-xs">
                        Publicado
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
                    {testemunho.mensagem}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mt-3 md:mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full sm:w-auto text-xs md:text-sm"
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
                        className="text-primary w-full sm:w-auto text-xs md:text-sm"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("testemunhos")
                              .update({ 
                                publicar: true,
                                data_publicacao: new Date().toISOString()
                              })
                              .eq("id", testemunho.id);

                            if (error) throw error;

                            toast({
                              title: "Sucesso",
                              description: "Testemunho publicado com sucesso"
                            });

                            fetchTestemunhos();
                          } catch (error) {
                            console.error("Erro ao publicar:", error);
                            toast({
                              title: "Erro",
                              description: "Não foi possível publicar o testemunho",
                              variant: "destructive"
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
                        className="w-full sm:w-auto text-xs md:text-sm"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("testemunhos")
                              .update({ status: "publico" })
                              .eq("id", testemunho.id);

                            if (error) throw error;

                            toast({
                              title: "Sucesso",
                              description: "Testemunho tornado público"
                            });

                            fetchTestemunhos();
                          } catch (error) {
                            console.error("Erro ao tornar público:", error);
                            toast({
                              title: "Erro",
                              description: "Não foi possível tornar o testemunho público",
                              variant: "destructive"
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

            {filteredTestemunhos.length === 0 && (
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

      {/* Dialogs */}
      <NovoTestemunhoDialog
        open={novoDialogOpen}
        onOpenChange={setNovoDialogOpen}
        onSuccess={fetchTestemunhos}
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
