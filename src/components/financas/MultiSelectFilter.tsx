import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Combobox multi-seleção (popover + checkboxes) — mesmo formato visual de
 * um Select single-value, usado nos 4 filtros de ExportarTab.tsx (Tipo de
 * Dados, Status, Conta, Categoria).
 */

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Texto do trigger quando `selected` está vazio (= "todos/todas", sem filtro aplicado). */
  allLabel: string;
  disabled?: boolean;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  allLabel,
  disabled,
}: MultiSelectFilterProps) {
  const habilitadas = options.filter((o) => !o.disabled);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const selecionarTodas = () => onChange(habilitadas.map((o) => o.value));
  const limpar = () => onChange([]);

  const triggerLabel = (() => {
    if (selected.length === 0) return allLabel;
    if (selected.length >= 3) return `${selected.length} selecionados`;
    return selected
      .map((v) => options.find((o) => o.value === v)?.label || v)
      .join(", ");
  })();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex gap-2 mb-2 pb-2 border-b">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={selecionarTodas}
          >
            Selecionar todos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={limpar}
          >
            Limpar
          </Button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex items-center gap-2 px-1.5 py-1 rounded text-sm ${
                option.disabled
                  ? "text-muted-foreground cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-accent"
              }`}
            >
              <Checkbox
                checked={selected.includes(option.value)}
                disabled={option.disabled}
                onCheckedChange={() => toggle(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
