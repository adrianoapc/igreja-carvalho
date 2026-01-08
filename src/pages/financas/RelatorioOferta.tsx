import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ArrowLeft, CalendarIcon, Save, DollarSign, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { ConferirOfertaDialog } from "@/components/financas/ConferirOfertaDialog";

type LinhaLancamento = {
  id: string;
  formaId: string;
  contaId?: string;
  valor: string;
};

export default function RelatorioOferta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: authLoading,
  } = useAuthContext();

  const [loading, setLoading] = useState(false);
  const [dataCulto, setDataCulto] = useState<Date>(new Date());
  const [conferenteId, setConferenteId] = useState("");
  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [showPreview, setShowPreview] = useState(false);

  // Buscar formas de pagamento com info de taxa e status
  const { data: formasPagamento } = useQuery({
    queryKey: ["formas-pagamento-oferta", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("formas_pagamento")
        .select("id, nome, taxa_administrativa, taxa_administrativa_fixa, gera_pago")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !authLoading && !!igrejaId,
  });

  // Buscar mapeamento dinâmico: forma → conta
  const { data: formaContaMapa } = useQuery({
    queryKey: ["forma-conta-mapa", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      
      let query = supabase
        .from("forma_pagamento_contas")
        .select(`
          forma_pagamento_id,
          conta_id,
          prioridade,
          contas(id, nome)
        `)
        .eq("igreja_id", igrejaId)
        .order("prioridade", { ascending: true });
      
      // Se não é all filiais, preferir mapeamento específico da filial
      if (!isAllFiliais && filialId) {
        query = query.or(
          `filial_id.eq.${filialId},filial_id.is.null`
        );
      } else {
        query = query.is("filial_id", null);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !authLoading && !!igrejaId,
  });

  // Índice rápido de mapeamentos por forma, já respeitando prioridade
  const mapeamentosPorForma = useMemo(() => {
    const map: Record<string, { contaId: string; contaNome: string; prioridade: number | null }[]> = {};
    (formaContaMapa || []).forEach((m) => {
      if (!m.forma_pagamento_id || !m.contas) return;
      const lista = map[m.forma_pagamento_id] || [];
      lista.push({
        contaId: m.conta_id,
        contaNome: m.contas.nome,
        prioridade: m.prioridade,
      });
      map[m.forma_pagamento_id] = lista;
    });
    // Ordena por prioridade asc (null ao fim)
    Object.keys(map).forEach((k) => {
      map[k] = map[k].sort((a, b) => {
        if (a.prioridade == null && b.prioridade == null) return 0;
        if (a.prioridade == null) return 1;
        if (b.prioridade == null) return -1;
        return a.prioridade - b.prioridade;
      });
    });
    return map;
  }, [formaContaMapa]);

  // Cria uma linha inicial e garante conta padrão por forma quando mapeamentos chegarem
  useEffect(() => {
    if (!formasPagamento || formasPagamento.length === 0) return;

    // Se não existir nenhuma linha, cria a primeira usando a primeira forma disponível
    if (linhas.length === 0) {
      const primeiraForma = formasPagamento[0];
      const contaDefault = mapeamentosPorForma[primeiraForma.id]?.[0]?.contaId;
      setLinhas([
        {
          id: `${Date.now()}`,
          formaId: primeiraForma.id,
          contaId: contaDefault,
          valor: "",
        },
      ]);
      return;
    }

    // Preencher conta default para linhas sem conta definida
    const atualizadas = linhas.map((linha) => {
      if (linha.contaId) return linha;
      const lista = mapeamentosPorForma[linha.formaId] || [];
      if (lista.length === 0) return linha;
      return { ...linha, contaId: lista[0].contaId };
    });

    const mudou = atualizadas.some((l, idx) => l !== linhas[idx]);
    if (mudou) {
      setLinhas(atualizadas);
    }
  }, [formasPagamento, mapeamentosPorForma, linhas]);

  // Buscar membros com permissão financeira para conferente
  const { data: pessoas } = useQuery({
    queryKey: [
      "pessoas-conferente",
      igrejaId,
      filialId,
      isAllFiliais,
      profile?.id,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      // Buscar usuários com role de admin ou tesoureiro
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "tesoureiro"])
        .eq("igreja_id", igrejaId);

      if (rolesError) throw rolesError;

      const userIds = userRoles?.map((r) => r.user_id) || [];

      // Buscar profiles desses usuários, excluindo quem está lançando
      let query = supabase
        .from("profiles")
        .select("id, nome, user_id")
        .in("user_id", userIds)
        .neq("id", profile?.id || "") // Excluir quem está lançando
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && !loading && !!igrejaId,
  });

  const atualizarLinha = (id: string, dados: Partial<LinhaLancamento>) => {
    setLinhas((prev) =>
      prev.map((linha) => (linha.id === id ? { ...linha, ...dados } : linha))
    );
  };

  const handleFormaChange = (id: string, formaId: string) => {
    const lista = mapeamentosPorForma[formaId] || [];
    const contaDefault = lista[0]?.contaId;
    atualizarLinha(id, { formaId, contaId: contaDefault });
  };

  const handleContaChange = (id: string, contaId: string) => {
    atualizarLinha(id, { contaId });
  };

  const handleValorChange = (id: string, valor: string) => {
    atualizarLinha(id, { valor });
  };

  const adicionarLinha = () => {
    const primeiraForma = formasPagamento?.[0];
    const formaId = primeiraForma?.id || "";
    const contaDefault = formaId ? mapeamentosPorForma[formaId]?.[0]?.contaId : undefined;
    setLinhas((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        formaId,
        contaId: contaDefault,
        valor: "",
      },
    ]);
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calcularTotal = () => {
    return linhas.reduce((sum, linha) => {
      const num = parseFloat(linha.valor.replace(",", ".")) || 0;
      return sum + num;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!igrejaId) {
      toast.error("Igreja não identificada.");
      return;
    }

    if (!conferenteId) {
      toast.error("Selecione o conferente");
      return;
    }

    // Se ainda estiver no passo 1, apenas avança para passo 2
    if (step === 1) {
      setStep(2);
      return;
    }

    // Validação das linhas preenchidas
    const linhasValidas = linhas.filter(
      (linha) => parseFloat(linha.valor.replace(",", ".")) > 0
    );

    if (linhasValidas.length === 0) {
      toast.error("Preencha ao menos um valor");
      return;
    }

    for (const linha of linhasValidas) {
      const valorNum = parseFloat(linha.valor.replace(",", ".")) || 0;
      if (valorNum < 0.01) {
        toast.error("Valor mínimo por linha é R$ 0,01");
        return;
      }
      if (!linha.formaId) {
        toast.error("Selecione a forma em cada linha com valor.");
        return;
      }
      const listaMap = mapeamentosPorForma[linha.formaId];
      if (!listaMap || listaMap.length === 0) {
        toast.error("Forma sem mapeamento de conta. Configure antes de lançar.");
        return;
      }
      if (!linha.contaId) {
        toast.error("Selecione a conta destino para cada linha com valor.");
        return;
      }
    }

    // Abre pré-visualização (confirmação antes de enviar)
    setShowPreview(true);
  };

  const enviarRelatorio = async () => {
    const linhasValidas = linhas.filter(
      (linha) => parseFloat(linha.valor.replace(",", ".")) > 0
    );

    if (linhasValidas.length === 0) return;

    setLoading(true);

    try {
      const total = calcularTotal();
      const valoresAgrupados: Record<string, number> = {};
      const linhasEnriquecidas = linhasValidas.map((linha) => {
        const forma = formasPagamento?.find((f) => f.id === linha.formaId);
        const contaNome =
          mapeamentosPorForma[linha.formaId]?.find((m) => m.contaId === linha.contaId)?.contaNome ||
          "Conta não mapeada";
        const valorNum = parseFloat(linha.valor.replace(",", ".")) || 0;
        if (forma) {
          valoresAgrupados[linha.formaId] = (valoresAgrupados[linha.formaId] || 0) + valorNum;
        }
        return {
          formaId: linha.formaId,
          contaId: linha.contaId,
          valor: valorNum,
          formaNome: forma?.nome,
          contaNome,
        };
      });

      const valoresFormatados = linhasEnriquecidas
        .map((l) => `${l.formaNome || "Forma"} → ${l.contaNome}: R$ ${l.valor.toFixed(2)}`)
        .join(", ");

      // Criar notificação para o conferente com dados completos no metadata
      const conferente = pessoas?.find((p) => p.id === conferenteId);
      if (conferente) {
        await supabase.from("notifications").insert({
          user_id: conferente.user_id,
          title: "Novo Relatório de Oferta Aguardando Conferência",
          message: `${
            profile?.nome
          } criou um relatório de oferta do culto de ${format(
            dataCulto,
            "dd/MM/yyyy"
          )} aguardando sua validação. Total: ${formatCurrency(total)}`,
          type: "conferencia_oferta",
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
          metadata: {
            data_evento: format(dataCulto, "yyyy-MM-dd"),
            lancado_por: profile?.nome,
            lancado_por_id: profile?.id,
            conferente_id: conferenteId,
            total,
            linhas: linhasEnriquecidas,
            valores_formatados: valoresFormatados,
            // Para compatibilidade com lógica antiga
            valores: Object.fromEntries(
              Object.entries(valoresAgrupados).map(([k, v]) => [k, v.toFixed(2)])
            ),
          },
        });
      }

      toast.success("Relatório enviado para conferência!");

      // Resetar form
      setLinhas([]);
      setDataCulto(new Date());
      setConferenteId("");
      setStep(1);
      setShowPreview(false);
    } catch (error: unknown) {
      console.error("Erro ao enviar relatório:", error);
      toast.error("Erro ao enviar relatório", {
        description: error instanceof Error ? error.message : String(error),
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
    conta_por_forma?: Record<string, string>;
    linhas?: {
      formaId: string;
      contaId?: string;
      valor: number;
      formaNome?: string;
      contaNome?: string;
    }[];
  };

  const handleConfirmarOferta = async (
    notificationId: string,
    metadata: OfertaMetadata
  ) => {
    setLoading(true);

    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const dataFormatada = metadata.data_evento;
      const valoresMetadata = metadata.valores || {};
      const contaPorFormaSelecionada = metadata.conta_por_forma || {};
      const linhasMetadata =
        (metadata.linhas && metadata.linhas.length > 0)
          ? metadata.linhas
          : Object.entries(valoresMetadata).map(([formaId, valorStr]) => {
              const valorNumerico = parseFloat(String(valorStr).replace(",", "."));
              const contaFallback =
                contaPorFormaSelecionada[formaId] || mapeamentosPorForma[formaId]?.[0]?.contaId;
              return {
                formaId,
                contaId: contaFallback,
                valor: valorNumerico,
              };
            });

      // Buscar categoria padrão de Ofertas (tipo entrada)
      let categoriaQuery = supabase
        .from("categorias_financeiras")
        .select("id")
        .eq("tipo", "entrada")
        .ilike("nome", "%oferta%")
        .eq("igreja_id", igrejaId)
        .limit(1);
      if (!isAllFiliais && filialId) {
        categoriaQuery = categoriaQuery.eq("filial_id", filialId);
      }
      const { data: categoriaOferta } = await categoriaQuery.maybeSingle();

      // Criar transações para cada forma de pagamento com valor
      const transacoes = [];
      for (const linha of linhasMetadata) {
        const valorNumerico = parseFloat(String(linha.valor).replace(",", ".")) || 0;
        if (valorNumerico <= 0) continue;

        const forma = formasPagamento?.find((f) => f.id === linha.formaId);
        if (!forma) continue;

        // 🎯 NOVO: Buscar conta no mapeamento dinâmico
        const mapeamentos = mapeamentosPorForma[linha.formaId];
        const contaId = linha.contaId || mapeamentos?.[0]?.contaId;
        if (!contaId) {
          toast.error(
            `Forma "${forma.nome}" não está mapeada para uma conta. ` +
            `Configure em Financas → Formas de Pagamento`
          );
          setLoading(false);
          return;
        }
        
        // 🎯 NOVO: Taxa vem da forma, não do form
        const taxaAdministrativa = forma.taxa_administrativa || 0;
        const taxaAdministrativaFixa = forma.taxa_administrativa_fixa;
        
        // 🎯 NOVO: Status vem da forma, não de parsing de nome
        const status = forma.gera_pago ? "pago" : "pendente";
        const dataPagamento = forma.gera_pago ? dataFormatada : null;

        // Calcular taxa
        let taxasAdministrativas = null;
        if (taxaAdministrativa > 0) {
          taxasAdministrativas = valorNumerico * (taxaAdministrativa / 100);
        }
        if (taxaAdministrativaFixa && taxaAdministrativaFixa > 0) {
          taxasAdministrativas = (taxasAdministrativas || 0) + taxaAdministrativaFixa;
        }

        const transacao = {
          tipo: "entrada",
          tipo_lancamento: "unico",
          descricao: `Oferta - Culto ${format(
            new Date(metadata.data_evento),
            "dd/MM/yyyy"
          )}`,
          valor: valorNumerico,
          data_vencimento: dataFormatada,
          data_competencia: dataFormatada,
          data_pagamento: dataPagamento,
          conta_id: contaId,  // ✅ Agora dinâmico
          categoria_id: categoriaOferta?.id || null,
          forma_pagamento: linha.formaId,
          status: status,  // ✅ Agora dinâmico
          taxas_administrativas: taxasAdministrativas,  // ✅ Agora dinâmico
          observacoes: `Lançado por: ${metadata.lancado_por}\nConferido por: ${profile?.nome}`,
          lancado_por: userData.user?.id,
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
        };

        transacoes.push(transacao);
      }

      // Inserir todas as transações
      const { error } = await supabase
        .from("transacoes_financeiras")
        .insert(transacoes);

      if (error) throw error;

      // Marcar notificação como lida
      let notificationQuery = supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        notificationQuery = notificationQuery.eq("filial_id", filialId);
      }
      await notificationQuery;

      toast.success(
        `${transacoes.length} lançamento(s) criado(s) com sucesso!`
      );
      queryClient.invalidateQueries({ queryKey: ["entradas"] });
      queryClient.invalidateQueries({ queryKey: ["contas-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error: unknown) {
      console.error("Erro ao criar lançamentos:", error);
      toast.error("Erro ao criar lançamentos", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitarOferta = async (
    notificationId: string,
    metadata: OfertaMetadata
  ) => {
    try {
      if (!igrejaId) {
        toast.error("Igreja não identificada.");
        return;
      }
      // Buscar perfil do lançador usando lancado_por_id do metadata
      let lancadorQuery = supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("id", metadata.lancado_por_id)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        lancadorQuery = lancadorQuery.eq("filial_id", filialId);
      }
      const { data: lancadorProfile } = await lancadorQuery.single();

      if (!lancadorProfile?.user_id) {
        toast.error("Erro ao encontrar usuário lançador");
        return;
      }

      // Criar notificação para o lançador informando rejeição
      await supabase.from("notifications").insert({
        user_id: lancadorProfile.user_id,
        title: "Relatório de Oferta Rejeitado",
        message: `O conferente ${
          profile?.nome
        } rejeitou o relatório de oferta do culto de ${format(
          new Date(metadata.data_evento),
          "dd/MM/yyyy"
        )}. Total: ${formatCurrency(metadata.total)}`,
        type: "rejeicao_oferta",
        igreja_id: igrejaId,
        filial_id: !isAllFiliais ? filialId : null,
        metadata: {
          data_evento: format(new Date(metadata.data_evento), "dd/MM/yyyy"),
          conferente: profile?.nome,
          lancado_por: metadata.lancado_por,
          valores: metadata.valores_formatados,
          total: metadata.total,
          data_rejeicao: new Date().toISOString(),
        },
      });

      // Marcar notificação original como lida
      let notificationQuery = supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        notificationQuery = notificationQuery.eq("filial_id", filialId);
      }
      await notificationQuery;

      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.info("Conferência rejeitada.");
    } catch (error: unknown) {
      console.error("Erro ao rejeitar oferta:", error);
      toast.error("Erro ao rejeitar oferta");
    }
  };

  // Buscar notificações pendentes de conferência para o usuário atual
  const { data: notificacoesPendentes } = useQuery({
    queryKey: [
      "notifications-conferencia",
      igrejaId,
      filialId,
      isAllFiliais,
      profile?.user_id,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile?.user_id)
        .eq("type", "conferencia_oferta")
        .eq("read", false)
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id && !loading && !!igrejaId,
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/financas")}
            className="w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/financas/dashboard-ofertas")}
          >
            Ver Dashboard
          </Button>
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Relatório de Oferta
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Registro rápido de entradas por forma de pagamento
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={cn("flex items-center gap-2", step === 1 ? "font-semibold text-foreground" : "")}>1. Dados do culto</div>
          <span>→</span>
          <div className={cn("flex items-center gap-2", step === 2 ? "font-semibold text-foreground" : "")}>2. Valores e contas</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {step === 1 && (
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
                        {dataCulto
                          ? format(dataCulto, "PPP", { locale: ptBR })
                          : "Selecione a data"}
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
                    value={profile?.nome || "Carregando..."}
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

              <div className="flex justify-end">
                <Button type="submit" className="bg-gradient-primary" disabled={loading}>
                  Próximo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <>
            <Card className="shadow-soft">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-lg">
                  Valores por Forma de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 text-xs font-semibold text-muted-foreground px-1">
                  <span>Forma</span>
                  <span>Conta</span>
                  <span>Valor</span>
                  <span className="hidden md:block" />
                </div>
                <div className="space-y-3">
                  {linhas.map((linha) => {
                    const formaSelecionada = formasPagamento?.find((f) => f.id === linha.formaId);
                    const mapeamentos = linha.formaId
                      ? mapeamentosPorForma[linha.formaId] || []
                      : [];
                    const temTaxa =
                      (Number(formaSelecionada?.taxa_administrativa ?? 0) > 0) ||
                      (Number(formaSelecionada?.taxa_administrativa_fixa ?? 0) > 0);
                    const taxaPercentual = Number(formaSelecionada?.taxa_administrativa ?? 0);
                    const taxaFixa = Number(formaSelecionada?.taxa_administrativa_fixa ?? 0);

                    return (
                      <div
                        key={linha.id}
                        className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center p-3 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <Select
                            value={linha.formaId}
                            onValueChange={(v) => handleFormaChange(linha.id, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a forma" />
                            </SelectTrigger>
                            <SelectContent>
                              {formasPagamento?.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {temTaxa && (
                            <p className="text-[11px] text-muted-foreground">
                              Taxa: {taxaPercentual > 0 ? `${taxaPercentual}%` : ""}
                              {taxaPercentual > 0 && taxaFixa > 0 ? " + " : ""}
                              {taxaFixa > 0 ? `R$ ${taxaFixa.toFixed(2)}` : ""}
                            </p>
                          )}
                        </div>

                        <div>
                          {mapeamentos.length === 0 ? (
                            <p className="text-xs text-destructive">Sem conta mapeada</p>
                          ) : (
                            <Select
                              value={linha.contaId || mapeamentos[0].contaId}
                              onValueChange={(v) => handleContaChange(linha.id, v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a conta" />
                              </SelectTrigger>
                              <SelectContent>
                                {mapeamentos.map((m) => (
                                  <SelectItem key={m.contaId} value={m.contaId}>
                                    {m.contaNome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <Input
                          id={`valor-${linha.id}`}
                          type="text"
                          placeholder="0,00"
                          value={linha.valor}
                          onChange={(e) => handleValorChange(linha.id, e.target.value)}
                        />

                        <div className="flex md:justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removerLinha(linha.id)}
                            disabled={linhas.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar linha
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-soft bg-primary/5">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between flex-col sm:flex-row gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Total do Relatório
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {formatCurrency(calcularTotal())}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      disabled={loading}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-gradient-primary shadow-soft"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? "Enviando..." : "Pré-visualizar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </form>

      <ResponsiveDialog open={showPreview} onOpenChange={setShowPreview}>
        <div className="flex flex-col h-full">
          <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight">Revisar e Enviar</h2>
            <p className="text-sm text-muted-foreground">Confirme os lançamentos antes de enviar para conferência</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-muted-foreground">Data do culto</div>
              <div className="font-medium">{format(dataCulto, "dd/MM/yyyy")}</div>
              <div className="text-muted-foreground">Conferente</div>
              <div className="font-medium">{pessoas?.find((p) => p.id === conferenteId)?.nome || ""}</div>
            </div>

            <div className="border rounded-lg">
              <div className="grid grid-cols-3 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <span>Forma</span>
                <span>Conta</span>
                <span className="text-right">Valor</span>
              </div>
              <div className="divide-y">
                {linhas
                  .filter((linha) => parseFloat(linha.valor.replace(",", ".")) > 0)
                  .map((linha) => {
                    const formaNome =
                      formasPagamento?.find((f) => f.id === linha.formaId)?.nome || "Forma";
                    const contaNome =
                      mapeamentosPorForma[linha.formaId]?.find((m) => m.contaId === linha.contaId)?.contaNome ||
                      "Conta";
                    return (
                      <div key={linha.id} className="grid grid-cols-3 gap-2 px-3 py-2 text-sm items-center">
                        <span>{formaNome}</span>
                        <span className="truncate" title={contaNome}>{contaNome}</span>
                        <span className="text-right font-medium">{formatCurrency(parseFloat(linha.valor.replace(",", ".")) || 0)}</span>
                      </div>
                    );
                  })}
              </div>
              <div className="flex justify-between items-center px-3 py-3 bg-muted/50">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(calcularTotal())}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 border-t bg-muted/50 px-4 py-3 md:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPreview(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={enviarRelatorio}
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-primary"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Enviando..." : "Confirmar e Enviar"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Notificações Pendentes de Conferência */}
      {notificacoesPendentes && notificacoesPendentes.length > 0 && (
        <Card className="shadow-soft border-primary/20">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg">
              Relatórios Aguardando Conferência
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-3">
            {notificacoesPendentes.map((notif) => {
              const metadata = notif.metadata as OfertaMetadata;
              const valoresObj = metadata.valores || {};
              const total = metadata.total || 0;

              const valoresAgrupados = (metadata.linhas && metadata.linhas.length > 0)
                ? metadata.linhas.reduce((acc, linha) => {
                    const valorNum = Number(linha.valor) || 0;
                    if (valorNum <= 0) return acc;
                    const formaNome =
                      linha.formaNome || formasPagamento?.find((f) => f.id === linha.formaId)?.nome || "Forma";
                    const atual = acc[linha.formaId] || { nome: formaNome, valor: 0 };
                    acc[linha.formaId] = { nome: atual.nome, valor: atual.valor + valorNum };
                    return acc;
                  }, {} as Record<string, { nome: string; valor: number }>)
                : Object.entries(valoresObj).reduce(
                    (acc, [id, valorStr]: [string, string]) => {
                      const valorNumerico = parseFloat(
                        String(valorStr).replace(",", ".")
                      );
                      if (valorNumerico > 0) {
                        const forma = formasPagamento?.find((f) => f.id === id);
                        if (forma) {
                          acc[id] = {
                            nome: forma.nome,
                            valor: valorNumerico,
                          };
                        }
                      }
                      return acc;
                    },
                    {} as Record<string, { nome: string; valor: number }>
                  );

              const dadosConferencia = {
                dataCulto: new Date(metadata.data_evento),
                valores: valoresAgrupados,
                total: total || Object.values(valoresAgrupados).reduce((s, v) => s + v.valor, 0),
                lancadoPor: metadata.lancado_por || "Não identificado",
                conferente: profile?.nome || "Você",
              };

              return (
                <div
                  key={notif.id}
                  className="p-3 md:p-4 border rounded-lg space-y-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm md:text-base truncate">
                        {notif.title}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          Total:
                        </span>
                        <span className="text-sm md:text-base font-bold text-primary">
                          {formatCurrency(total)}
                        </span>
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
                      onConfirmar={() =>
                        handleConfirmarOferta(notif.id, metadata)
                      }
                      onRejeitar={() =>
                        handleRejeitarOferta(notif.id, metadata)
                      }
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
