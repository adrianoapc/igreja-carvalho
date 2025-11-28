import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Lazy load components to avoid circular dependencies
const NovoPedidoDialog = React.lazy(() => import("@/components/pedidos/NovoPedidoDialog").then(m => ({ default: m.NovoPedidoDialog })));
const PedidoDetailsDialog = React.lazy(() => import("@/components/pedidos/PedidoDetailsDialog").then(m => ({ default: m.PedidoDetailsDialog })));
const IntercessoresManager = React.lazy(() => import("@/components/pedidos/IntercessoresManager").then(m => ({ default: m.IntercessoresManager })));

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
  const tipos: Record<string, string> = {
    saude: "Saúde",
    familia: "Família",
    financeiro: "Financeiro",
    trabalho: "Trabalho",
    espiritual: "Espiritual",
    agradecimento: "Agradecimento",
    outro: "Outro"
  };
  return tipos[tipo] || tipo;
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

export default function Oracoes() {
  const [pedidos, setPedidos] = React.useState<Pedido[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [novoPedidoOpen, setNovoPedidoOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedPedido, setSelectedPedido] = React.useState<Pedido | null>(null);
  const { toast } = useToast();

  const fetchPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos_oracao")
        .select(`
          *,
          intercessores(nome),
          profiles(nome)
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

  const renderPedidoCard = (pedido: Pedido) => {
    const solicitante = pedido.anonimo 
      ? "Anônimo"
      : pedido.profiles?.nome || pedido.nome_solicitante || "Não identificado";

    return (
      <Card key={pedido.id} className="shadow-soft hover:shadow-medium transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                {pedido.anonimo ? "?" : solicitante.charAt(0)}
              </div>
              <div>
                <CardTitle className="text-lg">{solicitante}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(pedido.data_criacao).toLocaleDateString("pt-BR")}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {getTipoLabel(pedido.tipo)}
                  </Badge>
                </div>
              </div>
            </div>
            <Badge className={getStatusColor(pedido.status)}>
              {getStatusLabel(pedido.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground line-clamp-2">{pedido.pedido}</p>
          
          {pedido.intercessores && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Intercessor: {pedido.intercessores.nome}</span>
            </div>
          )}
          
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
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
    pendente: pedidos.filter(p => p.status === "pendente"),
    em_oracao: pedidos.filter(p => p.status === "em_oracao"),
    respondido: pedidos.filter(p => p.status === "respondido"),
    arquivado: pedidos.filter(p => p.status === "arquivado")
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pedidos de Oração</h1>
          <p className="text-muted-foreground mt-1">Gerencie e acompanhe os pedidos de oração</p>
        </div>
        <Button 
          className="bg-gradient-primary shadow-soft"
          onClick={() => setNovoPedidoOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="todos">
            Todos ({pedidos.length})
          </TabsTrigger>
          <TabsTrigger value="pendente">
            Pendentes ({pedidosPorStatus.pendente.length})
          </TabsTrigger>
          <TabsTrigger value="em_oracao">
            Em Oração ({pedidosPorStatus.em_oracao.length})
          </TabsTrigger>
          <TabsTrigger value="respondido">
            Respondidos ({pedidosPorStatus.respondido.length})
          </TabsTrigger>
          <TabsTrigger value="intercessores">
            <Users className="w-4 h-4 mr-2" />
            Intercessores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4 mt-6">
          {pedidos.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum pedido de oração cadastrado</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pedidos.map(renderPedidoCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pendente" className="space-y-4 mt-6">
          <div className="grid gap-4">
            {pedidosPorStatus.pendente.map(renderPedidoCard)}
          </div>
        </TabsContent>

        <TabsContent value="em_oracao" className="space-y-4 mt-6">
          <div className="grid gap-4">
            {pedidosPorStatus.em_oracao.map(renderPedidoCard)}
          </div>
        </TabsContent>

        <TabsContent value="respondido" className="space-y-4 mt-6">
          <div className="grid gap-4">
            {pedidosPorStatus.respondido.map(renderPedidoCard)}
          </div>
        </TabsContent>

        <TabsContent value="intercessores" className="mt-6">
          <React.Suspense fallback={<div className="flex items-center justify-center p-8">Carregando...</div>}>
            <IntercessoresManager />
          </React.Suspense>
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
