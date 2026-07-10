import {
  formatLocalDate,
  startOfMonthLocal,
  endOfMonthLocal,
  startOfDayLocal,
  endOfDayLocal,
} from "@/utils/dateUtils";

export interface PeriodoRange {
  inicio: string;
  fim: string;
}

/**
 * Resolve o período de consulta: range customizado quando presente,
 * senão o mês selecionado inteiro.
 */
export function getPeriodoRange(
  selectedMonth: Date,
  customRange: { from: Date; to: Date } | null,
): PeriodoRange {
  if (customRange) {
    return {
      inicio: formatLocalDate(startOfDayLocal(customRange.from)),
      fim: formatLocalDate(endOfDayLocal(customRange.to)),
    };
  }
  return {
    inicio: formatLocalDate(startOfMonthLocal(selectedMonth)),
    fim: formatLocalDate(endOfMonthLocal(selectedMonth)),
  };
}
