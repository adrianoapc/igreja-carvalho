import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight, X, ArrowRight } from "lucide-react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface MonthPickerProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  // Modo range customizado
  customRange?: { from: Date; to: Date } | null;
  onCustomRangeChange?: (range: { from: Date; to: Date } | null) => void;
  className?: string;
}

export function MonthPicker({ 
  selectedMonth, 
  onMonthChange, 
  customRange,
  onCustomRangeChange,
  className 
}: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'month' | 'custom'>(customRange ? 'custom' : 'month');
  const [tempRange, setTempRange] = useState<DateRange | undefined>(
    customRange ? { from: customRange.from, to: customRange.to } : undefined
  );

  const monthPresets = [
    { label: 'Este mês', getValue: () => startOfMonth(new Date()) },
    { label: 'Mês passado', getValue: () => startOfMonth(subMonths(new Date(), 1)) },
    { label: '2 meses atrás', getValue: () => startOfMonth(subMonths(new Date(), 2)) },
    { label: '3 meses atrás', getValue: () => startOfMonth(subMonths(new Date(), 3)) },
  ];

  const rangePresets = [
    { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: 'Últimos 15 dias', getValue: () => ({ from: subDays(new Date(), 15), to: new Date() }) },
    { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: 'Últimos 3 meses', getValue: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  ];

  const handleMonthPresetClick = (preset: typeof monthPresets[0]) => {
    const date = preset.getValue();
    onMonthChange(date);
    onCustomRangeChange?.(null);
    setMode('month');
    setOpen(false);
  };

  const handleRangePresetClick = (preset: typeof rangePresets[0]) => {
    const range = preset.getValue();
    setTempRange(range);
    onCustomRangeChange?.(range);
    setMode('custom');
    setOpen(false);
  };

  const handlePrevMonth = () => {
    if (mode === 'month') {
      onMonthChange(subMonths(selectedMonth, 1));
    }
  };

  const handleNextMonth = () => {
    if (mode === 'month') {
      onMonthChange(addMonths(selectedMonth, 1));
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onMonthChange(startOfMonth(date));
      onCustomRangeChange?.(null);
      setMode('month');
      setOpen(false);
    }
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setTempRange(range);
    if (range?.from && range?.to) {
      onCustomRangeChange?.(range as { from: Date; to: Date });
    }
  };

  const handleApplyRange = () => {
    if (tempRange?.from && tempRange?.to) {
      onCustomRangeChange?.(tempRange as { from: Date; to: Date });
      setMode('custom');
      setOpen(false);
    }
  };

  const handleClearRange = () => {
    setTempRange(undefined);
    onCustomRangeChange?.(null);
    setMode('month');
  };

  const getDisplayText = () => {
    if (mode === 'custom' && customRange?.from && customRange?.to) {
      return `${format(customRange.from, "dd/MM")} - ${format(customRange.to, "dd/MM")}`;
    }
    return format(selectedMonth, "MMM yyyy", { locale: ptBR });
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handlePrevMonth}
        disabled={mode === 'custom'}
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
            {getDisplayText()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'month' | 'custom')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 m-3 mb-0" style={{ width: 'calc(100% - 24px)' }}>
              <TabsTrigger value="month" className="text-xs">Mensal</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">Customizado</TabsTrigger>
            </TabsList>

            <TabsContent value="month" className="p-3 pt-2 space-y-3">
              {/* Atalhos de mês */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Atalhos</p>
                <div className="grid grid-cols-2 gap-2">
                  {monthPresets.map((preset, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleMonthPresetClick(preset)}
                      className="text-xs h-8 justify-start"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Calendário mensal */}
              <div className="border-t pt-3">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={handleCalendarSelect}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </div>
            </TabsContent>

            <TabsContent value="custom" className="p-3 pt-2 space-y-3">
              {/* Período selecionado */}
              <div className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed transition-colors",
                tempRange?.from && tempRange?.to ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20"
              )}>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">De</p>
                  <p className={cn(
                    "font-medium text-sm",
                    tempRange?.from ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {tempRange?.from ? format(tempRange.from, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Até</p>
                  <p className={cn(
                    "font-medium text-sm",
                    tempRange?.to ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {tempRange?.to ? format(tempRange.to, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </p>
                </div>
                {(tempRange?.from || tempRange?.to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearRange}
                    className="h-6 w-6 p-0 ml-2"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Atalhos de range */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Atalhos rápidos</p>
                <div className="grid grid-cols-2 gap-2">
                  {rangePresets.map((preset, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleRangePresetClick(preset)}
                      className="text-xs h-8 justify-start"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Calendário Range */}
              <div className="border-t pt-3">
                <Calendar
                  mode="range"
                  selected={tempRange}
                  onSelect={handleRangeSelect}
                  locale={ptBR}
                  numberOfMonths={1}
                  className="pointer-events-auto"
                />
              </div>

              {/* Botão aplicar */}
              {tempRange?.from && tempRange?.to && (
                <Button
                  onClick={handleApplyRange}
                  className="w-full bg-gradient-primary"
                  size="sm"
                >
                  Aplicar Período
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleNextMonth}
        disabled={mode === 'custom'}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
