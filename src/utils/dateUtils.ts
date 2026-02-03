/**
 * Utilitários para manipulação de datas sem problemas de timezone
 *
 * Problema: Ao usar .toISOString() ou format() com datas, o JavaScript
 * converte para UTC, causando offset de -3h no Brasil. Isso faz com que
 * datas como 31/07 23:59:59 BRT virem 01/08 02:59:59 UTC.
 *
 * Solução: Sempre usar o timezone local ao extrair YYYY-MM-DD.
 */

/**
 * Converte Date para string YYYY-MM-DD no timezone LOCAL
 * Evita offset UTC que causa bugs em filtros de data
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converte string YYYY-MM-DD para Date no timezone LOCAL
 * Evita interpretação UTC que subtrai 1 dia
 */
export function parseLocalDate(
  dateString: string | null | undefined,
): Date | undefined {
  if (!dateString) return undefined;
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Retorna o primeiro dia do mês no timezone local (00:00:00)
 */
export function startOfMonthLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Retorna o último dia do mês no timezone local (23:59:59.999)
 */
export function endOfMonthLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Retorna início do dia no timezone local (00:00:00)
 */
export function startOfDayLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Retorna fim do dia no timezone local (23:59:59.999)
 */
export function endOfDayLocal(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}
