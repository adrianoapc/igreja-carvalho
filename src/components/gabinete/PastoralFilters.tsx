import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Filter, Search, X, LayoutGrid, List } from "lucide-react";

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

interface PastoralFiltersProps {
  filtroMeus: boolean;
  setFiltroMeus: (v: boolean) => void;
  filtroGravidade: GravidadeEnum | "TODAS";
  setFiltroGravidade: (v: GravidadeEnum | "TODAS") => void;
  busca: string;
  setBusca: (v: string) => void;
  filtroOrigem: string;
  setFiltroOrigem: (v: string) => void;
  viewMode: "kanban" | "list";
  setViewMode: (v: "kanban" | "list") => void;
}

export function PastoralFilters({
  filtroMeus,
  setFiltroMeus,
  filtroGravidade,
  setFiltroGravidade,
  busca,
  setBusca,
  filtroOrigem,
  setFiltroOrigem,
  viewMode,
  setViewMode,
}: PastoralFiltersProps) {
  const hasFilters = filtroMeus || filtroGravidade !== "TODAS" || busca || filtroOrigem !== "TODAS";

  const clearFilters = () => {
    setFiltroMeus(false);
    setFiltroGravidade("TODAS");
    setBusca("");
    setFiltroOrigem("TODAS");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Linha 1: Busca e Toggle de Visualização */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou motivo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="rounded-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Linha 2: Filtros */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filtroMeus ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltroMeus(!filtroMeus)}
        >
          <User className="h-4 w-4 mr-2" />
          Meus Atendimentos
        </Button>

        <Select
          value={filtroGravidade}
          onValueChange={(v) => setFiltroGravidade(v as GravidadeEnum | "TODAS")}
        >
          <SelectTrigger className="w-36 h-9">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Gravidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas</SelectItem>
            <SelectItem value="CRITICA">Crítica</SelectItem>
            <SelectItem value="ALTA">Alta</SelectItem>
            <SelectItem value="MEDIA">Média</SelectItem>
            <SelectItem value="BAIXA">Baixa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas Origens</SelectItem>
            <SelectItem value="CHATBOT">Chatbot</SelectItem>
            <SelectItem value="SENTIMENTOS">Sentimentos</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>
    </div>
  );
}
