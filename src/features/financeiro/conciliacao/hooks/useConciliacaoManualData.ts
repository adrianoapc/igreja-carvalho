import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { formatLocalDate } from "@/utils/dateUtils";
import {
  marcarExtratoIgnorado,
  FILTRO_EXCLUI_ESPELHO_GETNET,
} from "@/features/financeiro/core/api/extratos.api";
import {
  gerarCandidatosConciliacao,
  listarExtratosSemCandidato,
} from "@/features/financeiro/core/api/conciliacao.api";
import { toast } from "sonner";
import type {
  ExtratoItem,
  TransacaoConciliacao,
  ContaConciliacao,
} from "../model/types";
import type { AutoReconciliarCandidato } from "./useAutoReconciliar";

const ITEMS_PER_PAGE = 15;

/**
 * Dados/filtros/paginação da tela Conciliação Manual (Modo Clássico) — F7
 * sub-frente 2/5. Query keys "transacoes-conciliacao"/"transacoes-ja-
 * vinculadas"/"contas-conciliacao" preservadas do arquivo original —
 * "transacoes-conciliacao" é invalidada também pela ConciliacaoInteligente
 * ao marcar conferência manual.
 *
 * Ciclo 2 (C2-1): a aba "Por Extrato" passou de "tudo reconciliado=false" pra
 * estado derivado — só o que sobrou depois dos motores Cartão e Inteligente
 * (`extratosSemCandidato`, via `fin_listar_extratos_sem_candidato`). A query
 * bruta antiga (`extratosBrutos`) continua existindo só para uso interno:
 * lookup de nome/valor no resultado do "Reconciliar Automático".
 */
export function useConciliacaoManualData() {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();

  // Date filter state - start with previous month since current month often has no data yet
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  // Extrato tab state
  const [selectedContaId, setSelectedContaId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [origemFiltro, setOrigemFiltro] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Transacao tab state
  const [transacaoSearchTerm, setTransacaoSearchTerm] = useState("");
  const [transacaoPage, setTransacaoPage] = useState(1);
  const [transacaoContaFilter, setTransacaoContaFilter] = useState<string>("all");
  const [transacaoTipoFilter, setTransacaoTipoFilter] = useState<string>("all");
  const [transacaoOrigemFilter, setTransacaoOrigemFilter] = useState<string>("all");

  const { dataInicio, dataFim } = useMemo(() => {
    if (customRange) {
      return {
        dataInicio: formatLocalDate(customRange.from),
        dataFim: formatLocalDate(customRange.to),
      };
    }
    const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    return {
      dataInicio: formatLocalDate(startOfMonth),
      dataFim: formatLocalDate(endOfMonth),
    };
  }, [selectedMonth, customRange]);

  const { data: contas } = useQuery<ContaConciliacao[]>({
    queryKey: ["contas-conciliacao", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);
      // Filial compartilhada (filial_id NULL) precisa continuar visível com
      // uma filial concreta selecionada — .eq() puro a esconderia (guardrail
      // financeiro). Achado/corrigido na C2-1: esta lista virou base do nome
      // de conta exibido em `extratosSemCandidato` e da varredura de contas
      // do "Reconciliar Automático" — antes só alimentava um dropdown.
      if (!isAllFiliais && filialId) {
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Extratos SEM candidato dos motores Cartão e Inteligente — a lista que a
  // aba "Por Extrato" realmente mostra (Ciclo 2, C2-1: Modo Clássico como
  // estado derivado, não mais "tudo que está reconciliado=false"). Busca
  // independente de `contas` de propósito (não entra no `enabled`/queryFn) —
  // acoplar as duas faria essa query ficar `enabled:false` (isLoading=false,
  // não "carregando") enquanto `contas` ainda não resolveu, piscando o banner
  // de "tudo conciliado" antes do dado real chegar. Nome da conta é anexado
  // depois, em `extratosSemCandidatoComConta`.
  const {
    data: extratosSemCandidatoBruto,
    isLoading: loadingExtratos,
    refetch: refetchExtratosSemCandidato,
  } = useQuery<Omit<ExtratoItem, "contas">[]>({
    queryKey: [
      "extratos-sem-candidato",
      igrejaId,
      filialId,
      isAllFiliais,
      selectedContaId,
      dataInicio,
      dataFim,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      const rows = await listarExtratosSemCandidato({
        contaId: selectedContaId !== "all" ? selectedContaId : null,
        periodoInicio: dataInicio,
        periodoFim: dataFim,
        filialId: isAllFiliais ? null : filialId,
      });
      return rows.map((r) => ({
        id: r.extrato_id,
        conta_id: r.conta_id,
        data_transacao: r.data_transacao,
        descricao: r.descricao,
        valor: Number(r.valor),
        tipo: r.tipo,
        reconciliado: false,
        transacao_vinculada_id: null,
        origem: r.origem,
        possivel_duplicata_de: r.possivel_duplicata_de,
        motivo: r.motivo,
      }));
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Extratos pendentes BRUTOS (sem excluir os que já têm candidato) — só pra
  // uso interno: (1) exibir descrição/valor no resultado do "Reconciliar
  // Automático" mesmo quando o item conciliado não aparece mais na lista
  // derivada acima (ele tinha candidato, por isso sumiu de lá); (2) contagem
  // de "pendentes" pro dialog de resultado. Mesmo filtro de conta que a
  // aba usa — sem isso, "Reconciliar Automático" com uma conta selecionada
  // mostraria contagem de TODAS as contas, não só a filtrada. NÃO é o que a
  // aba "Por Extrato" renderiza.
  const { data: extratosBrutos, refetch: refetchExtratosBrutos } = useQuery<
    ExtratoItem[]
  >({
    queryKey: [
      "extratos-pendentes-brutos",
      igrejaId,
      filialId,
      isAllFiliais,
      selectedContaId,
      dataInicio,
      dataFim,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("extratos_bancarios")
        .select("*, contas(nome)")
        .eq("igreja_id", igrejaId)
        .eq("reconciliado", false)
        .is("transacao_vinculada_id", null)
        .gte("data_transacao", dataInicio)
        .lte("data_transacao", dataFim)
        // C2-8: espelho sintético do próprio Getnet nunca terá candidato
        // real (C2-7/motor F4 já rejeitam ele) — mesmo filtro já aplicado
        // em HistoricoExtratos.tsx/useConciliacaoInteligente.ts.
        .or(FILTRO_EXCLUI_ESPELHO_GETNET)
        .order("data_transacao", { ascending: false });
      // Sem .limit() de propósito (achado do code-review C2-1): esta lista
      // alimenta a contagem "pendentes" do dialog de resultado e a varredura
      // de contas do auto-reconciliar — um teto aqui divergiria da contagem
      // de `extratosSemCandidato` (a RPC não tem teto) e faria o
      // auto-reconciliar pular contas cujo único pendente cai fora do corte.

      if (!isAllFiliais && filialId) {
        // Filial compartilhada (filial_id NULL) precisa continuar visível —
        // mesma correção aplicada em `contas` e na RPC nesta mesma fase
        // (achado do code-review: esta query ficou .eq() puro pra trás).
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }
      if (selectedContaId !== "all") {
        query = query.eq("conta_id", selectedContaId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ExtratoItem[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Anexa nome da conta depois de buscada — desacoplado da query original de
  // propósito (evita a race de loading comentada acima). Prioriza o nome já
  // embutido em `extratosBrutos` (join SQL real via `contas(nome)`, sem
  // filtro de conta ativa) — `contas` (a lista usada no dropdown de filtro)
  // só teria conta ATIVA, então uma conta desativada com extrato pendente
  // ficaria sem nome se essa fosse a única fonte (achado do code-review).
  const extratosSemCandidato = useMemo<ExtratoItem[]>(() => {
    if (!extratosSemCandidatoBruto) return [];
    const contaNomeById = new Map<string, string>();
    for (const c of contas ?? []) contaNomeById.set(c.id, c.nome);
    for (const e of extratosBrutos ?? []) {
      if (e.contas?.nome) contaNomeById.set(e.conta_id, e.contas.nome);
    }
    return extratosSemCandidatoBruto.map((e) => ({
      ...e,
      contas: contaNomeById.has(e.conta_id)
        ? { nome: contaNomeById.get(e.conta_id)! }
        : null,
    }));
  }, [extratosSemCandidatoBruto, extratosBrutos, contas]);

  const refetchExtratos = () => {
    refetchExtratosSemCandidato();
    refetchExtratosBrutos();
  };

  const { data: transacoes, isLoading: loadingTransacoes } = useQuery<
    TransacaoConciliacao[]
  >({
    queryKey: ["transacoes-conciliacao", igrejaId, filialId, isAllFiliais, dataInicio, dataFim],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          "id, descricao, valor, tipo, data_pagamento, data_vencimento, status, conciliacao_status, conta_id, origem_registro, contas:conta_id(nome), categorias_financeiras(nome)",
        )
        .eq("igreja_id", igrejaId)
        // Inclui PENDENTES (casadas por data_vencimento): o motor F4 e
        // fin_confirmar_conciliacao baixam pendente→pago na conciliação, então a
        // lista/rotulagem precisa enxergá-las — pago casa por data_pagamento.
        .or(
          `and(status.eq.pago,data_pagamento.gte.${dataInicio},data_pagamento.lte.${dataFim}),` +
            `and(status.eq.pendente,data_vencimento.gte.${dataInicio},data_vencimento.lte.${dataFim})`,
        )
        .order("data_pagamento", { ascending: false, nullsFirst: false })
        .limit(500);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TransacaoConciliacao[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch transaction IDs that are already reconciled (via any method)
  const { data: transacoesJaVinculadas } = useQuery({
    queryKey: ["transacoes-ja-vinculadas", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return new Set<string>();

      const { data: vinculadas1to1 } = await supabase
        .from("extratos_bancarios")
        .select("transacao_vinculada_id")
        .eq("igreja_id", igrejaId)
        .not("transacao_vinculada_id", "is", null);

      const { data: lotes } = await supabase
        .from("conciliacoes_lote")
        .select("transacao_id")
        .eq("igreja_id", igrejaId);

      const { data: divisoes } = await supabase
        .from("conciliacoes_divisao_transacoes")
        .select("transacao_id");

      const ids = new Set<string>();
      vinculadas1to1?.forEach((e) => e.transacao_vinculada_id && ids.add(e.transacao_vinculada_id));
      lotes?.forEach((l) => l.transacao_id && ids.add(l.transacao_id));
      divisoes?.forEach((d) => d.transacao_id && ids.add(d.transacao_id));

      return ids;
    },
    enabled: !igrejaLoading && !!igrejaId,
  });

  const extratosFiltrados = useMemo(() => {
    if (!extratosSemCandidato) return [];
    return extratosSemCandidato.filter((e) => {
      // NÃO filtra CONTAMAX aqui (diferente de HistoricoExtratos.tsx/
      // ExtratoPreviewDialog.tsx/useConciliacaoLote.ts, onde o objetivo é
      // não oferecer a linha como candidata a match de uma transação real).
      // Modo Clássico é o destino final dessas linhas — a RPC já rotula
      // com motivo `aplicacao_financeira_automatica` (20260817); escondê-las
      // aqui as tornava invisíveis mesmo já classificadas (achado do review
      // do PR #112, commit 7f64e33f).
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !e.descricao.toLowerCase().includes(search) &&
          !e.contas?.nome?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (tipoFiltro !== "all") {
        const tipoNormalizado =
          e.tipo?.toLowerCase() === "credit"
            ? "credito"
            : e.tipo?.toLowerCase() === "debit"
              ? "debito"
              : e.tipo?.toLowerCase();
        if (tipoNormalizado !== tipoFiltro) return false;
      }
      if (origemFiltro !== "all" && e.origem !== origemFiltro) return false;
      return true;
    });
  }, [extratosSemCandidato, searchTerm, tipoFiltro, origemFiltro]);

  const transacoesPendentes = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t) => {
      if (transacoesJaVinculadas?.has(t.id)) return false;
      if (t.conciliacao_status && t.conciliacao_status !== "nao_conciliado") return false;

      if (transacaoSearchTerm) {
        const search = transacaoSearchTerm.toLowerCase();
        if (
          !t.descricao.toLowerCase().includes(search) &&
          !t.categorias_financeiras?.nome.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (transacaoContaFilter !== "all" && t.conta_id !== transacaoContaFilter) return false;
      if (transacaoTipoFilter !== "all" && t.tipo !== transacaoTipoFilter) return false;
      if (transacaoOrigemFilter !== "all") {
        const origem = (t.origem_registro || "manual").toLowerCase();
        if (origem !== transacaoOrigemFilter) return false;
      }
      return true;
    });
  }, [
    transacoes,
    transacaoSearchTerm,
    transacoesJaVinculadas,
    transacaoContaFilter,
    transacaoTipoFilter,
    transacaoOrigemFilter,
  ]);

  // Reset pages on filter change — ajuste de estado durante o render (padrão
  // recomendado pelo React pra "resetar estado quando outra coisa muda", sem
  // useEffect: https://react.dev/learn/you-might-not-need-an-effect). Achado
  // do lint ao tocar este arquivo na C2-1 — useMemo/useEffect com setState
  // direto no corpo são ambos flagados pela config atual.
  const extratoFiltrosKey = `${searchTerm}|${selectedContaId}|${tipoFiltro}|${origemFiltro}`;
  const [prevExtratoFiltrosKey, setPrevExtratoFiltrosKey] = useState(extratoFiltrosKey);
  if (extratoFiltrosKey !== prevExtratoFiltrosKey) {
    setPrevExtratoFiltrosKey(extratoFiltrosKey);
    setCurrentPage(1);
  }

  const transacaoFiltrosKey = `${transacaoSearchTerm}|${transacaoContaFilter}|${transacaoTipoFilter}|${transacaoOrigemFilter}`;
  const [prevTransacaoFiltrosKey, setPrevTransacaoFiltrosKey] = useState(transacaoFiltrosKey);
  if (transacaoFiltrosKey !== prevTransacaoFiltrosKey) {
    setPrevTransacaoFiltrosKey(transacaoFiltrosKey);
    setTransacaoPage(1);
  }

  const totalPages = Math.ceil(extratosFiltrados.length / ITEMS_PER_PAGE);
  const paginatedExtratos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return extratosFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [extratosFiltrados, currentPage]);

  const transacaoTotalPages = Math.ceil(transacoesPendentes.length / ITEMS_PER_PAGE);
  const paginatedTransacoes = useMemo(() => {
    const start = (transacaoPage - 1) * ITEMS_PER_PAGE;
    return transacoesPendentes.slice(start, start + ITEMS_PER_PAGE);
  }, [transacoesPendentes, transacaoPage]);

  const handleIgnorar = async (extratoId: string) => {
    try {
      await marcarExtratoIgnorado(extratoId, true);
      toast.success("Extrato marcado como ignorado");
      refetchExtratos();
    } catch (err) {
      console.error("Exceção ao ignorar:", err);
      toast.error("Erro ao ignorar extrato");
    }
  };

  const invalidarAposVinculo = () => {
    refetchExtratos();
    queryClient.invalidateQueries({ queryKey: ["transacoes-conciliacao"] });
    queryClient.invalidateQueries({ queryKey: ["transacoes-ja-vinculadas"] });
  };

  /**
   * Candidatos 1:1 do motor único, por conta, para o "Reconciliar Automático".
   * Varre as contas de `extratosBrutos` (pendentes sem excluir quem já tem
   * candidato, já respeitando `selectedContaId`) — não `contas` (varreria
   * contas ativas sem nenhum pendente, N chamadas desperdiçadas) nem
   * `extratosSemCandidato` (desde C2-1 essa lista já exclui quem tem
   * candidato, que é justamente quem esta função busca e aplica
   * automaticamente; usar aquela lista faria pular contas "consumidas").
   */
  const buscarCandidatosAutoReconciliar = async (): Promise<
    AutoReconciliarCandidato[]
  > => {
    if (!extratosBrutos || extratosBrutos.length === 0) return [];
    const contaIds = [...new Set(extratosBrutos.map((e) => e.conta_id))];
    const out: AutoReconciliarCandidato[] = [];
    for (const contaId of contaIds) {
      try {
        const rows = await gerarCandidatosConciliacao({
          contaId,
          periodoInicio: dataInicio,
          periodoFim: dataFim,
          filialId: isAllFiliais ? null : filialId,
        });
        for (const r of rows) {
          if (r.tipo_match === "1:1" && r.transacao_ids.length === 1) {
            out.push({
              extrato_id: r.extrato_id,
              transacao_id: r.transacao_ids[0],
              score: r.score,
            });
          }
        }
      } catch (err) {
        console.error("Erro ao gerar candidatos:", err);
      }
    }
    return out;
  };

  const obterExtrato = (id: string) =>
    extratosBrutos?.find((e) => e.id === id) ??
    extratosSemCandidato?.find((e) => e.id === id);
  const obterTransacao = (id: string) => {
    const t = transacoes?.find((tx) => tx.id === id);
    return t ? { descricao: t.descricao, valor: Number(t.valor) } : undefined;
  };

  return {
    // month/date filter
    selectedMonth,
    setSelectedMonth,
    customRange,
    setCustomRange,
    // extrato tab
    contas,
    selectedContaId,
    setSelectedContaId,
    searchTerm,
    setSearchTerm,
    tipoFiltro,
    setTipoFiltro,
    origemFiltro,
    setOrigemFiltro,
    extratosFiltrados,
    /** Contagem residual SEM filtros client-side (busca/tipo/origem) — banner de empty state. */
    totalExtratosSemCandidato: extratosSemCandidato.length,
    paginatedExtratos,
    loadingExtratos,
    currentPage,
    setCurrentPage,
    totalPages,
    // transacao tab
    transacaoSearchTerm,
    setTransacaoSearchTerm,
    transacaoContaFilter,
    setTransacaoContaFilter,
    transacaoTipoFilter,
    setTransacaoTipoFilter,
    transacaoOrigemFilter,
    setTransacaoOrigemFilter,
    transacoesPendentes,
    paginatedTransacoes,
    loadingTransacoes,
    transacaoPage,
    setTransacaoPage,
    transacaoTotalPages,
    // actions
    handleIgnorar,
    invalidarAposVinculo,
    buscarCandidatosAutoReconciliar,
    obterExtrato,
    obterTransacao,
    extratosBrutos,
  };
}
