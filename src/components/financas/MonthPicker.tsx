import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, subMonths, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  className?: string;
}

export function MonthPicker({ selectedMonth, onMonthChange, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false);

  const presets = [
    { label: 'Este mês', getValue: () => startOfMonth(new Date()) },
    { label: 'Mês passado', getValue: () => startOfMonth(subMonths(new Date(), 1)) },
    { label: '2 meses atrás', getValue: () => startOfMonth(subMonths(new Date(), 2)) },
    { label: '3 meses atrás', getValue: () => startOfMonth(subMonths(new Date(), 3)) },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    onMonthChange(preset.getValue());
    setOpen(false);
  };

  const handlePrevMonth = () => {
    onMonthChange(subMonths(selectedMonth, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(selectedMonth, 1));
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onMonthChange(startOfMonth(date));
      setOpen(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handlePrevMonth}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-left font-normal min-w-[140px]"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(selectedMonth, "MMM yyyy", { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 space-y-3">
            {/* Atalhos rápidos */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Atalhos</p>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className="text-xs h-8 justify-start"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendário */}
            <div className="border-t pt-3">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={handleCalendarSelect}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleNextMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
