import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { MonthPicker } from "@/components/financas/MonthPicker";
import type { ContaConciliacao } from "../../model/types";

interface TipoOption {
  value: string;
  label: string;
}

interface ManualFiltrosBarProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  customRange: { from: Date; to: Date } | null;
  onCustomRangeChange: (range: { from: Date; to: Date } | null) => void;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  contas?: ContaConciliacao[];
  contaFiltro: string;
  onContaFiltroChange: (value: string) => void;
  tipoOptions: TipoOption[];
  tipoFiltro: string;
  onTipoFiltroChange: (value: string) => void;
  origemFiltro: string;
  onOrigemFiltroChange: (value: string) => void;
}

/**
 * Barra de filtros do Modo Clássico — as duas abas ("Por Extrato"/"Por
 * Transação") tinham essa mesma barra quase idêntica, só as opções do
 * filtro "Tipo" mudam (crédito/débito vs entrada/saída) — parametrizado via
 * `tipoOptions` em vez de duplicar (F7 sub-frente 2/5).
 */
export function ManualFiltrosBar({
  selectedMonth,
  onMonthChange,
  customRange,
  onCustomRangeChange,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  contas,
  contaFiltro,
  onContaFiltroChange,
  tipoOptions,
  tipoFiltro,
  onTipoFiltroChange,
  origemFiltro,
  onOrigemFiltroChange,
}: ManualFiltrosBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <MonthPicker
        selectedMonth={selectedMonth}
        onMonthChange={onMonthChange}
        customRange={customRange}
        onCustomRangeChange={onCustomRangeChange}
      />
      <div className="flex-1 min-w-[200px] relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Select value={contaFiltro} onValueChange={onContaFiltroChange}>
          <SelectTrigger className="w-[140px] sm:w-[180px]">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas?.map((conta) => (
              <SelectItem key={conta.id} value={conta.id}>
                {conta.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={onTipoFiltroChange}>
          <SelectTrigger className="w-[110px] sm:w-[130px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {tipoOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={origemFiltro} onValueChange={onOrigemFiltroChange}>
          <SelectTrigger className="w-[130px] sm:w-[150px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="api_santander">API Santander</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
