import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileImage } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ProcessarNotaFiscalDialog from "./ProcessarNotaFiscalDialog";

interface TransacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "entrada" | "saida";
  transacao?: any;
}

export function TransacaoDialog({ open, onOpenChange, tipo, transacao }: TransacaoDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [processarNotaDialogOpen, setProcessarNotaDialogOpen] = useState(false);
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
  
  // Novos campos de confirmação de pagamento/recebimento
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
      // Resetar form ao fechar
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
    setFoiPago(false);
    setDataPagamento(undefined);
    setJuros("");
    setMultas("");
    setDesconto("");
    setTaxasAdministrativas("");
  };

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
      if (!categoriaId) return [];
      const { data, error } = await supabase
        .from('subcategorias_financeiras')
        .select('id, nome')
        .eq('categoria_id', categoriaId)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
    enabled: !!categoriaId,
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

  // Função para buscar sugestões baseadas em transações anteriores do fornecedor
  const buscarSugestoesFornecedor = async (fornecedorIdParam: string) => {
    if (!fornecedorIdParam || fornecedorIdParam === 'none') return;

    try {
      // Buscar últimas 20 transações do fornecedor
      const { data: transacoes, error } = await supabase
        .from('transacoes_financeiras')
        .select('categoria_id, subcategoria_id, centro_custo_id, base_ministerial_id, conta_id, forma_pagamento')
        .eq('fornecedor_id', fornecedorIdParam)
        .not('categoria_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!transacoes || transacoes.length === 0) return;

      // Contar frequência de cada campo
      const categoriaFreq: Record<string, number> = {};
      const subcategoriaFreq: Record<string, number> = {};
      const centroCustoFreq: Record<string, number> = {};
      const baseMinisterialFreq: Record<string, number> = {};
      const contaFreq: Record<string, number> = {};
      const formaPagamentoFreq: Record<string, number> = {};

      transacoes.forEach(t => {
        if (t.categoria_id) {
          categoriaFreq[t.categoria_id] = (categoriaFreq[t.categoria_id] || 0) + 1;
        }
        if (t.subcategoria_id) {
          subcategoriaFreq[t.subcategoria_id] = (subcategoriaFreq[t.subcategoria_id] || 0) + 1;
        }
        if (t.centro_custo_id) {
          centroCustoFreq[t.centro_custo_id] = (centroCustoFreq[t.centro_custo_id] || 0) + 1;
        }
        if (t.base_ministerial_id) {
          baseMinisterialFreq[t.base_ministerial_id] = (baseMinisterialFreq[t.base_ministerial_id] || 0) + 1;
        }
        if (t.conta_id) {
          contaFreq[t.conta_id] = (contaFreq[t.conta_id] || 0) + 1;
        }
        if (t.forma_pagamento) {
          formaPagamentoFreq[t.forma_pagamento] = (formaPagamentoFreq[t.forma_pagamento] || 0) + 1;
        }
      });

      // Encontrar os mais frequentes
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

      // Aplicar sugestões apenas se os campos estiverem vazios
      if (categoriaSugerida && (categoriaId === 'none' || categoriaId === '')) {
        setCategoriaId(categoriaSugerida);
      }
      if (subcategoriaSugerida && (subcategoriaId === 'none' || subcategoriaId === '')) {
        setSubcategoriaId(subcategoriaSugerida);
      }
      if (centroCustoSugerido && (centroCustoId === 'none' || centroCustoId === '')) {
        setCentroCustoId(centroCustoSugerido);
      }
      if (baseMinisterialSugerida && (baseMinisterialId === 'none' || baseMinisterialId === '')) {
        setBaseMinisterialId(baseMinisterialSugerida);
      }
      if (contaSugerida && (contaId === '' || !contaId)) {
        setContaId(contaSugerida);
      }
      if (formaPagamentoSugerida && (formaPagamento === '' || !formaPagamento)) {
        setFormaPagamento(formaPagamentoSugerida);
      }

      // Notificar usuário sobre sugestões aplicadas
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
      // Não mostrar erro ao usuário, apenas log
    }
  };

  // Monitorar mudanças no fornecedor para aplicar sugestões
  useEffect(() => {
    if (fornecedorId && fornecedorId !== 'none' && open) {
      buscarSugestoesFornecedor(fornecedorId);
    }
  }, [fornecedorId, open]);

  // Função para processar dados da nota fiscal
  const handleDadosNotaFiscal = async (dados: any) => {
    try {
      toast.loading('Processando dados da nota fiscal...', { id: 'process-nf' });

      // Preencher campos básicos
      setDescricao(dados.descricao || "");
      setValor(String(dados.valor_total || ""));
      
      if (dados.data_emissao) {
        setDataVencimento(new Date(dados.data_emissao));
        setDataCompetencia(new Date(dados.data_emissao));
      }
      
      if (dados.data_vencimento) {
        setDataVencimento(new Date(dados.data_vencimento));
      }

      // Adicionar número da nota às observações
      if (dados.numero_nota) {
        setObservacoes(`Nota Fiscal: ${dados.numero_nota}\n${dados.tipo_documento ? `Tipo: ${dados.tipo_documento}\n` : ''}${observacoes}`);
      }

      // Definir URL do anexo se disponível
      if (dados.anexo_url) {
        setAnexoUrl(dados.anexo_url);
      }

      // Buscar ou criar fornecedor
      if (dados.fornecedor_nome) {
        // Limpar CNPJ/CPF (remover formatação)
        const cnpjCpfLimpo = dados.fornecedor_cnpj_cpf?.replace(/\D/g, '') || null;

        // Buscar fornecedor existente por nome ou CNPJ/CPF
        let fornecedorQuery = supabase
          .from('fornecedores')
          .select('id')
          .eq('nome', dados.fornecedor_nome)
          .eq('ativo', true)
          .limit(1);

        if (cnpjCpfLimpo) {
          fornecedorQuery = fornecedorQuery.or(`cpf_cnpj.eq.${cnpjCpfLimpo}`);
        }

        const { data: fornecedorExistente } = await fornecedorQuery.single();

        if (fornecedorExistente) {
          setFornecedorId(fornecedorExistente.id);
          toast.success('Fornecedor encontrado!', { id: 'process-nf' });
          
          // Buscar sugestões baseadas em transações anteriores
          await buscarSugestoesFornecedor(fornecedorExistente.id);
        } else {
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

          if (fornecedorError) throw fornecedorError;

          setFornecedorId(novoFornecedor.id);
          queryClient.invalidateQueries({ queryKey: ['fornecedores-select'] });
          toast.success('Novo fornecedor criado!', { id: 'process-nf' });
          
          // Como é novo fornecedor, não há histórico para sugestões
        }
      } else {
        toast.success('Dados da nota fiscal carregados!', { id: 'process-nf' });
      }

    } catch (error: any) {
      console.error('Erro ao processar dados da nota fiscal:', error);
      toast.error('Erro ao processar dados', {
        description: error.message,
        id: 'process-nf'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const valorNumerico = parseFloat(valor.replace(',', '.')) || 0;
      const { data: userData } = await supabase.auth.getUser();

      // Fazer upload do anexo se houver
      let anexoPath = anexoUrl;
      if (anexoFile) {
        const fileExt = anexoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${tipo}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('transacoes-anexos')
          .upload(filePath, anexoFile);

        if (uploadError) throw uploadError;

        // Obter URL pública
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
          ? format(dataFimRecorrencia, 'yyyy-MM-dd') 
          : null,
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
        // Atualizar transação existente
        const result = await supabase
          .from('transacoes_financeiras')
          .update(transacaoData)
          .eq('id', transacao.id);
        error = result.error;
      } else {
        // Criar nova transação
        const result = await supabase
          .from('transacoes_financeiras')
          .insert(transacaoData);
        error = result.error;
      }

      if (error) throw error;

      toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} ${transacao ? 'atualizada' : 'cadastrada'} com sucesso!`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {transacao ? 'Editar' : tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
            </DialogTitle>
            {!transacao && tipo === 'saida' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProcessarNotaDialogOpen(true)}
                className="gap-2"
              >
                <FileImage className="w-4 h-4" />
                <span className="hidden sm:inline">Processar com IA</span>
                <span className="sm:hidden">IA</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tipo de {tipo === 'entrada' ? 'entrada' : 'saída'} *</Label>
              <RadioGroup value={tipoLancamento} onValueChange={(value: any) => setTipoLancamento(value)}>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="unico" id="unico" />
                    <Label htmlFor="unico" className="cursor-pointer">
                      Único - Um {tipo === 'entrada' ? 'recebimento' : 'pagamento'} feito uma única vez
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recorrente" id="recorrente" />
                    <Label htmlFor="recorrente" className="cursor-pointer">
                      Recorrente - Se repete periodicamente
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="parcelado" id="parcelado" />
                    <Label htmlFor="parcelado" className="cursor-pointer">
                      Parcelado - Dividido em parcelas ao longo do tempo
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Informações Básicas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Input
                    id="descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder={`Descrição da ${tipo === 'entrada' ? 'entrada' : 'saída'}`}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="valor">Valor *</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="R$ 0,00"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="forma-pagamento">Forma de {tipo === 'entrada' ? 'recebimento' : 'pagamento'}</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não especificado</SelectItem>
                      {formasPagamento?.filter(forma => forma.id && forma.id !== '').map((forma) => (
                        <SelectItem key={forma.id} value={forma.nome}>
                          {forma.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="conta">Conta *</Label>
                  <Select value={contaId} onValueChange={setContaId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas?.filter(conta => conta.id && conta.id !== '').map((conta) => (
                        <SelectItem key={conta.id} value={conta.id}>
                          {conta.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data de vencimento *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataVencimento && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataVencimento ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
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
                  <Label>Data de competência *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataCompetencia && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataCompetencia ? format(dataCompetencia, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
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

            {tipoLancamento === 'parcelado' && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Parcelamento</h3>
                <div>
                  <Label htmlFor="parcelas">Número de parcelas *</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="2"
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {tipoLancamento === 'recorrente' && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Recorrência</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recorrencia">Frequência *</Label>
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
                    <Label>Data fim da recorrência</Label>
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
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Classificação Contábil</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select value={categoriaId} onValueChange={(value) => {
                    setCategoriaId(value);
                    setSubcategoriaId("none"); // Reset subcategoria
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {categorias?.filter(cat => cat.id && cat.id !== '').map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Select 
                    value={subcategoriaId} 
                    onValueChange={setSubcategoriaId}
                    disabled={!categoriaId || categoriaId === 'none'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma subcategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {subcategorias?.filter(sub => sub.id && sub.id !== '').map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="base">Base Ministerial</Label>
                  <Select value={baseMinisterialId} onValueChange={setBaseMinisterialId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma base" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {bases?.filter(base => base.id && base.id !== '').map((base) => (
                        <SelectItem key={base.id} value={base.id}>
                          {base.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="centro">Centro de Custo</Label>
                  <Select value={centroCustoId} onValueChange={setCentroCustoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um centro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {centros?.filter(centro => centro.id && centro.id !== '').map((centro) => (
                        <SelectItem key={centro.id} value={centro.id}>
                          {centro.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {tipo === 'saida' && (
                  <div className="md:col-span-2">
                    <Label htmlFor="fornecedor">Fornecedor</Label>
                    <Select value={fornecedorId} onValueChange={setFornecedorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {fornecedores?.filter(forn => forn.id && forn.id !== '').map((forn) => (
                          <SelectItem key={forn.id} value={forn.id}>
                            {forn.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Seção de Confirmação de Pagamento/Recebimento */}
            <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="foi-pago" className="text-base font-semibold">
                    Esse lançamento já foi {tipo === 'entrada' ? 'recebido' : 'pago'}?
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ative para confirmar o {tipo === 'entrada' ? 'recebimento' : 'pagamento'} e registrar detalhes
                  </p>
                </div>
                <Switch
                  id="foi-pago"
                  checked={foiPago}
                  onCheckedChange={setFoiPago}
                />
              </div>

              {foiPago && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label>Data do {tipo === 'entrada' ? 'recebimento' : 'pagamento'} *</Label>
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
                          {dataPagamento ? format(dataPagamento, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
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

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor="juros">Juros</Label>
                      <Input
                        id="juros"
                        type="text"
                        value={juros}
                        onChange={(e) => setJuros(e.target.value)}
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="multas">Multas</Label>
                      <Input
                        id="multas"
                        type="text"
                        value={multas}
                        onChange={(e) => setMultas(e.target.value)}
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="desconto">Desconto</Label>
                      <Input
                        id="desconto"
                        type="text"
                        value={desconto}
                        onChange={(e) => setDesconto(e.target.value)}
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="taxas">Taxas administrativas</Label>
                      <Input
                        id="taxas"
                        type="text"
                        value={taxasAdministrativas}
                        onChange={(e) => setTaxasAdministrativas(e.target.value)}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="anexo">Anexo (Nota Fiscal / Comprovante)</Label>
              <div className="space-y-2">
                <Input
                  id="anexo"
                  type="file"
                  accept="image/*,application/pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAnexoFile(file);
                  }}
                  className="cursor-pointer"
                />
                {anexoUrl && !anexoFile && (
                  <div className="text-xs text-muted-foreground">
                    <a 
                      href={anexoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Ver anexo atual
                    </a>
                  </div>
                )}
                {anexoFile && (
                  <p className="text-xs text-muted-foreground">
                    Novo arquivo selecionado: {anexoFile.name}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-gradient-primary">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <ProcessarNotaFiscalDialog
        open={processarNotaDialogOpen}
        onOpenChange={setProcessarNotaDialogOpen}
        onDadosExtraidos={handleDadosNotaFiscal}
      />
    </Dialog>
  );
}
