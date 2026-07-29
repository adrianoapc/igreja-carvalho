import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { MaskedInput } from "@/components/ui/masked-input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateFieldPickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  /** Datas que não podem ser selecionadas (repassado ao Calendar; também
   * bloqueia a digitação de uma data que caia nesse predicado). */
  disabledDate?: (date: Date) => boolean;
}

/**
 * Campo de data única digitável (máscara dd/mm/aaaa via MaskedInput) com o
 * calendário de sempre disponível como atalho pelo ícone — substitui o
 * padrão antigo (Popover só-calendário, sem digitar, sem pular ano rápido)
 * nos campos avulsos de data do financeiro.
 */
export function DateFieldPicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  disabled,
  id,
  disabledDate,
}: DateFieldPickerProps) {
  const [text, setText] = useState(value ? format(value, "dd/MM/yyyy") : "");
  const [open, setOpen] = useState(false);
  // Resync o texto quando `value` muda por fora (clique no calendário, dialog
  // trocando de transação) — ajuste de estado durante o render em vez de um
  // useEffect, seguindo o padrão recomendado pra "derivar estado de props".
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value ? format(value, "dd/MM/yyyy") : "");
  }

  const handleAccept = (val: string) => {
    setText(val);
    if (val.length === 10) {
      const parsed = parse(val, "dd/MM/yyyy", new Date());
      if (isValid(parsed) && !disabledDate?.(parsed)) {
        onChange(parsed);
      }
      return;
    }
    if (val.length === 0) {
      onChange(undefined);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <MaskedInput
        id={id}
        mask="99/99/9999"
        value={text}
        onAccept={handleAccept}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="absolute right-0 top-0 h-10 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
            locale={ptBR}
            disabled={disabledDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
