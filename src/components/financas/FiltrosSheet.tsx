import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Search, CalendarIcon, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <Label className="text-sm font-semibold">Período Customizado</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="data-inicio" className="text-xs">Data Início</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="data-inicio"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataInicio && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataInicio ? format(dataInicio, "dd/MM/yy", { locale: ptBR }) : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataInicio}
                        onSelect={setDataInicio}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data-fim" className="text-xs">Data Fim</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="data-fim"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dataFim && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataFim ? format(dataFim, "dd/MM/yy", { locale: ptBR }) : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dataFim}
                        onSelect={setDataFim}
                        locale={ptBR}
                        disabled={(date) => dataInicio ? date < dataInicio : false}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {dataInicio && dataFim && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDataInicio(undefined);
                    setDataFim(undefined);
                  }}
                  className="w-full"
                >
                  <X className="w-3 h-3 mr-2" />
                  Limpar datas
                </Button>
              )}
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
                <SelectItem value="pago">Pago</SelectItem>
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
