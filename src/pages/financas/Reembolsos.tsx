import { type ElementType } from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContextProvider";
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
import { AIProcessingOverlay, type AIProcessingStep } from "@/components/financas/AIProcessingOverlay";

type AppRole = Database["public"]["Enums"]["app_role"];

const ADMIN_ROLES: AppRole[] = ["admin", "tesoureiro"];

type SolicitacaoReembolso =
  Database["public"]["Views"]["view_solicitacoes_reembolso"]["Row"];

interface ItemReembolso {
  descricao: string;
  valor: number;
  categoria_id: string;
  subcategoria_id: string;
  fornecedor_id: string;
  base_ministerial_id: string;
  centro_custo_id: string;
  data_item: string;
  anexo_url: string;
}

interface Categoria {
  id: string;
  nome: string;
}

interface Subcategoria {
  id: string;
  nome: string;
  categoria_id: string;
}

interface Fornecedor {
  id: string;
  nome: string;
}

interface BaseMinisterial {
  id: string;
  titulo: string;
}

interface CentroCusto {
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
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();

  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [novoReembolsoOpen, setNovoReembolsoOpen] = useState(false);
  const [pagarReembolsoOpen, setPagarReembolsoOpen] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] =
    useState<SolicitacaoReembolso | null>(null);
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
    subcategoria_id: "",
    fornecedor_id: "",
    base_ministerial_id: "",
    centro_custo_id: "",
    data_item: "",
    anexo_url: "",
  });
  const [aiStep, setAiStep] = useState<AIProcessingStep>('idle');
  const processandoIA = aiStep !== 'idle';

  // Estado do pagamento
  const [contaSaida, setContaSaida] = useState("");
  const [dataPagamento, setDataPagamento] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [contaPadrao, setContaPadrao] = useState("");

  // Buscar roles do usuário
  useEffect(() => {
    if (user?.id && igrejaId) {
      fetchUserRoles();
    }
  }, [user?.id, igrejaId]);

  const fetchUserRoles = async () => {
    try {
      let query = (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;

      const roles = data?.map((r) => r.role as AppRole) || [];
      setUserRoles(roles);
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const isAdmin = userRoles.some((role) => ADMIN_ROLES.includes(role));

  // Query: Minhas solicitações
  const { data: minhasSolicitacoes = [], isLoading: loadingMinhas } = useQuery({
    queryKey: [
      "minhas-solicitacoes",
      igrejaId,
      filialId,
      isAllFiliais,
      profile?.id,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = (supabase as any)
        .from("view_solicitacoes_reembolso")
        .select("*")
        .eq("solicitante_id", profile?.id)
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as SolicitacaoReembolso[];
    },
    enabled: !!profile?.id && !loading && !!igrejaId,
  });

  // Query: Todas as solicitações (para admin/tesoureiro)
  const { data: todasSolicitacoes = [], isLoading: loadingTodas } = useQuery({
    queryKey: ["todas-solicitacoes", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = (supabase as any)
        .from("view_solicitacoes_reembolso")
        .select("*")
        .in("status", ["pendente", "aprovado"])
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as SolicitacaoReembolso[];
    },
    enabled: isAdmin && !loading && !!igrejaId,
  });

  // Query: Categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-saida", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("tipo", "saida")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as Categoria[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Query: Subcategorias (baseado na categoria selecionada)
  const { data: subcategorias = [] } = useQuery({
    queryKey: [
      "subcategorias",
      igrejaId,
      filialId,
      isAllFiliais,
      itemAtual.categoria_id,
    ],
    queryFn: async () => {
      if (!itemAtual.categoria_id || !igrejaId) return [];
      let query = supabase
        .from("subcategorias_financeiras")
        .select("id, nome, categoria_id")
        .eq("categoria_id", itemAtual.categoria_id)
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as Subcategoria[];
    },
    enabled: !!itemAtual.categoria_id && !loading && !!igrejaId,
  });

  // Query: Fornecedores
  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-ativos", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as Fornecedor[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Query: Bases Ministeriais
  const { data: basesMinisteriais = [] } = useQuery({
    queryKey: ["bases-ministeriais-ativas", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("bases_ministeriais")
        .select("id, titulo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("titulo");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as BaseMinisterial[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Query: Centros de Custo
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros-custo-ativos", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as CentroCusto[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Query: Contas bancárias
  const { data: contas = [] } = useQuery({
    queryKey: ["contas-ativas", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data as Conta[];
    },
    enabled: !loading && !!igrejaId,
  });

  // Definir conta padrão quando contas são carregadas
  useEffect(() => {
    if (contas.length > 0 && !contaPadrao) {
      setContaPadrao(contas[0].id);
    }
  }, [contas, contaPadrao]);

  // Mutation: Criar solicitação de reembolso
  const criarSolicitacaoMutation = useMutation({
    mutationFn: async () => {
      if (!igrejaId) {
        throw new Error("Igreja não identificada.");
      }
      // Calcular valor total dos itens
      const valorTotalItens = itens.reduce((sum, item) => sum + item.valor, 0);

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
          valor_total: valorTotalItens,
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
        })
        .select()
        .single();

      if (solicitacaoError) throw solicitacaoError;

      // 2. Criar os itens na tabela itens_reembolso (sem criar transações financeiras)
      const itensReembolso = itens.map((item) => ({
        solicitacao_id: solicitacao.id,
        descricao: item.descricao,
        valor: Math.abs(item.valor),
        data_item: item.data_item || new Date().toISOString().split("T")[0],
        categoria_id: item.categoria_id || null,
        subcategoria_id: item.subcategoria_id || null,
        fornecedor_id: item.fornecedor_id || null,
        base_ministerial_id: item.base_ministerial_id || null,
        centro_custo_id: item.centro_custo_id || null,
        foto_url: item.anexo_url || null,
        igreja_id: igrejaId,
        filial_id: !isAllFiliais ? filialId : null,
      }));

      const { error: itensError } = await supabase
        .from("itens_reembolso")
        .insert(itensReembolso);

      if (itensError) throw itensError;

      return solicitacao;
    },
    onSuccess: () => {
      toast.success("Solicitação de reembolso criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes"] });
      resetarFormulario();
      setNovoReembolsoOpen(false);
    },
    onError: (error: unknown) => {
      console.error("Erro ao criar solicitação:", error);
      toast.error("Erro ao criar solicitação de reembolso");
    },
  });

  // Mutation: Pagar reembolso
  const pagarReembolsoMutation = useMutation({
    mutationFn: async () => {
      if (!solicitacaoSelecionada)
        throw new Error("Nenhuma solicitação selecionada");
      if (!igrejaId) throw new Error("Igreja não identificada.");

      // 1. Criar UMA ÚNICA transação financeira para o pagamento do reembolso (Fluxo de Caixa - ADR-001)
      const { error: transacaoError } = await supabase
        .from("transacoes_financeiras")
        .insert({
          descricao: `Reembolso - ${
            solicitacaoSelecionada.solicitante_nome || "Solicitante"
          }`,
          valor: solicitacaoSelecionada.valor_total || 0,
          tipo: "saida",
          tipo_lancamento: "unico",
          data_vencimento:
            solicitacaoSelecionada.data_vencimento ||
            new Date(dataPagamento).toISOString().split("T")[0],
          data_pagamento: new Date(dataPagamento).toISOString().split("T")[0],
          data_competencia: new Date(dataPagamento).toISOString().split("T")[0],
          status: "pago",
          conta_id: contaSaida,
          forma_pagamento:
            solicitacaoSelecionada.forma_pagamento_preferida || "pix",
          solicitacao_reembolso_id: solicitacaoSelecionada.id,
          observacoes: `Pagamento de reembolso #${solicitacaoSelecionada.id
            ?.slice(0, 8)
            .toUpperCase()}`,
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
        });

      if (transacaoError) throw transacaoError;

      // 2. Atualizar a solicitação como paga
      let solicitacaoQuery = supabase
        .from("solicitacoes_reembolso")
        .update({
          status: "pago",
          data_pagamento: new Date(dataPagamento).toISOString(),
        })
        .eq("id", solicitacaoSelecionada.id)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        solicitacaoQuery = solicitacaoQuery.eq("filial_id", filialId);
      }
      const { error: solicitacaoError } = await solicitacaoQuery;

      if (solicitacaoError) throw solicitacaoError;
    },
    onSuccess: () => {
      toast.success("Reembolso pago com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["todas-solicitacoes"] });
      queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes"] });
      setPagarReembolsoOpen(false);
      setSolicitacaoSelecionada(null);
    },
    onError: (error: unknown) => {
      console.error("Erro ao pagar reembolso:", error);
      toast.error("Erro ao processar pagamento");
    },
  });

  const processarNotaFiscalComIA = async (file: File) => {
    setAiStep('uploading');
    try {
      if (!igrejaId) {
        throw new Error("Igreja não identificada.");
      }
      // 1. Upload do arquivo para storage (bucket privado)
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const isPdf = file.type === "application/pdf" || fileExt === "pdf";
      const fileName = `${profile?.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("transaction-attachments")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Gerar signed URL (bucket privado) - 1 ano de validade
      const { data: signedData, error: signedError } = await supabase.storage
        .from("transaction-attachments")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      if (signedError || !signedData?.signedUrl) {
        throw new Error("Erro ao gerar URL de acesso ao arquivo");
      }

      setAiStep('analyzing');

      // 2. Converter arquivo para base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const imageBase64 = await base64Promise;

      // 3. Chamar edge function para processar (suporta imagens e PDFs)
      const { data, error } = await supabase.functions.invoke(
        "processar-nota-fiscal",
        {
          body: {
            imageBase64,
            mimeType: file.type,
            igreja_id: igrejaId,
          },
        }
      );

      if (error) throw error;

      setAiStep('extracting');

      if (data?.success && data?.dados) {
        const {
          valor_total,
          fornecedor_nome,
          data_emissao,
          descricao,
          tipo_documento,
        } = data.dados;

        // Gerar descrição resumida (máximo 60 caracteres)
        let descricaoResumida = "";
        if (fornecedor_nome) {
          descricaoResumida =
            fornecedor_nome.length > 40
              ? fornecedor_nome.substring(0, 37) + "..."
              : fornecedor_nome;
        } else if (descricao) {
          // Pegar primeira linha ou primeiras palavras
          const primeiraLinha = descricao.split("\n")[0];
          descricaoResumida =
            primeiraLinha.length > 40
              ? primeiraLinha.substring(0, 37) + "..."
              : primeiraLinha;
        }

        setAiStep('filling');

        // Auto-preencher campos
        setItemAtual((prev) => ({
          ...prev,
          valor: valor_total?.toString() || prev.valor,
          descricao: descricaoResumida || prev.descricao,
          data_item: data_emissao || prev.data_item,
          anexo_url: signedData.signedUrl,
        }));

        toast.success("✨ Nota fiscal lida com sucesso!");
      } else {
        throw new Error("Não foi possível extrair dados da nota");
      }
    } catch (error: unknown) {
      console.error("Erro ao processar nota fiscal:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : String(error) || "Erro ao processar nota fiscal com IA"
      );
    } finally {
      setAiStep('idle');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
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
    setItemAtual({
      descricao: "",
      valor: "",
      categoria_id: "",
      subcategoria_id: "",
      fornecedor_id: "",
      base_ministerial_id: "",
      centro_custo_id: "",
      data_item: "",
      anexo_url: "",
    });
  };

  const adicionarItem = () => {
    if (!itemAtual.descricao || !itemAtual.valor) {
      toast.error("Preencha pelo menos descrição e valor");
      return;
    }

    setItens([
      ...itens,
      {
        ...itemAtual,
        valor: parseFloat(itemAtual.valor),
      },
    ]);
    setItemAtual({
      descricao: "",
      valor: "",
      categoria_id: "",
      subcategoria_id: "",
      fornecedor_id: "",
      base_ministerial_id: "",
      centro_custo_id: "",
      data_item: "",
      anexo_url: "",
    });
    toast.success("Item adicionado!");
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const valorTotal = itens.reduce((sum, item) => sum + item.valor, 0);

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive";
        label: string;
        icon: ElementType;
      }
    > = {
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
            <Button
              onClick={() => setNovoReembolsoOpen(true)}
              className="gap-2"
            >
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
                          {format(
                            new Date(solicitacao.data_solicitacao),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                          {solicitacao.data_vencimento && (
                            <>
                              {" "}
                              • Vencimento:{" "}
                              {format(
                                new Date(solicitacao.data_vencimento),
                                "dd/MM/yyyy",
                                { locale: ptBR }
                              )}
                            </>
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
                        <p className="font-medium">
                          {/* solicitacao.quantidade_itens */} -
                        </p>
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
                            {format(
                              new Date(solicitacao.data_pagamento),
                              "dd/MM/yyyy"
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    {solicitacao.observacoes && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-md">
                        <p className="text-sm text-muted-foreground mb-1">
                          Observações:
                        </p>
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
                            Solicitado em:{" "}
                            {format(
                              new Date(solicitacao.data_solicitacao),
                              "dd/MM/yyyy",
                              { locale: ptBR }
                            )}
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
                          <p className="font-medium">
                            {/* solicitacao.quantidade_itens */} -
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pagamento</p>
                          <p className="font-medium capitalize">
                            {solicitacao.forma_pagamento_preferida || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">
                            Dados Bancários
                          </p>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto relative">
          <AIProcessingOverlay currentStep={aiStep} />
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
                <Label htmlFor="formaPagamento">
                  Forma de Pagamento Preferida
                </Label>
                <Select
                  value={formaPagamento}
                  onValueChange={setFormaPagamento}
                >
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
                          <p className="font-medium text-sm">
                            {item.descricao}
                          </p>
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
                  <Label
                    htmlFor="upload-comprovante"
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Comprovante (Imagem ou PDF)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="upload-comprovante"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleImageUpload}
                      disabled={processandoIA}
                      className="cursor-pointer"
                    />
                    {processandoIA && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span>Lendo documento... 🤖</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    📸 Envie foto ou PDF da nota fiscal para preenchimento
                    automático com IA
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
                        setItemAtual({
                          ...itemAtual,
                          data_item: e.target.value,
                        })
                      }
                      disabled={processandoIA}
                    />
                  </div>
                </div>

                {/* Categoria e Subcategoria */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select
                      value={itemAtual.categoria_id}
                      onValueChange={(value) =>
                        setItemAtual({
                          ...itemAtual,
                          categoria_id: value,
                          subcategoria_id: "",
                        })
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
                    <Label htmlFor="subcategoria">Subcategoria</Label>
                    <Select
                      value={itemAtual.subcategoria_id}
                      onValueChange={(value) =>
                        setItemAtual({ ...itemAtual, subcategoria_id: value })
                      }
                      disabled={processandoIA || !itemAtual.categoria_id}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            itemAtual.categoria_id
                              ? "Selecione"
                              : "Selecione categoria"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategorias.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhuma subcategoria
                          </SelectItem>
                        ) : (
                          subcategorias.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.nome}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Fornecedor */}
                <div className="space-y-2">
                  <Label htmlFor="fornecedor">Fornecedor</Label>
                  <Select
                    value={itemAtual.fornecedor_id}
                    onValueChange={(value) =>
                      setItemAtual({ ...itemAtual, fornecedor_id: value })
                    }
                    disabled={processandoIA}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Base Ministerial e Centro de Custo */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="base_ministerial">Base Ministerial</Label>
                    <Select
                      value={itemAtual.base_ministerial_id}
                      onValueChange={(value) =>
                        setItemAtual({
                          ...itemAtual,
                          base_ministerial_id: value,
                        })
                      }
                      disabled={processandoIA}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {basesMinisteriais.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.titulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="centro_custo">Centro de Custo</Label>
                    <Select
                      value={itemAtual.centro_custo_id}
                      onValueChange={(value) =>
                        setItemAtual({ ...itemAtual, centro_custo_id: value })
                      }
                      disabled={processandoIA}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosCusto.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                      {dataVencimento
                        ? format(new Date(dataVencimento), "dd/MM/yyyy")
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Forma de Pagamento</p>
                    <p className="font-medium capitalize">{formaPagamento}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dados Bancários</p>
                    <p className="font-medium text-xs">
                      {dadosBancarios || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total de Itens</p>
                    <p className="font-medium">{itens.length}</p>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-md">
                  <p className="text-sm text-muted-foreground mb-1">
                    Valor Total
                  </p>
                  <p className="text-2xl font-bold">
                    R$ {valorTotal.toFixed(2)}
                  </p>
                </div>

                {observacoes && (
                  <div className="p-3 bg-muted/30 rounded-md">
                    <p className="text-sm text-muted-foreground mb-1">
                      Observações:
                    </p>
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
              <p className="text-sm text-muted-foreground mb-1">
                Valor a Pagar
              </p>
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
