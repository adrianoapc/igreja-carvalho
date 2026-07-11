import type { ComponentType } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { EntradasCalendario } from "@/components/financas/EntradasCalendario";
import { EntradasTimelineCalendario } from "@/components/financas/EntradasTimelineCalendario";
import { SaidasCalendario } from "@/components/financas/SaidasCalendario";
import { SaidasTimelineCalendario } from "@/components/financas/SaidasTimelineCalendario";

/** Tudo que difere entre Entradas e Saídas vive aqui (F2/ADR-029 §7.3). */

export interface TransacoesPageConfig {
  tipo: "entrada" | "saida";
  titulo: string;
  subtitulo: string;
  novoLabel: string;
  singular: string;
  listaTitulo: string;
  agrupadoTitulo: string;
  calendarioTitulo: string;
  vazioMensagem: string;
  exportNome: string;
  exportDataPagamentoLabel: string;
  queryKey: "entradas" | "saidas";
  arquivosTab: string;
  valorClass: string;
  totalIcone: ComponentType<{ className?: string }>;
  totalLabelPago: string;
  pageSize: number;
  Calendario: ComponentType<{
    ano: number;
    mes: number;
    dadosPorDia: Record<string, unknown[]>;
  }>;
  TimelineCalendario: ComponentType<{
    dataInicio: string;
    dataFim: string;
    dadosPorDia: Record<string, unknown[]>;
  }>;
}

export const TRANSACOES_PAGE_CONFIG: Record<
  "entrada" | "saida",
  TransacoesPageConfig
> = {
  entrada: {
    tipo: "entrada",
    titulo: "Entradas",
    subtitulo: "Gerencie os recebimentos da igreja",
    novoLabel: "Nova Entrada",
    singular: "entrada",
    listaTitulo: "Lista de Entradas",
    agrupadoTitulo: "Entradas (Agrupadas)",
    calendarioTitulo: "Calendário de Entradas",
    vazioMensagem: "Nenhuma entrada encontrada para o período selecionado.",
    exportNome: "Entradas",
    exportDataPagamentoLabel: "Data Recebimento",
    queryKey: "entradas",
    arquivosTab: "/financas/gerenciar-dados?tab=exportar&tipo=entrada",
    valorClass: "text-green-600",
    totalIcone: TrendingUp,
    totalLabelPago: "Recebido",
    pageSize: 10,
    Calendario: EntradasCalendario,
    TimelineCalendario: EntradasTimelineCalendario,
  },
  saida: {
    tipo: "saida",
    titulo: "Saídas",
    subtitulo: "Gerencie os pagamentos da igreja",
    novoLabel: "Nova Saída",
    singular: "saída",
    listaTitulo: "Lista de Saídas",
    agrupadoTitulo: "Saídas (Agrupadas)",
    calendarioTitulo: "Calendário de Saídas",
    vazioMensagem: "Nenhuma saída encontrada para o período selecionado.",
    exportNome: "Saidas",
    exportDataPagamentoLabel: "Data Pagamento",
    queryKey: "saidas",
    arquivosTab: "/financas/gerenciar-dados?tab=exportar&tipo=saida",
    valorClass: "text-red-600",
    totalIcone: TrendingDown,
    totalLabelPago: "Pago",
    pageSize: 20,
    Calendario: SaidasCalendario,
    TimelineCalendario: SaidasTimelineCalendario,
  },
};
