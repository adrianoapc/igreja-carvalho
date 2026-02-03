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

export default function DiarioDeOracao() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"pedidos" | "testemunhos">(
    "pedidos",
  );
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [testemunhos, setTestemunhos] = useState<Testemunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilterPedidos, setStatusFilterPedidos] = useState("todos");
  const [tipoFilterPedidos, setTipoFilterPedidos] = useState("todos");
  const [statusFilterTestemunhos, setStatusFilterTestemunhos] =
    useState("todos");
  const [categoriaFilterTestemunhos, setCategoriaFilterTestemunhos] =
    useState("todos");
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [novoTestemunhoOpen, setNovoTestemunhoOpen] = useState(false);

  const fetchMeusPedidos = async () => {
    if (!user?.id) return;

    try {
      // Buscar pelo user_id (auth) usando membro_id
      const { data, error } = await supabase
        .from("pedidos_oracao")
        .select("*")
        .or(`membro_id.eq.${user.id},pessoa_id.eq.${user.id}`)
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      console.log("Pedidos encontrados:", data?.length || 0);
      setPedidos(data || []);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error("Não foi possível carregar seus pedidos");
    }
  };

  const fetchMeusTestemunhos = async () => {
    if (!user?.id) return;

    try {
      // Primeiro buscar o profiles.id do usuário logado
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      if (!profileData?.id) {
        console.log("Profile não encontrado para user_id:", user.id);
        return;
      }

      // Agora buscar testemunhos pelo profiles.id
      const { data, error } = await supabase
        .from("testemunhos")
        .select("*")
        .eq("autor_id", profileData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      console.log("Testemunhos encontrados:", data?.length || 0);
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

  const filteredPedidos = pedidos.filter((p) => {
    const matchSearch =
      p.pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tipo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilterPedidos === "todos" || p.status === statusFilterPedidos;
    const matchTipo =
      tipoFilterPedidos === "todos" || p.tipo === tipoFilterPedidos;
    return matchSearch && matchStatus && matchTipo;
  });

  const filteredTestemunhos = testemunhos.filter((t) => {
    const matchSearch =
      t.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mensagem?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria =
      categoriaFilterTestemunhos === "todos" ||
      t.categoria === categoriaFilterTestemunhos;
    const matchStatus =
      statusFilterTestemunhos === "todos" ||
      (statusFilterTestemunhos === "publico"
        ? t.publicar === true
        : t.status === statusFilterTestemunhos);
    return matchSearch && matchCategoria && matchStatus;
  });

  const TIPO_PEDIDOS = [
    { value: "todos", label: "Todos os Tipos" },
    { value: "saude", label: "Saúde" },
    { value: "familia", label: "Família" },
    { value: "financeiro", label: "Financeiro" },
    { value: "trabalho", label: "Trabalho" },
    { value: "espiritual", label: "Espiritual" },
    { value: "agradecimento", label: "Agradecimento" },
    { value: "outro", label: "Outro" },
  ];

  const CATEGORIAS_TESTEMUNHOS = [
    { value: "todos", label: "Todas Categorias" },
    { value: "espiritual", label: "Área Espiritual" },
    { value: "casamento", label: "Casamento" },
    { value: "familia", label: "Família" },
    { value: "saude", label: "Saúde" },
    { value: "trabalho", label: "Trabalho" },
    { value: "financeiro", label: "Vida Financeira" },
    { value: "ministerial", label: "Vida Ministerial" },
    { value: "outro", label: "Outros" },
  ];

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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="border-b bg-card shadow-soft p-4 md:p-6">
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
            <h1 className="text-2xl md:text-3xl font-bold">Diário de Oração</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Compartilhe pedidos de oração e testemunhos
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div>
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
            {/* Header da Tab com Ícone */}
            <Card className="shadow-soft border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-bold mb-1">
                      Seus Pedidos de Oração
                    </h2>
                    <p className="text-sm md:text-base text-muted-foreground">
                      Compartilhe suas necessidades e nossa equipe de
                      intercessores estará orando por você
                    </p>
                  </div>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 flex-shrink-0 w-full md:w-auto justify-center"
                    onClick={() => setNovoPedidoOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Pedido
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                    <p className="text-base md:text-lg text-muted-foreground">
                      Você ainda não fez nenhum pedido de oração
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Input
                    placeholder="Buscar seus pedidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                </div>

                <p className="text-sm text-muted-foreground">
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
                                    pedido.status,
                                  )}`}
                                >
                                  {getStatusLabel(pedido.status)}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(
                                    pedido.data_criacao,
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
            {/* Header da Tab com Ícone */}
            <Card className="shadow-soft border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-900/10">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-bold mb-1">
                      Seus Testemunhos
                    </h2>
                    <p className="text-sm md:text-base text-muted-foreground">
                      Conte como Deus tem agido em sua vida e inspire outros
                      irmãos
                    </p>
                  </div>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 flex-shrink-0 w-full md:w-auto justify-center"
                    onClick={() => setNovoTestemunhoOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Testemunho
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                    <p className="text-base md:text-lg text-muted-foreground">
                      Você ainda não compartilhou nenhum testemunho
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <Input
                    placeholder="Buscar seus testemunhos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={statusFilterTestemunhos}
                    onValueChange={setStatusFilterTestemunhos}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="publico">Publicado</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={categoriaFilterTestemunhos}
                    onValueChange={setCategoriaFilterTestemunhos}
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
                </div>

                <p className="text-sm text-muted-foreground">
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
                                  <Badge
                                    className={`text-xs ${getStatusColor(
                                      "pendente",
                                    )}`}
                                  >
                                    Pendente
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(
                                    testemunho.created_at,
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
