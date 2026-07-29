import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TipoDataFiltro } from "@/features/financeiro/core";

interface TipoDataFiltroSelectProps {
  value: TipoDataFiltro;
  onValueChange: (value: TipoDataFiltro) => void;
  /** Label da opção "pagamento" nesse contexto (ex: "Recebimento", "Pagamento", "Data de Caixa"). */
  labelPagamento: string;
  className?: string;
  /** "pill" reduz o gatilho ao mesmo visual do Badge de período (ícone/fonte
   * text-xs, formato pill) — usado junto do MonthPicker variant="pill". */
  variant?: "control" | "pill";
}

const PILL_TRIGGER_CLASS =
  "h-auto w-auto gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold [&>span]:line-clamp-none";

export function TipoDataFiltroSelect({
  value,
  onValueChange,
  labelPagamento,
  className,
  variant = "control",
}: TipoDataFiltroSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TipoDataFiltro)}
    >
      <SelectTrigger
        className={
          variant === "pill"
            ? cn(PILL_TRIGGER_CLASS, className)
            : (className ?? "w-[180px]")
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="vencimento">Vencimento</SelectItem>
        <SelectItem value="pagamento">{labelPagamento}</SelectItem>
      </SelectContent>
    </Select>
  );
}
