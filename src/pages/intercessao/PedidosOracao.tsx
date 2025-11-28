import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, User, Search, ArrowLeft, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";

const NovoPedidoDialog = React.lazy(() => import("@/components/pedidos/NovoPedidoDialog").then(m => ({ default: m.NovoPedidoDialog })));
const PedidoDetailsDialog = React.lazy(() => import("@/components/pedidos/PedidoDetailsDialog").then(m => ({ default: m.PedidoDetailsDialog })));

interface Pedido {
  id: string;
  tipo: string;
  status: string;
  anonimo: boolean;
  nome_solicitante: string | null;
  pedido: string;
  data_criacao: string;
  intercessor_id: string | null;
  membro_id: string | null;
  intercessores?: {
    nome: string;
  };
  profiles?: {
    nome: string;
  };
}

const TIPO_PEDIDOS = [
  { value: "todos", label: "Todos" },
  { value: "saude", label: "Saúde" },
  { value: "familia", label: "Família" },
  { value: "financeiro", label: "Financeiro" },
  { value: "trabalho", label: "Trabalho" },
  { value: "espiritual", label: "Espiritual" },
  { value: "agradecimento", label: "Agradecimento" },
  { value: "outro", label: "Outro" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "pendente":
      return "bg-accent/20 text-accent-foreground";
    case "em_oracao":
      return "bg-primary/20 text-primary";
    case "respondido":
      return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
    case "arquivado":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted";
  }
};

const getTipoLabel = (tipo: string) => {
  const item = TIPO_PEDIDOS.find(t => t.value === tipo);
  return item?.label || tipo;
};

const getStatusLabel = (status: string) => {
  const statusLabels: Record<string, string> = {
    pendente: "Pendente",
    em_oracao: "Em Oração",
    respondido: "Respondido",
    arquivado: "Arquivado"
  };
  return statusLabels[status] || status;
};

export default function PedidosOracao() {
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [novoPedidoOpen, setNovoPedidoOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedPedido, setSelectedPedido] = React.useState<Pedido | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [tipoFilter, setTipoFilter] = React.useState("todos");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  React.useEffect(() => {
    if (searchParams.get("novo") === "true") {
      setNovoPedidoOpen(true);
    }
  }, [searchParams]);

  const fetchPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos_oracao")
        .select(`
          *,
          intercessores(nome),
          profiles!pedidos_oracao_membro_id_fkey(nome)
        `)
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pedidos de oração",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPedidos();
  }, []);

  const handleAlocarAutomaticamente = async (pedidoId: string) => {
    try {
      const { error } = await supabase.rpc("alocar_pedido_balanceado", {
        p_pedido_id: pedidoId
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pedido alocado automaticamente com sucesso"
      });
      
      fetchPedidos();
    } catch (error) {
      console.error("Erro ao alocar pedido:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alocar o pedido",
        variant: "destructive"
      });
    }
  };

  const filteredPedidos = React.useMemo(() => {
    return pedidos.filter(pedido => {
      const matchesSearch = pedido.pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.nome_solicitante?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pedido.profiles?.nome.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTipo = tipoFilter === "todos" || pedido.tipo === tipoFilter;
      
      return matchesSearch && matchesTipo;
    });
  }, [pedidos, searchTerm, tipoFilter]);

  const renderPedidoCard = (pedido: Pedido) => {
    const solicitante = pedido.anonimo 
      ? "Anônimo"
      : pedido.profiles?.nome || pedido.nome_solicitante || "Não identificado";

    return (
      <Card key={pedido.id} className="shadow-soft hover:shadow-medium transition-shadow">
        <CardHeader className="pb-3 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                {pedido.anonimo ? "?" : solicitante.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base md:text-lg truncate">{solicitante}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(pedido.data_criacao).toLocaleDateString("pt-BR")}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {getTipoLabel(pedido.tipo)}
                  </Badge>
                </div>
              </div>
            </div>
            <Badge className={`${getStatusColor(pedido.status)} whitespace-nowrap text-xs`}>
              {getStatusLabel(pedido.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <p className="text-sm md:text-base text-muted-foreground line-clamp-2">{pedido.pedido}</p>
          
          {pedido.intercessores && (
            <div className="flex items-center gap-2 mt-3 text-xs md:text-sm text-muted-foreground">
              <User className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
              <span>Intercessor: {pedido.intercessores.nome}</span>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              className="w-full sm:w-auto text-xs md:text-sm"
              onClick={() => {
                setSelectedPedido(pedido);
                setDetailsOpen(true);
              }}
            >
              Ver Detalhes
            </Button>
            {pedido.status === "pendente" && (
              <Button 
                variant="outline" 
                size="sm"
                className="w-full sm:w-auto text-xs md:text-sm"
                onClick={() => handleAlocarAutomaticamente(pedido.id)}
              >
                Alocar Automaticamente
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando pedidos...</p>
      </div>
    );
  }

  const pedidosPorStatus = {
    pendente: filteredPedidos.filter(p => p.status === "pendente"),
    em_oracao: filteredPedidos.filter(p => p.status === "em_oracao"),
    respondido: filteredPedidos.filter(p => p.status === "respondido"),
    arquivado: filteredPedidos.filter(p => p.status === "arquivado")
  };

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/intercessao")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pedidos de Oração</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie e acompanhe os pedidos de oração
          </p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft"
          onClick={() => setNovoPedidoOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Novo Pedido</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 md:p-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedidos..."
              className="pl-10 text-sm md:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {TIPO_PEDIDOS.map((tipo) => (
              <Button
                key={tipo.value}
                variant={tipoFilter === tipo.value ? "default" : "outline"}
                size="sm"
                className="whitespace-nowrap text-xs"
                onClick={() => setTipoFilter(tipo.value)}
              >
                {tipo.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="todos" className="text-xs md:text-sm">
            Todos ({filteredPedidos.length})
          </TabsTrigger>
          <TabsTrigger value="pendente" className="text-xs md:text-sm">
            Pendentes ({pedidosPorStatus.pendente.length})
          </TabsTrigger>
          <TabsTrigger value="em_oracao" className="text-xs md:text-sm">
            Em Oração ({pedidosPorStatus.em_oracao.length})
          </TabsTrigger>
          <TabsTrigger value="respondido" className="text-xs md:text-sm">
            Respondidos ({pedidosPorStatus.respondido.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
          {filteredPedidos.length === 0 ? (
            <Card className="p-6 md:p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
            </Card>
          ) : (
            <div className="grid gap-3 md:gap-4">
              {filteredPedidos.map(renderPedidoCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pendente" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
          <div className="grid gap-3 md:gap-4">
            {pedidosPorStatus.pendente.length === 0 ? (
              <Card className="p-6 md:p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum pedido pendente</p>
              </Card>
            ) : (
              pedidosPorStatus.pendente.map(renderPedidoCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="em_oracao" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
          <div className="grid gap-3 md:gap-4">
            {pedidosPorStatus.em_oracao.length === 0 ? (
              <Card className="p-6 md:p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum pedido em oração</p>
              </Card>
            ) : (
              pedidosPorStatus.em_oracao.map(renderPedidoCard)
            )}
          </div>
        </TabsContent>

        <TabsContent value="respondido" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
          <div className="grid gap-3 md:gap-4">
            {pedidosPorStatus.respondido.length === 0 ? (
              <Card className="p-6 md:p-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum pedido respondido</p>
              </Card>
            ) : (
              pedidosPorStatus.respondido.map(renderPedidoCard)
            )}
          </div>
        </TabsContent>
      </Tabs>

      <React.Suspense fallback={null}>
        <NovoPedidoDialog 
          open={novoPedidoOpen}
          onOpenChange={setNovoPedidoOpen}
          onSuccess={fetchPedidos}
        />

        {selectedPedido && (
          <PedidoDetailsDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            pedido={selectedPedido}
            onUpdate={fetchPedidos}
          />
        )}
      </React.Suspense>
    </div>
  );
}
