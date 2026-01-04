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
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

export default function RelatorioOferta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const [loading, setLoading] = useState(false);
  const [dataCulto, setDataCulto] = useState<Date>(new Date());
  const [conferenteId, setConferenteId] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [taxaCartaoCredito, setTaxaCartaoCredito] = useState("3.5");
  const [taxaCartaoDebito, setTaxaCartaoDebito] = useState("2.0");
  const [showConferirDialog, setShowConferirDialog] = useState(false);

  // Buscar formas de pagamento
  const { data: formasPagamento } = useQuery({
    queryKey: ['formas-pagamento-oferta', igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from('formas_pagamento')
        .select('id, nome')
        .eq('ativo', true)
        .eq('igreja_id', igrejaId)
        .order('nome');
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Buscar membros com permissão financeira para conferente
  const { data: pessoas } = useQuery({
    queryKey: ['pessoas-conferente', igrejaId, filialId, isAllFiliais, profile?.id],
    queryFn: async () => {
      if (!igrejaId) return [];
      // Buscar usuários com role de admin ou tesoureiro
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'tesoureiro'])
        .eq('igreja_id', igrejaId);
      
      if (rolesError) throw rolesError;
      
      const userIds = userRoles?.map(r => r.user_id) || [];
      
      // Buscar profiles desses usuários, excluindo quem está lançando
      let query = supabase
        .from('profiles')
        .select('id, nome, user_id')
        .in('user_id', userIds)
        .neq('id', profile?.id || '') // Excluir quem está lançando
        .eq('igreja_id', igrejaId)
        .order('nome');
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Buscar contas
  const { data: contas } = useQuery({
    queryKey: ['contas-relatorio', igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from('contas')
        .select('id, nome')
        .eq('ativo', true)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
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
    setLoading(true);

    if (!igrejaId) {
      toast.error("Igreja não identificada.");
      setLoading(false);
      return;
    }
    
    if (!conferenteId) {
      toast.error('Selecione o conferente');
      setLoading(false);
      return;
    }

    // Verificar se há ao menos um valor preenchido
    const temValores = Object.values(valores).some(v => parseFloat(v.replace(',', '.')) > 0);
    if (!temValores) {
      toast.error('Preencha ao menos um valor');
      setLoading(false);
      return;
    }

    try {
      const valoresFormatados = Object.entries(valores)
        .filter(([_, v]) => parseFloat(v.replace(',', '.')) > 0)
        .map(([id, v]) => {
          const forma = formasPagamento?.find(f => f.id === id);
          return `${forma?.nome}: R$ ${v}`;
        })
        .join(', ');

      // Criar notificação para o conferente com dados completos no metadata
      const conferente = pessoas?.find(p => p.id === conferenteId);
      if (conferente) {
        await supabase.from('notifications').insert({
          user_id: conferente.user_id,
          title: 'Novo Relatório de Oferta Aguardando Conferência',
          message: `${profile?.nome} criou um relatório de oferta do culto de ${format(dataCulto, 'dd/MM/yyyy')} aguardando sua validação. Total: ${formatCurrency(calcularTotal())}`,
          type: 'conferencia_oferta',
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
          metadata: {
            data_evento: format(dataCulto, 'yyyy-MM-dd'),
            lancado_por: profile?.nome,
            lancado_por_id: profile?.id,
            conferente_id: conferenteId,
            valores: valores,
            valores_formatados: valoresFormatados,
            total: calcularTotal(),
            taxa_cartao_credito: taxaCartaoCredito,
            taxa_cartao_debito: taxaCartaoDebito
          }
        });
      }

      toast.success('Relatório enviado para conferência!');
      
      // Resetar form
      setValores({});
      setDataCulto(new Date());
      setConferenteId("");
      
    } catch (error: unknown) {
      console.error('Erro ao enviar relatório:', error);
      toast.error('Erro ao enviar relatório', {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

    type OfertaMetadata = {
      data_evento: string;
      lancado_por?: string;
      lancado_por_id?: string;
      valores: Record<string, string>;
      valores_formatados?: string;
      total: number;
      taxa_cartao_credito?: string;
      taxa_cartao_debito?: string;
    };

    const handleConfirmarOferta = async (notificationId: string, metadata: OfertaMetadata) => {
    setLoading(true);

    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      // Buscar contas por nome
      const contaOfertas = contas?.find(c => c.nome.toLowerCase().includes('oferta'));
      const contaSantander = contas?.find(c => c.nome.toLowerCase().includes('santander'));

      if (!contaOfertas || !contaSantander) {
        toast.error('Contas "Ofertas" ou "Santander" não encontradas. Configure as contas primeiro.');
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const dataFormatada = metadata.data_evento;
      const valoresMetadata = metadata.valores;
      const taxaCredito = metadata.taxa_cartao_credito;
      const taxaDebito = metadata.taxa_cartao_debito;

      // Buscar categoria padrão de Ofertas (tipo entrada)
      let categoriaQuery = supabase
        .from('categorias_financeiras')
        .select('id')
        .eq('tipo', 'entrada')
        .ilike('nome', '%oferta%')
        .eq('igreja_id', igrejaId)
        .limit(1)
        .single();
      if (!isAllFiliais && filialId) {
        categoriaQuery = categoriaQuery.eq('filial_id', filialId);
      }
      const { data: categoriaOferta } = await categoriaQuery;

      // Criar transações para cada forma de pagamento com valor
      const transacoes = [];
      for (const [formaId, valorStr] of Object.entries(valoresMetadata)) {
        const valorNumerico = parseFloat(String(valorStr).replace(',', '.'));
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
          const taxa = parseFloat(taxaCredito) / 100;
          taxasAdministrativas = valorNumerico * taxa;
        } else if (isCartaoDebito) {
          const taxa = parseFloat(taxaDebito) / 100;
          taxasAdministrativas = valorNumerico * taxa;
        }

        const transacao = {
          tipo: 'entrada',
          tipo_lancamento: 'unico',
          descricao: `Oferta - Culto ${format(new Date(metadata.data_evento), 'dd/MM/yyyy')}`,
          valor: valorNumerico,
          data_vencimento: dataFormatada,
          data_competencia: dataFormatada,
          data_pagamento: dataPagamento,
          conta_id: contaId,
          categoria_id: categoriaOferta?.id || null,
          forma_pagamento: formaId,
          status: status,
          taxas_administrativas: taxasAdministrativas,
          observacoes: `Lançado por: ${metadata.lancado_por}\nConferido por: ${profile?.nome}\nForma: ${forma.nome}`,
          lancado_por: userData.user?.id,
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
        };

        transacoes.push(transacao);
      }

      // Inserir todas as transações
      const { error } = await supabase
        .from('transacoes_financeiras')
        .insert(transacoes);

      if (error) throw error;

      // Marcar notificação como lida
      let notificationQuery = supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        notificationQuery = notificationQuery.eq('filial_id', filialId);
      }
      await notificationQuery;

      toast.success(`${transacoes.length} lançamento(s) criado(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['contas-resumo'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

    } catch (error: unknown) {
      console.error('Erro ao criar lançamentos:', error);
      toast.error('Erro ao criar lançamentos', {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitarOferta = async (notificationId: string, metadata: OfertaMetadata) => {
    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      // Buscar perfil do lançador usando lancado_por_id do metadata
      let lancadorQuery = supabase
        .from('profiles')
        .select('user_id, nome')
        .eq('id', metadata.lancado_por_id)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        lancadorQuery = lancadorQuery.eq('filial_id', filialId);
      }
      const { data: lancadorProfile } = await lancadorQuery.single();

      if (!lancadorProfile?.user_id) {
        toast.error('Erro ao encontrar usuário lançador');
        return;
      }

      // Criar notificação para o lançador informando rejeição
      await supabase.from('notifications').insert({
        user_id: lancadorProfile.user_id,
        title: 'Relatório de Oferta Rejeitado',
        message: `O conferente ${profile?.nome} rejeitou o relatório de oferta do culto de ${format(new Date(metadata.data_evento), 'dd/MM/yyyy')}. Total: ${formatCurrency(metadata.total)}`,
        type: 'rejeicao_oferta',
        igreja_id: igrejaId,
        filial_id: !isAllFiliais ? filialId : null,
        metadata: {
          data_evento: format(new Date(metadata.data_evento), 'dd/MM/yyyy'),
          conferente: profile?.nome,
          lancado_por: metadata.lancado_por,
          valores: metadata.valores_formatados,
          total: metadata.total,
          data_rejeicao: new Date().toISOString()
        }
      });

      // Marcar notificação original como lida
      let notificationQuery = supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('igreja_id', igrejaId);
      if (!isAllFiliais && filialId) {
        notificationQuery = notificationQuery.eq('filial_id', filialId);
      }
      await notificationQuery;

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.info('Conferência rejeitada.');
    } catch (error: unknown) {
      console.error('Erro ao rejeitar oferta:', error);
      toast.error('Erro ao rejeitar oferta');
    }
  };

  // Buscar notificações pendentes de conferência para o usuário atual
  const { data: notificacoesPendentes } = useQuery({
    queryKey: ['notifications-conferencia', igrejaId, filialId, isAllFiliais, profile?.user_id],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile?.user_id)
        .eq('type', 'conferencia_oferta')
        .eq('read', false)
        .eq('igreja_id', igrejaId)
        .order('created_at', { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq('filial_id', filialId);
      }
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id && !igrejaLoading && !filialLoading && !!igrejaId,
  });

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

      {/* Notificações Pendentes de Conferência */}
      {notificacoesPendentes && notificacoesPendentes.length > 0 && (
        <Card className="shadow-soft border-primary/20">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg">Relatórios Aguardando Conferência</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-3">
            {notificacoesPendentes.map((notif) => {
              const metadata = notif.metadata as OfertaMetadata;
              const valoresObj = metadata.valores || {};
              const total = metadata.total || 0;
              
              const dadosConferencia = {
                dataCulto: new Date(metadata.data_evento),
                valores: Object.entries(valoresObj).reduce((acc, [id, valorStr]: [string, string]) => {
                  const valorNumerico = parseFloat(String(valorStr).replace(',', '.'));
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
                total: total,
                lancadoPor: metadata.lancado_por || 'Não identificado',
                conferente: profile?.nome || 'Você'
              };

              return (
                <div key={notif.id} className="p-3 md:p-4 border rounded-lg space-y-3 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm md:text-base truncate">{notif.title}</p>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Total:</span>
                        <span className="text-sm md:text-base font-bold text-primary">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejeitarOferta(notif.id, metadata)}
                    >
                      Rejeitar
                    </Button>
                    <ConferirOfertaDialog
                      dados={dadosConferencia}
                      onConfirmar={() => handleConfirmarOferta(notif.id, metadata)}
                      onRejeitar={() => handleRejeitarOferta(notif.id, metadata)}
                      loading={loading}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
