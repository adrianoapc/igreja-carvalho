import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarIcon, Save, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ConferirOfertaDialog } from "@/components/financas/ConferirOfertaDialog";

export default function RelatorioOferta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataCulto, setDataCulto] = useState<Date>(new Date());
  const [conferenteId, setConferenteId] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [taxaCartaoCredito, setTaxaCartaoCredito] = useState("3.5");
  const [taxaCartaoDebito, setTaxaCartaoDebito] = useState("2.0");
  const [showConferirDialog, setShowConferirDialog] = useState(false);

  // Buscar formas de pagamento
  const { data: formasPagamento } = useQuery({
    queryKey: ['formas-pagamento-oferta'],
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

  // Buscar membros/pessoas para conferente (excluindo quem está lançando)
  const { data: pessoas } = useQuery({
    queryKey: ['pessoas-conferente', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .in('status', ['membro', 'frequentador'])
        .neq('id', profile?.id || '') // Excluir quem está lançando
        .order('nome');
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Buscar contas
  const { data: contas } = useQuery({
    queryKey: ['contas-relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas')
        .select('id, nome')
        .eq('ativo', true);
      
      if (error) throw error;
      return data;
    },
  });

  const handleValorChange = (formaId: string, valor: string) => {
    setValores(prev => ({
      ...prev,
      [formaId]: valor
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calcularTotal = () => {
    return Object.values(valores).reduce((sum, val) => {
      const num = parseFloat(val.replace(',', '.')) || 0;
      return sum + num;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!conferenteId) {
      toast.error('Selecione o conferente');
      return;
    }

    // Verificar se há ao menos um valor preenchido
    const temValores = Object.values(valores).some(v => parseFloat(v.replace(',', '.')) > 0);
    if (!temValores) {
      toast.error('Preencha ao menos um valor');
      return;
    }

    // Abrir dialog de conferência
    setShowConferirDialog(true);
  };

  const handleConfirmarOferta = async () => {
    setLoading(true);

    try {
      // Buscar contas por nome
      const contaOfertas = contas?.find(c => c.nome.toLowerCase().includes('oferta'));
      const contaSantander = contas?.find(c => c.nome.toLowerCase().includes('santander'));

      if (!contaOfertas || !contaSantander) {
        toast.error('Contas "Ofertas" ou "Santander" não encontradas. Configure as contas primeiro.');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const dataFormatada = format(dataCulto, 'yyyy-MM-dd');

      // Buscar categoria padrão de Ofertas (tipo entrada)
      const { data: categoriaOferta } = await supabase
        .from('categorias_financeiras')
        .select('id')
        .eq('tipo', 'entrada')
        .ilike('nome', '%oferta%')
        .limit(1)
        .single();

      // Criar transações para cada forma de pagamento com valor
      const transacoes = [];
      for (const [formaId, valorStr] of Object.entries(valores)) {
        const valorNumerico = parseFloat(valorStr.replace(',', '.'));
        if (valorNumerico <= 0) continue;

        const forma = formasPagamento?.find(f => f.id === formaId);
        if (!forma) continue;

        const nomeLower = forma.nome.toLowerCase();
        const isDinheiro = nomeLower.includes('dinheiro');
        const isPix = nomeLower.includes('pix');
        const isCartaoCredito = nomeLower.includes('crédito') || nomeLower.includes('credito');
        const isCartaoDebito = nomeLower.includes('débito') || nomeLower.includes('debito');

        // Determinar conta
        let contaId = contaSantander.id;
        if (isDinheiro) {
          contaId = contaOfertas.id;
        }

        // Determinar status e data de pagamento
        let status = 'pendente';
        let dataPagamento = null;
        let taxasAdministrativas = null;

        if (isDinheiro || isPix) {
          status = 'pago';
          dataPagamento = dataFormatada;
        }

        // Calcular taxa administrativa para cartões
        if (isCartaoCredito) {
          const taxa = parseFloat(taxaCartaoCredito) / 100;
          taxasAdministrativas = valorNumerico * taxa;
        } else if (isCartaoDebito) {
          const taxa = parseFloat(taxaCartaoDebito) / 100;
          taxasAdministrativas = valorNumerico * taxa;
        }

        const transacao = {
          tipo: 'entrada',
          tipo_lancamento: 'unico',
          descricao: `Oferta - Culto ${format(dataCulto, 'dd/MM/yyyy')}`,
          valor: valorNumerico,
          data_vencimento: dataFormatada,
          data_competencia: dataFormatada,
          data_pagamento: dataPagamento,
          conta_id: contaId,
          categoria_id: categoriaOferta?.id || null,
          forma_pagamento: formaId,
          status: status,
          taxas_administrativas: taxasAdministrativas,
          observacoes: `Conferente: ${pessoas?.find(p => p.id === conferenteId)?.nome}\nForma: ${forma.nome}`,
          lancado_por: userData.user?.id
        };

        transacoes.push(transacao);
      }

      // Inserir todas as transações
      const { error } = await supabase
        .from('transacoes_financeiras')
        .insert(transacoes);

      if (error) throw error;

      toast.success(`${transacoes.length} lançamento(s) criado(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['contas-resumo'] });
      
      // Resetar form
      setValores({});
      setDataCulto(new Date());
      setConferenteId("");
      setShowConferirDialog(false);

    } catch (error: any) {
      console.error('Erro ao criar lançamentos:', error);
      toast.error('Erro ao criar lançamentos', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitarOferta = () => {
    setShowConferirDialog(false);
    toast.info('Conferência cancelada. Revise os valores e tente novamente.');
  };

  // Preparar dados para o dialog de conferência
  const dadosConferencia = {
    dataCulto,
    valores: Object.entries(valores).reduce((acc, [id, valorStr]) => {
      const valorNumerico = parseFloat(valorStr.replace(',', '.'));
      if (valorNumerico > 0) {
        const forma = formasPagamento?.find(f => f.id === id);
        if (forma) {
          acc[id] = {
            nome: forma.nome,
            valor: valorNumerico
          };
        }
      }
      return acc;
    }, {} as Record<string, { nome: string; valor: number }>),
    total: calcularTotal(),
    lancadoPor: profile?.nome || 'Usuário não identificado',
    conferente: pessoas?.find(p => p.id === conferenteId)?.nome || 'Não selecionado'
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/financas')}
            className="w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/financas/dashboard-ofertas')}
          >
            Ver Dashboard
          </Button>
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Relatório de Oferta</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Registro rápido de entradas por forma de pagamento
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg">Dados do Culto</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-culto">Data do Culto *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataCulto && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataCulto ? format(dataCulto, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataCulto}
                      onSelect={(date) => date && setDataCulto(date)}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lancado-por">Lançado por</Label>
                <Input
                  id="lancado-por"
                  type="text"
                  value={profile?.nome || 'Carregando...'}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conferente">Conferente (quem validará) *</Label>
              <Select value={conferenteId} onValueChange={setConferenteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione outra pessoa para conferir" />
                </SelectTrigger>
                <SelectContent>
                  {pessoas?.map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O conferente irá validar os valores antes de salvar
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg">Valores por Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formasPagamento?.map((forma) => {
                const isCartaoCredito = forma.nome.toLowerCase().includes('crédito') || forma.nome.toLowerCase().includes('credito');
                const isCartaoDebito = forma.nome.toLowerCase().includes('débito') || forma.nome.toLowerCase().includes('debito');
                
                return (
                  <div key={forma.id} className="space-y-2">
                    <Label htmlFor={`valor-${forma.id}`} className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {forma.nome}
                      {(isCartaoCredito || isCartaoDebito) && (
                        <span className="text-xs text-muted-foreground">
                          (Taxa: {isCartaoCredito ? taxaCartaoCredito : taxaCartaoDebito}%)
                        </span>
                      )}
                    </Label>
                    <Input
                      id={`valor-${forma.id}`}
                      type="text"
                      placeholder="0,00"
                      value={valores[forma.id] || ''}
                      onChange={(e) => handleValorChange(forma.id, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg">Configuração de Taxas</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxa-credito">Taxa Cartão de Crédito (%)</Label>
                <Input
                  id="taxa-credito"
                  type="text"
                  placeholder="3.5"
                  value={taxaCartaoCredito}
                  onChange={(e) => setTaxaCartaoCredito(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxa-debito">Taxa Cartão de Débito (%)</Label>
                <Input
                  id="taxa-debito"
                  type="text"
                  placeholder="2.0"
                  value={taxaCartaoDebito}
                  onChange={(e) => setTaxaCartaoDebito(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft bg-primary/5">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total do Relatório</p>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(calcularTotal())}</p>
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="bg-gradient-primary shadow-soft"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Relatório'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <ConferirOfertaDialog
        open={showConferirDialog}
        onOpenChange={setShowConferirDialog}
        dados={dadosConferencia}
        onConfirmar={handleConfirmarOferta}
        onRejeitar={handleRejeitarOferta}
        loading={loading}
      />
    </div>
  );
}
