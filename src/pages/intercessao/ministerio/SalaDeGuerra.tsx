import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Heart,
  Sparkles,
  Users,
  Plus,
  Clock,
  Search,
  Download,
  Church,
  Home,
  Briefcase,
  DollarSign,
  Smile,
  User,
  CheckCircle,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { exportToExcel, formatDateTimeForExport } from "@/lib/exportUtils";
import { NovoPedidoDialog } from "@/components/pedidos/NovoPedidoDialog";
import { PedidoDetailsDialog } from "@/components/pedidos/PedidoDetailsDialog";
import { NovoTestemunhoDialog } from "@/components/testemunhos/NovoTestemunhoDialog";
import { TestemunhoDetailsDialog } from "@/components/testemunhos/TestemunhoDetailsDialog";
import { useFilialId } from "@/hooks/useFilialId";

interface Pedido {
  id: string;
  tipo: string;
  status: string;
  anonimo: boolean;
  nome_solicitante: string | null;
  pedido: string;
  data_criacao: string;
  intercessor_id: string | null;
  intercessores?: { nome: string };
  profiles?: { nome: string };
}

interface Testemunho {
  id: string;
  titulo: string;
  mensagem: string;
  categoria: string;
  status: string;
  publicar: boolean;
  created_at: string;
  autor_id: string;
  anonimo: boolean;
  profiles: { nome: string } | null;
}

const TIPO_PEDIDOS = [
  { value: "todos", label: "Todos os Tipos", icon: Smile },
  { value: "saude", label: "Saúde", icon: Heart },
  { value: "familia", label: "Família", icon: Home },
  { value: "financeiro", label: "Financeiro", icon: DollarSign },
  { value: "trabalho", label: "Trabalho", icon: Briefcase },
  { value: "espiritual", label: "Espiritual", icon: Church },
  { value: "agradecimento", label: "Agradecimento", icon: Sparkles },
  { value: "outro", label: "Outro", icon: Smile },
];

const CATEGORIAS_TESTEMUNHOS = [
  { value: "todos", label: "Todos os Tipos", icon: Smile },
  { value: "espiritual", label: "Área Espiritual", icon: Church },
  { value: "casamento", label: "Casamento", icon: Heart },
  { value: "familia", label: "Família", icon: Home },
  { value: "saude", label: "Saúde", icon: Heart },
  { value: "trabalho", label: "Trabalho", icon: Briefcase },
  { value: "financeiro", label: "Vida Financeira", icon: DollarSign },
  { value: "ministerial", label: "Vida Ministerial", icon: Users },
  { value: "outro", label: "Outros", icon: Smile },
];

export default function SalaDeGuerra() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"pedidos" | "testemunhos">(
    "pedidos"
  );

  // Pedidos
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [searchPedidos, setSearchPedidos] = useState("");
  const [statusFilterPedidos, setStatusFilterPedidos] = useState("todos");
  const [tipoFilterPedidos, setTipoFilterPedidos] = useState("todos");
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [pedidoDetailsOpen, setPedidoDetailsOpen] = useState(false);

  // Testemunhos
  const [testemunhos, setTestemunhos] = useState<Testemunho[]>([]);
  const [searchTestemunhos, setSearchTestemunhos] = useState("");
  const [statusFilterTestemunhos, setStatusFilterTestemunhos] =
    useState("aberto");
  const [categoriaFilter, setCategoriaFilter] = useState("todos");
  const [novoTestemunhoOpen, setNovoTestemunhoOpen] = useState(false);
  const [selectedTestemunho, setSelectedTestemunho] =
    useState<Testemunho | null>(null);
  const [testemunhoDetailsOpen, setTestemunhoDetailsOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  // Fetch Pedidos
  const fetchPedidos = async () => {
    try {
      if (!igrejaId) return;
      let query = supabase
        .from("pedidos_oracao")
        .select(
          `
          *,
          intercessores(nome),
          profiles!pedidos_oracao_pessoa_id_fkey(nome)
        `
        )
        .eq("igreja_id", igrejaId)
        .order("data_criacao", { ascending: false });
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

      const { data, error } = await query;

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error("Não foi possível carregar os pedidos");
    }
  };

  // Fetch Testemunhos
  const fetchTestemunhos = async () => {
    try {
      if (!igrejaId) return;
      let query = supabase
        .from("testemunhos")
        .select(
          `
          *,
          profiles!testemunhos_autor_id_fkey(nome)
        `
        )
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);

      const { data, error } = await query;

      if (error) throw error;
      setTestemunhos(data || []);
    } catch (error) {
      console.error("Erro ao buscar testemunhos:", error);
      toast.error("Não foi possível carregar os testemunhos");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchPedidos(), fetchTestemunhos()]);
      setLoading(false);
    };
    fetchData();
  }, [igrejaId, filialId, isAllFiliais]);

  // Filtros Pedidos
  const filteredPedidos = pedidos.filter((p) => {
    const matchSearch =
      p.pedido?.toLowerCase().includes(searchPedidos.toLowerCase()) ||
      p.nome_solicitante?.toLowerCase().includes(searchPedidos.toLowerCase());
    const matchStatus =
      statusFilterPedidos === "todos" || p.status === statusFilterPedidos;
    const matchTipo =
      tipoFilterPedidos === "todos" || p.tipo === tipoFilterPedidos;
    return matchSearch && matchStatus && matchTipo;
  });

  // Filtros Testemunhos
  const filteredTestemunhos = testemunhos.filter((t) => {
    const matchSearch =
      t.titulo?.toLowerCase().includes(searchTestemunhos.toLowerCase()) ||
      t.mensagem?.toLowerCase().includes(searchTestemunhos.toLowerCase());
    const matchCategoria =
      categoriaFilter === "todos" || t.categoria === categoriaFilter;
    const matchStatus =
      statusFilterTestemunhos === "aberto"
        ? t.status === "aberto"
        : statusFilterTestemunhos === "publico"
        ? t.publicar === true
        : t.status === "arquivado";
    return matchSearch && matchCategoria && matchStatus;
  });

  // Helper para exibir nome do solicitante
  const getNomeSolicitante = (pedido: Pedido) => {
    if (pedido.anonimo) return "Anônimo";
    return (
      pedido.profiles?.nome || pedido.nome_solicitante || "Não identificado"
    );
  };

  // Atribuir pedido ao usuário atual
  const handleAtribuirPedido = async (
    pedidoId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Evita abrir o dialog

    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    try {
      const { error } = await supabase
        .from("pedidos_oracao")
        .update({
          intercessor_id: user.id,
          status: "em_oracao",
          data_alocacao: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      toast.success("Pedido atribuído com sucesso!");
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao atribuir pedido:", error);
      toast.error("Erro ao atribuir pedido");
    }
  };

  // Marcar pedido como orado
  const handleMarcarComoOrado = async (
    pedidoId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Evita abrir o dialog

    try {
      const { error } = await supabase
        .from("pedidos_oracao")
        .update({
          status: "respondido",
          data_resposta: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      toast.success("Pedido marcado como respondido!");
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao marcar pedido:", error);
      toast.error("Erro ao marcar pedido");
    }
  };

  // Export Pedidos
  const handleExportPedidos = () => {
    const exportData = filteredPedidos.map((p) => ({
      Data: formatDateTimeForExport(p.data_criacao),
      Solicitante: p.anonimo
        ? "Anônimo"
        : p.nome_solicitante || "Não informado",
      Tipo: p.tipo,
      Status: p.status,
      Pedido: p.pedido,
      Intercessor: p.intercessores?.nome || "Não atribuído",
    }));
    exportToExcel(
      exportData,
      `pedidos_oracao_${new Date().toISOString().split("T")[0]}`
    );
    toast.success("Pedidos exportados com sucesso!");
  };

  // Export Testemunhos
  const handleExportTestemunhos = () => {
    const exportData = filteredTestemunhos.map((t) => ({
      Data: formatDateTimeForExport(t.created_at),
      Autor: t.anonimo ? "Anônimo" : t.profiles?.nome || "Não informado",
      Título: t.titulo,
      Categoria: t.categoria,
      Status: t.status,
      Publicar: t.publicar ? "Sim" : "Não",
      Mensagem: t.mensagem,
    }));
    exportToExcel(
      exportData,
      `testemunhos_${new Date().toISOString().split("T")[0]}`
    );
    toast.success("Testemunhos exportados com sucesso!");
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: "Pendente",
      em_oracao: "Em Oração",
      respondido: "Respondido",
      arquivado: "Arquivado",
      aberto: "Aberto",
      publico: "Público",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pendente: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20",
      em_oracao: "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
      respondido: "bg-green-100 text-green-700 dark:bg-green-900/20",
      arquivado: "bg-gray-100 text-gray-700 dark:bg-gray-900/20",
      aberto: "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
    };
    return colors[status] || "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-soft">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="p-0 h-auto w-auto"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Sala de Guerra</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Área de trabalho dos intercessores - ore pelos pedidos da
                comunidade
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "pedidos" | "testemunhos")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="pedidos" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Pedidos de Oração
            </TabsTrigger>
            <TabsTrigger
              value="testemunhos"
              className="flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Testemunhos
            </TabsTrigger>
          </TabsList>

          {/* Tab: Pedidos */}
          <TabsContent value="pedidos" className="space-y-4">
            {/* Filtros */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Filtros de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <Input
                    placeholder="Buscar por pedido ou solicitante..."
                    value={searchPedidos}
                    onChange={(e) => setSearchPedidos(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={statusFilterPedidos}
                    onValueChange={setStatusFilterPedidos}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_oracao">Em Oração</SelectItem>
                      <SelectItem value="respondido">Respondido</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={tipoFilterPedidos}
                    onValueChange={setTipoFilterPedidos}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_PEDIDOS.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleExportPedidos}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {filteredPedidos.length}{" "}
                {filteredPedidos.length === 1
                  ? "pedido encontrado"
                  : "pedidos encontrados"}
              </p>
              <Button onClick={() => setNovoPedidoOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>
            </div>

            {/* Lista de Pedidos */}
            {loading ? (
              <Card className="shadow-soft">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Carregando pedidos...</p>
                </CardContent>
              </Card>
            ) : filteredPedidos.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhum pedido encontrado
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPedidos.map((pedido) => (
                  <Card
                    key={pedido.id}
                    className="shadow-soft hover:shadow-medium transition-all"
                  >
                    <CardHeader className="pb-3 p-4 md:p-6">
                      <div className="flex flex-col gap-3">
                        <div
                          className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 cursor-pointer"
                          onClick={() => {
                            setSelectedPedido(pedido);
                            setPedidoDetailsOpen(true);
                          }}
                        >
                          <div className="flex-1">
                            <CardTitle className="text-base mb-2">
                              {pedido.pedido}
                            </CardTitle>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs">
                                {pedido.tipo}
                              </Badge>
                              <Badge
                                className={`text-xs ${getStatusColor(
                                  pedido.status
                                )}`}
                              >
                                {getStatusLabel(pedido.status)}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {getNomeSolicitante(pedido)}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(
                                  pedido.data_criacao
                                ).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botões de Ação Rápida */}
                        <div className="flex flex-wrap gap-2">
                          {pedido.status === "pendente" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) =>
                                handleAtribuirPedido(pedido.id, e)
                              }
                              className="flex-1 sm:flex-none"
                            >
                              <UserPlus className="w-4 h-4 mr-2" />
                              Atribuir a mim
                            </Button>
                          )}
                          {pedido.status === "em_oracao" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) =>
                                handleMarcarComoOrado(pedido.id, e)
                              }
                              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Marcar como Orado
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedPedido(pedido);
                              setPedidoDetailsOpen(true);
                            }}
                            className="flex-1 sm:flex-none"
                          >
                            Ver Detalhes
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Testemunhos */}
          <TabsContent value="testemunhos" className="space-y-4">
            {/* Filtros */}
            <Card className="shadow-soft">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Filtros de Testemunhos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <Input
                    placeholder="Buscar por título ou mensagem..."
                    value={searchTestemunhos}
                    onChange={(e) => setSearchTestemunhos(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={statusFilterTestemunhos}
                    onValueChange={(v) =>
                      setStatusFilterTestemunhos(
                        v as "aberto" | "publico" | "arquivado"
                      )
                    }
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="publico">Público</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={categoriaFilter}
                    onValueChange={setCategoriaFilter}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_TESTEMUNHOS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleExportTestemunhos}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {filteredTestemunhos.length}{" "}
                {filteredTestemunhos.length === 1
                  ? "testemunho encontrado"
                  : "testemunhos encontrados"}
              </p>
              <Button onClick={() => setNovoTestemunhoOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Testemunho
              </Button>
            </div>

            {/* Lista de Testemunhos */}
            {loading ? (
              <Card className="shadow-soft">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Carregando testemunhos...
                  </p>
                </CardContent>
              </Card>
            ) : filteredTestemunhos.length === 0 ? (
              <Card className="shadow-soft">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhum testemunho encontrado
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTestemunhos.map((testemunho) => (
                  <Card
                    key={testemunho.id}
                    className="shadow-soft hover:shadow-medium transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedTestemunho(testemunho);
                      setTestemunhoDetailsOpen(true);
                    }}
                  >
                    <CardHeader className="pb-3 p-4 md:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1">
                          <CardTitle className="text-base mb-2">
                            {testemunho.titulo}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {testemunho.mensagem}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                              {testemunho.categoria}
                            </Badge>
                            {testemunho.publicar ? (
                              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/20">
                                Publicado
                              </Badge>
                            ) : (
                              <Badge
                                className={`text-xs ${getStatusColor(
                                  testemunho.status
                                )}`}
                              >
                                {getStatusLabel(testemunho.status)}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {testemunho.anonimo
                                ? "Anônimo"
                                : testemunho.profiles?.nome || "Não informado"}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(
                                testemunho.created_at
                              ).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <NovoPedidoDialog
        open={novoPedidoOpen}
        onOpenChange={setNovoPedidoOpen}
        onSuccess={fetchPedidos}
      />
      {selectedPedido && (
        <PedidoDetailsDialog
          open={pedidoDetailsOpen}
          onOpenChange={setPedidoDetailsOpen}
          pedido={selectedPedido}
          onUpdate={fetchPedidos}
        />
      )}
      <NovoTestemunhoDialog
        open={novoTestemunhoOpen}
        onOpenChange={setNovoTestemunhoOpen}
        onSuccess={fetchTestemunhos}
      />
      {selectedTestemunho && (
        <TestemunhoDetailsDialog
          open={testemunhoDetailsOpen}
          onOpenChange={(open) => {
            setTestemunhoDetailsOpen(open);
            if (!open) fetchTestemunhos();
          }}
          testemunho={selectedTestemunho}
          onSuccess={fetchTestemunhos}
        />
      )}
    </div>
  );
}
