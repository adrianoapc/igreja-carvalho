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
  // Data completa digitada (10 dígitos) mas rejeitada — inválida (ex:
  // 31/02/2026) ou barrada por disabledDate (ex: data futura no Getnet).
  // O texto fica visível pro usuário corrigir, mas `value` não muda — sem
  // isso o formulário salvaria silenciosamente a data antiga enquanto
  // mostra a data rejeitada na tela.
  const [invalido, setInvalido] = useState(false);
  // Resync o texto quando `value` muda por fora (clique no calendário, dialog
  // trocando de transação) — ajuste de estado durante o render em vez de um
  // useEffect, seguindo o padrão recomendado pra "derivar estado de props".
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value ? format(value, "dd/MM/yyyy") : "");
    setInvalido(false);
  }

  const handleAccept = (val: string) => {
    setText(val);
    if (val.length === 10) {
      const parsed = parse(val, "dd/MM/yyyy", new Date());
      if (isValid(parsed) && !disabledDate?.(parsed)) {
        setInvalido(false);
        onChange(parsed);
      } else {
        setInvalido(true);
      }
      return;
    }
    setInvalido(false);
    if (val.length === 0) {
      onChange(undefined);
    }
  };

  // Se o campo perde foco com uma data incompleta/rejeitada, volta a exibir
  // o último valor válido — garante que texto exibido e valor salvo nunca
  // fiquem dessincronizados além do tempo em que o usuário está digitando.
  const handleBlur = () => {
    if (invalido || (text.length > 0 && text.length < 10)) {
      setText(value ? format(value, "dd/MM/yyyy") : "");
      setInvalido(false);
      return;
    }
    // Campo obrigatório: limpar tudo chama onChange(undefined), mas
    // consumidores como TransacaoDialog/AjusteSaldoDialog/RelatorioOferta
    // ignoram undefined de propósito (`(date) => date && setX(date)`) — o
    // valor no formulário não muda. Se `value` continua definido depois
    // disso, é porque o clear foi recusado; volta a mostrar o valor real
    // em vez de deixar o campo em branco mentindo sobre o que será salvo.
    if (text.length === 0 && value) {
      setText(format(value, "dd/MM/yyyy"));
    }
  };

  return (
    <div className={cn("relative", className)}>
      <MaskedInput
        id={id}
        mask="99/99/9999"
        value={text}
        onAccept={handleAccept}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "pr-9",
          invalido &&
            "border-destructive focus-visible:ring-destructive text-destructive",
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label="Abrir calendário"
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
