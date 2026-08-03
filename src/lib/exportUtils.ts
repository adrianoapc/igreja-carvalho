import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';

/**
 * Monta uma worksheet a partir de linhas de dados, aplicando formato
 * numérico do Excel (`numberFormats`) e autosize de colunas — lógica
 * compartilhada entre `exportToExcel` (1 aba) e `exportSheetsToExcel`
 * (múltiplas abas no mesmo arquivo).
 */
function buildWorksheet(
  data: Record<string, unknown>[],
  numberFormats?: Record<string, string>,
) {
  const ws = XLSX.utils.json_to_sheet(data);

  if (numberFormats) {
    const headers = Object.keys(data[0]);
    Object.entries(numberFormats).forEach(([column, numFmt]) => {
      const colIndex = headers.indexOf(column);
      if (colIndex === -1) return;
      for (let row = 0; row < data.length; row++) {
        const cellRef = XLSX.utils.encode_cell({ r: row + 1, c: colIndex });
        const cell = ws[cellRef];
        if (cell && cell.t === 'n') {
          cell.z = numFmt;
        }
      }
    });
  }

  // Auto-size columns
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLength = Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;

  return ws;
}

/**
 * Export data to Excel file
 *
 * @param numberFormats - maps column header -> Excel number format code (e.g. `{ Valor: '#,##0.00' }`)
 *   applied to numeric cells so they stay real numbers (summable) while displaying with the desired format.
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName: string = 'Dados',
  numberFormats?: Record<string, string>,
) {
  if (!data || data.length === 0) {
    throw new Error('Não há dados para exportar');
  }

  const wb = XLSX.utils.book_new();
  const ws = buildWorksheet(data, numberFormats);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
  const fullFilename = `${filename}_${timestamp}.xlsx`;
  XLSX.writeFile(wb, fullFilename);
}

/**
 * Export de múltiplas abas num único arquivo .xlsx — cada item de `sheets`
 * vira uma worksheet própria (`sheet.name`), com seu próprio
 * `numberFormats`. Abas sem dado são puladas; erro só se NENHUMA aba tiver
 * dado (mesma guarda de `exportToExcel`).
 */
export function exportSheetsToExcel(
  sheets: Array<{
    name: string;
    data: Record<string, unknown>[];
    numberFormats?: Record<string, string>;
  }>,
  filename: string,
) {
  const comDados = sheets.filter((s) => s.data && s.data.length > 0);
  if (comDados.length === 0) {
    throw new Error('Não há dados para exportar');
  }

  const wb = XLSX.utils.book_new();
  comDados.forEach((sheet) => {
    const ws = buildWorksheet(sheet.data, sheet.numberFormats);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });

  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
  const fullFilename = `${filename}_${timestamp}.xlsx`;
  XLSX.writeFile(wb, fullFilename);
}

/**
 * Export data to CSV file
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) {
    throw new Error('Não há dados para exportar');
  }

  // Convert to CSV
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
  const fullFilename = `${filename}_${timestamp}.csv`;
  
  link.setAttribute('href', url);
  link.setAttribute('download', fullFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format date for export
 *
 * Colunas PostgreSQL DATE puras ("YYYY-MM-DD", ex: data_vencimento,
 * data_competencia) viram meia-noite UTC com `new Date(string)` — em fusos
 * a oeste de UTC (Brasil) isso volta um dia no horário local. Só essas
 * strings "date-only" passam por parseLocalDate; timestamptz completo
 * (ex: pessoas.data_primeira_visita) e Date já concretos seguem o caminho
 * original — `new Date()` já converte esses corretamente pro fuso local.
 */
export function formatDateForExport(date: string | Date | null): string {
  if (!date) return '';
  try {
    const isDateOnly = typeof date === 'string' && DATE_ONLY_PATTERN.test(date);
    const parsed = isDateOnly ? parseLocalDate(date as string) : new Date(date);
    if (!parsed) return '';
    return format(parsed, 'dd/MM/yyyy');
  } catch {
    return '';
  }
}

/**
 * Format datetime for export
 */
export function formatDateTimeForExport(date: string | Date | null): string {
  if (!date) return '';
  try {
    return format(new Date(date), 'dd/MM/yyyy HH:mm');
  } catch {
    return '';
  }
}

/**
 * Format currency for export
 */
export function formatCurrencyForExport(value: number | null): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format boolean for export
 */
export function formatBooleanForExport(value: boolean | null): string {
  if (value === null || value === undefined) return '';
  return value ? 'Sim' : 'Não';
}
