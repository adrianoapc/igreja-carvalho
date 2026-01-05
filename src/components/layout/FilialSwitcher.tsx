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
import { Badge } from "@/components/ui/badge";
import { useFilialInfo } from "@/hooks/useFilialInfo";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrentUserFilialAccess } from "@/hooks/useUserFilialAccess";
import { cn } from "@/lib/utils";

const FILIAL_OVERRIDE_KEY = "lovable_filial_override";

interface FilialSwitcherProps {
  className?: string;
}

export function FilialSwitcher({ className }: FilialSwitcherProps) {
  const { filialId, filialNome, filiais, igrejaId, isAllFiliais, loading } = useFilialInfo();
  const { isAdmin, loading: permLoading } = usePermissions();
  const { allowedFilialIds, hasExplicitRestrictions, isLoading: accessLoading } = useCurrentUserFilialAccess(igrejaId || undefined);
  
  const [selectedFilialId, setSelectedFilialId] = useState<string | null>(null);
  const [selectedFilialNome, setSelectedFilialNome] = useState<string | null>(null);
  const [selectedIsAll, setSelectedIsAll] = useState(false);

  // Carregar override do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(FILIAL_OVERRIDE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSelectedFilialId(parsed.id);
        setSelectedFilialNome(parsed.nome);
        setSelectedIsAll(Boolean(parsed.isAll));
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
      setSelectedIsAll(false);
    } else if (isAllFiliais) {
      setSelectedFilialId(null);
      setSelectedFilialNome("Todas as filiais");
      setSelectedIsAll(true);
    }
  }, [filialId, filialNome, isAllFiliais, selectedFilialId]);

  const handleSelectFilial = (id: string | null, nome: string | null, isAll = false) => {
    setSelectedFilialId(id);
    setSelectedFilialNome(nome);
    setSelectedIsAll(isAll);
    
    if ((id && nome) || isAll) {
      localStorage.setItem(FILIAL_OVERRIDE_KEY, JSON.stringify({ id, nome, isAll }));
    } else {
      localStorage.removeItem(FILIAL_OVERRIDE_KEY);
    }
    
    // Recarregar a página para aplicar o novo contexto
    window.location.reload();
  };

  // Carregando
  if (loading || permLoading || accessLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <MapPin className="h-3 w-3" />
        <span>Carregando...</span>
      </div>
    );
  }

  // Determinar quais filiais mostrar
  // Se tem restrições explícitas em user_filial_access, usar essas
  // Se não tem restrições e é admin, mostrar todas
  // Se não tem restrições e não é admin, mostrar apenas a filial do perfil
  const displayFiliais = hasExplicitRestrictions
    ? filiais.filter(f => allowedFilialIds?.includes(f.id))
    : isAdmin
      ? filiais
      : filiais.filter(f => f.id === filialId);

  const displayNome = selectedFilialNome || filialNome || "Matriz";
  
  // Pode trocar se tem mais de uma filial disponível
  const canSwitch = displayFiliais.length > 1;
  
  // Pode ver "Todas as filiais" apenas se é admin E não tem restrições explícitas
  const canViewAll = isAdmin && !hasExplicitRestrictions;
  
  const isAllSelected = selectedIsAll || isAllFiliais;

  // Usuário com apenas uma filial: apenas indicador visual
  if (!canSwitch && !canViewAll) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <MapPin className="h-3 w-3" />
        <span>{displayNome}</span>
      </div>
    );
  }

  // Dropdown para trocar filial
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
          {isAllSelected && <Badge variant="outline">Todas</Badge>}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {canViewAll && (
          <>
            <DropdownMenuItem 
              onClick={() => handleSelectFilial(null, "Todas as filiais", true)}
              className={cn(isAllSelected && "bg-accent")}
            >
              <Building2 className="h-4 w-4 mr-2" />
              <span>Todas as filiais</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {displayFiliais.map((filial) => (
          <DropdownMenuItem
            key={filial.id}
            onClick={() => handleSelectFilial(filial.id, filial.nome, false)}
            className={cn(selectedFilialId === filial.id && !isAllSelected && "bg-accent")}
          >
            <MapPin className="h-4 w-4 mr-2" />
            <span>{filial.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
