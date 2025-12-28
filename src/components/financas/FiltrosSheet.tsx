import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import { MonthPicker } from "./MonthPicker";

interface FiltrosSheetProps {
  // Mês selecionado
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  
  // Range customizado
  customRange?: { from: Date; to: Date } | null;
  onCustomRangeChange?: (range: { from: Date; to: Date } | null) => void;
  
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
  contas: Array<{ id: string; nome: string }>;
  categorias: Array<{ id: string; nome: string }>;
  fornecedores?: Array<{ id: string; nome: string }>;
  
  // Tipo (para terminologia correta)
  tipoTransacao?: 'entrada' | 'saida';
  
  // Actions
  onLimpar: () => void;
  onAplicar: () => void;
}

export function FiltrosSheet({
  selectedMonth,
  onMonthChange,
  customRange,
  onCustomRangeChange,
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
          {/* Período com MonthPicker */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Período</Label>
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={onMonthChange}
              customRange={customRange}
              onCustomRangeChange={onCustomRangeChange}
              className="w-full"
            />
          </div>

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
