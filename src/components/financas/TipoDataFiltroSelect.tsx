import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TipoDataFiltro } from "@/features/financeiro/core";

interface TipoDataFiltroSelectProps {
  value: TipoDataFiltro;
  onValueChange: (value: TipoDataFiltro) => void;
  /** Label da opção "pagamento" nesse contexto (ex: "Recebimento", "Pagamento", "Data de Caixa"). */
  labelPagamento: string;
  className?: string;
}

export function TipoDataFiltroSelect({
  value,
  onValueChange,
  labelPagamento,
  className,
}: TipoDataFiltroSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TipoDataFiltro)}
    >
      <SelectTrigger className={className ?? "w-[180px]"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="vencimento">Vencimento</SelectItem>
        <SelectItem value="pagamento">{labelPagamento}</SelectItem>
      </SelectContent>
    </Select>
  );
}
