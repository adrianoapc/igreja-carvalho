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
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  ArrowLeft,
  CalendarIcon,
  Save,
  DollarSign,
  Plus,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  openSessaoContagem,
  confrontarContagens,
  SessaoContagem,
  calcularJanelaSincronizacao,
  finalizarSessao,
} from "@/hooks/useFinanceiroSessao";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import {
  buscarPixRecebidos,
  getSantanderIntegracaoId,
} from "@/hooks/useSantanderPix";
import { ConferirOfertaDialog } from "@/components/financas/ConferirOfertaDialog";
import { PessoaCombobox } from "@/components/pessoas/PessoaCombobox";
import { MinhaContagemDialog } from "@/components/financas/MinhaContagemDialog";
import { EventoSelect } from "@/components/financas/EventoSelect";

type LinhaLancamento = {
  id: string;
  formaId: string;
  contaId?: string;
  valor: string;
  pessoaId?: string | null;
  tipo?: "oferta" | "dizimo" | "missoes";
  categoriaId?: string | null;
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
  const [periodo, setPeriodo] = useState<"manha" | "noite">("manha");
  const [periodosDisponiveis, setPeriodosDisponiveis] = useState<string[]>([
    "manhã",
    "noite",
  ]);
  const [conferenteId, setConferenteId] = useState("");
  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [showPreview, setShowPreview] = useState(false);
  const [showMinhaContagem, setShowMinhaContagem] = useState(false);
  const [minhaContagemLoading, setMinhaContagemLoading] = useState(false);
  const [sessaoAtual, setSessaoAtual] = useState<SessaoContagem | null>(null);
  const [eventoSelecionado, setEventoSelecionado] = useState<string | null>(
    null,
  );
  const [eventoInfo, setEventoInfo] = useState<any | null>(null);
  // Extensão para suportar conta em linhas digitais
  type LinhaDigital = {
    id: string;
    pessoaId?: string | null;
    formaId?: string;
    contaId?: string;
    categoriaId?: string | null;
    valor: string;
    origem: "manual" | "api";
    readOnly?: boolean;
  };
  const [linhasDigitaisEx, setLinhasDigitaisEx] = useState<LinhaDigital[]>([]);
  const [syncPixLoading, setSyncPixLoading] = useState(false);
  const [confrontoLoading, setConfrontoLoading] = useState(false);
  const [confrontoStatus, setConfrontoStatus] = useState<string | null>(null);
  const [confrontoVariance, setConfrontoVariance] = useState<number | null>(
    null,
  );
  const [confrontoPorTipo, setConfrontoPorTipo] = useState<Record<
    string,
    number
  > | null>(null);
  const [blindTolerance, setBlindTolerance] = useState<number | null>(null);
  const [blindCompareLevel, setBlindCompareLevel] = useState<
    "total" | "tipo" | null
  >(null);
  const [confirmZeroFisico, setConfirmZeroFisico] = useState(false);
  const [financeiroConfig, setFinanceiroConfig] = useState<any | null>(null);

  const handleSincronizarPix = async () => {
    if (!igrejaId) return;

    setSyncPixLoading(true);
    try {
      // 1. Calcular janela de tempo baseada na última sessão finalizada
      const { inicio, fim } = await calcularJanelaSincronizacao(
        igrejaId,
        filialId,
      );

      console.log("Janela de sincronização:", {
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
      });

      // 2. Garantir que a sessão existe
      const dataISO = format(dataCulto, "yyyy-MM-dd");
      const sessao =
        sessaoAtual ||
        (await findOrOpenSessao(dataISO, periodo, eventoSelecionado));
      if (!sessao) throw new Error("Sessão não encontrada/aberta");

      // 3. Buscar IDs de PIX já vinculados a outras sessões para evitar duplicidade
      const { data: pixVinculados } = await supabase
        .from("sessoes_itens_draft")
        .select("id")
        .eq("igreja_id", igrejaId)
        .eq("is_digital", true)
        .eq("origem_registro", "api")
        .neq("sessao_id", sessao.id);

      const idsVinculados = new Set(
        (pixVinculados || []).map((item: any) =>
          item.id.replace("api-pix-", ""),
        ),
      );

      // 4. Verificar se há PIX no período na tabela temporária
      const { data: pixNoPeriodo } = await supabase
        .from("pix_webhook_temp")
        .select("id")
        .eq("igreja_id", igrejaId)
        .gte("data_pix", inicio.toISOString())
        .lte("data_pix", fim.toISOString())
        .limit(1);

      // 5. Se não há PIX no período, buscar da API
      if (!pixNoPeriodo || pixNoPeriodo.length === 0) {
        const integracaoId = await getSantanderIntegracaoId(igrejaId);
        if (!integracaoId) {
          toast.error("Integração Santander não encontrada");
          return;
        }

        const resultado = await buscarPixRecebidos({
          integracaoId,
          igrejaId,
          dataInicio: inicio.toISOString(),
          dataFim: fim.toISOString(),
        });

        toast.info(
          `PIX: ${resultado.importados || 0} importados, ${resultado.duplicados || 0} duplicados`,
        );
      }

      // 6. Buscar PIX do período que não estão vinculados
      const { data: pixRows } = await supabase
        .from("pix_webhook_temp")
        .select("id, pix_id, valor, data_pix")
        .eq("igreja_id", igrejaId)
        .gte("data_pix", inicio.toISOString())
        .lte("data_pix", fim.toISOString())
        .order("data_pix", { ascending: false })
        .limit(200);

      if (pixRows && pixRows.length > 0) {
        // Procura especificamente pela forma de pagamento PIX
        const formaPix = (formasDigitais || formasPagamento)?.find((f) =>
          f.nome.toLowerCase().includes("pix"),
        );

        // Usa o ID do PIX se encontrado, senão usa a primeira forma digital como fallback
        const formaId =
          formaPix?.id ||
          formasDigitais?.[0]?.id ||
          formasPagamento?.[0]?.id ||
          undefined;

        const contaDefault = formaId
          ? mapeamentosPorForma[formaId]?.[0]?.contaId
          : undefined;

        const existentes = new Set(
          linhasDigitaisEx
            .filter((p) => p.origem === "api")
            .map((p) => p.id.replace("api-pix-", "")),
        );

        const novos: LinhaDigital[] = (pixRows as any[])
          .filter((it) => {
            const pixId = it.pix_id || it.id;
            return !existentes.has(pixId) && !idsVinculados.has(pixId);
          })
          .map((it) => ({
            id: `api-pix-${it.pix_id || it.id}`,
            pessoaId: null,
            formaId,
            contaId: contaDefault,
            valor: String(it.valor ?? ""),
            origem: "api",
            readOnly: true,
          }));

        if (novos.length === 0) {
          toast.info("Nenhum PIX novo encontrado no período.");
        } else {
          setLinhasDigitaisEx((prev) => [...novos, ...prev]);
          toast.success(`${novos.length} PIX(s) adicionado(s) à contagem.`);
        }
      } else {
        toast.info("Nenhum PIX encontrado no período especificado.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao sincronizar PIX");
    } finally {
      setSyncPixLoading(false);
    }
  };
  const { data: categoriasEntrada } = useQuery({
    queryKey: ["categorias-entrada", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let q = supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo")
        .eq("tipo", "entrada")
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) q = q.eq("filial_id", filialId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!igrejaId,
  });

  // CTA para listagem de sessões de contagem
  const HeaderActions = () => (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => navigate("/financas/sessoes-contagem")}
      >
        Sessões de Contagem
      </Button>
    </div>
  );

  // Buscar formas de pagamento com info de taxa e status
  const { data: formasPagamento } = useQuery({
    queryKey: ["formas-pagamento-oferta", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("formas_pagamento")
        .select(
          "id, nome, taxa_administrativa, taxa_administrativa_fixa, gera_pago, is_digital",
        )
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

  // Derivar listas de formas por canal, aplicando restrições de config se existirem
  const formasFisicas = useMemo(() => {
    let base = (formasPagamento || []).filter((f: any) => !f.is_digital);
    const ids = financeiroConfig?.formas_fisicas_ids as string[] | undefined;
    if (Array.isArray(ids) && ids.length > 0) {
      base = base.filter((f: any) => ids.includes(f.id));
    }
    return base;
  }, [formasPagamento, financeiroConfig?.formas_fisicas_ids]);
  const formasDigitais = useMemo(() => {
    let base = (formasPagamento || []).filter((f: any) => !!f.is_digital);
    const ids = financeiroConfig?.formas_digitais_ids as string[] | undefined;
    if (Array.isArray(ids) && ids.length > 0) {
      base = base.filter((f: any) => ids.includes(f.id));
    }
    return base;
  }, [formasPagamento, financeiroConfig?.formas_digitais_ids]);

  // Buscar mapeamento dinâmico: forma → conta
  const { data: formaContaMapa } = useQuery({
    queryKey: ["forma-conta-mapa", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];

      let query = supabase
        .from("forma_pagamento_contas")
        .select(
          `
          forma_pagamento_id,
          conta_id,
          prioridade,
          contas(id, nome)
        `,
        )
        .eq("igreja_id", igrejaId)
        .order("prioridade", { ascending: true });

      // Se não é all filiais, preferir mapeamento específico da filial
      if (!isAllFiliais && filialId) {
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
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
    const map: Record<
      string,
      { contaId: string; contaNome: string; prioridade: number | null }[]
    > = {};
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

  // Tipos permitidos (físico) derivados de config ou por fallback de nomes
  const tiposFisicosPermitidos = useMemo(() => {
    const ids = financeiroConfig?.tipos_permitidos_fisico as
      | string[]
      | undefined;
    const todas = (categoriasEntrada || []) as any[];
    if (Array.isArray(ids) && ids.length > 0) {
      return todas.filter((c) => ids.includes(c.id));
    }
    const nomes = ["oferta", "dizimo", "miss" /* cobre missões */];
    return todas.filter((c) =>
      nomes.some((n) => (c.nome || "").toLowerCase().includes(n)),
    );
  }, [financeiroConfig?.tipos_permitidos_fisico, categoriasEntrada]);

  // Helper para mapear uma categoria ao tipo base (dizimo/missoes/oferta)
  const categoriaToTipo = (nome: string) => {
    const n = nome.toLowerCase();
    return n.includes("diz")
      ? "dizimo"
      : n.includes("miss")
        ? "missoes"
        : "oferta";
  };

  // Categorias permitidas (digital) derivadas de config ou fallback de nomes
  const categoriasDigitaisPermitidas = useMemo(() => {
    const ids = financeiroConfig?.tipos_permitidos_digital as
      | string[]
      | undefined;
    const todas = (categoriasEntrada || []) as any[];
    if (Array.isArray(ids) && ids.length > 0) {
      return todas.filter((c) => ids.includes(c.id));
    }
    const nomes = ["oferta", "dizimo", "miss"]; // fallback por nome
    return todas.filter((c) =>
      nomes.some((n) => (c.nome || "").toLowerCase().includes(n)),
    );
  }, [financeiroConfig?.tipos_permitidos_digital, categoriasEntrada]);

  // Cria uma linha inicial e garante conta padrão por forma quando mapeamentos chegarem
  useEffect(() => {
    // Carregar períodos configurados de configuracoes_financeiro (fallback para padrão)
    const carregarPeriodos = async () => {
      try {
        if (!igrejaId) return;
        let q = supabase
          .from("configuracoes_financeiro")
          .select(
            "periodos, formas_fisicas_ids, formas_digitais_ids, tipos_permitidos_fisico, tipos_permitidos_digital, controla_dizimistas",
          )
          .eq("igreja_id", igrejaId)
          .limit(1);
        if (!isAllFiliais && filialId) q = q.eq("filial_id", filialId);
        const { data } = await q.maybeSingle();
        setFinanceiroConfig(data || null);
        const arr = (data?.periodos as any) || null;
        if (Array.isArray(arr) && arr.length > 0) {
          setPeriodosDisponiveis(arr);
        }
      } catch (e) {
        // silencia erros e mantém defaults
      }
    };
    carregarPeriodos();
  }, [igrejaId, filialId, isAllFiliais]);

  useEffect(() => {
    if (!formasPagamento || formasPagamento.length === 0) return;

    // Se não existir nenhuma linha, cria a primeira usando a primeira forma disponível
    if (linhas.length === 0) {
      const primeiraForma = formasFisicas[0] || formasPagamento[0];
      const contaDefault = mapeamentosPorForma[primeiraForma.id]?.[0]?.contaId;
      setLinhas([
        {
          id: `${Date.now()}`,
          formaId: primeiraForma.id,
          contaId: contaDefault,
          valor: "",
          tipo: (tiposFisicosPermitidos[0]?.nome || "oferta")
            .toLowerCase()
            .includes("diz")
            ? "dizimo"
            : (tiposFisicosPermitidos[0]?.nome || "")
                  .toLowerCase()
                  .includes("miss")
              ? "missoes"
              : "oferta",
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
      prev.map((linha) => (linha.id === id ? { ...linha, ...dados } : linha)),
    );
  };

  useEffect(() => {
    const carregarConfronto = async () => {
      if (step !== 4 || !sessaoAtual?.id || !igrejaId) return;
      setConfrontoLoading(true);
      try {
        const { data: sessao } = await supabase
          .from("sessoes_contagem")
          .select("blind_tolerance_value, blind_compare_level")
          .eq("id", sessaoAtual.id)
          .maybeSingle();
        if (sessao) {
          setBlindTolerance(Number(sessao.blind_tolerance_value ?? 0));
          setBlindCompareLevel((sessao.blind_compare_level as any) || "total");
        }

        const confronto = await confrontarContagens(sessaoAtual.id);
        if (confronto) {
          setConfrontoStatus(confronto.status || null);
          setConfrontoVariance(confronto.variance_value ?? null);
          setConfrontoPorTipo((confronto.variance_by_tipo as any) || null);
        }
      } catch (e) {
        console.warn("Falha ao carregar confronto", e);
      } finally {
        setConfrontoLoading(false);
      }
    };
    carregarConfronto();
  }, [step, sessaoAtual?.id, igrejaId]);

  const handleFormaChange = (id: string, formaId: string) => {
    const lista = mapeamentosPorForma[formaId] || [];
    const contaDefault = lista[0]?.contaId;
    atualizarLinha(id, { formaId, contaId: contaDefault });
  };

  const handleContaChange = (id: string, contaId: string) => {
    atualizarLinha(id, { contaId });
  };

  // Sanitiza entrada monetária: apenas dígitos e formata como 0,00
  const sanitizeMoneyInput = (raw: string) => {
    const digits = (raw || "").replace(/\D+/g, "");
    const trimmed = digits.replace(/^0+(?=\d)/, "");
    const safe = trimmed === "" ? "0" : trimmed;
    const len = safe.length;
    const intPart = safe.slice(0, Math.max(0, len - 2)) || "0";
    const decPart = safe.slice(Math.max(0, len - 2)).padStart(2, "0");
    return `${intPart},${decPart}`;
  };

  const handleValorChange = (id: string, valor: string) => {
    atualizarLinha(id, { valor: sanitizeMoneyInput(valor) });
  };

  const adicionarLinha = () => {
    const primeiraForma = formasFisicas?.[0] || formasPagamento?.[0];
    const formaId = primeiraForma?.id || "";
    const contaDefault = formaId
      ? mapeamentosPorForma[formaId]?.[0]?.contaId
      : undefined;
    setLinhas((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        formaId,
        contaId: contaDefault,
        valor: "",
        pessoaId: null,
        tipo: (tiposFisicosPermitidos[0]?.nome || "oferta")
          .toLowerCase()
          .includes("diz")
          ? "dizimo"
          : (tiposFisicosPermitidos[0]?.nome || "")
                .toLowerCase()
                .includes("miss")
            ? "missoes"
            : "oferta",
      },
    ]);
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) =>
      prev.length > 1 ? prev.filter((l) => l.id !== id) : prev,
    );
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
  const calcularTotalDigital = () => {
    return linhasDigitaisEx.reduce((sum, l: any) => {
      const num = parseFloat(String(l.valor || "").replace(",", ".")) || 0;
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

    // Passo 1: abrir sessão e só avançar se existir
    if (step === 1) {
      const dataISO = format(dataCulto, "yyyy-MM-dd");
      const sessao = await findOrOpenSessao(dataISO, periodo);
      if (!sessao) {
        toast.error("Falha ao abrir sessão de contagem.");
        return;
      }
      setSessaoAtual(sessao);
      setStep(2);
      return;
    }

    // Validação das linhas preenchidas
    const linhasValidas = linhas.filter(
      (linha) => parseFloat(linha.valor.replace(",", ".")) > 0,
    );
    const totalFisico = calcularTotal();

    if (linhasValidas.length === 0) {
      // Permite avançar se total físico for zero e houver confirmação explícita
      if (totalFisico <= 0 && confirmZeroFisico) {
        setStep(3);
        return;
      }
      toast.error("Preencha ao menos um valor ou confirme valor zero");
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
        toast.error(
          "Forma sem mapeamento de conta. Configure antes de lançar.",
        );
        return;
      }
      if (!linha.contaId) {
        toast.error("Selecione a conta destino para cada linha com valor.");
        return;
      }
    }

    // Avança para Digital
    setStep(3);
  };

  // Salvar rascunho (substitui os itens atuais de rascunho da sessão)
  const salvarRascunho = async () => {
    try {
      if (!igrejaId) throw new Error("Igreja não identificada");
      const dataISO = format(dataCulto, "yyyy-MM-dd");
      // Garante sessão aberta (usa a sessão atual se existir)
      const sessao = sessaoAtual || (await findOrOpenSessao(dataISO, periodo));
      if (!sessao) throw new Error("Sessão não encontrada/aberta");

      // Limpa rascunhos anteriores da sessão
      await supabase
        .from("sessoes_itens_draft")
        .delete()
        .eq("sessao_id", sessao.id);

      // Mapeia linhas físicas
      const fisicos = linhas
        .map((l) => ({
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
          sessao_id: sessao.id,
          is_digital: false,
          origem_registro: "manual",
          pessoa_id: l.pessoaId || null,
          forma_pagamento_id: l.formaId || null,
          conta_id: l.contaId || null,
          categoria_id: l.categoriaId || null,
          valor: parseFloat((l.valor || "0").replace(",", ".")) || 0,
          descricao: `${(l.tipo || "oferta").replace(/^./, (c) =>
            c.toUpperCase(),
          )} - Culto ${format(dataCulto, "dd/MM/yyyy")}`,
          read_only: false,
          created_by: profile?.id || null,
        }))
        .filter((x) => x.valor > 0);

      // Mapeia linhas digitais
      const digitais = linhasDigitaisEx
        .map((d) => ({
          igreja_id: igrejaId,
          filial_id: !isAllFiliais ? filialId : null,
          sessao_id: sessao.id,
          is_digital: true,
          origem_registro: d.origem,
          pessoa_id: d.pessoaId || null,
          forma_pagamento_id: d.formaId || null,
          conta_id: d.contaId || null,
          categoria_id: d.categoriaId || null,
          valor: parseFloat((d.valor || "0").replace(",", ".")) || 0,
          descricao: `Digital (${d.origem}) - Culto ${format(
            dataCulto,
            "dd/MM/yyyy",
          )}`,
          read_only: !!d.readOnly,
          created_by: profile?.id || null,
        }))
        .filter((x) => x.valor > 0);

      const payload = [...fisicos, ...digitais];
      if (payload.length === 0) {
        toast.info("Nada para salvar como rascunho.");
        return;
      }
      const { error } = await supabase
        .from("sessoes_itens_draft")
        .insert(payload);
      if (error) throw error;
      setSessaoAtual(sessao);
      toast.success("Rascunho salvo com sucesso.");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Falha ao salvar rascunho", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Carregar rascunho da sessão (se existir)
  const carregarRascunho = async (sessaoId: string) => {
    try {
      const { data, error } = await supabase
        .from("sessoes_itens_draft")
        .select("*, formas_pagamento:forma_pagamento_id(id, is_digital)")
        .eq("sessao_id", sessaoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const fisicos = (data || []).filter((x: any) => !x.is_digital);
      const digitais = (data || []).filter((x: any) => !!x.is_digital);

      setLinhas(
        fisicos.map((x: any) => ({
          id: crypto.randomUUID(),
          formaId: x.forma_pagamento_id || "",
          contaId: x.conta_id || undefined,
          valor: Number(x.valor || 0)
            .toFixed(2)
            .replace(".", ","),
          pessoaId: x.pessoa_id || null,
          tipo: undefined,
          categoriaId: x.categoria_id || null,
        })),
      );
      setLinhasDigitaisEx(
        digitais.map((x: any) => ({
          id: crypto.randomUUID(),
          pessoaId: x.pessoa_id || null,
          formaId: x.forma_pagamento_id || undefined,
          contaId: x.conta_id || undefined,
          categoriaId: x.categoria_id || null,
          valor: Number(x.valor || 0)
            .toFixed(2)
            .replace(".", ","),
          origem: x.origem_registro || "manual",
          readOnly: !!x.read_only,
        })),
      );
    } catch (e) {
      console.warn("Falha ao carregar rascunho da sessão", e);
    }
  };

  // Quando abrirmos/definirmos a sessão, tenta carregar rascunho
  useEffect(() => {
    if (sessaoAtual?.id) {
      carregarRascunho(sessaoAtual.id);
    }
  }, [sessaoAtual?.id]);

  const enviarRelatorio = async () => {
    const linhasValidas = linhas.filter(
      (linha) => parseFloat(linha.valor.replace(",", ".")) > 0,
    );

    if (linhasValidas.length === 0) return;

    setLoading(true);

    try {
      const total = calcularTotal();
      const valoresAgrupados: Record<string, number> = {};
      const linhasEnriquecidas = linhasValidas.map((linha) => {
        const forma = formasPagamento?.find((f) => f.id === linha.formaId);
        const contaNome =
          mapeamentosPorForma[linha.formaId]?.find(
            (m) => m.contaId === linha.contaId,
          )?.contaNome || "Conta não mapeada";
        const valorNum = parseFloat(linha.valor.replace(",", ".")) || 0;
        if (forma) {
          valoresAgrupados[linha.formaId] =
            (valoresAgrupados[linha.formaId] || 0) + valorNum;
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
        .map(
          (l) =>
            `${l.formaNome || "Forma"} → ${l.contaNome}: R$ ${l.valor.toFixed(
              2,
            )}`,
        )
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
            "dd/MM/yyyy",
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
              Object.entries(valoresAgrupados).map(([k, v]) => [
                k,
                v.toFixed(2),
              ]),
            ),
          },
        });
      }

      // Garantir sessão de contagem disponível para este culto/período
      try {
        const dataISO = format(dataCulto, "yyyy-MM-dd");
        const sessao = await findOrOpenSessao(dataISO, periodo);
        if (sessao) setSessaoAtual(sessao);
      } catch (e) {
        console.warn("Falha ao abrir/obter sessão de contagem", e);
      }

      toast.success("Relatório enviado! Sessão de contagem aberta.");

      // Avançar para passo 3 (envio & sessão)
      setShowPreview(false);
      setStep(3);
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
    metadata: OfertaMetadata,
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
        metadata.linhas && metadata.linhas.length > 0
          ? metadata.linhas
          : Object.entries(valoresMetadata).map(([formaId, valorStr]) => {
              const valorNumerico = parseFloat(
                String(valorStr).replace(",", "."),
              );
              const contaFallback =
                contaPorFormaSelecionada[formaId] ||
                mapeamentosPorForma[formaId]?.[0]?.contaId;
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
        const valorNumerico =
          parseFloat(String(linha.valor).replace(",", ".")) || 0;
        if (valorNumerico <= 0) continue;

        const forma = formasPagamento?.find((f) => f.id === linha.formaId);
        if (!forma) continue;

        // 🎯 NOVO: Buscar conta no mapeamento dinâmico
        const mapeamentos = mapeamentosPorForma[linha.formaId];
        const contaId = linha.contaId || mapeamentos?.[0]?.contaId;
        if (!contaId) {
          toast.error(
            `Forma "${forma.nome}" não está mapeada para uma conta. ` +
              `Configure em Financas → Formas de Pagamento`,
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
          taxasAdministrativas =
            (taxasAdministrativas || 0) + taxaAdministrativaFixa;
        }

        const transacao = {
          tipo: "entrada",
          tipo_lancamento: "unico",
          descricao: `${forma.is_digital ? "Digital" : "Físico"} (${forma.nome}) - Oferta - Culto ${format(
            new Date(metadata.data_evento),
            "dd/MM/yyyy",
          )}`,
          valor: valorNumerico,
          data_vencimento: dataFormatada,
          data_competencia: dataFormatada,
          data_pagamento: dataPagamento,
          conta_id: contaId, // ✅ Agora dinâmico
          categoria_id: categoriaOferta?.id || null,
          forma_pagamento: linha.formaId,
          status: status, // ✅ Agora dinâmico
          taxas_administrativas: taxasAdministrativas, // ✅ Agora dinâmico
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
        `${transacoes.length} lançamento(s) criado(s) com sucesso!`,
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

  const findOrOpenSessao = async (
    dataEventoISO: string,
    periodoSessao: string = periodo,
    eventoId: string | null = null,
  ): Promise<SessaoContagem | null> => {
    if (!igrejaId) return null;
    // 1) Tenta localizar sessão existente (igreja/data/periodo) ignorando filial
    // para evitar 409 quando a sessão existir em outra filial ou global.
    let base = supabase
      .from("sessoes_contagem")
      .select("*")
      .eq("igreja_id", igrejaId)
      .eq("data_culto", dataEventoISO)
      .eq("periodo", periodoSessao)
      .order("created_at", { ascending: false })
      .limit(1);
    const { data: byPeriodo } = await base;
    if (byPeriodo && byPeriodo.length > 0) {
      return byPeriodo[0] as unknown as SessaoContagem;
    }

    // 2) Fallback: buscar por data sem filtrar periodo (caso antigas sessões usem outro valor, ex.: 'oferta'), ignorando filial
    let anyPeriodo = supabase
      .from("sessoes_contagem")
      .select("*")
      .eq("igreja_id", igrejaId)
      .eq("data_culto", dataEventoISO)
      .order("created_at", { ascending: false })
      .limit(1);
    const { data: existentes } = await anyPeriodo;
    if (existentes && existentes.length > 0) {
      return existentes[0] as unknown as SessaoContagem;
    }

    // 3) Se ainda não existir, tenta abrir; em caso de conflito (409), reconsulta e retorna
    try {
      const criada = await openSessaoContagem(
        igrejaId,
        !isAllFiliais ? filialId || null : null,
        new Date(dataEventoISO),
        periodoSessao,
        eventoId,
      );
      return criada;
    } catch (e: any) {
      // Log completo do erro para debug
      console.error("Erro ao abrir sessão:", e);
      console.error("Detalhes do erro:", {
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
      });

      // Em cenários de corrida/duplicidade (409), reconsultar sem filtrar período e ignorando filial
      let retry = supabase
        .from("sessoes_contagem")
        .select("*")
        .eq("igreja_id", igrejaId)
        .eq("data_culto", dataEventoISO)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: aposErro } = await retry;
      if (aposErro && aposErro.length > 0) {
        return aposErro[0] as unknown as SessaoContagem;
      }

      // Se não conseguiu abrir a sessão, mostrar erro para o usuário
      toast.error("Erro ao abrir sessão", {
        description:
          e?.message || "Não foi possível abrir a sessão de contagem",
      });
      return null;
    }
  };

  const handleSalvarMinhaContagem = async (
    valores: { oferta: number; dizimo: number; missoes: number },
    metadata?: OfertaMetadata,
  ) => {
    if (!igrejaId || !profile?.id) return;
    setMinhaContagemLoading(true);
    try {
      const dataISO = metadata?.data_evento || format(dataCulto, "yyyy-MM-dd");
      const sessao = await findOrOpenSessao(dataISO);
      if (!sessao) throw new Error("Sessão não encontrada/aberta");

      const { count } = await supabase
        .from("contagens")
        .select("id", { count: "exact", head: true })
        .eq("sessao_id", sessao.id);

      const ordem = (count || 0) + 1;
      const total =
        (valores.oferta || 0) + (valores.dizimo || 0) + (valores.missoes || 0);

      const { error: insertError } = await supabase.from("contagens").insert({
        sessao_id: sessao.id,
        contador_id: profile.id,
        ordem,
        total,
        totais_por_tipo: valores,
      });
      if (insertError) throw insertError;

      const confronto = await confrontarContagens(sessao.id);
      if (confronto) {
        const status = confronto.status;
        const variance = confronto.variance_value ?? 0;
        if (status === "validado") {
          toast.success("Contagem validada sem divergências.");
        } else if (status === "divergente") {
          toast.warning(
            `Divergência de ${new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(variance)}`,
          );
        } else {
          toast.info(`Status da sessão: ${status}`);
        }
      } else {
        toast.info("Confronto realizado.");
      }

      setShowMinhaContagem(false);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err: unknown) {
      console.error(err);
      toast.error("Falha ao salvar contagem", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setMinhaContagemLoading(false);
    }
  };

  const handleRejeitarOferta = async (
    notificationId: string,
    metadata: OfertaMetadata,
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
          "dd/MM/yyyy",
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
          <div
            className={cn(
              "flex items-center gap-2",
              step === 1 ? "font-semibold text-foreground" : "",
            )}
          >
            1. Abertura
          </div>
          <span>→</span>
          <div
            className={cn(
              "flex items-center gap-2",
              step === 2 ? "font-semibold text-foreground" : "",
            )}
          >
            2. Cofre (Físico)
          </div>
          <span>→</span>
          <div
            className={cn(
              "flex items-center gap-2",
              step === 3 ? "font-semibold text-foreground" : "",
            )}
          >
            3. Digital (Pix/Cartão)
          </div>
          <span>→</span>
          <div
            className={cn(
              "flex items-center gap-2",
              step === 4 ? "font-semibold text-foreground" : "",
            )}
          >
            4. Fechamento
          </div>
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
                <div className="md:col-span-2">
                  <EventoSelect
                    igrejaId={igrejaId!}
                    filialId={filialId}
                    isAllFiliais={isAllFiliais}
                    value={eventoSelecionado}
                    onValueChange={setEventoSelecionado}
                    onEventoSelect={(evento) => {
                      setEventoInfo(evento);
                      if (evento) {
                        setDataCulto(new Date(evento.data_evento));
                        const hora = new Date(evento.data_evento).getHours();
                        setPeriodo(hora < 12 ? "manha" : "noite");
                      }
                    }}
                  />
                </div>

                {!eventoSelecionado && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="data-culto">Data do Culto *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !dataCulto && "text-muted-foreground",
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
                      <Label htmlFor="periodo">Período *</Label>
                      <Select
                        value={periodo}
                        onValueChange={(v) => setPeriodo(v as any)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o período" />
                        </SelectTrigger>
                        <SelectContent>
                          {periodosDisponiveis.map((p) => (
                            <SelectItem key={p} value={p.toLowerCase()}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

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
                <Button
                  type="submit"
                  className="bg-gradient-primary"
                  disabled={loading}
                >
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
                <div
                  className={
                    financeiroConfig?.controla_dizimistas !== false
                      ? "grid grid-cols-6 gap-3 text-xs font-semibold text-muted-foreground px-1 mt-2"
                      : "grid grid-cols-5 gap-3 text-xs font-semibold text-muted-foreground px-1 mt-2"
                  }
                >
                  {financeiroConfig?.controla_dizimistas !== false && (
                    <span>Pessoa</span>
                  )}
                  <span>Forma</span>
                  <span>Categoria</span>
                  <span>Conta</span>
                  <span>Origem</span>
                  <span>Valor</span>
                </div>
                <div className="space-y-3">
                  {linhas.map((linha) => {
                    const formaSelecionada = formasPagamento?.find(
                      (f) => f.id === linha.formaId,
                    );
                    const mapeamentos = linha.formaId
                      ? mapeamentosPorForma[linha.formaId] || []
                      : [];
                    const temTaxa =
                      Number(formaSelecionada?.taxa_administrativa ?? 0) > 0 ||
                      Number(formaSelecionada?.taxa_administrativa_fixa ?? 0) >
                        0;
                    const taxaPercentual = Number(
                      formaSelecionada?.taxa_administrativa ?? 0,
                    );
                    const taxaFixa = Number(
                      formaSelecionada?.taxa_administrativa_fixa ?? 0,
                    );

                    return (
                      <div
                        key={linha.id}
                        className={
                          financeiroConfig?.controla_dizimistas !== false
                            ? "grid grid-cols-1 md:grid-cols-6 gap-3 items-center p-3 border rounded-lg"
                            : "grid grid-cols-1 md:grid-cols-5 gap-3 items-center p-3 border rounded-lg"
                        }
                      >
                        {financeiroConfig?.controla_dizimistas !== false && (
                          <div>
                            <PessoaCombobox
                              value={linha.pessoaId || null}
                              onChange={(v) =>
                                atualizarLinha(linha.id, { pessoaId: v })
                              }
                              placeholder="Pessoa (opcional)"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <Select
                            value={linha.formaId}
                            onValueChange={(v) =>
                              handleFormaChange(linha.id, v)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a forma" />
                            </SelectTrigger>
                            <SelectContent>
                              {(formasFisicas || formasPagamento)?.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {temTaxa && (
                            <p className="text-[11px] text-muted-foreground">
                              Taxa:{" "}
                              {taxaPercentual > 0 ? `${taxaPercentual}%` : ""}
                              {taxaPercentual > 0 && taxaFixa > 0 ? " + " : ""}
                              {taxaFixa > 0 ? `R$ ${taxaFixa.toFixed(2)}` : ""}
                            </p>
                          )}
                        </div>

                        <div>
                          <Select
                            value={
                              linha.categoriaId
                                ? `${linha.tipo || "oferta"}:${
                                    linha.categoriaId
                                  }`
                                : undefined
                            }
                            onValueChange={(v) => {
                              const [tipoSel, catId] = v.split(":");
                              atualizarLinha(linha.id, {
                                tipo: tipoSel as any,
                                categoriaId: catId,
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {tiposFisicosPermitidos.map((c: any) => {
                                const key = categoriaToTipo(c.nome || "");
                                const label = c.nome as string;
                                const value = `${key}:${c.id}`;
                                return (
                                  <SelectItem key={c.id} value={value}>
                                    {label}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          {mapeamentos.length === 0 ? (
                            <p className="text-xs text-destructive">
                              Sem conta mapeada
                            </p>
                          ) : (
                            <Select
                              value={linha.contaId || mapeamentos[0].contaId}
                              onValueChange={(v) =>
                                handleContaChange(linha.id, v)
                              }
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

                        <div className="text-xs text-muted-foreground">
                          <span>Manual</span>
                        </div>

                        <div className="flex gap-2 items-center">
                          <Input
                            id={`valor-${linha.id}`}
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={linha.valor}
                            onChange={(e) =>
                              handleValorChange(linha.id, e.target.value)
                            }
                          />
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

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={adicionarLinha}
                >
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
                      Total Físico
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {formatCurrency(calcularTotal())}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={salvarRascunho}
                    >
                      <Save className="w-4 h-4 mr-2" /> Salvar rascunho
                    </Button>
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
                      {loading ? "Salvando..." : "Avançar para Digital"}
                    </Button>
                  </div>
                </div>

                {calcularTotal() <= 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Checkbox
                      id="confirm-zero-fisico"
                      checked={confirmZeroFisico}
                      onCheckedChange={(v) => setConfirmZeroFisico(!!v)}
                    />
                    <Label
                      htmlFor="confirm-zero-fisico"
                      className="text-sm text-muted-foreground"
                    >
                      Confirmo que não houve entradas físicas (valor zerado)
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate("/financas/sessoes-contagem")}
        >
          Sessões de Contagem
        </Button>
        {step === 3 && (
          <Card className="shadow-soft">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg">Digital (Pix/Cartão)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0 space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await handleSincronizarPix();
                  }}
                  disabled={syncPixLoading}
                >
                  🔄 Sincronizar API
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const formaId =
                      formasDigitais?.[0]?.id || formasPagamento?.[0]?.id;
                    const contaDefault = formaId
                      ? mapeamentosPorForma[formaId]?.[0]?.contaId
                      : undefined;
                    const categoriaDefault =
                      categoriasDigitaisPermitidas?.[0]?.id || null;
                    setLinhasDigitaisEx((prev) => [
                      ...prev,
                      {
                        id: `${Date.now()}-${Math.random()}`,
                        pessoaId: null,
                        formaId,
                        contaId: contaDefault,
                        categoriaId: categoriaDefault,
                        valor: "",
                        origem: "manual",
                      },
                    ]);
                  }}
                >
                  ➕ Adicionar Manual
                </Button>
              </div>

              <div
                className={
                  financeiroConfig?.controla_dizimistas !== false
                    ? "grid grid-cols-6 gap-3 text-xs font-semibold text-muted-foreground px-1 mt-2"
                    : "grid grid-cols-5 gap-3 text-xs font-semibold text-muted-foreground px-1 mt-2"
                }
              >
                {financeiroConfig?.controla_dizimistas !== false && (
                  <span>Pessoa</span>
                )}
                <span>Forma</span>
                <span>Categoria</span>
                <span>Conta</span>
                <span>Origem</span>
                <span>Valor</span>
              </div>
              <div className="space-y-3">
                {linhasDigitaisEx.map((l) => (
                  <div
                    key={l.id}
                    className={
                      financeiroConfig?.controla_dizimistas !== false
                        ? "grid grid-cols-1 md:grid-cols-6 gap-3 items-center p-3 border rounded-lg"
                        : "grid grid-cols-1 md:grid-cols-5 gap-3 items-center p-3 border rounded-lg"
                    }
                  >
                    {financeiroConfig?.controla_dizimistas !== false && (
                      <div>
                        <PessoaCombobox
                          value={l.pessoaId || null}
                          onChange={(v) =>
                            setLinhasDigitaisEx((prev) =>
                              prev.map((it) =>
                                it.id === l.id ? { ...it, pessoaId: v } : it,
                              ),
                            )
                          }
                          placeholder="Pessoa (opcional)"
                        />
                      </div>
                    )}
                    <div>
                      <Select
                        value={l.formaId || ""}
                        disabled={!!l.readOnly}
                        onValueChange={(v) => {
                          const contaDefault = v
                            ? mapeamentosPorForma[v]?.[0]?.contaId
                            : undefined;
                          setLinhasDigitaisEx((prev) =>
                            prev.map((it) =>
                              it.id === l.id
                                ? { ...it, formaId: v, contaId: contaDefault }
                                : it,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a forma" />
                        </SelectTrigger>
                        <SelectContent>
                          {(formasDigitais || formasPagamento)?.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Select
                        value={
                          l.categoriaId || categoriasDigitaisPermitidas?.[0]?.id
                        }
                        onValueChange={(v) =>
                          setLinhasDigitaisEx((prev) =>
                            prev.map((it) =>
                              it.id === l.id ? { ...it, categoriaId: v } : it,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriasDigitaisPermitidas.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      {(() => {
                        const mapeamentos = l.formaId
                          ? mapeamentosPorForma[l.formaId] || []
                          : [];
                        if (mapeamentos.length === 0) {
                          return (
                            <p className="text-xs text-destructive">
                              Sem conta mapeada
                            </p>
                          );
                        }
                        return (
                          <Select
                            value={l.contaId || mapeamentos[0].contaId}
                            disabled={!!l.readOnly}
                            onValueChange={(v) =>
                              setLinhasDigitaisEx((prev) =>
                                prev.map((it) =>
                                  it.id === l.id ? { ...it, contaId: v } : it,
                                ),
                              )
                            }
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
                        );
                      })()}
                    </div>
                    <div>
                      <span className="text-xs">{l.origem.toUpperCase()}</span>
                    </div>
                    <div>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={l.valor}
                        disabled={l.readOnly}
                        onChange={(e) =>
                          setLinhasDigitaisEx((prev) =>
                            prev.map((it) =>
                              it.id === l.id
                                ? {
                                    ...it,
                                    valor: sanitizeMoneyInput(e.target.value),
                                  }
                                : it,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between flex-col sm:flex-row gap-3 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Digital
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {formatCurrency(
                      linhasDigitaisEx.reduce(
                        (sum, l) =>
                          sum +
                          (parseFloat((l.valor || "0").replace(",", ".")) || 0),
                        0,
                      ),
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={salvarRascunho}
                  >
                    <Save className="w-4 h-4 mr-2" /> Salvar rascunho
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    className="bg-gradient-primary"
                    onClick={() => setStep(4)}
                  >
                    Avançar para Fechamento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="shadow-soft">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-lg">Fechamento & Resumo</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">Data do culto</div>
                <div className="font-medium">
                  {format(dataCulto, "dd/MM/yyyy")}
                </div>
                <div className="text-muted-foreground">Período</div>
                <div className="font-medium">
                  {periodo?.charAt(0).toUpperCase() + periodo?.slice(1)}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 border rounded">
                  <p className="text-sm text-muted-foreground">Físico</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(calcularTotal())}
                  </p>
                </div>
                <div className="p-3 border rounded">
                  <p className="text-sm text-muted-foreground">Digital</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(calcularTotalDigital())}
                  </p>
                </div>
                <div className="p-3 border rounded">
                  <p className="text-sm text-muted-foreground">Total Geral</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(calcularTotal() + calcularTotalDigital())}
                  </p>
                </div>
              </div>

              {sessaoAtual && (
                <div className="p-3 border rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Conferência Cega</p>
                    <span className="text-xs text-muted-foreground">
                      {confrontoLoading
                        ? "Carregando..."
                        : confrontoStatus
                          ? `Status: ${confrontoStatus}`
                          : "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        Tolerância
                      </p>
                      <p className="text-sm font-medium">
                        {formatCurrency(Number(blindTolerance ?? 0))}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        Comparação
                      </p>
                      <p className="text-sm font-medium">
                        {blindCompareLevel === "tipo" ? "Por Tipo" : "Total"}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        Desvio Total
                      </p>
                      <p className="text-sm font-medium">
                        {formatCurrency(Number(confrontoVariance ?? 0))}
                      </p>
                    </div>
                  </div>
                  {blindCompareLevel === "tipo" && confrontoPorTipo && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {(["oferta", "dizimo", "missoes"] as const).map((k) => {
                        const v = Number((confrontoPorTipo as any)[k] ?? 0);
                        const ok =
                          blindTolerance != null
                            ? Math.abs(v) <= Number(blindTolerance)
                            : undefined;
                        return (
                          <div
                            key={k}
                            className={`p-2 rounded border ${
                              ok === undefined
                                ? ""
                                : ok
                                  ? "border-green-300 bg-green-50"
                                  : "border-amber-300 bg-amber-50"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {k.charAt(0).toUpperCase() + k.slice(1)}
                              </span>
                              {ok !== undefined && (
                                <span
                                  className={`font-medium ${
                                    ok ? "text-green-600" : "text-amber-600"
                                  }`}
                                >
                                  {ok ? "OK" : "Divergente"}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium">
                              {formatCurrency(v)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(3)}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="bg-gradient-primary"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      if (!igrejaId) throw new Error("Igreja não identificada");
                      const dataISO = format(dataCulto, "yyyy-MM-dd");
                      const sessao =
                        sessaoAtual || (await findOrOpenSessao(dataISO));
                      // Categorias por tipo
                      const getCategoriaId = async (tipoNome: string) => {
                        let q = supabase
                          .from("categorias_financeiras")
                          .select("id")
                          .eq("tipo", "entrada")
                          .ilike("nome", `%${tipoNome}%`)
                          .eq("igreja_id", igrejaId)
                          .limit(1);
                        if (!isAllFiliais && filialId)
                          q = q.eq("filial_id", filialId);
                        const { data } = await q.maybeSingle();
                        return data?.id || null;
                      };
                      const catOferta = await getCategoriaId("oferta");
                      const catDizimo = await getCategoriaId("dizimo");
                      const catMissoes = await getCategoriaId("missoes");
                      // Prefere IDs das categorias carregadas (permitidas), se disponíveis
                      const idOfertaCfg =
                        tiposFisicosPermitidos.find((c: any) =>
                          (c.nome || "").toLowerCase().includes("oferta"),
                        )?.id || catOferta;
                      const idDizimoCfg =
                        tiposFisicosPermitidos.find((c: any) =>
                          (c.nome || "").toLowerCase().includes("diz"),
                        )?.id || catDizimo;
                      const idMissoesCfg =
                        tiposFisicosPermitidos.find((c: any) =>
                          (c.nome || "").toLowerCase().includes("miss"),
                        )?.id || catMissoes;

                      const fisicoTransacoes: any[] = [];
                      for (const l of linhas) {
                        const valorNumerico =
                          parseFloat(l.valor.replace(",", ".")) || 0;
                        if (valorNumerico <= 0) continue;
                        const forma = formasPagamento?.find(
                          (f) => f.id === l.formaId,
                        );
                        if (!forma) continue;
                        const contaMap = mapeamentosPorForma[l.formaId];
                        const contaId =
                          l.contaId || contaMap?.[0]?.contaId || null;
                        const categoriaId =
                          l.categoriaId ||
                          (l.tipo === "dizimo"
                            ? idDizimoCfg
                            : l.tipo === "missoes"
                              ? idMissoesCfg
                              : idOfertaCfg);
                        const taxaPercent = Number(
                          forma.taxa_administrativa || 0,
                        );
                        const taxaFixa = Number(
                          forma.taxa_administrativa_fixa || 0,
                        );
                        let taxasAdministrativas: number | null = null;
                        if (taxaPercent > 0)
                          taxasAdministrativas =
                            valorNumerico * (taxaPercent / 100);
                        if (taxaFixa > 0)
                          taxasAdministrativas =
                            (taxasAdministrativas || 0) + taxaFixa;
                        fisicoTransacoes.push({
                          tipo: "entrada",
                          tipo_lancamento: "unico",
                          descricao: `Físico (${forma?.nome || "N/A"}) - ${
                            (l.tipo || "Oferta").charAt(0).toUpperCase() +
                            (l.tipo || "oferta").slice(1)
                          } - Culto ${format(dataCulto, "dd/MM/yyyy")}`,
                          valor: valorNumerico,
                          data_vencimento: format(dataCulto, "yyyy-MM-dd"),
                          data_competencia: format(dataCulto, "yyyy-MM-dd"),
                          data_pagamento: format(dataCulto, "yyyy-MM-dd"),
                          conta_id: contaId,
                          categoria_id: categoriaId,
                          forma_pagamento: l.formaId,
                          status: "pago",
                          taxas_administrativas: taxasAdministrativas,
                          observacoes: `Lançado por: ${profile?.nome}`,
                          lancado_por: profile?.user_id,
                          igreja_id: igrejaId,
                          filial_id: !isAllFiliais ? filialId : null,
                          pessoa_id: l.pessoaId || null,
                          origem_registro: "manual",
                        });
                      }

                      // Categoria digital preferida via config (tipos_permitidos_digital)
                      const idDigitalCfg =
                        Array.isArray(
                          (financeiroConfig as any)?.tipos_permitidos_digital,
                        ) &&
                        (financeiroConfig as any).tipos_permitidos_digital
                          .length > 0
                          ? (financeiroConfig as any)
                              .tipos_permitidos_digital[0]
                          : catOferta;

                      const digitaisTransacoes: any[] = [];
                      for (const d of linhasDigitaisEx) {
                        const valorNumerico =
                          parseFloat(d.valor.replace(",", ".")) || 0;
                        if (valorNumerico <= 0) continue;
                        const forma = formasPagamento?.find(
                          (f) => f.id === d.formaId,
                        );
                        const contaMap = d.formaId
                          ? mapeamentosPorForma[d.formaId]
                          : [];
                        const contaId =
                          d.contaId || contaMap?.[0]?.contaId || null;
                        digitaisTransacoes.push({
                          tipo: "entrada",
                          tipo_lancamento: "unico",
                          descricao: `Digital (${forma?.nome || "N/A"}) - Culto ${format(
                            dataCulto,
                            "dd/MM/yyyy",
                          )}`,
                          valor: valorNumerico,
                          data_vencimento: format(dataCulto, "yyyy-MM-dd"),
                          data_competencia: format(dataCulto, "yyyy-MM-dd"),
                          data_pagamento: format(dataCulto, "yyyy-MM-dd"),
                          conta_id: contaId,
                          categoria_id: d.categoriaId || idDigitalCfg,
                          forma_pagamento: d.formaId,
                          status: "pago",
                          taxas_administrativas: forma
                            ? Number(forma.taxa_administrativa || 0) > 0
                              ? valorNumerico *
                                (Number(forma.taxa_administrativa) / 100)
                              : null
                            : null,
                          observacoes: `Digital (${d.origem})`,
                          lancado_por: profile?.user_id,
                          igreja_id: igrejaId,
                          filial_id: !isAllFiliais ? filialId : null,
                          pessoa_id: d.pessoaId || null,
                          origem_registro: d.origem,
                        });
                      }

                      const todas = [
                        ...fisicoTransacoes,
                        ...digitaisTransacoes,
                      ];
                      if (todas.length === 0) {
                        toast.error("Nada a lançar");
                        setLoading(false);
                        return;
                      }

                      // Anexa sessão ao lançamento para consulta posterior
                      const payload = todas.map((t) => ({
                        ...t,
                        sessao_id: sessao?.id || null,
                      }));

                      const { error } = await supabase
                        .from("transacoes_financeiras")
                        .insert(payload);
                      if (error) throw error;

                      // Limpa rascunho ao encerrar
                      if (sessao?.id) {
                        await supabase
                          .from("sessoes_itens_draft")
                          .delete()
                          .eq("sessao_id", sessao.id);

                        // Marca sessão como finalizada
                        await finalizarSessao(sessao.id);
                      }
                      toast.success(`${todas.length} lançamento(s) criado(s)!`);
                      queryClient.invalidateQueries({
                        queryKey: ["sessoes-contagem"],
                      });
                      setStep(1);
                      setLinhas([]);
                      setLinhasDigitaisEx([]);
                    } catch (err: any) {
                      console.error(err);
                      toast.error("Erro ao encerrar e lançar", {
                        description: err?.message || String(err),
                      });
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Encerrar e Lançar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>

      <ResponsiveDialog open={showPreview} onOpenChange={setShowPreview}>
        <div className="flex flex-col h-full">
          <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Revisar e Enviar
            </h2>
            <p className="text-sm text-muted-foreground">
              Confirme os lançamentos físicos antes de avançar
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-muted-foreground">Data do culto</div>
              <div className="font-medium">
                {format(dataCulto, "dd/MM/yyyy")}
              </div>
              <div className="text-muted-foreground">Conferente</div>
              <div className="font-medium">
                {pessoas?.find((p) => p.id === conferenteId)?.nome || ""}
              </div>
            </div>

            <div className="border rounded-lg">
              <div
                className={
                  financeiroConfig?.controla_dizimistas !== false
                    ? "grid grid-cols-4 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground"
                    : "grid grid-cols-3 gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground"
                }
              >
                <span>Forma</span>
                <span>Conta</span>
                {financeiroConfig?.controla_dizimistas !== false && (
                  <span>Membro</span>
                )}
                <span className="text-right">Valor</span>
              </div>
              <div className="divide-y">
                {linhas
                  .filter(
                    (linha) => parseFloat(linha.valor.replace(",", ".")) > 0,
                  )
                  .map((linha) => {
                    const formaNome =
                      formasPagamento?.find((f) => f.id === linha.formaId)
                        ?.nome || "Forma";
                    const contaNome =
                      mapeamentosPorForma[linha.formaId]?.find(
                        (m) => m.contaId === linha.contaId,
                      )?.contaNome || "Conta";
                    const pessoaNome =
                      (pessoas || []).find((p) => p.id === linha.pessoaId)
                        ?.nome || "-";
                    return (
                      <div
                        key={linha.id}
                        className={
                          financeiroConfig?.controla_dizimistas !== false
                            ? "grid grid-cols-4 gap-2 px-3 py-2 text-sm items-center"
                            : "grid grid-cols-3 gap-2 px-3 py-2 text-sm items-center"
                        }
                      >
                        <span>{formaNome}</span>
                        <span className="truncate" title={contaNome}>
                          {contaNome}
                        </span>
                        {financeiroConfig?.controla_dizimistas !== false && (
                          <span className="truncate" title={pessoaNome}>
                            {pessoaNome}
                          </span>
                        )}
                        <span className="text-right font-medium">
                          {formatCurrency(
                            parseFloat(linha.valor.replace(",", ".")) || 0,
                          )}
                        </span>
                      </div>
                    );
                  })}
              </div>
              <div className="flex justify-between items-center px-3 py-3 bg-muted/50">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(calcularTotal())}
                </span>
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
              {loading ? "Salvando..." : "Confirmar Físico"}
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

              const valoresAgrupados =
                metadata.linhas && metadata.linhas.length > 0
                  ? metadata.linhas.reduce(
                      (acc, linha) => {
                        const valorNum = Number(linha.valor) || 0;
                        if (valorNum <= 0) return acc;
                        const formaNome =
                          linha.formaNome ||
                          formasPagamento?.find((f) => f.id === linha.formaId)
                            ?.nome ||
                          "Forma";
                        const atual = acc[linha.formaId] || {
                          nome: formaNome,
                          valor: 0,
                        };
                        acc[linha.formaId] = {
                          nome: atual.nome,
                          valor: atual.valor + valorNum,
                        };
                        return acc;
                      },
                      {} as Record<string, { nome: string; valor: number }>,
                    )
                  : Object.entries(valoresObj).reduce(
                      (acc, [id, valorStr]: [string, string]) => {
                        const valorNumerico = parseFloat(
                          String(valorStr).replace(",", "."),
                        );
                        if (valorNumerico > 0) {
                          const forma = formasPagamento?.find(
                            (f) => f.id === id,
                          );
                          if (forma) {
                            acc[id] = {
                              nome: forma.nome,
                              valor: valorNumerico,
                            };
                          }
                        }
                        return acc;
                      },
                      {} as Record<string, { nome: string; valor: number }>,
                    );

              const dadosConferencia = {
                dataCulto: new Date(metadata.data_evento),
                valores: valoresAgrupados,
                total:
                  total ||
                  Object.values(valoresAgrupados).reduce(
                    (s, v) => s + v.valor,
                    0,
                  ),
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowMinhaContagem(true)}
                    >
                      Minha Contagem
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
                    <MinhaContagemDialog
                      open={showMinhaContagem}
                      onOpenChange={setShowMinhaContagem}
                      defaultValores={{ oferta: metadata.total || 0 }}
                      onSubmit={(vals) =>
                        handleSalvarMinhaContagem(vals, metadata)
                      }
                      loading={minhaContagemLoading}
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
