import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  DollarSign,
  Calendar,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Upload,
  FileText,
} from "lucide-react";

type AppRole = Database["public"]["Enums"]["app_role"];

const ADMIN_ROLES: AppRole[] = ['admin', 'tesoureiro'];

type SolicitacaoReembolso = Database["public"]["Views"]["view_solicitacoes_reembolso"]["Row"];

interface ItemReembolso {
  descricao: string;
  valor: number;
  categoria_id: string;
  comprovante_url: string;
}

interface Categoria {
  id: string;
  nome: string;
}

interface Conta {
  id: string;
  nome: string;
  tipo: string;
}

export default function Reembolsos() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [novoReembolsoOpen, setNovoReembolsoOpen] = useState(false);
  const [pagarReembolsoOpen, setPagarReembolsoOpen] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoReembolso | null>(null);
  const [etapaWizard, setEtapaWizard] = useState(1);

  // Estado do formulário - Cabeçalho
  const [dataVencimento, setDataVencimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<string>("pix");
  const [dadosBancarios, setDadosBancarios] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Estado do formulário - Itens
  const [itens, setItens] = useState<ItemReembolso[]>([]);
  const [itemAtual, setItemAtual] = useState({
    descricao: "",
    valor: "",
    categoria_id: "",
    comprovante_url: "",
    data_item: "",
  });
  const [processandoIA, setProcessandoIA] = useState(false);

  // Estado do pagamento
  const [contaSaida, setContaSaida] = useState("");
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));

  // Buscar roles do usuário
  useEffect(() => {
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

  const isAdmin = userRoles.some(role => ADMIN_ROLES.includes(role));

  // Query: Minhas solicitações
  const { data: minhasSolicitacoes = [], isLoading: loadingMinhas } = useQuery({
    queryKey: ["minhas-solicitacoes", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_solicitacoes_reembolso")
        .select("*")
        .eq("solicitante_id", profile?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SolicitacaoReembolso[];
    },
    enabled: !!profile?.id,
  });

  // Query: Todas as solicitações (para admin/tesoureiro)
  const { data: todasSolicitacoes = [], isLoading: loadingTodas } = useQuery({
    queryKey: ["todas-solicitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_solicitacoes_reembolso")
        .select("*")
        .in("status", ["pendente", "aprovado"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SolicitacaoReembolso[];
    },
    enabled: isAdmin,
  });

  // Query: Categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-despesa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("tipo", "despesa")
        .order("nome");

      if (error) throw error;
      return data as Categoria[];
    },
  });

  // Query: Contas bancárias
  const { data: contas = [] } = useQuery({
    queryKey: ["contas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as Conta[];
    },
  });

  // Mutation: Criar solicitação de reembolso
  const criarSolicitacaoMutation = useMutation({
    mutationFn: async () => {
      // 1. Criar a solicitação
      const { data: solicitacao, error: solicitacaoError } = await supabase
        .from("solicitacoes_reembolso")
        .insert({
          solicitante_id: profile?.id,
          status: "pendente",
          data_vencimento: dataVencimento || null,
          forma_pagamento_preferida: formaPagamento,
          dados_bancarios: dadosBancarios,
          observacoes: observacoes,
        })
        .select()
        .single();

      if (solicitacaoError) throw solicitacaoError;

      // 2. Criar as transações (itens)
      const transacoes = itens.map((item) => ({
        tipo: "despesa" as const,
        tipo_lancamento: "comum" as const,
        valor: -Math.abs(item.valor),
        descricao: item.descricao,
        categoria_id: item.categoria_id,
        status: "pendente" as const,
        data_vencimento: dataVencimento || new Date().toISOString().split('T')[0],
        data_transacao: new Date().toISOString(),
        conta_id: "00000000-0000-0000-0000-000000000000", // Temporário até pagamento
        solicitacao_reembolso_id: solicitacao.id,
        anexo_url: item.comprovante_url || null,
      }));

      const { error: transacoesError } = await supabase
        .from("transacoes_financeiras")
        .insert(transacoes);

      if (transacoesError) throw transacoesError;

      return solicitacao;
    },
    onSuccess: () => {
      toast.success("Solicitação de reembolso criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes"] });
      resetarFormulario();
      setNovoReembolsoOpen(false);
    },
    onError: (error: any) => {
      console.error("Erro ao criar solicitação:", error);
      toast.error("Erro ao criar solicitação de reembolso");
    },
  });

  // Mutation: Pagar reembolso
  const pagarReembolsoMutation = useMutation({
    mutationFn: async () => {
      if (!solicitacaoSelecionada) throw new Error("Nenhuma solicitação selecionada");

      // 1. Atualizar a solicitação
      const { error: solicitacaoError } = await supabase
        .from("solicitacoes_reembolso")
        .update({
          status: "pago",
          data_pagamento: new Date(dataPagamento).toISOString(),
        })
        .eq("id", solicitacaoSelecionada.id);

      if (solicitacaoError) throw solicitacaoError;

      // 2. Atualizar todas as transações vinculadas
      const { error: transacoesError } = await supabase
        .from("transacoes_financeiras")
        .update({
          status: "pago",
          conta_id: contaSaida,
          data_pagamento: new Date(dataPagamento).toISOString(),
        })
        .eq("solicitacao_reembolso_id", solicitacaoSelecionada.id);

      if (transacoesError) throw transacoesError;
    },
    onSuccess: () => {
      toast.success("Reembolso pago com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["todas-solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes"] });
      setPagarReembolsoOpen(false);
      setSolicitacaoSelecionada(null);
    },
    onError: (error: any) => {
      console.error("Erro ao pagar reembolso:", error);
      toast.error("Erro ao processar pagamento");
    },
  });

  const processarNotaFiscalComIA = async (file: File) => {
    setProcessandoIA(true);
    try {
      // Converter imagem para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const imageBase64 = await base64Promise;

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('processar-nota-fiscal', {
        body: {
          imageBase64,
          mimeType: file.type,
        },
      });

      if (error) throw error;

      if (data?.success && data?.dados) {
        const { valor_total, fornecedor_nome, data_emissao, descricao } = data.dados;
        
        // Auto-preencher campos
        setItemAtual(prev => ({
          ...prev,
          valor: valor_total?.toString() || prev.valor,
          descricao: descricao || fornecedor_nome || prev.descricao,
          data_item: data_emissao || prev.data_item,
        }));

        toast.success('✨ Nota fiscal lida com sucesso!');
      } else {
        throw new Error('Não foi possível extrair dados da nota');
      }
    } catch (error: any) {
      console.error('Erro ao processar nota fiscal:', error);
      toast.error(error.message || 'Erro ao processar nota fiscal com IA');
    } finally {
      setProcessandoIA(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Processar com IA
    await processarNotaFiscalComIA(file);
  };

  const resetarFormulario = () => {
    setEtapaWizard(1);
    setDataVencimento("");
    setFormaPagamento("pix");
    setDadosBancarios("");
    setObservacoes("");
    setItens([]);
    setItemAtual({ descricao: "", valor: "", categoria_id: "", comprovante_url: "", data_item: "" });
  };

  const adicionarItem = () => {
    if (!itemAtual.descricao || !itemAtual.valor || !itemAtual.categoria_id) {
      toast.error("Preencha todos os campos do item");
      return;
    }

    setItens([
      ...itens,
      {
        ...itemAtual,
        valor: parseFloat(itemAtual.valor),
      },
    ]);
    setItemAtual({ descricao: "", valor: "", categoria_id: "", comprovante_url: "", data_item: "" });
    toast.success("Item adicionado!");
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const valorTotal = itens.reduce((sum, item) => sum + item.valor, 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      rascunho: { variant: "secondary", label: "Rascunho", icon: FileText },
      pendente: { variant: "default", label: "Pendente", icon: Clock },
      aprovado: { variant: "default", label: "Aprovado", icon: CheckCircle },
      pago: { variant: "default", label: "Pago", icon: CheckCircle },
      rejeitado: { variant: "destructive", label: "Rejeitado", icon: XCircle },
    };

    const config = variants[status] || variants.pendente;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Gestão de Reembolsos
          </h1>
          <p className="text-muted-foreground mt-1">
            Solicite e gerencie reembolsos de despesas
          </p>
        </div>
      </div>

      <Tabs defaultValue="meus" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="meus">
            <Receipt className="w-4 h-4 mr-2" />
            Meus Pedidos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="gestao">
              <DollarSign className="w-4 h-4 mr-2" />
              Gestão / Aprovação
            </TabsTrigger>
          )}
        </TabsList>

        {/* ABA 1: Meus Pedidos */}
        <TabsContent value="meus" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setNovoReembolsoOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Reembolso
            </Button>
          </div>

          {loadingMinhas ? (
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-24 bg-muted/30" />
                </Card>
              ))}
            </div>
          ) : minhasSolicitacoes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Você ainda não possui solicitações de reembolso
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {minhasSolicitacoes.map((solicitacao) => (
                <Card key={solicitacao.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">
                          Solicitação #{solicitacao.id.slice(0, 8)}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(solicitacao.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                          {solicitacao.data_vencimento && (
                            <> • Vencimento: {format(new Date(solicitacao.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</>
                          )}
                        </CardDescription>
                      </div>
                      {getStatusBadge(solicitacao.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Valor Total</p>
                        <p className="font-semibold text-lg">
                          R$ {solicitacao.valor_total.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Itens</p>
                        <p className="font-medium">{/* solicitacao.quantidade_itens */} -</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pagamento</p>
                        <p className="font-medium capitalize">
                          {solicitacao.forma_pagamento_preferida || "—"}
                        </p>
                      </div>
                      {solicitacao.data_pagamento && (
                        <div>
                          <p className="text-muted-foreground">Pago em</p>
                          <p className="font-medium">
                            {format(new Date(solicitacao.data_pagamento), "dd/MM/yyyy")}
                          </p>
                        </div>
                      )}
                    </div>
                    {solicitacao.observacoes && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-md">
                        <p className="text-sm text-muted-foreground mb-1">Observações:</p>
                        <p className="text-sm">{solicitacao.observacoes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ABA 2: Gestão / Aprovação (Admin) */}
        {isAdmin && (
          <TabsContent value="gestao" className="space-y-4">
            {loadingTodas ? (
              <div className="grid gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="h-24 bg-muted/30" />
                  </Card>
                ))}
              </div>
            ) : todasSolicitacoes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma solicitação pendente de aprovação
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {todasSolicitacoes.map((solicitacao) => (
                  <Card key={solicitacao.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {solicitacao.solicitante_nome}
                          </CardTitle>
                          <CardDescription>
                            Solicitado em: {format(new Date(solicitacao.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        {getStatusBadge(solicitacao.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-muted-foreground">Valor Total</p>
                          <p className="font-semibold text-lg text-destructive">
                            R$ {solicitacao.valor_total.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Itens</p>
                          <p className="font-medium">{/* solicitacao.quantidade_itens */} -</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pagamento</p>
                          <p className="font-medium capitalize">
                            {solicitacao.forma_pagamento_preferida || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dados Bancários</p>
                          <p className="font-medium text-xs">
                            {solicitacao.dados_bancarios || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSolicitacaoSelecionada(solicitacao);
                            setPagarReembolsoOpen(true);
                          }}
                          className="gap-2"
                        >
                          <CreditCard className="w-4 h-4" />
                          Realizar Pagamento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* DIALOG: Novo Reembolso (Wizard) */}
      <Dialog open={novoReembolsoOpen} onOpenChange={setNovoReembolsoOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Nova Solicitação de Reembolso - Etapa {etapaWizard} de 3
            </DialogTitle>
            <DialogDescription>
              {etapaWizard === 1 && "Informe os dados gerais do reembolso"}
              {etapaWizard === 2 && "Adicione os itens da despesa"}
              {etapaWizard === 3 && "Revise e confirme a solicitação"}
            </DialogDescription>
          </DialogHeader>

          {/* ETAPA 1: Cabeçalho */}
          {etapaWizard === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dataVencimento">Data de Vencimento</Label>
                <Input
                  id="dataVencimento"
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="formaPagamento">Forma de Pagamento Preferida</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dadosBancarios">
                  {formaPagamento === "pix" ? "Chave PIX" : "Dados Bancários"}
                </Label>
                <Input
                  id="dadosBancarios"
                  value={dadosBancarios}
                  onChange={(e) => setDadosBancarios(e.target.value)}
                  placeholder={
                    formaPagamento === "pix"
                      ? "CPF, e-mail ou telefone"
                      : "Banco, agência e conta"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações adicionais sobre o reembolso"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* ETAPA 2: Itens */}
          {etapaWizard === 2 && (
            <div className="space-y-4">
              {/* Lista de itens adicionados */}
              {itens.length > 0 && (
                <div className="space-y-2">
                  <Label>Itens Adicionados ({itens.length})</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {itens.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            R$ {item.valor.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerItem(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-primary/5 rounded-md">
                    <p className="text-sm font-semibold">
                      Total: R$ {valorTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              {/* Formulário para adicionar item */}
              <div className="space-y-3 p-4 border rounded-md">
                <Label>Adicionar Novo Item</Label>

                {/* Upload de Comprovante com IA */}
                <div className="space-y-2">
                  <Label htmlFor="upload-comprovante" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Foto do Comprovante (Auto-preenchimento com IA)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="upload-comprovante"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={processandoIA}
                      className="cursor-pointer"
                    />
                    {processandoIA && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span>Lendo nota fiscal... 🤖</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    📸 Tire uma foto da nota fiscal e os campos serão preenchidos automaticamente
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={itemAtual.descricao}
                    onChange={(e) =>
                      setItemAtual({ ...itemAtual, descricao: e.target.value })
                    }
                    placeholder="Ex: Material de escritório"
                    disabled={processandoIA}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      value={itemAtual.valor}
                      onChange={(e) =>
                        setItemAtual({ ...itemAtual, valor: e.target.value })
                      }
                      placeholder="0,00"
                      disabled={processandoIA}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_item">Data</Label>
                    <Input
                      id="data_item"
                      type="date"
                      value={itemAtual.data_item}
                      onChange={(e) =>
                        setItemAtual({ ...itemAtual, data_item: e.target.value })
                      }
                      disabled={processandoIA}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={itemAtual.categoria_id}
                    onValueChange={(value) =>
                      setItemAtual({ ...itemAtual, categoria_id: value })
                    }
                    disabled={processandoIA}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comprovante">URL do Comprovante (opcional)</Label>
                  <Input
                    id="comprovante"
                    value={itemAtual.comprovante_url}
                    onChange={(e) =>
                      setItemAtual({ ...itemAtual, comprovante_url: e.target.value })
                    }
                    placeholder="https://..."
                    disabled={processandoIA}
                  />
                </div>

                <Button 
                  onClick={adicionarItem} 
                  variant="outline" 
                  className="w-full gap-2"
                  disabled={processandoIA}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Item
                </Button>
              </div>
            </div>
          )}

          {/* ETAPA 3: Confirmação */}
          {etapaWizard === 3 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Resumo da Solicitação</h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="font-medium">
                      {dataVencimento ? format(new Date(dataVencimento), "dd/MM/yyyy") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Forma de Pagamento</p>
                    <p className="font-medium capitalize">{formaPagamento}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dados Bancários</p>
                    <p className="font-medium text-xs">{dadosBancarios || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total de Itens</p>
                    <p className="font-medium">{itens.length}</p>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-md">
                  <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                  <p className="text-2xl font-bold">R$ {valorTotal.toFixed(2)}</p>
                </div>

                {observacoes && (
                  <div className="p-3 bg-muted/30 rounded-md">
                    <p className="text-sm text-muted-foreground mb-1">Observações:</p>
                    <p className="text-sm">{observacoes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                onClick={() => {
                  if (etapaWizard === 1) {
                    setNovoReembolsoOpen(false);
                    resetarFormulario();
                  } else {
                    setEtapaWizard(etapaWizard - 1);
                  }
                }}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {etapaWizard === 1 ? "Cancelar" : "Voltar"}
              </Button>

              {etapaWizard < 3 ? (
                <Button
                  onClick={() => {
                    if (etapaWizard === 2 && itens.length === 0) {
                      toast.error("Adicione pelo menos um item");
                      return;
                    }
                    setEtapaWizard(etapaWizard + 1);
                  }}
                  className="gap-2"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => criarSolicitacaoMutation.mutate()}
                  disabled={criarSolicitacaoMutation.isPending}
                  className="gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Enviar Solicitação
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Pagar Reembolso */}
      <Dialog open={pagarReembolsoOpen} onOpenChange={setPagarReembolsoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Realizar Pagamento</DialogTitle>
            <DialogDescription>
              Solicitação de {solicitacaoSelecionada?.solicitante_nome}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-md">
              <p className="text-sm text-muted-foreground mb-1">Valor a Pagar</p>
              <p className="text-2xl font-bold">
                R$ {solicitacaoSelecionada?.valor_total.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contaSaida">Conta de Saída</Label>
              <Select value={contaSaida} onValueChange={setContaSaida}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((conta) => (
                    <SelectItem key={conta.id} value={conta.id}>
                      {conta.nome} ({conta.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataPagamento">Data do Pagamento</Label>
              <Input
                id="dataPagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>

            {solicitacaoSelecionada?.dados_bancarios && (
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Dados para Pagamento:
                </p>
                <p className="text-sm text-blue-800">
                  {solicitacaoSelecionada.dados_bancarios}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPagarReembolsoOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => pagarReembolsoMutation.mutate()}
              disabled={!contaSaida || pagarReembolsoMutation.isPending}
              className="gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
