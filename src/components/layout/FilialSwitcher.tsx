import { useState, useEffect } from "react";
import { MapPin, ChevronDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useFilialInfo } from "@/hooks/useFilialInfo";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

const FILIAL_OVERRIDE_KEY = "lovable_filial_override";

interface FilialSwitcherProps {
  className?: string;
}

export function FilialSwitcher({ className }: FilialSwitcherProps) {
  const { filialId, filialNome, filiais, loading } = useFilialInfo();
  const { isAdmin, loading: permLoading } = usePermissions();
  const [selectedFilialId, setSelectedFilialId] = useState<string | null>(null);
  const [selectedFilialNome, setSelectedFilialNome] = useState<string | null>(null);

  // Carregar override do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(FILIAL_OVERRIDE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSelectedFilialId(parsed.id);
        setSelectedFilialNome(parsed.nome);
      } catch {
        localStorage.removeItem(FILIAL_OVERRIDE_KEY);
      }
    }
  }, []);

  // Sincronizar com contexto quando não há override
  useEffect(() => {
    if (!selectedFilialId && filialId) {
      setSelectedFilialId(filialId);
      setSelectedFilialNome(filialNome);
    }
  }, [filialId, filialNome, selectedFilialId]);

  const handleSelectFilial = (id: string | null, nome: string | null) => {
    setSelectedFilialId(id);
    setSelectedFilialNome(nome);
    
    if (id && nome) {
      localStorage.setItem(FILIAL_OVERRIDE_KEY, JSON.stringify({ id, nome }));
    } else {
      localStorage.removeItem(FILIAL_OVERRIDE_KEY);
    }
    
    // Recarregar a página para aplicar o novo contexto
    window.location.reload();
  };

  // Não mostrar para usuários sem permissão ou se só há uma filial
  if (loading || permLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <MapPin className="h-3 w-3" />
        <span>Carregando...</span>
      </div>
    );
  }

  const displayNome = selectedFilialNome || filialNome || "Matriz";
  const canSwitch = isAdmin && filiais.length > 1;

  // Usuário comum: apenas indicador visual
  if (!canSwitch) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <MapPin className="h-3 w-3" />
        <span>{displayNome}</span>
      </div>
    );
  }

  // Admin: dropdown para trocar filial
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground gap-1", className)}
        >
          <MapPin className="h-3 w-3" />
          <span>{displayNome}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem 
          onClick={() => handleSelectFilial(null, null)}
          className={cn(!selectedFilialId && "bg-accent")}
        >
          <Building2 className="h-4 w-4 mr-2" />
          <span>Todas as filiais</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {filiais.map((filial) => (
          <DropdownMenuItem
            key={filial.id}
            onClick={() => handleSelectFilial(filial.id, filial.nome)}
            className={cn(selectedFilialId === filial.id && "bg-accent")}
          >
            <MapPin className="h-4 w-4 mr-2" />
            <span>{filial.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
