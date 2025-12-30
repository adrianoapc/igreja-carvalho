import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Heart, Plus, Clock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { NovoPedidoDialog } from "@/components/pedidos/NovoPedidoDialog";
import { NovoTestemunhoDialog } from "@/components/testemunhos/NovoTestemunhoDialog";

interface Pedido {
  id: string;
  pedido: string;
  tipo: string;
  status: string;
  data_criacao: string;
  nome_solicitante?: string;
}

interface Testemunho {
  id: string;
  titulo: string;
  mensagem: string;
  categoria: string;
  status: string;
  created_at: string;
  publicar: boolean;
}

export default function SolicitacaoPedido() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"pedidos" | "testemunhos">(
    "pedidos"
  );
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [testemunhos, setTestemunhos] = useState<Testemunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [novoTestemunhoOpen, setNovoTestemunhoOpen] = useState(false);

  const fetchMeusPedidos = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("pedidos_oracao")
        .select("*")
        .eq("pessoa_id", user.id)
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error("Não foi possível carregar seus pedidos");
    }
  };

  const fetchMeusTestemunhos = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("testemunhos")
        .select("*")
        .eq("autor_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTestemunhos(data || []);
    } catch (error) {
      console.error("Erro ao buscar testemunhos:", error);
      toast.error("Não foi possível carregar seus testemunhos");
    }
  };

  // Buscar pedidos e testemunhos do usuário ao carregar
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchMeusPedidos(), fetchMeusTestemunhos()]);
      setLoading(false);
    };
    if (user?.id) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filteredPedidos = pedidos.filter(
    (p) =>
      p.pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tipo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTestemunhos = testemunhos.filter(
    (t) =>
      t.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mensagem?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: "Pendente",
      em_oracao: "Em Oração",
      respondido: "Respondido",
      arquivado: "Arquivado",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pendente:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
      em_oracao:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
      respondido:
        "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      arquivado:
        "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
    };
    return colors[status] || "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-soft">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="p-0 h-auto w-auto"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Minha Intercessão
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Compartilhe pedidos de oração e testemunhos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
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
            {loading ? (
              <Card className="shadow-soft">
                <CardContent className="p-8 md:p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Carregando pedidos...
                  </p>
                </CardContent>
              </Card>
            ) : filteredPedidos.length === 0 && searchTerm === "" ? (
              <Card className="shadow-soft border-0">
                <CardContent className="p-12 md:p-16 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Heart className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold mb-2">
                        Precisa de Oração?
                      </h2>
                      <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
                        Compartilhe seu pedido e nossa equipe de intercessores
                        estará orando por você
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-soft mt-4"
                      onClick={() => setNovoPedidoOpen(true)}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Fazer Novo Pedido de Oração
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col md:flex-row gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Buscar seus pedidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border bg-background text-sm"
                  />
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setNovoPedidoOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Pedido
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {filteredPedidos.length}{" "}
                  {filteredPedidos.length === 1
                    ? "pedido encontrado"
                    : "pedidos encontrados"}
                </p>

                {filteredPedidos.length === 0 ? (
                  <Card className="shadow-soft">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        Nenhum pedido encontrado
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {filteredPedidos.map((pedido) => (
                      <Card
                        key={pedido.id}
                        className="shadow-soft hover:shadow-medium transition-all"
                      >
                        <CardHeader className="pb-3 p-4 md:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1">
                              <CardTitle className="text-lg mb-2">
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
                                  <Clock className="w-3 h-3" />
                                  {new Date(
                                    pedido.data_criacao
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
              </>
            )}
          </TabsContent>

          {/* Tab: Testemunhos */}
          <TabsContent value="testemunhos" className="space-y-4">
            {loading ? (
              <Card className="shadow-soft">
                <CardContent className="p-8 md:p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    Carregando testemunhos...
                  </p>
                </CardContent>
              </Card>
            ) : filteredTestemunhos.length === 0 && searchTerm === "" ? (
              <Card className="shadow-soft border-0">
                <CardContent className="p-12 md:p-16 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-bold mb-2">
                        Compartilhe seu Testemunho
                      </h2>
                      <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
                        Conte como Deus tem agido em sua vida e inspire outros
                        irmãos
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="bg-amber-600 hover:bg-amber-700 text-white shadow-soft mt-4"
                      onClick={() => setNovoTestemunhoOpen(true)}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Compartilhar Testemunho
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col md:flex-row gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Buscar seus testemunhos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border bg-background text-sm"
                  />
                  <Button
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={() => setNovoTestemunhoOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Testemunho
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {filteredTestemunhos.length}{" "}
                  {filteredTestemunhos.length === 1
                    ? "testemunho encontrado"
                    : "testemunhos encontrados"}
                </p>

                {filteredTestemunhos.length === 0 ? (
                  <Card className="shadow-soft">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        Nenhum testemunho encontrado
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {filteredTestemunhos.map((testemunho) => (
                      <Card
                        key={testemunho.id}
                        className="shadow-soft hover:shadow-medium transition-all"
                      >
                        <CardHeader className="pb-3 p-4 md:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex-1">
                              <CardTitle className="text-lg mb-2">
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
                                  <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/20">
                                    Pendente
                                  </Badge>
                                )}
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
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <NovoPedidoDialog
        open={novoPedidoOpen}
        onOpenChange={setNovoPedidoOpen}
        onSuccess={fetchMeusPedidos}
      />
      <NovoTestemunhoDialog
        open={novoTestemunhoOpen}
        onOpenChange={setNovoTestemunhoOpen}
        onSuccess={fetchMeusTestemunhos}
      />
    </div>
  );
}
