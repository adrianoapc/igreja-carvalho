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
import { DateFieldPicker } from "@/components/financas/DateFieldPicker";
import {
  X,
  Loader2,
  ZoomIn,
  ZoomOut,
  FileText,
  Download,
  ImageIcon,
  Copy,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  criarLancamento,
  atualizarLancamento,
  alterarCompetenciaGrupo,
} from "@/features/financeiro/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDadosApoio } from "@/features/financeiro/core/hooks/useDadosApoio";

// Helper para converter string ISO (YYYY-MM-DD) para Date no timezone local
const parseLocalDate = (
  dateString: string | null | undefined,
): Date | undefined => {
  if (!dateString) return undefined;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// Helper para converter Date para string ISO (YYYY-MM-DD) sem offset de timezone
const formatLocalDate = (date: Date | undefined): string | null => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
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
    valor_liquido?: number | null;
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
    forma_pagamento_id?: string | null;
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
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);

  // Estados do formulário
  const [tipoLancamento, setTipoLancamento] = useState<
    "unico" | "recorrente" | "parcelado"
  >("unico");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [valorLiquido, setValorLiquido] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date>(new Date());
  const [dataCompetencia, setDataCompetencia] = useState<Date>(new Date());
  // D10: quando fin_atualizar_lancamento recusa editar a competência de uma
  // parcela isolada de um grupo parcelado, oferece sincronizar o grupo todo
  // via fin_alterar_competencia_grupo em vez de só mostrar um erro genérico.
  const [confirmarSincronizarGrupo, setConfirmarSincronizarGrupo] = useState<{
    lancamentoId: string;
    novaCompetencia: string;
    // Resto do patch (descrição, valor, forma de pagamento etc.) que a RPC
    // recusou junto por causa do bloqueio de competência — reaplicado após
    // sincronizar o grupo, senão essas edições se perdem silenciosamente
    // (review Codex P1).
    patchRestante: Record<string, unknown>;
  } | null>(null);
  const [sincronizandoGrupo, setSincronizandoGrupo] = useState(false);
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

  useEffect(() => {
    const parse = (v: string) =>
      parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;

    const valorBruto = parse(valor);
    const taxas = parse(taxasAdministrativas);
    const jurosNum = parse(juros);
    const multasNum = parse(multas);
    const descontoNum = parse(desconto);

    // Taxa administrativa reduz o que se RECEBE (entrada) e aumenta o que
    // se PAGA (saída) — mesma correção do backend (fin_criar_lancamento e
    // demais RPCs fin_*, ver docs/arquitetura-financeiro.md §9.15).
    const sinalTaxa = tipo === "saida" ? 1 : -1;
    const liquido =
      valorBruto + sinalTaxa * taxas + jurosNum + multasNum - descontoNum;

    setValorLiquido(
      liquido === 0
        ? ""
        : liquido.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
    );
  }, [valor, taxasAdministrativas, juros, multas, desconto, tipo]);

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (transacao && open) {
      setDescricao(transacao.descricao || "");
      // Formatar valor como moeda BR (ex: 1234.50 -> "1.234,50")
      const formatarValorBR = (num: number | null | undefined) => {
        if (num == null) return "";
        return num.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      };
      setValor(formatarValorBR(transacao.valor));
      setValorLiquido(formatarValorBR(transacao.valor_liquido));
      setDataVencimento(
        parseLocalDate(transacao.data_vencimento) || new Date(),
      );
      setDataCompetencia(
        parseLocalDate(transacao.data_competencia) || new Date(),
      );
      // Debug dos outros campos
      console.log("🔍 Campos do banco:", {
        conta_id: transacao.conta_id,
        categoria_id: transacao.categoria_id,
        subcategoria_id: transacao.subcategoria_id,
        centro_custo_id: transacao.centro_custo_id,
        fornecedor_id: transacao.fornecedor_id,
        forma_pagamento_id: transacao.forma_pagamento_id,
      });

      setContaId(transacao.conta_id ? String(transacao.conta_id) : "none");

      // Setar categoria primeiro, depois subcategoria (evitar race condition na query)
      const categoriaValue = transacao.categoria_id
        ? String(transacao.categoria_id)
        : "none";
      const subcategoriaValue = transacao.subcategoria_id
        ? String(transacao.subcategoria_id)
        : "none";

      setCategoriaId(categoriaValue);

      // Aguardar próximo ciclo para setar subcategoria (query precisa recarregar primeiro)
      if (subcategoriaValue !== "none") {
        setTimeout(() => {
          setSubcategoriaId(subcategoriaValue);
          // Desmarcar flag após completar o carregamento
          setTimeout(() => 100);
        }, 50);
      } else {
        setSubcategoriaId("none");
        // Desmarcar flag imediatamente se não tem subcategoria
        setTimeout(() => 100);
      }
      setCentroCustoId(transacao.centro_custo_id || "none");
      setBaseMinisterialId(transacao.base_ministerial_id || "none");
      setFornecedorId(transacao.fornecedor_id || "none");
      setFormaPagamento(transacao.forma_pagamento_id || "");
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
      setDataPagamento(parseLocalDate(transacao.data_pagamento));
      // Mesma formatação BR de valor/valorLiquido acima — String(numero) cru
      // (ex: "0.9") quebra o parser do recálculo automático abaixo, que
      // assume formato BR (remove ponto de milhar antes de trocar vírgula
      // por ponto): "0.9" virava 9, não 0,9.
      setJuros(transacao.juros ? formatarValorBR(transacao.juros) : "");
      setMultas(transacao.multas ? formatarValorBR(transacao.multas) : "");
      setDesconto(transacao.desconto ? formatarValorBR(transacao.desconto) : "");
      setTaxasAdministrativas(
        transacao.taxas_administrativas
          ? formatarValorBR(transacao.taxas_administrativas)
          : "",
      );
      if (transacao.total_parcelas)
        setTotalParcelas(String(transacao.total_parcelas));
      if (transacao.recorrencia) setRecorrencia(transacao.recorrencia);
      if (transacao.data_fim_recorrencia)
        setDataFimRecorrencia(parseLocalDate(transacao.data_fim_recorrencia));
    } else if (!open) {
      resetForm();
    }
  }, [transacao, open]);

  const resetForm = () => {
    setDescricao("");
    setValor("");
    setValorLiquido("");
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

  // Cadastros de apoio centralizados no CORE (F2/ADR-029)
  const {
    contas,
    categorias,
    subcategorias,
    subcategoriasLoading,
    centros,
    bases,
    fornecedores,
    formasPagamento,
  } = useDadosApoio(tipo, categoriaId, open);

  // Buscar sugestões baseadas em transações anteriores do fornecedor
  const buscarSugestoesFornecedor = async (
    fornecedorIdParam: string,
    forceApply: boolean = false,
  ) => {
    if (!fornecedorIdParam || fornecedorIdParam === "none") return;

    try {
      console.log(
        "Buscando sugestões para fornecedor:",
        fornecedorIdParam,
        "forceApply:",
        forceApply,
      );

      // forma_pagamento_id ainda não consta nos tipos gerados de types.ts
      // (regenerar com `supabase gen types` após o deploy da migration).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: transacoes, error } = await (supabase as any)
        .from("transacoes_financeiras")
        .select(
          "categoria_id, subcategoria_id, centro_custo_id, base_ministerial_id, conta_id, forma_pagamento_id",
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
        if (t.forma_pagamento_id)
          formaPagamentoFreq[t.forma_pagamento_id] =
            (formaPagamentoFreq[t.forma_pagamento_id] || 0) + 1;
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
            ", ",
          )}`,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar sugestões:", error);
    }
  };

  useEffect(() => {
    // Só sugere se for nova transação ou se mudou o fornecedor
    if (
      fornecedorId &&
      fornecedorId !== "none" &&
      open &&
      (!transacao || fornecedorId !== (transacao.fornecedor_id || "none"))
    ) {
      buscarSugestoesFornecedor(fornecedorId);
    }
  }, [fornecedorId, open, transacao]);

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
          "Sessão inválida. Refaça login antes de processar a nota.",
        );
      }
      if (!igrejaId) {
        throw new Error(
          "Contexto da igreja não identificado. Recarregue a página e tente novamente.",
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
        },
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
            fornecedorEncontrado.id,
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
        "Contexto da igreja não identificado. Recarregue e tente novamente.",
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

      // Calcular valor_liquido conforme ADR-027
      // Desconto e taxas podem existir antes do pagamento (previsíveis)
      // Juros e multas só existem após pagamento (atraso)
      // Parse BR completo (remove separador de milhar antes da vírgula
      // decimal) — mesmo parser de valor/valorLiquido logo acima. Review
      // Codex (P1, PR #59): agora que os campos nascem formatados em BR
      // (ex.: "1.234,56"), um parse que só troca vírgula por ponto
      // truncava ajustes >= R$1.000.
      const parseDecimalBR = (v: string) =>
        parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
      const descontoNum = desconto ? parseDecimalBR(desconto) : 0;
      const taxasAdmNum = taxasAdministrativas
        ? parseDecimalBR(taxasAdministrativas)
        : 0;
      const jurosNum = foiPago && juros ? parseDecimalBR(juros) : 0;
      const multasNum = foiPago && multas ? parseDecimalBR(multas) : 0;

      let valorLiquidoFinal: number;
      if (valorLiquido && valorLiquido.trim() !== "") {
        valorLiquidoFinal = parseFloat(
          valorLiquido.replace(/\./g, "").replace(",", "."),
        );
      } else {
        // Calcular automaticamente: taxa reduz o que se recebe (entrada) e
        // aumenta o que se paga (saída) — mesma regra do backend (ver
        // docs/arquitetura-financeiro.md §9.15).
        const sinalTaxa = tipo === "saida" ? 1 : -1;
        valorLiquidoFinal =
          valorNumerico + jurosNum + multasNum + sinalTaxa * taxasAdmNum - descontoNum;
      }

      // Campos comuns criar/editar — a escrita acontece nas RPCs fin_* do
      // CORE (ADR-029); tenant e permissão são validados no banco.
      const competenciaFormatada = formatLocalDate(dataCompetencia);
      // "" é tanto o estado inicial de uma transação nova quanto o de uma
      // existente cujo forma_pagamento_id nunca foi mapeado (reembolso/
      // transferência — fora do escopo da FK, ver 20260729130000). "none"
      // é a escolha explícita "Não especificado" no Select.
      const formaPagamentoId =
        formaPagamento && formaPagamento !== "none" ? formaPagamento : null;
      const camposComuns = {
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
        data_pagamento:
          foiPago && dataPagamento ? formatLocalDate(dataPagamento) : null,
        // Juros e multas só quando pago (atraso); desconto/taxas sempre
        juros: jurosNum,
        multas: multasNum,
        desconto: descontoNum,
        taxas_administrativas: taxasAdmNum,
        valor_liquido: valorLiquidoFinal,
        observacoes: observacoes || null,
        anexo_url: anexoPath || null,
        filial_id: isAllFiliais ? null : filialId,
      };

      if (transacao) {
        // D10: fin_atualizar_lancamento recusa (FIN_COMPETENCIA_GRUPO)
        // QUALQUER patch que contenha data_competencia numa parcela de
        // grupo parcelado — mesmo sem mudança real de valor. Como o form
        // sempre carrega esse campo, só inclui no patch quando o valor
        // realmente difere do que já estava salvo (review Codex P1); assim
        // editar outro campo (descrição, valor...) numa parcela não aciona
        // o bloqueio à toa.
        const competenciaMudou =
          transacao.data_competencia !== competenciaFormatada;
        // Mesmo raciocínio da competência: só inclui forma_pagamento_id no
        // patch quando muda de verdade. Sem isso, reabrir uma transação
        // legada sem forma_pagamento_id mapeado (formaPagamento carrega ""),
        // salvar SEM tocar no campo, manda forma_pagamento_id:null — a RPC
        // vê a chave presente e zera também o texto legado forma_pagamento
        // (Codex P2), apagando um dado que o usuário nunca pediu pra mudar.
        const formaPagamentoMudou =
          formaPagamentoId !== (transacao.forma_pagamento_id || null);
        const patchAtualizar = {
          ...camposComuns,
          ...(competenciaMudou
            ? { data_competencia: competenciaFormatada }
            : {}),
          ...(formaPagamentoMudou ? { forma_pagamento_id: formaPagamentoId } : {}),
          tipo,
          tipo_lancamento: tipoLancamento as "unico" | "parcelado" | "recorrente",
          descricao,
          valor: valorNumerico,
          data_vencimento: formatLocalDate(dataVencimento),
          conta_id: contaId,
          categoria_id:
            categoriaId && categoriaId !== "none" ? categoriaId : null,
          status: (foiPago ? "pago" : "pendente") as "pago" | "pendente",
          total_parcelas:
            tipoLancamento === "parcelado" ? parseInt(totalParcelas) : undefined,
          recorrencia: tipoLancamento === "recorrente" ? recorrencia : null,
          data_fim_recorrencia:
            tipoLancamento === "recorrente" && dataFimRecorrencia
              ? formatLocalDate(dataFimRecorrencia)
              : null,
          lancado_por: userData.user?.id,
        };
        try {
          await atualizarLancamento(String(transacao.id), patchAtualizar);
        } catch (updateError: unknown) {
          // D10: mesmo com o filtro acima, uma mudança DELIBERADA de
          // competência numa parcela ainda aciona o bloqueio — nesse caso
          // preserva o resto do patch pra reaplicar depois de sincronizar
          // o grupo, em vez de descartar silenciosamente (Codex P1).
          if (
            updateError instanceof Error &&
            updateError.message.includes("FIN_COMPETENCIA_GRUPO")
          ) {
            const { data_competencia: _omit, ...patchRestante } =
              patchAtualizar;
            setConfirmarSincronizarGrupo({
              lancamentoId: String(transacao.id),
              novaCompetencia: competenciaFormatada!,
              patchRestante,
            });
            return;
          }
          throw updateError;
        }
      } else {
        const resultado = await criarLancamento({
          tipo: tipo as "entrada" | "saida",
          valor: valorNumerico,
          data_vencimento: formatLocalDate(dataVencimento),
          conta_id: contaId,
          descricao,
          categoria_id:
            categoriaId && categoriaId !== "none" ? categoriaId : null,
          extras: {
            ...camposComuns,
            forma_pagamento_id: formaPagamentoId,
            data_competencia: competenciaFormatada,
            status: foiPago ? "pago" : "pendente",
            tipo_lancamento: tipoLancamento as
              | "unico"
              | "parcelado"
              | "recorrente",
            total_parcelas:
              tipoLancamento === "parcelado"
                ? parseInt(totalParcelas)
                : undefined,
            recorrencia: tipoLancamento === "recorrente" ? recorrencia : null,
            data_fim_recorrencia:
              tipoLancamento === "recorrente" && dataFimRecorrencia
                ? formatLocalDate(dataFimRecorrencia)
                : null,
            lancado_por: userData.user?.id,
          },
        });
        resultado.warnings?.forEach((w) => toast.info(w));
      }

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
        }!`,
      );
      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      // FIN_COMPETENCIA_GRUPO (D10) já é tratado no catch específico em
      // volta de atualizarLancamento, mais acima, onde o resto do patch
      // ainda está disponível pra reaplicar depois de sincronizar o grupo.
      toast.error(
        error instanceof Error
          ? error.message
          : String(error) ||
              `Erro ao ${transacao ? "atualizar" : "cadastrar"} transação`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSincronizarCompetenciaGrupo = async () => {
    if (!confirmarSincronizarGrupo) return;
    setSincronizandoGrupo(true);
    try {
      const resultado = await alterarCompetenciaGrupo(
        confirmarSincronizarGrupo.lancamentoId,
        confirmarSincronizarGrupo.novaCompetencia,
      );
      resultado.warnings?.forEach((w) => toast.info(w));

      // Reaplica o resto do patch original (descrição, valor, forma de
      // pagamento etc.) que a recusa FIN_COMPETENCIA_GRUPO tinha descartado
      // junto com a mudança de competência — sincronizar o grupo não pode
      // jogar fora as outras edições pedidas no mesmo submit (Codex P1).
      if (Object.keys(confirmarSincronizarGrupo.patchRestante).length > 0) {
        await atualizarLancamento(
          confirmarSincronizarGrupo.lancamentoId,
          confirmarSincronizarGrupo.patchRestante,
        );
      }

      toast.success("Competência sincronizada em todas as parcelas do lançamento!");
      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      setConfirmarSincronizarGrupo(null);
      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao sincronizar competência do grupo",
      );
    } finally {
      setSincronizandoGrupo(false);
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
    [],
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
    [],
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
                  | "bimestral",
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
            <Label htmlFor="data-fim-recorrencia">Data fim (opcional)</Label>
            <DateFieldPicker
              id="data-fim-recorrencia"
              value={dataFimRecorrencia}
              onChange={setDataFimRecorrencia}
              placeholder="Opcional"
            />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="valor">Valor (Bruto) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="valor"
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={handleValorChange}
                placeholder="0,00"
                required
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="valor-liquido">Valor Pago (Líquido)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="valor-liquido"
                type="text"
                inputMode="decimal"
                value={valorLiquido}
                onChange={handleDecimalChange(setValorLiquido)}
                placeholder="0,00"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deixe vazio para calcular automaticamente
            </p>
          </div>
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
                    <SelectItem key={f.id} value={f.id}>
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
            <Label htmlFor="data-vencimento-transacao">Vencimento *</Label>
            <DateFieldPicker
              id="data-vencimento-transacao"
              value={dataVencimento}
              onChange={(date) => date && setDataVencimento(date)}
            />
          </div>

          <div>
            <Label htmlFor="data-competencia-transacao">Competência *</Label>
            <DateFieldPicker
              id="data-competencia-transacao"
              value={dataCompetencia}
              onChange={(date) => date && setDataCompetencia(date)}
            />
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
              <SelectTrigger className="text-left">
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
              value={subcategoriaId || "none"}
              onValueChange={setSubcategoriaId}
              disabled={
                !categoriaId || categoriaId === "none" || subcategoriasLoading
              }
            >
              <SelectTrigger className="text-left">
                {subcategoriasLoading &&
                subcategoriaId &&
                subcategoriaId !== "none" ? (
                  <span className="text-muted-foreground">Carregando...</span>
                ) : subcategoriaId && subcategoriaId !== "none" ? (
                  <span>
                    {subcategorias?.find((s) => s.id === subcategoriaId)
                      ?.nome || "Carregando..."}
                  </span>
                ) : (
                  <SelectValue placeholder="Selecione" />
                )}
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
              <SelectTrigger className="text-left">
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

      {/* Ajustes de Valor (previsíveis - antes do pagamento) */}
      <div className="border-t pt-3 space-y-3">
        <h4 className="font-medium text-sm">Ajustes de Valor (Previstos)</h4>
        <p className="text-xs text-muted-foreground">
          Desconto e taxas conhecidos. O valor líquido será calculado
          automaticamente.
        </p>
        <div className="grid grid-cols-2 gap-2">
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
            <Label>Taxas Administrativas</Label>
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
              <Label htmlFor="data-pagamento-transacao">
                Data do {tipo === "entrada" ? "recebimento" : "pagamento"} *
              </Label>
              <DateFieldPicker
                id="data-pagamento-transacao"
                value={dataPagamento}
                onChange={setDataPagamento}
                placeholder="Selecione"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Juros e multas por atraso (se houver):
            </p>
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
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  {title}
                </h2>
                {transacao?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(String(transacao.id));
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                      toast.success("ID copiado!");
                    }}
                    className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="font-mono">
                      ID: {String(transacao.id).substring(0, 8)}...
                    </span>
                    {copiedId ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            </div>
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
                  isMobile && "fixed bottom-0 left-0 right-0 p-4 shadow-lg",
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
      <AlertDialog
        open={!!confirmarSincronizarGrupo}
        onOpenChange={(open) => !open && setConfirmarSincronizarGrupo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar competência do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta parcela faz parte de um lançamento parcelado — todas as
              parcelas compartilham a mesma competência (D10). Aplicar a nova
              competência a esta parcela isolada divergiria do grupo. Deseja
              aplicar a nova competência a TODAS as parcelas deste
              lançamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sincronizandoGrupo}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={sincronizandoGrupo}
              onClick={(e) => {
                e.preventDefault();
                handleSincronizarCompetenciaGrupo();
              }}
            >
              {sincronizandoGrupo ? "Sincronizando..." : "Sincronizar grupo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
