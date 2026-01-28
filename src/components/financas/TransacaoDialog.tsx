import { useState, useEffect, useRef, useCallback } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  X,
  Loader2,
  ZoomIn,
  ZoomOut,
  FileText,
  Download,
  ImageIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { generatePdfThumbnail } from "@/lib/pdfUtils";
import { TransacaoUploadSection } from "./TransacaoUploadSection";
import { TransacaoDocumentViewer } from "./TransacaoDocumentViewer";
import { useFilialId } from "@/hooks/useFilialId";
import {
  AIProcessingOverlay,
  type AIProcessingStep,
} from "./AIProcessingOverlay";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TransacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "entrada" | "saida";
  transacao?: {
    id?: string | number;
    descricao?: string | null;
    valor?: number | null;
    data_vencimento?: string | null;
    data_competencia?: string | null;
    data_pagamento?: string | null;
    conta_id?: string | null;
    categoria_id?: string | null;
    subcategoria_id?: string | null;
    centro_custo_id?: string | null;
    base_ministerial_id?: string | null;
    fornecedor_id?: string | null;
    forma_pagamento?: string | null;
    observacoes?: string | null;
    tipo_lancamento?: "unico" | "recorrente" | "parcelado";
    anexo_url?: string | null;
    status?: string | null;
    juros?: number | null;
    multas?: number | null;
    desconto?: number | null;
    taxas_administrativas?: number | null;
    total_parcelas?: number | null;
    recorrencia?:
      | "diaria"
      | "semanal"
      | "quinzenal"
      | "mensal"
      | "bimestral"
      | null;
    data_fim_recorrencia?: string | null;
  };
}

export function TransacaoDialog({
  open,
  onOpenChange,
  tipo,
  transacao,
}: TransacaoDialogProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiStep, setAiStep] = useState<AIProcessingStep>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);

  // Estados do formulário
  const [tipoLancamento, setTipoLancamento] = useState<
    "unico" | "recorrente" | "parcelado"
  >("unico");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date>(new Date());
  const [dataCompetencia, setDataCompetencia] = useState<Date>(new Date());
  const [contaId, setContaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("none");
  const [subcategoriaId, setSubcategoriaId] = useState("none");
  const [centroCustoId, setCentroCustoId] = useState("none");
  const [baseMinisterialId, setBaseMinisterialId] = useState("none");
  const [fornecedorId, setFornecedorId] = useState("none");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("1");
  const [recorrencia, setRecorrencia] = useState<
    "diaria" | "semanal" | "quinzenal" | "mensal" | "bimestral"
  >("mensal");
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState<
    Date | undefined
  >();
  const [observacoes, setObservacoes] = useState("");
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string>("");
  const [anexoPreview, setAnexoPreview] = useState<string>("");
  const [anexoIsPdf, setAnexoIsPdf] = useState(false);

  // Campos de confirmação de pagamento/recebimento
  const [foiPago, setFoiPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>();
  const [juros, setJuros] = useState("");
  const [multas, setMultas] = useState("");
  const [desconto, setDesconto] = useState("");
  const [taxasAdministrativas, setTaxasAdministrativas] = useState("");

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (transacao && open) {
      setDescricao(transacao.descricao || "");
      setValor(String(transacao.valor || ""));
      setDataVencimento(
        transacao.data_vencimento
          ? new Date(transacao.data_vencimento)
          : new Date()
      );
      setDataCompetencia(
        transacao.data_competencia
          ? new Date(transacao.data_competencia)
          : new Date()
      );
      setContaId(transacao.conta_id || "");
      setCategoriaId(transacao.categoria_id || "none");
      setSubcategoriaId(transacao.subcategoria_id || "none");
      setCentroCustoId(transacao.centro_custo_id || "none");
      setBaseMinisterialId(transacao.base_ministerial_id || "none");
      setFornecedorId(transacao.fornecedor_id || "none");
      setFormaPagamento(transacao.forma_pagamento || "");
      setObservacoes(transacao.observacoes || "");
      setTipoLancamento(transacao.tipo_lancamento || "unico");
      setAnexoUrl(transacao.anexo_url || "");

      const isPdf =
        transacao.anexo_url?.toLowerCase().endsWith(".pdf") || false;
      setAnexoIsPdf(isPdf);

      // Gerar thumbnail se for PDF existente
      if (isPdf && transacao.anexo_url) {
        generatePdfThumbnail(transacao.anexo_url, 0.8)
          .then((thumbnail) => setAnexoPreview(thumbnail))
          .catch((err) => {
            console.error("Erro ao gerar thumbnail do PDF:", err);
            setAnexoPreview("");
          });
      } else {
        setAnexoPreview(transacao.anexo_url || "");
      }

      setFoiPago(transacao.status === "pago");
      setDataPagamento(
        transacao.data_pagamento
          ? new Date(transacao.data_pagamento)
          : undefined
      );
      setJuros(transacao.juros ? String(transacao.juros) : "");
      setMultas(transacao.multas ? String(transacao.multas) : "");
      setDesconto(transacao.desconto ? String(transacao.desconto) : "");
      setTaxasAdministrativas(
        transacao.taxas_administrativas
          ? String(transacao.taxas_administrativas)
          : ""
      );
      if (transacao.total_parcelas)
        setTotalParcelas(String(transacao.total_parcelas));
      if (transacao.recorrencia) setRecorrencia(transacao.recorrencia);
      if (transacao.data_fim_recorrencia)
        setDataFimRecorrencia(new Date(transacao.data_fim_recorrencia));
    } else if (!open) {
      resetForm();
    }
  }, [transacao, open]);

  const resetForm = () => {
    setDescricao("");
    setValor("");
    setDataVencimento(new Date());
    setDataCompetencia(new Date());
    setContaId("");
    setCategoriaId("none");
    setSubcategoriaId("none");
    setCentroCustoId("none");
    setBaseMinisterialId("none");
    setFornecedorId("none");
    setFormaPagamento("");
    setTotalParcelas("1");
    setRecorrencia("mensal");
    setDataFimRecorrencia(undefined);
    setObservacoes("");
    setTipoLancamento("unico");
    setAnexoFile(null);
    setAnexoUrl("");
    setAnexoPreview("");
    setAnexoIsPdf(false);
    setFoiPago(false);
    setDataPagamento(undefined);
    setJuros("");
    setMultas("");
    setDesconto("");
    setTaxasAdministrativas("");
    setImageZoom(1);
  };

  // Queries para selects
  const { data: contas } = useQuery({
    queryKey: ["contas-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias-select", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("tipo", tipo)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: subcategorias } = useQuery({
    queryKey: ["subcategorias-select", categoriaId],
    queryFn: async () => {
      if (!categoriaId || categoriaId === "none") return [];
      const { data, error } = await supabase
        .from("subcategorias_financeiras")
        .select("id, nome")
        .eq("categoria_id", categoriaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!categoriaId && categoriaId !== "none",
  });

  const { data: centros } = useQuery({
    queryKey: ["centros-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: bases } = useQuery({
    queryKey: ["bases-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bases_ministeriais")
        .select("id, titulo")
        .eq("ativo", true)
        .order("titulo");
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: formasPagamento } = useQuery({
    queryKey: ["formas-pagamento-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar sugestões baseadas em transações anteriores do fornecedor
  const buscarSugestoesFornecedor = async (
    fornecedorIdParam: string,
    forceApply: boolean = false
  ) => {
    if (!fornecedorIdParam || fornecedorIdParam === "none") return;

    try {
      console.log(
        "Buscando sugestões para fornecedor:",
        fornecedorIdParam,
        "forceApply:",
        forceApply
      );

      const { data: transacoes, error } = await supabase
        .from("transacoes_financeiras")
        .select(
          "categoria_id, subcategoria_id, centro_custo_id, base_ministerial_id, conta_id, forma_pagamento"
        )
        .eq("fornecedor_id", fornecedorIdParam)
        .not("categoria_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      console.log("Transações encontradas:", transacoes?.length || 0);

      if (!transacoes || transacoes.length === 0) {
        console.log("Nenhuma transação anterior encontrada para sugestões");
        return;
      }

      const categoriaFreq: Record<string, number> = {};
      const subcategoriaFreq: Record<string, number> = {};
      const centroCustoFreq: Record<string, number> = {};
      const baseMinisterialFreq: Record<string, number> = {};
      const contaFreq: Record<string, number> = {};
      const formaPagamentoFreq: Record<string, number> = {};

      transacoes.forEach((t) => {
        if (t.categoria_id)
          categoriaFreq[t.categoria_id] =
            (categoriaFreq[t.categoria_id] || 0) + 1;
        if (t.subcategoria_id)
          subcategoriaFreq[t.subcategoria_id] =
            (subcategoriaFreq[t.subcategoria_id] || 0) + 1;
        if (t.centro_custo_id)
          centroCustoFreq[t.centro_custo_id] =
            (centroCustoFreq[t.centro_custo_id] || 0) + 1;
        if (t.base_ministerial_id)
          baseMinisterialFreq[t.base_ministerial_id] =
            (baseMinisterialFreq[t.base_ministerial_id] || 0) + 1;
        if (t.conta_id)
          contaFreq[t.conta_id] = (contaFreq[t.conta_id] || 0) + 1;
        if (t.forma_pagamento)
          formaPagamentoFreq[t.forma_pagamento] =
            (formaPagamentoFreq[t.forma_pagamento] || 0) + 1;
      });

      const getMaisFrequente = (freq: Record<string, number>) => {
        const entries = Object.entries(freq);
        if (entries.length === 0) return null;
        return entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      };

      const categoriaSugerida = getMaisFrequente(categoriaFreq);
      const subcategoriaSugerida = getMaisFrequente(subcategoriaFreq);
      const centroCustoSugerido = getMaisFrequente(centroCustoFreq);
      const baseMinisterialSugerida = getMaisFrequente(baseMinisterialFreq);
      const contaSugerida = getMaisFrequente(contaFreq);
      const formaPagamentoSugerida = getMaisFrequente(formaPagamentoFreq);

      console.log("Sugestões encontradas:", {
        categoriaSugerida,
        subcategoriaSugerida,
        centroCustoSugerido,
        baseMinisterialSugerida,
        contaSugerida,
        formaPagamentoSugerida,
      });

      const sugestoesAplicadas: string[] = [];

      // Quando forceApply é true (chamado do processamento de nota), sempre aplicar
      if (
        categoriaSugerida &&
        (forceApply || categoriaId === "none" || categoriaId === "")
      ) {
        setCategoriaId(categoriaSugerida);
        sugestoesAplicadas.push("categoria");
      }
      if (
        subcategoriaSugerida &&
        (forceApply || subcategoriaId === "none" || subcategoriaId === "")
      ) {
        setSubcategoriaId(subcategoriaSugerida);
        sugestoesAplicadas.push("subcategoria");
      }
      if (
        centroCustoSugerido &&
        (forceApply || centroCustoId === "none" || centroCustoId === "")
      ) {
        setCentroCustoId(centroCustoSugerido);
        sugestoesAplicadas.push("centro de custo");
      }
      if (
        baseMinisterialSugerida &&
        (forceApply || baseMinisterialId === "none" || baseMinisterialId === "")
      ) {
        setBaseMinisterialId(baseMinisterialSugerida);
        sugestoesAplicadas.push("base ministerial");
      }
      if (contaSugerida && (forceApply || contaId === "" || !contaId)) {
        setContaId(contaSugerida);
        sugestoesAplicadas.push("conta");
      }
      if (
        formaPagamentoSugerida &&
        (forceApply || formaPagamento === "" || !formaPagamento)
      ) {
        setFormaPagamento(formaPagamentoSugerida);
        sugestoesAplicadas.push("forma de pagamento");
      }

      if (sugestoesAplicadas.length > 0) {
        toast.success("💡 Sugestões aplicadas", {
          description: `Baseado em transações anteriores: ${sugestoesAplicadas.join(
            ", "
          )}`,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
    }
  };

  useEffect(() => {
    if (fornecedorId && fornecedorId !== "none" && open) {
      buscarSugestoesFornecedor(fornecedorId);
    }
  }, [fornecedorId, open]);

  // Processar arquivo com IA
  const handleFileSelected = async (file: File) => {
    setAnexoFile(file);

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    setAnexoIsPdf(isPdf);

    // Criar preview
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAnexoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (isPdf) {
      // Gerar thumbnail do PDF
      try {
        const thumbnail = await generatePdfThumbnail(file, 0.8);
        setAnexoPreview(thumbnail);
      } catch (error) {
        console.error("Erro ao gerar thumbnail do PDF:", error);
        setAnexoPreview("");
      }
    } else {
      setAnexoPreview("");
    }

    // Processar com IA automaticamente para saídas
    if (tipo === "saida") {
      await processarComIA(file);
    }
  };

  const processarComIA = async (file: File) => {
    setAiProcessing(true);
    setAiStep("uploading");

    try {
      // Garantir sessão e contexto antes de invocar a função
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error(
          "Sessão inválida. Refaça login antes de processar a nota."
        );
      }
      if (!igrejaId) {
        throw new Error(
          "Contexto da igreja não identificado. Recarregue a página e tente novamente."
        );
      }

      // Converter para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) =>
          resolve((e.target?.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setAiStep("analyzing");

      const { data, error } = await supabase.functions.invoke(
        "processar-nota-fiscal",
        {
          body: {
            imageBase64: base64,
            mimeType: file.type,
            igreja_id: igrejaId,
            filial_id: isAllFiliais ? null : filialId || null,
          },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            apikey: supabaseAnonKey,
          },
        }
      );

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAiStep("extracting");

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `notas-fiscais/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("transaction-attachments")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from("transaction-attachments")
        .createSignedUrl(filePath, 31536000);

      const publicUrl = signedData?.signedUrl;

      setAnexoUrl(publicUrl);
      if (file.type.startsWith("image/")) {
        setAnexoPreview(publicUrl);
      }

      setAiStep("filling");

      // Preencher campos
      await handleDadosNotaFiscal({ ...data.dados, anexo_url: publicUrl });

      toast.success("Nota fiscal processada com sucesso!");
    } catch (error: unknown) {
      console.error("Erro ao processar nota fiscal:", error);
      toast.error("Erro ao processar", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setAiProcessing(false);
      setAiStep("idle");
    }
  };

  const handleDadosNotaFiscal = async (dados: {
    descricao?: string;
    valor_total?: number;
    data_emissao?: string;
    data_vencimento?: string;
    numero_nota?: string;
    tipo_documento?: string;
    anexo_url?: string;
    fornecedor_nome?: string;
    fornecedor_cnpj_cpf?: string;
    fornecedor_id?: string | null;
    categoria_sugerida_id?: string | null;
    subcategoria_sugerida_id?: string | null;
    centro_custo_sugerido_id?: string | null;
    conta_sugerida_id?: string | null;
    forma_pagamento_sugerida?: string | null;
  }) => {
    try {
      console.log("Processando dados da nota fiscal:", dados);

      if (dados.descricao) setDescricao(dados.descricao);
      if (dados.valor_total)
        setValor(String(dados.valor_total).replace(".", ","));

      if (dados.data_emissao) {
        try {
          const dataEmissao = new Date(dados.data_emissao + "T12:00:00");
          setDataCompetencia(dataEmissao);
          if (!dados.data_vencimento) setDataVencimento(dataEmissao);
        } catch (e) {
          console.error("Erro ao parsear data_emissao:", e);
        }
      }

      if (dados.data_vencimento) {
        try {
          setDataVencimento(new Date(dados.data_vencimento + "T12:00:00"));
        } catch (e) {
          console.error("Erro ao parsear data_vencimento:", e);
        }
      }

      if (dados.numero_nota) {
        const novaObs = `Nota Fiscal: ${dados.numero_nota}${
          dados.tipo_documento ? `\nTipo: ${dados.tipo_documento}` : ""
        }`;
        setObservacoes((prev) => (prev ? `${novaObs}\n${prev}` : novaObs));
      }

      if (dados.anexo_url) {
        setAnexoUrl(dados.anexo_url);
        const isPdf = dados.anexo_url.toLowerCase().endsWith(".pdf");
        setAnexoIsPdf(isPdf);
        // Só gerar thumbnail se não tivermos um preview ainda (evita regenerar após upload)
        if (isPdf && !anexoPreview) {
          // Gerar thumbnail do PDF
          generatePdfThumbnail(dados.anexo_url, 0.8)
            .then((thumbnail) => setAnexoPreview(thumbnail))
            .catch((err) => {
              console.error("Erro ao gerar thumbnail do PDF:", err);
              // Mantém vazio para mostrar fallback
            });
        } else if (!isPdf) {
          setAnexoPreview(dados.anexo_url);
        }
      }

      // Aplicar fornecedor_id retornado pelo Edge, se existir
      if (dados.fornecedor_id) {
        setFornecedorId(dados.fornecedor_id);
      }

      // Preencher sugestões diretas da IA/histórico antes de buscar mais
      if (dados.categoria_sugerida_id)
        setCategoriaId(dados.categoria_sugerida_id);
      if (dados.subcategoria_sugerida_id)
        setSubcategoriaId(dados.subcategoria_sugerida_id);
      if (dados.centro_custo_sugerido_id)
        setCentroCustoId(dados.centro_custo_sugerido_id);
      if (dados.conta_sugerida_id) setContaId(dados.conta_sugerida_id);
      if (dados.forma_pagamento_sugerida)
        setFormaPagamento(dados.forma_pagamento_sugerida);

      // Se não veio fornecedor_id, buscar fornecedor existente - priorizar CNPJ/CPF
      if (
        !dados.fornecedor_id &&
        (dados.fornecedor_nome || dados.fornecedor_cnpj_cpf)
      ) {
        const cnpjCpfLimpo =
          dados.fornecedor_cnpj_cpf?.replace(/\D/g, "") || null;
        let fornecedorEncontrado: { id: string } | null = null;

        // Primeiro: tentar encontrar por CNPJ/CPF (mais preciso)
        if (cnpjCpfLimpo) {
          const { data } = await supabase
            .from("fornecedores")
            .select("id")
            .eq("cpf_cnpj", cnpjCpfLimpo)
            .eq("ativo", true)
            .limit(1)
            .maybeSingle();
          fornecedorEncontrado = data;
        }

        // Segundo: buscar por nome case-insensitive
        if (!fornecedorEncontrado && dados.fornecedor_nome) {
          const { data } = await supabase
            .from("fornecedores")
            .select("id")
            .ilike("nome", dados.fornecedor_nome)
            .eq("ativo", true)
            .limit(1)
            .maybeSingle();
          fornecedorEncontrado = data;
        }

        if (fornecedorEncontrado) {
          console.log(
            "Fornecedor encontrado, buscando sugestões:",
            fornecedorEncontrado.id
          );
          setFornecedorId(fornecedorEncontrado.id);
          // Só buscar sugestões históricas se algum campo-chave estiver vazio
          setTimeout(async () => {
            const needsMoreSuggestions =
              categoriaId === "none" ||
              !categoriaId ||
              subcategoriaId === "none" ||
              !subcategoriaId ||
              centroCustoId === "none" ||
              !centroCustoId ||
              !contaId ||
              !formaPagamento;
            if (needsMoreSuggestions) {
              await buscarSugestoesFornecedor(fornecedorEncontrado.id, true);
            }
          }, 100);
        } else if (dados.fornecedor_nome) {
          // Criar novo fornecedor
          const { data: novoFornecedor, error: fornecedorError } =
            await supabase
              .from("fornecedores")
              .insert({
                nome: dados.fornecedor_nome,
                cpf_cnpj: cnpjCpfLimpo,
                tipo_pessoa:
                  cnpjCpfLimpo?.length === 14
                    ? "juridica"
                    : cnpjCpfLimpo?.length === 11
                    ? "fisica"
                    : "juridica",
                ativo: true,
              })
              .select("id")
              .single();

          if (fornecedorError) {
            console.error("Erro ao criar fornecedor:", fornecedorError);
          } else if (novoFornecedor) {
            setFornecedorId(novoFornecedor.id);
            queryClient.invalidateQueries({
              queryKey: ["fornecedores-select"],
            });
          }
        }
      }

      console.log("Dados da nota fiscal processados com sucesso");
    } catch (error: unknown) {
      console.error("Erro ao processar dados da nota fiscal:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit disparado", { valor, contaId, descricao });

    // Validações antes de processar
    if (!contaId || contaId === "none" || contaId === "") {
      toast.error("Selecione a Conta Bancária para salvar");
      return;
    }

    // Parse do valor tratando formato brasileiro (1.234,56 -> 1234.56)
    const valorLimpo = valor.replace(/\./g, "").replace(",", ".");
    const valorNumerico = parseFloat(valorLimpo) || 0;

    if (valorNumerico <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    if (!descricao.trim()) {
      toast.error("Informe uma descrição");
      return;
    }

    if (!igrejaId) {
      toast.error(
        "Contexto da igreja não identificado. Recarregue e tente novamente."
      );
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      // Upload do anexo se não foi processado ainda (bucket privado - usar signed URL)
      let anexoPath = anexoUrl;
      if (anexoFile && !anexoUrl) {
        const fileExt = anexoFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;
        const filePath = `${tipo}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("transaction-attachments")
          .upload(filePath, anexoFile);

        if (uploadError) throw uploadError;

        // Gerar signed URL (bucket privado) - 1 ano de validade
        const { data: signedData, error: signedError } = await supabase.storage
          .from("transaction-attachments")
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);

        if (signedError || !signedData?.signedUrl) {
          throw new Error("Erro ao gerar URL de acesso ao arquivo");
        }

        anexoPath = signedData.signedUrl;
      }

      const transacaoData = {
        tipo,
        tipo_lancamento: tipoLancamento,
        descricao,
        valor: valorNumerico,
        data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
        data_competencia: format(dataCompetencia, "yyyy-MM-dd"),
        data_pagamento:
          foiPago && dataPagamento ? format(dataPagamento, "yyyy-MM-dd") : null,
        conta_id: contaId,
        categoria_id:
          categoriaId && categoriaId !== "none" ? categoriaId : null,
        subcategoria_id:
          subcategoriaId && subcategoriaId !== "none" ? subcategoriaId : null,
        centro_custo_id:
          centroCustoId && centroCustoId !== "none" ? centroCustoId : null,
        base_ministerial_id:
          baseMinisterialId && baseMinisterialId !== "none"
            ? baseMinisterialId
            : null,
        fornecedor_id:
          fornecedorId && fornecedorId !== "none" ? fornecedorId : null,
        forma_pagamento:
          formaPagamento && formaPagamento !== "none" ? formaPagamento : null,
        total_parcelas:
          tipoLancamento === "parcelado" ? parseInt(totalParcelas) : null,
        numero_parcela: tipoLancamento === "parcelado" ? 1 : null,
        recorrencia: tipoLancamento === "recorrente" ? recorrencia : null,
        data_fim_recorrencia:
          tipoLancamento === "recorrente" && dataFimRecorrencia
            ? format(dataFimRecorrencia, "yyyy-MM-dd")
            : null,
        observacoes: observacoes || null,
        anexo_url: anexoPath || null,
        lancado_por: userData.user?.id,
        status: foiPago ? "pago" : "pendente",
        juros: foiPago && juros ? parseFloat(juros.replace(",", ".")) : 0,
        multas: foiPago && multas ? parseFloat(multas.replace(",", ".")) : 0,
        desconto:
          foiPago && desconto ? parseFloat(desconto.replace(",", ".")) : 0,
        taxas_administrativas:
          foiPago && taxasAdministrativas
            ? parseFloat(taxasAdministrativas.replace(",", "."))
            : 0,
        igreja_id: igrejaId,
        filial_id: isAllFiliais ? null : filialId,
      };

      let error;
      if (transacao) {
        const result = await supabase
          .from("transacoes_financeiras")
          .update(transacaoData)
          .eq("id", String(transacao.id));
        error = result.error;
      } else {
        const result = await supabase
          .from("transacoes_financeiras")
          .insert(transacaoData);
        error = result.error;
      }

      if (error) throw error;

      // Apenas notificar se for uma NOVA transação (não na edição) e se for uma SAÍDA (Conta a Pagar)
      if (!transacao && tipo === "saida") {
        try {
          await supabase.functions.invoke("disparar-alerta", {
            body: {
              evento: "financeiro_conta_vencer",
              dados: {
                descricao,
                valor: valorNumerico,
                data_vencimento: format(dataVencimento, "yyyy-MM-dd"),
                // Formata o valor para BRL para ficar bonito na mensagem
                valor_formatado: new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(valorNumerico),
              },
            },
          });
          console.log("🔔 Alerta de nova conta a pagar disparado");
        } catch (err) {
          console.error("Erro ao disparar alerta (não bloqueante):", err);
        }
      }

      toast.success(
        `${tipo === "entrada" ? "Entrada" : "Saída"} ${
          transacao ? "atualizada" : "cadastrada"
        }!`
      );
      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : String(error) ||
              `Erro ao ${transacao ? "atualizar" : "cadastrar"} transação`
      );
    } finally {
      setLoading(false);
    }
  };

  const clearAnexo = () => {
    setAnexoFile(null);
    setAnexoUrl("");
    setAnexoPreview("");
    setAnexoIsPdf(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handler para formatar valor monetário (aceita apenas números e vírgula)
  const handleValorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;

      // Remove tudo que não é número ou vírgula
      inputValue = inputValue.replace(/[^\d,]/g, "");

      // Permite apenas uma vírgula
      const parts = inputValue.split(",");
      if (parts.length > 2) {
        inputValue = parts[0] + "," + parts.slice(1).join("");
      }

      // Limita casas decimais a 2
      if (parts.length === 2 && parts[1].length > 2) {
        inputValue = parts[0] + "," + parts[1].substring(0, 2);
      }

      setValor(inputValue);
    },
    []
  );

  // Handler para formatar valores de juros/multas/desconto/taxas
  const handleDecimalChange = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        let inputValue = e.target.value;
        inputValue = inputValue.replace(/[^\d,]/g, "");
        const parts = inputValue.split(",");
        if (parts.length > 2) {
          inputValue = parts[0] + "," + parts.slice(1).join("");
        }
        if (parts.length === 2 && parts[1].length > 2) {
          inputValue = parts[0] + "," + parts[1].substring(0, 2);
        }
        setter(inputValue);
      };
    },
    []
  );

  // Formulário principal - JSX inline para evitar re-render
  const formContent = (
    <div className="space-y-4">
      {/* Tipo de lançamento */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Tipo de {tipo === "entrada" ? "entrada" : "saída"} *
        </Label>
        <RadioGroup
          value={tipoLancamento}
          onValueChange={(value: "unico" | "recorrente" | "parcelado") =>
            setTipoLancamento(value)
          }
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="unico" id="unico" />
              <Label htmlFor="unico" className="cursor-pointer text-sm">
                Único
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="recorrente" id="recorrente" />
              <Label htmlFor="recorrente" className="cursor-pointer text-sm">
                Recorrente
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="parcelado" id="parcelado" />
              <Label htmlFor="parcelado" className="cursor-pointer text-sm">
                Parcelado
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Parcelamento */}
      {tipoLancamento === "parcelado" && (
        <div className="border-t pt-3">
          <Label htmlFor="parcelas">Número de parcelas *</Label>
          <Input
            id="parcelas"
            type="number"
            inputMode="numeric"
            min="2"
            value={totalParcelas}
            onChange={(e) => setTotalParcelas(e.target.value)}
            required
          />
        </div>
      )}

      {/* Recorrência */}
      {tipoLancamento === "recorrente" && (
        <div className="border-t pt-3 space-y-3">
          <div>
            <Label>Frequência *</Label>
            <Select
              value={recorrencia}
              onValueChange={(
                value:
                  | "diaria"
                  | "semanal"
                  | "quinzenal"
                  | "mensal"
                  | "bimestral"
              ) => setRecorrencia(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diaria">Diária</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="bimestral">Bimestral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data fim (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataFimRecorrencia && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFimRecorrencia
                    ? format(dataFimRecorrencia, "dd/MM/yyyy", { locale: ptBR })
                    : "Opcional"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataFimRecorrencia}
                  onSelect={setDataFimRecorrencia}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Informações básicas */}
      <div className="border-t pt-3 space-y-3">
        {tipo === "saida" && (
          <div>
            <Label>Fornecedor</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {fornecedores
                  ?.filter((f) => f.id)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="descricao">Descrição *</Label>
          <Input
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={`Descrição da ${tipo}`}
            required
          />
        </div>

        <div>
          <Label htmlFor="valor">Valor *</Label>
          <Input
            id="valor"
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={handleValorChange}
            placeholder="0,00"
            required
            className="md:hidden text-lg h-12 border-2 border-primary bg-primary/5"
          />
          <Input
            id="valor-desktop"
            type="text"
            inputMode="decimal"
            value={valor}
            onChange={handleValorChange}
            placeholder="0,00"
            required
            className="hidden md:block text-base h-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Forma de pgto</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não especificado</SelectItem>
                {formasPagamento
                  ?.filter((f) => f.id)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.nome}>
                      {f.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Conta *</Label>
            <Select value={contaId} onValueChange={setContaId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas
                  ?.filter((c) => c.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Vencimento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataVencimento, "dd/MM/yy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataVencimento}
                  onSelect={(date) => date && setDataVencimento(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Competência *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataCompetencia, "dd/MM/yy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataCompetencia}
                  onSelect={(date) => date && setDataCompetencia(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Classificação contábil */}
      <div className="border-t pt-3 space-y-3">
        <h4 className="font-medium text-sm">Classificação</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Select
              value={categoriaId}
              onValueChange={(value) => {
                setCategoriaId(value);
                setSubcategoriaId("none");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {categorias
                  ?.filter((c) => c.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Subcategoria</Label>
            <Select
              value={subcategoriaId}
              onValueChange={setSubcategoriaId}
              disabled={!categoriaId || categoriaId === "none"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {subcategorias
                  ?.filter((s) => s.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Base Ministerial</Label>
            <Select
              value={baseMinisterialId}
              onValueChange={setBaseMinisterialId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {bases
                  ?.filter((b) => b.id)
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.titulo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Centro de Custo</Label>
            <Select value={centroCustoId} onValueChange={setCentroCustoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {centros
                  ?.filter((c) => c.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Confirmação de pagamento */}
      <div className="p-3 border border-primary/20 rounded-lg bg-primary/5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="foi-pago" className="font-medium">
              Já foi {tipo === "entrada" ? "recebido" : "pago"}?
            </Label>
          </div>
          <Switch
            id="foi-pago"
            checked={foiPago}
            onCheckedChange={setFoiPago}
          />
        </div>

        {foiPago && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label>
                Data do {tipo === "entrada" ? "recebimento" : "pagamento"} *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataPagamento && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPagamento
                      ? format(dataPagamento, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dataPagamento}
                    onSelect={setDataPagamento}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Juros</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={juros}
                  onChange={handleDecimalChange(setJuros)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Multas</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={multas}
                  onChange={handleDecimalChange(setMultas)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Desconto</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={desconto}
                  onChange={handleDecimalChange(setDesconto)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Taxas</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={taxasAdministrativas}
                  onChange={handleDecimalChange(setTaxasAdministrativas)}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Observações */}
      <div>
        <Label>Observações</Label>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações adicionais..."
          rows={2}
        />
      </div>
    </div>
  );

  // Handler para abrir visualização - Abre modal interno para tudo
  const handleViewDocument = () => {
    setImagePreviewOpen(true);
  };

  const title = transacao
    ? "Editar"
    : tipo === "entrada"
    ? "Nova Entrada"
    : "Nova Saída";

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        dialogContentProps={{
          className: "max-w-4xl max-h-[90vh] overflow-hidden flex flex-col",
        }}
        drawerContentProps={{
          className: "max-h-[95vh]",
        }}
      >
        <div className="flex flex-col h-full relative">
          {/* Overlay de processamento IA */}
          <AIProcessingOverlay currentStep={aiStep} />
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário de {tipo === "entrada" ? "entrada" : "saída"} financeira
          </DialogDescription>
          <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col h-full min-h-0"
            >
              {/* Desktop: Split View */}
              <div className="hidden md:flex md:gap-6 flex-1 min-h-0">
                {/* Coluna esquerda: Imagem */}
                <div className="w-[340px] shrink-0 flex flex-col gap-4">
                  <h3 className="font-semibold text-sm">Documento</h3>
                  <TransacaoUploadSection
                    anexoPreview={anexoPreview}
                    anexoUrl={anexoUrl}
                    anexoFile={anexoFile}
                    anexoIsPdf={anexoIsPdf}
                    isMobile={isMobile}
                    aiProcessing={aiProcessing}
                    onFileSelected={handleFileSelected}
                    onClear={clearAnexo}
                    onViewDocument={handleViewDocument}
                  />

                  {!anexoPreview && !anexoUrl && !anexoFile && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs font-medium mb-1">Dicas:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>• Foto nítida e bem iluminada</li>
                        <li>• Enquadre toda a nota</li>
                        <li>• PDFs funcionam melhor</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Coluna direita: Formulário com scroll */}
                <ScrollArea className="flex-1 min-w-0 pl-4 border-l h-[calc(90vh-180px)]">
                  <div className="pr-4">{formContent}</div>
                </ScrollArea>
              </div>

              {/* Mobile: Coluna única */}
              <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-4 pb-20">
                {/* Upload em destaque no topo */}
                {tipo === "saida" && !transacao && (
                  <TransacaoUploadSection
                    anexoPreview={anexoPreview}
                    anexoUrl={anexoUrl}
                    anexoFile={anexoFile}
                    anexoIsPdf={anexoIsPdf}
                    isMobile={isMobile}
                    aiProcessing={aiProcessing}
                    onFileSelected={handleFileSelected}
                    onClear={clearAnexo}
                    onViewDocument={handleViewDocument}
                  />
                )}

                {formContent}
              </div>

              {/* Botões de ação - Sticky no mobile */}
              <div
                className={cn(
                  "flex gap-2 pt-4 border-t bg-background shrink-0",
                  isMobile && "fixed bottom-0 left-0 right-0 p-4 shadow-lg"
                )}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || aiProcessing}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : transacao ? (
                    "Atualizar"
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </ResponsiveDialog>
      <TransacaoDocumentViewer
        open={imagePreviewOpen}
        onOpenChange={setImagePreviewOpen}
        url={anexoUrl || anexoPreview}
        isPdf={anexoIsPdf || anexoFile?.type === "application/pdf"}
        fileName={anexoFile?.name}
        imageZoom={imageZoom}
        setImageZoom={setImageZoom}
      />
    </>
  );
}
