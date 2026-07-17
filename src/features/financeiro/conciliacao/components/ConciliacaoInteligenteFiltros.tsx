import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Sparkles } from "lucide-react";
import type { Conta } from "../hooks/useConciliacaoInteligente";

interface ConciliacaoInteligenteFiltrosProps {
  contas?: Conta[];
  contaFiltro: string;
  onContaFiltroChange: (value: string) => void;
  tipoFiltro: string;
  onTipoFiltroChange: (value: string) => void;
  searchExtrato: string;
  onSearchExtratoChange: (value: string) => void;
  gerando: boolean;
  onRegenerarSugestoes: () => void;
}

/** Barra de filtros globais (busca, conta, tipo, regenerar sugestões ML). */
export function ConciliacaoInteligenteFiltros({
  contas,
  contaFiltro,
  onContaFiltroChange,
  tipoFiltro,
  onTipoFiltroChange,
  searchExtrato,
  onSearchExtratoChange,
  gerando,
  onRegenerarSugestoes,
}: ConciliacaoInteligenteFiltrosProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 bg-card border rounded-lg flex-shrink-0">
      <div className="flex-1 relative min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar extrato..."
          value={searchExtrato}
          onChange={(e) => onSearchExtratoChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-2">
        <Select value={contaFiltro} onValueChange={onContaFiltroChange}>
          <SelectTrigger className="flex-1 sm:w-[180px]">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas?.map((conta) => (
              <SelectItem key={conta.id} value={conta.id}>
                {conta.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={onTipoFiltroChange}>
          <SelectTrigger className="flex-1 sm:w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="entrada">Entrada (Crédito)</SelectItem>
            <SelectItem value="saida">Saída (Débito)</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="outline"
          className="shrink-0"
          onClick={onRegenerarSugestoes}
          disabled={gerando}
          title="Regenerar sugestões ML"
        >
          {gerando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
