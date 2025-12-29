import * as XLSX from 'xlsx';
import { format } from 'date-fns';

/**
 * Export data to Excel file
 */
export function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName: string = 'Dados') {
  if (!data || data.length === 0) {
    throw new Error('Não há dados para exportar');
  }

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLength = Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate filename with timestamp
  const timestamp = format(new Date(), 'yyyy-MM-dd_HHmmss');
  const fullFilename = `${filename}_${timestamp}.xlsx`;

  // Save file
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

/**
 * Format date for export
 */
export function formatDateForExport(date: string | Date | null): string {
  if (!date) return '';
  try {
    return format(new Date(date), 'dd/MM/yyyy');
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
