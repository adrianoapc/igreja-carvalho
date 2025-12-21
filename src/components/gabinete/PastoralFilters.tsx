import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Search, X, SlidersHorizontal } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

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
}: PastoralFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const activeFiltersCount = [
    filtroMeus,
    filtroGravidade !== "TODAS",
    filtroOrigem !== "TODAS",
  ].filter(Boolean).length;

  const hasFilters = activeFiltersCount > 0 || busca;

  const clearFilters = () => {
    setFiltroMeus(false);
    setFiltroGravidade("TODAS");
    setBusca("");
    setFiltroOrigem("TODAS");
  };

  return (
    <div className="space-y-3">
      {/* Busca + Toggle Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 relative shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <Badge 
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Filtros Expansíveis */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent className="space-y-3">
          <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
            <Button
              variant={filtroMeus ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroMeus(!filtroMeus)}
              className="h-8"
            >
              <User className="h-3.5 w-3.5 mr-1.5" />
              Meus
            </Button>

            <Select
              value={filtroGravidade}
              onValueChange={(v) => setFiltroGravidade(v as GravidadeEnum | "TODAS")}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
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
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                <SelectItem value="CHATBOT">Chatbot</SelectItem>
                <SelectItem value="SENTIMENTOS">Sentimentos</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 ml-auto">
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
