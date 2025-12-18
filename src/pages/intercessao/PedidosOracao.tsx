import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Clock, User, Search, ArrowLeft, Filter, Download, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, formatDateTimeForExport } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { NovoPedidoDialog } from "@/components/pedidos/NovoPedidoDialog";
import { PedidoDetailsDialog } from "@/components/pedidos/PedidoDetailsDialog";
import { useAuth } from "@/hooks/useAuth";

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
  pessoa_id: string | null;
  intercessores?: {
    nome: string;
  };
  profiles?: {
    nome: string;
  };
}

type AppRole = 'admin' | 'pastor' | 'lider' | 'secretario' | 'tesoureiro' | 'membro' | 'basico';

const ADMIN_ROLES: AppRole[] = ['admin', 'pastor', 'lider', 'secretario'];

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
  const [meusPedidos, setMeusPedidos] = React.useState<Pedido[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [novoPedidoOpen, setNovoPedidoOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedPedido, setSelectedPedido] = React.useState<Pedido | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [tipoFilter, setTipoFilter] = React.useState("todos");
  const [userRoles, setUserRoles] = React.useState<AppRole[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [initialDescription, setInitialDescription] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    // Abre dialog via query param
    if (searchParams.get("novo") === "true") {
      setNovoPedidoOpen(true);
    }
    
    // Abre dialog via state (vindo de Sentimentos)
    const state = location.state as { openNew?: boolean; description?: string } | null;
    if (state?.openNew) {
      setNovoPedidoOpen(true);
      if (state.description) {
        setInitialDescription(state.description);
      }
      // Limpar state para evitar reabrir ao navegar
      window.history.replaceState({}, document.title);
    }
  }, [searchParams, location.state]);

  React.useEffect(() => {
    if (user?.id) {
      fetchUserRoles();
    }
  }, [user?.id]);

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);

      if (error) throw error;
      
      const roles = data?.map(r => r.role as AppRole) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error('Error fetching user roles:', error);
    }
  };

  // Verifica se é admin/pastor/intercessor
  const isAdminUser = userRoles.some(role => ADMIN_ROLES.includes(role));

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

  // Buscar apenas os pedidos do usuário atual
  const fetchMeusPedidos = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("pedidos_oracao")
        .select(`
          *,
          intercessores(nome),
          profiles!pedidos_oracao_membro_id_fkey(nome)
        `)
        .eq("pessoa_id", profile.id)
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      setMeusPedidos(data || []);
    } catch (error) {
      console.error("Erro ao buscar meus pedidos:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isAdminUser) {
      fetchPedidos();
    } else if (profile?.id) {
      fetchMeusPedidos();
    }
  }, [isAdminUser, profile?.id]);

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

  const handleExportar = () => {
    try {
      if (!filteredPedidos || filteredPedidos.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há dados para exportar",
          variant: "destructive"
        });
        return;
      }

      const dadosExportacao = filteredPedidos.map(p => ({
        'Solicitante': p.anonimo ? 'Anônimo' : (p.profiles?.nome || p.nome_solicitante || 'Não identificado'),
        'Tipo': getTipoLabel(p.tipo),
        'Status': getStatusLabel(p.status),
        'Pedido': p.pedido,
        'Intercessor': p.intercessores?.nome || 'Não alocado',
        'Data Criação': formatDateTimeForExport(p.data_criacao),
      }));

      exportToExcel(dadosExportacao, 'Pedidos_Oracao', 'Pedidos de Oração');
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

  const renderPedidoCard = (pedido: Pedido, showAdminActions: boolean = true) => {
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
            {showAdminActions && pedido.status === "pendente" && (
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

  // ========== VISÃO DO MEMBRO/VISITANTE ==========
  if (!isAdminUser) {
    return (
      <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pedidos de Oração</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Faça um pedido de oração e nossa equipe de intercessores estará orando por você
            </p>
          </div>
        </div>

        {/* Botão de destaque para novo pedido */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
              <HandHeart className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Precisa de Oração?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Compartilhe seu pedido e nossa equipe estará intercedendo por você
              </p>
            </div>
            <Button 
              size="lg"
              className="bg-gradient-primary shadow-soft"
              onClick={() => setNovoPedidoOpen(true)}
            >
              <Plus className="w-5 h-5 mr-2" />
              Fazer Novo Pedido de Oração
            </Button>
          </CardContent>
        </Card>

        {/* Meus Pedidos */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Meus Pedidos</h2>
          
          {meusPedidos.length === 0 ? (
            <Card className="p-6 md:p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Você ainda não fez nenhum pedido de oração
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 md:gap-4">
              {meusPedidos.map(pedido => renderPedidoCard(pedido, false))}
            </div>
          )}
        </div>

        <NovoPedidoDialog 
          open={novoPedidoOpen}
          onOpenChange={(open) => {
            setNovoPedidoOpen(open);
            if (!open) setInitialDescription(undefined);
          }}
          onSuccess={fetchMeusPedidos}
          initialDescription={initialDescription}
        />

        {selectedPedido && (
          <PedidoDetailsDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            pedido={selectedPedido}
            onUpdate={fetchMeusPedidos}
          />
        )}
      </div>
    );
  }

  // ========== VISÃO ADMIN/PASTOR/INTERCESSOR ==========
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
            onClick={() => setNovoPedidoOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Novo Pedido</span>
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
              {filteredPedidos.map(pedido => renderPedidoCard(pedido, true))}
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
              pedidosPorStatus.pendente.map(pedido => renderPedidoCard(pedido, true))
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
              pedidosPorStatus.em_oracao.map(pedido => renderPedidoCard(pedido, true))
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
              pedidosPorStatus.respondido.map(pedido => renderPedidoCard(pedido, true))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <NovoPedidoDialog 
        open={novoPedidoOpen}
        onOpenChange={(open) => {
          setNovoPedidoOpen(open);
          if (!open) setInitialDescription(undefined);
        }}
        onSuccess={fetchPedidos}
        initialDescription={initialDescription}
      />

      {selectedPedido && (
        <PedidoDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          pedido={selectedPedido}
          onUpdate={fetchPedidos}
        />
      )}
    </div>
  );
}
