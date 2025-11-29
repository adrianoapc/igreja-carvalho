import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TransacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "entrada" | "saida";
  transacao?: any;
}

export function TransacaoDialog({ open, onOpenChange, tipo, transacao }: TransacaoDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [tipoLancamento, setTipoLancamento] = useState<"unico" | "recorrente" | "parcelado">("unico");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataVencimento, setDataVencimento] = useState<Date>(new Date());
  const [dataCompetencia, setDataCompetencia] = useState<Date>(new Date());
  const [contaId, setContaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [subcategoriaId, setSubcategoriaId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [baseMinisterialId, setBaseMinisterialId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("1");
  const [recorrencia, setRecorrencia] = useState<"diaria" | "semanal" | "quinzenal" | "mensal" | "bimestral">("mensal");
  const [dataFimRecorrencia, setDataFimRecorrencia] = useState<Date | undefined>();
  const [observacoes, setObservacoes] = useState("");
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string>("");

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (transacao && open) {
      setDescricao(transacao.descricao || "");
      setValor(String(transacao.valor || ""));
      setDataVencimento(transacao.data_vencimento ? new Date(transacao.data_vencimento) : new Date());
      setDataCompetencia(transacao.data_competencia ? new Date(transacao.data_competencia) : new Date());
      setContaId(transacao.conta_id || "");
      setCategoriaId(transacao.categoria_id || "");
      setSubcategoriaId(transacao.subcategoria_id || "");
      setCentroCustoId(transacao.centro_custo_id || "");
      setBaseMinisterialId(transacao.base_ministerial_id || "");
      setFornecedorId(transacao.fornecedor_id || "");
      setFormaPagamento(transacao.forma_pagamento || "");
      setObservacoes(transacao.observacoes || "");
      setTipoLancamento(transacao.tipo_lancamento || "unico");
      setAnexoUrl(transacao.anexo_url || "");
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
    setCategoriaId("");
    setSubcategoriaId("");
    setCentroCustoId("");
    setBaseMinisterialId("");
    setFornecedorId("");
    setFormaPagamento("");
    setTotalParcelas("1");
    setRecorrencia("mensal");
    setDataFimRecorrencia(undefined);
    setObservacoes("");
    setTipoLancamento("unico");
    setAnexoFile(null);
    setAnexoUrl("");
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
        conta_id: contaId,
        categoria_id: categoriaId || null,
        subcategoria_id: subcategoriaId || null,
        centro_custo_id: centroCustoId || null,
        base_ministerial_id: baseMinisterialId || null,
        fornecedor_id: fornecedorId || null,
        forma_pagamento: formaPagamento || null,
        total_parcelas: tipoLancamento === 'parcelado' ? parseInt(totalParcelas) : null,
        numero_parcela: tipoLancamento === 'parcelado' ? 1 : null,
        recorrencia: tipoLancamento === 'recorrente' ? recorrencia : null,
        data_fim_recorrencia: tipoLancamento === 'recorrente' && dataFimRecorrencia 
          ? format(dataFimRecorrencia, 'yyyy-MM-dd') 
          : null,
        observacoes: observacoes || null,
        anexo_url: anexoPath || null,
        lancado_por: userData.user?.id,
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
          .insert({ ...transacaoData, status: 'pendente' });
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
          <DialogTitle>
            {transacao ? 'Editar' : tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
          </DialogTitle>
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
                  <Input
                    id="forma-pagamento"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    placeholder="Ex: Dinheiro, PIX, Cartão"
                  />
                </div>

                <div>
                  <Label htmlFor="conta">Conta *</Label>
                  <Select value={contaId} onValueChange={setContaId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {contas?.map((conta) => (
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
                    setSubcategoriaId(""); // Reset subcategoria
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {categorias?.map((cat) => (
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
                    disabled={!categoriaId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma subcategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {subcategorias?.map((sub) => (
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
                      <SelectItem value="">Nenhuma</SelectItem>
                      {bases?.map((base) => (
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
                      <SelectItem value="">Nenhum</SelectItem>
                      {centros?.map((centro) => (
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
                        <SelectItem value="">Nenhum</SelectItem>
                        {fornecedores?.map((forn) => (
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
    </Dialog>
  );
}
