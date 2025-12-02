import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Filter, Search, CalendarIcon, X, ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subDays, subMonths, startOfMonth, endOfMonth, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface FiltrosSheetProps {
  // Período
  periodo: 'hoje' | 'semana' | 'mes' | 'ano' | 'customizado';
  setPeriodo: (value: 'hoje' | 'semana' | 'mes' | 'ano' | 'customizado') => void;
  
  // Range customizado
  dataInicio?: Date;
  setDataInicio: (date: Date | undefined) => void;
  dataFim?: Date;
  setDataFim: (date: Date | undefined) => void;
  
  // Filtros
  busca: string;
  setBusca: (value: string) => void;
  contaId: string;
  setContaId: (value: string) => void;
  categoriaId: string;
  setCategoriaId: (value: string) => void;
  fornecedorId?: string;
  setFornecedorId?: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  
  // Dados
  contas: any[];
  categorias: any[];
  fornecedores?: any[];
  
  // Tipo (para terminologia correta)
  tipoTransacao?: 'entrada' | 'saida';
  
  // Actions
  onLimpar: () => void;
  onAplicar: () => void;
}

export function FiltrosSheet({
  periodo,
  setPeriodo,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
  busca,
  setBusca,
  contaId,
  setContaId,
  categoriaId,
  setCategoriaId,
  fornecedorId,
  setFornecedorId,
  status,
  setStatus,
  contas,
  categorias,
  fornecedores,
  tipoTransacao = 'saida',
  onLimpar,
  onAplicar,
}: FiltrosSheetProps) {
  const [open, setOpen] = useState(false);

  const handleAplicar = () => {
    onAplicar();
    setOpen(false);
  };

  const handleLimpar = () => {
    onLimpar();
  };

  // Presets de período rápido
  const presets = [
    { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: 'Últimos 15 dias', getValue: () => ({ from: subDays(new Date(), 15), to: new Date() }) },
    { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'Mês passado', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
    { label: 'Últimos 3 meses', getValue: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  ];

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    setDataInicio(range.from);
    setDataFim(range.to);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDataInicio(range?.from);
    setDataFim(range?.to);
  };

  const statusPagoLabel = tipoTransacao === 'entrada' ? 'Recebido' : 'Pago';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="default">
          <Filter className="w-4 h-4 mr-2" />
          Filtros
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Período */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Período</Label>
            <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="hoje" className="text-xs">Hoje</TabsTrigger>
                <TabsTrigger value="semana" className="text-xs">Semana</TabsTrigger>
                <TabsTrigger value="mes" className="text-xs">Mês</TabsTrigger>
                <TabsTrigger value="ano" className="text-xs">Ano</TabsTrigger>
                <TabsTrigger value="customizado" className="text-xs">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Range de Data Customizado */}
          {periodo === 'customizado' && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Período Customizado</Label>
                {(dataInicio || dataFim) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDataInicio(undefined);
                      setDataFim(undefined);
                    }}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>

              {/* Período selecionado */}
              <div className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed transition-colors",
                dataInicio && dataFim ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20"
              )}>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">De</p>
                  <p className={cn(
                    "font-medium text-sm",
                    dataInicio ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {dataInicio ? format(dataInicio, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Até</p>
                  <p className={cn(
                    "font-medium text-sm",
                    dataFim ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {dataFim ? format(dataFim, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                  </p>
                </div>
              </div>

              {/* Presets rápidos */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Atalhos rápidos</Label>
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

              {/* Calendário Range */}
              <div className="border rounded-lg overflow-hidden">
                <Calendar
                  mode="range"
                  selected={{ from: dataInicio, to: dataFim }}
                  onSelect={handleRangeSelect}
                  locale={ptBR}
                  numberOfMonths={1}
                  className="pointer-events-auto"
                />
              </div>
            </div>
          )}

          {/* Busca por Descrição */}
          <div className="space-y-2">
            <Label htmlFor="busca" className="text-sm font-semibold">Buscar descrição</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="busca"
                placeholder="Digite para buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Conta */}
          <div className="space-y-2">
            <Label htmlFor="conta" className="text-sm font-semibold">Conta</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger id="conta">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {contas?.filter(conta => conta.id && conta.id !== '').map((conta) => (
                  <SelectItem key={conta.id} value={conta.id}>
                    {conta.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria" className="text-sm font-semibold">Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger id="categoria">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categorias?.filter(categoria => categoria.id && categoria.id !== '').map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fornecedor (apenas para saídas) */}
          {fornecedores && setFornecedorId && fornecedorId !== undefined && (
            <div className="space-y-2">
              <Label htmlFor="fornecedor" className="text-sm font-semibold">Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger id="fornecedor">
                  <SelectValue placeholder="Todos os fornecedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os fornecedores</SelectItem>
                  {fornecedores?.filter(fornecedor => fornecedor.id && fornecedor.id !== '').map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-semibold">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">{statusPagoLabel}</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleLimpar}
            className="flex-1"
          >
            Limpar Tudo
          </Button>
          <Button
            onClick={handleAplicar}
            className="flex-1 bg-gradient-primary"
          >
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
