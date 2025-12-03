import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Camera, Upload, Eye, X, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface TransacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "entrada" | "saida";
  transacao?: any;
}

export function TransacaoDialog({ open, onOpenChange, tipo, transacao }: TransacaoDialogProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  
  // Estados do formulário
  const [tipoLancamento, setTipoLancamento] = useState<"unico" | "recorrente" | "parcelado">("unico");
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
  const [recorrencia, setRecorrencia] = useState<"diaria" | "semanal" | "quinzenal" | "mensal" | "bimestral">("mensal");
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState<Date | undefined>();
  const [observacoes, setObservacoes] = useState("");
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string>("");
  const [anexoPreview, setAnexoPreview] = useState<string>("");
  
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
      setDataVencimento(transacao.data_vencimento ? new Date(transacao.data_vencimento) : new Date());
      setDataCompetencia(transacao.data_competencia ? new Date(transacao.data_competencia) : new Date());
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
      setAnexoPreview(transacao.anexo_url || "");
      setFoiPago(transacao.status === 'pago');
      setDataPagamento(transacao.data_pagamento ? new Date(transacao.data_pagamento) : undefined);
      setJuros(transacao.juros ? String(transacao.juros) : "");
      setMultas(transacao.multas ? String(transacao.multas) : "");
      setDesconto(transacao.desconto ? String(transacao.desconto) : "");
      setTaxasAdministrativas(transacao.taxas_administrativas ? String(transacao.taxas_administrativas) : "");
      if (transacao.total_parcelas) setTotalParcelas(String(transacao.total_parcelas));
      if (transacao.recorrencia) setRecorrencia(transacao.recorrencia);
      if (transacao.data_fim_recorrencia) setDataFimRecorrencia(new Date(transacao.data_fim_recorrencia));
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
    queryKey: ['contas-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias-select', tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .select('id, nome')
        .eq('tipo', tipo)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: subcategorias } = useQuery({
    queryKey: ['subcategorias-select', categoriaId],
    queryFn: async () => {
      if (!categoriaId || categoriaId === 'none') return [];
      const { data, error } = await supabase
        .from('subcategorias_financeiras')
        .select('id, nome')
        .eq('categoria_id', categoriaId)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!categoriaId && categoriaId !== 'none',
  });

  const { data: centros } = useQuery({
    queryKey: ['centros-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centros_custo')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: bases } = useQuery({
    queryKey: ['bases-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bases_ministeriais')
        .select('id, titulo')
        .eq('ativo', true)
        .order('titulo');
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const { data: formasPagamento } = useQuery({
    queryKey: ['formas-pagamento-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Buscar sugestões baseadas em transações anteriores do fornecedor
  const buscarSugestoesFornecedor = async (fornecedorIdParam: string) => {
    if (!fornecedorIdParam || fornecedorIdParam === 'none') return;

    try {
      const { data: transacoes, error } = await supabase
        .from('transacoes_financeiras')
        .select('categoria_id, subcategoria_id, centro_custo_id, base_ministerial_id, conta_id, forma_pagamento')
        .eq('fornecedor_id', fornecedorIdParam)
        .not('categoria_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!transacoes || transacoes.length === 0) return;

      const categoriaFreq: Record<string, number> = {};
      const subcategoriaFreq: Record<string, number> = {};
      const centroCustoFreq: Record<string, number> = {};
      const baseMinisterialFreq: Record<string, number> = {};
      const contaFreq: Record<string, number> = {};
      const formaPagamentoFreq: Record<string, number> = {};

      transacoes.forEach(t => {
        if (t.categoria_id) categoriaFreq[t.categoria_id] = (categoriaFreq[t.categoria_id] || 0) + 1;
        if (t.subcategoria_id) subcategoriaFreq[t.subcategoria_id] = (subcategoriaFreq[t.subcategoria_id] || 0) + 1;
        if (t.centro_custo_id) centroCustoFreq[t.centro_custo_id] = (centroCustoFreq[t.centro_custo_id] || 0) + 1;
        if (t.base_ministerial_id) baseMinisterialFreq[t.base_ministerial_id] = (baseMinisterialFreq[t.base_ministerial_id] || 0) + 1;
        if (t.conta_id) contaFreq[t.conta_id] = (contaFreq[t.conta_id] || 0) + 1;
        if (t.forma_pagamento) formaPagamentoFreq[t.forma_pagamento] = (formaPagamentoFreq[t.forma_pagamento] || 0) + 1;
      });

      const getMaisFrequente = (freq: Record<string, number>) => {
        const entries = Object.entries(freq);
        if (entries.length === 0) return null;
        return entries.reduce((a, b) => a[1] > b[1] ? a : b)[0];
      };

      const categoriaSugerida = getMaisFrequente(categoriaFreq);
      const subcategoriaSugerida = getMaisFrequente(subcategoriaFreq);
      const centroCustoSugerido = getMaisFrequente(centroCustoFreq);
      const baseMinisterialSugerida = getMaisFrequente(baseMinisterialFreq);
      const contaSugerida = getMaisFrequente(contaFreq);
      const formaPagamentoSugerida = getMaisFrequente(formaPagamentoFreq);

      if (categoriaSugerida && (categoriaId === 'none' || categoriaId === '')) setCategoriaId(categoriaSugerida);
      if (subcategoriaSugerida && (subcategoriaId === 'none' || subcategoriaId === '')) setSubcategoriaId(subcategoriaSugerida);
      if (centroCustoSugerido && (centroCustoId === 'none' || centroCustoId === '')) setCentroCustoId(centroCustoSugerido);
      if (baseMinisterialSugerida && (baseMinisterialId === 'none' || baseMinisterialId === '')) setBaseMinisterialId(baseMinisterialSugerida);
      if (contaSugerida && (contaId === '' || !contaId)) setContaId(contaSugerida);
      if (formaPagamentoSugerida && (formaPagamento === '' || !formaPagamento)) setFormaPagamento(formaPagamentoSugerida);

      const sugestoesAplicadas = [];
      if (categoriaSugerida) sugestoesAplicadas.push('categoria');
      if (subcategoriaSugerida) sugestoesAplicadas.push('subcategoria');
      if (centroCustoSugerido) sugestoesAplicadas.push('centro de custo');
      if (baseMinisterialSugerida) sugestoesAplicadas.push('base ministerial');
      if (contaSugerida) sugestoesAplicadas.push('conta');
      if (formaPagamentoSugerida) sugestoesAplicadas.push('forma de pagamento');

      if (sugestoesAplicadas.length > 0) {
        toast.success('💡 Sugestões aplicadas', {
          description: `Baseado em transações anteriores: ${sugestoesAplicadas.join(', ')}`
        });
      }
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
    }
  };

  useEffect(() => {
    if (fornecedorId && fornecedorId !== 'none' && open) {
      buscarSugestoesFornecedor(fornecedorId);
    }
  }, [fornecedorId, open]);

  // Processar arquivo com IA
  const handleFileSelected = async (file: File) => {
    setAnexoFile(file);
    
    // Criar preview se for imagem
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAnexoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAnexoPreview("");
    }

    // Processar com IA automaticamente para saídas
    if (tipo === 'saida') {
      await processarComIA(file);
    }
  };

  const processarComIA = async (file: File) => {
    setAiProcessing(true);

    try {
      // Converter para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      toast.loading('Processando nota fiscal com IA...', { id: 'processing' });
      
      const { data, error } = await supabase.functions.invoke('processar-nota-fiscal', {
        body: { imageBase64: base64, mimeType: file.type }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Upload do arquivo
      toast.loading('Salvando arquivo...', { id: 'processing' });
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `notas-fiscais/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('transaction-attachments')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('transaction-attachments')
        .getPublicUrl(filePath);

      setAnexoUrl(publicUrl);

      // Preencher campos
      await handleDadosNotaFiscal({ ...data.dados, anexo_url: publicUrl });
      
      toast.success('Nota fiscal processada!', { id: 'processing' });
    } catch (error: any) {
      console.error('Erro ao processar nota fiscal:', error);
      toast.error('Erro ao processar', { description: error.message, id: 'processing' });
    } finally {
      setAiProcessing(false);
    }
  };

  const handleDadosNotaFiscal = async (dados: any) => {
    try {
      console.log('Processando dados da nota fiscal:', dados);
      
      if (dados.descricao) setDescricao(dados.descricao);
      if (dados.valor_total) setValor(String(dados.valor_total).replace('.', ','));
      
      if (dados.data_emissao) {
        try {
          const dataEmissao = new Date(dados.data_emissao + 'T12:00:00');
          setDataCompetencia(dataEmissao);
          if (!dados.data_vencimento) setDataVencimento(dataEmissao);
        } catch (e) {
          console.error('Erro ao parsear data_emissao:', e);
        }
      }
      
      if (dados.data_vencimento) {
        try {
          setDataVencimento(new Date(dados.data_vencimento + 'T12:00:00'));
        } catch (e) {
          console.error('Erro ao parsear data_vencimento:', e);
        }
      }

      if (dados.numero_nota) {
        const novaObs = `Nota Fiscal: ${dados.numero_nota}${dados.tipo_documento ? `\nTipo: ${dados.tipo_documento}` : ''}`;
        setObservacoes(prev => prev ? `${novaObs}\n${prev}` : novaObs);
      }

      if (dados.anexo_url) {
        setAnexoUrl(dados.anexo_url);
      }

      // Buscar fornecedor existente - priorizar CNPJ/CPF
      if (dados.fornecedor_nome || dados.fornecedor_cnpj_cpf) {
        const cnpjCpfLimpo = dados.fornecedor_cnpj_cpf?.replace(/\D/g, '') || null;
        let fornecedorEncontrado: any = null;

        // Primeiro: tentar encontrar por CNPJ/CPF (mais preciso)
        if (cnpjCpfLimpo) {
          const { data } = await supabase
            .from('fornecedores')
            .select('id')
            .eq('cpf_cnpj', cnpjCpfLimpo)
            .eq('ativo', true)
            .limit(1)
            .maybeSingle();
          fornecedorEncontrado = data;
        }

        // Segundo: buscar por nome case-insensitive
        if (!fornecedorEncontrado && dados.fornecedor_nome) {
          const { data } = await supabase
            .from('fornecedores')
            .select('id')
            .ilike('nome', dados.fornecedor_nome)
            .eq('ativo', true)
            .limit(1)
            .maybeSingle();
          fornecedorEncontrado = data;
        }

        if (fornecedorEncontrado) {
          setFornecedorId(fornecedorEncontrado.id);
          await buscarSugestoesFornecedor(fornecedorEncontrado.id);
        } else if (dados.fornecedor_nome) {
          // Criar novo fornecedor
          const { data: novoFornecedor, error: fornecedorError } = await supabase
            .from('fornecedores')
            .insert({
              nome: dados.fornecedor_nome,
              cpf_cnpj: cnpjCpfLimpo,
              tipo_pessoa: cnpjCpfLimpo?.length === 14 ? 'juridica' : cnpjCpfLimpo?.length === 11 ? 'fisica' : 'juridica',
              ativo: true
            })
            .select('id')
            .single();

          if (fornecedorError) {
            console.error('Erro ao criar fornecedor:', fornecedorError);
          } else if (novoFornecedor) {
            setFornecedorId(novoFornecedor.id);
            queryClient.invalidateQueries({ queryKey: ['fornecedores-select'] });
          }
        }
      }
      
      console.log('Dados da nota fiscal processados com sucesso');
    } catch (error: any) {
      console.error('Erro ao processar dados da nota fiscal:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const valorNumerico = parseFloat(valor.replace(',', '.')) || 0;
      const { data: userData } = await supabase.auth.getUser();

      // Upload do anexo se não foi processado ainda
      let anexoPath = anexoUrl;
      if (anexoFile && !anexoUrl) {
        const fileExt = anexoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${tipo}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('transacoes-anexos')
          .upload(filePath, anexoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('transacoes-anexos')
          .getPublicUrl(filePath);

        anexoPath = urlData.publicUrl;
      }

      const transacaoData = {
        tipo,
        tipo_lancamento: tipoLancamento,
        descricao,
        valor: valorNumerico,
        data_vencimento: format(dataVencimento, 'yyyy-MM-dd'),
        data_competencia: format(dataCompetencia, 'yyyy-MM-dd'),
        data_pagamento: foiPago && dataPagamento ? format(dataPagamento, 'yyyy-MM-dd') : null,
        conta_id: contaId,
        categoria_id: categoriaId && categoriaId !== 'none' ? categoriaId : null,
        subcategoria_id: subcategoriaId && subcategoriaId !== 'none' ? subcategoriaId : null,
        centro_custo_id: centroCustoId && centroCustoId !== 'none' ? centroCustoId : null,
        base_ministerial_id: baseMinisterialId && baseMinisterialId !== 'none' ? baseMinisterialId : null,
        fornecedor_id: fornecedorId && fornecedorId !== 'none' ? fornecedorId : null,
        forma_pagamento: formaPagamento && formaPagamento !== 'none' ? formaPagamento : null,
        total_parcelas: tipoLancamento === 'parcelado' ? parseInt(totalParcelas) : null,
        numero_parcela: tipoLancamento === 'parcelado' ? 1 : null,
        recorrencia: tipoLancamento === 'recorrente' ? recorrencia : null,
        data_fim_recorrencia: tipoLancamento === 'recorrente' && dataFimRecorrencia 
          ? format(dataFimRecorrencia, 'yyyy-MM-dd') : null,
        observacoes: observacoes || null,
        anexo_url: anexoPath || null,
        lancado_por: userData.user?.id,
        status: foiPago ? 'pago' : 'pendente',
        juros: foiPago && juros ? parseFloat(juros.replace(',', '.')) : 0,
        multas: foiPago && multas ? parseFloat(multas.replace(',', '.')) : 0,
        desconto: foiPago && desconto ? parseFloat(desconto.replace(',', '.')) : 0,
        taxas_administrativas: foiPago && taxasAdministrativas ? parseFloat(taxasAdministrativas.replace(',', '.')) : 0,
      };

      let error;
      if (transacao) {
        const result = await supabase
          .from('transacoes_financeiras')
          .update(transacaoData)
          .eq('id', transacao.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('transacoes_financeiras')
          .insert(transacaoData);
        error = result.error;
      }

      if (error) throw error;

      toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} ${transacao ? 'atualizada' : 'cadastrada'}!`);
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || `Erro ao ${transacao ? 'atualizar' : 'cadastrar'} transação`);
    } finally {
      setLoading(false);
    }
  };

  const clearAnexo = () => {
    setAnexoFile(null);
    setAnexoUrl("");
    setAnexoPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload/Capture Section
  const UploadSection = () => (
    <div className="space-y-3">
      {!anexoPreview && !anexoUrl ? (
        <div className="border-2 border-dashed border-primary/30 rounded-xl p-4 md:p-6 bg-primary/5 hover:bg-primary/10 transition-colors">
          {aiProcessing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando com IA...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-5 h-5" />
                  {isMobile ? "Tirar Foto da Nota" : "Fotografar ou Enviar Nota"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  A IA irá extrair os dados automaticamente
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelected(file);
                }}
              />
            </>
          )}
        </div>
      ) : (
        <div className="relative">
          {/* Miniatura clicável */}
          <div 
            className={cn(
              "relative rounded-lg overflow-hidden border cursor-pointer group",
              isMobile ? "h-[120px]" : "h-[200px] md:h-full md:min-h-[300px]"
            )}
            onClick={() => setImagePreviewOpen(true)}
          >
            {anexoPreview || anexoUrl ? (
              <>
                <img
                  src={anexoPreview || anexoUrl}
                  alt="Nota fiscal"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-8 h-8 text-white" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">PDF anexado</p>
              </div>
            )}
          </div>

          {/* Botão de remover */}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              clearAnexo();
            }}
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Botão flutuante para ver (mobile) */}
          {isMobile && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute bottom-2 right-2 gap-1 shadow-lg"
              onClick={() => setImagePreviewOpen(true)}
            >
              <Eye className="w-4 h-4" />
              Ver Nota
            </Button>
          )}
        </div>
      )}
    </div>
  );

  // Formulário principal
  const FormContent = () => (
    <div className="space-y-4">
      {/* Tipo de lançamento */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Tipo de {tipo === 'entrada' ? 'entrada' : 'saída'} *
        </Label>
        <RadioGroup value={tipoLancamento} onValueChange={(value: any) => setTipoLancamento(value)}>
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
      {tipoLancamento === 'parcelado' && (
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
      {tipoLancamento === 'recorrente' && (
        <div className="border-t pt-3 space-y-3">
          <div>
            <Label>Frequência *</Label>
            <Select value={recorrencia} onValueChange={(value: any) => setRecorrencia(value)}>
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
                  className={cn("w-full justify-start text-left font-normal", !dataFimRecorrencia && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFimRecorrencia ? format(dataFimRecorrencia, "dd/MM/yyyy", { locale: ptBR }) : "Opcional"}
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
        {tipo === 'saida' && (
          <div>
            <Label>Fornecedor</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {fornecedores?.filter(f => f.id).map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>

          <div>
            <Label>Forma de pgto</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não especificado</SelectItem>
                {formasPagamento?.filter(f => f.id).map((f) => (
                  <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Conta *</Label>
          <Select value={contaId} onValueChange={setContaId} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a conta" />
            </SelectTrigger>
            <SelectContent>
              {contas?.filter(c => c.id).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vencimento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
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
                <Button variant="outline" className="w-full justify-start text-left font-normal">
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
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={(value) => {
              setCategoriaId(value);
              setSubcategoriaId("none");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {categorias?.filter(c => c.id).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Subcategoria</Label>
            <Select 
              value={subcategoriaId} 
              onValueChange={setSubcategoriaId}
              disabled={!categoriaId || categoriaId === 'none'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {subcategorias?.filter(s => s.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Base Ministerial</Label>
            <Select value={baseMinisterialId} onValueChange={setBaseMinisterialId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {bases?.filter(b => b.id).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.titulo}</SelectItem>
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
                {centros?.filter(c => c.id).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
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
              Já foi {tipo === 'entrada' ? 'recebido' : 'pago'}?
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
              <Label>Data do {tipo === 'entrada' ? 'recebimento' : 'pagamento'} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dataPagamento && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataPagamento ? format(dataPagamento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
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
                  onChange={(e) => setJuros(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Multas</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={multas}
                  onChange={(e) => setMultas(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Desconto</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Taxas</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={taxasAdministrativas}
                  onChange={(e) => setTaxasAdministrativas(e.target.value)}
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

  // Sheet para visualizar imagem em tela cheia
  const ImagePreviewSheet = () => (
    <Sheet open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
      <SheetContent side="bottom" className="h-[90vh] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>Nota Fiscal</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setImageZoom(Math.max(0.5, imageZoom - 0.25))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm w-12 text-center">{Math.round(imageZoom * 100)}%</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setImageZoom(Math.min(3, imageZoom + 0.25))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-center min-h-full">
            <img
              src={anexoPreview || anexoUrl}
              alt="Nota fiscal"
              className="max-w-full transition-transform duration-200"
              style={{ transform: `scale(${imageZoom})` }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Conteúdo do Dialog/Drawer
  const DialogContentInner = () => (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
      {/* Desktop: Split View */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-6 flex-1 min-h-0 overflow-hidden">
        {/* Coluna esquerda: Imagem */}
        <div className="space-y-4 overflow-y-auto pr-2">
          <h3 className="font-semibold text-sm">Documento</h3>
          <UploadSection />
          
          {!anexoPreview && !anexoUrl && (
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

        {/* Coluna direita: Formulário */}
        <ScrollArea className="h-full pl-2 border-l">
          <div className="pr-4">
            <FormContent />
          </div>
        </ScrollArea>
      </div>

      {/* Mobile: Coluna única */}
      <div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-4 pb-20">
        {/* Upload em destaque no topo */}
        {tipo === 'saida' && !transacao && (
          <UploadSection />
        )}
        
        <FormContent />
      </div>

      {/* Botões de ação - Sticky no mobile */}
      <div className={cn(
        "flex gap-2 pt-4 border-t bg-background shrink-0",
        isMobile && "fixed bottom-0 left-0 right-0 p-4 shadow-lg"
      )}>
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
          ) : (
            transacao ? 'Atualizar' : 'Salvar'
          )}
        </Button>
      </div>
    </form>
  );

  // Renderização condicional: Drawer no mobile, Dialog no desktop
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[95vh]">
            <DrawerHeader className="border-b pb-3">
              <DrawerTitle>
                {transacao ? 'Editar' : tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <DialogContentInner />
            </div>
          </DrawerContent>
        </Drawer>
        <ImagePreviewSheet />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {transacao ? 'Editar' : tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
            </DialogTitle>
          </DialogHeader>
          <DialogContentInner />
        </DialogContent>
      </Dialog>
      <ImagePreviewSheet />
    </>
  );
}
