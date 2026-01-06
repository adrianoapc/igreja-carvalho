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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { cn } from "@/lib/utils";

interface FilialSwitcherProps {
  className?: string;
}

export function FilialSwitcher({ className }: FilialSwitcherProps) {
  const {
    filialId,
    filialNome,
    filiais,
    igrejaId,
    isAllFiliais,
    isAdmin,
    hasExplicitAccess,
    allowedFilialIds,
    loading,
    setFilialOverride,
  } = useAuthContext();

  const handleSelectFilial = (id: string | null, isAll = false) => {
    setFilialOverride(id, isAll);
    // Recarregar a página para aplicar o novo contexto
    window.location.reload();
  };

  // Skeleton loading - não bloqueia UI
  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  // Determinar quais filiais mostrar
  const displayFiliais = hasExplicitAccess
    ? filiais.filter((f) => allowedFilialIds?.includes(f.id))
    : isAdmin
      ? filiais
      : filiais.filter((f) => f.id === filialId);

  const displayNome = filialNome || "Matriz";

  // Pode trocar se tem mais de uma filial disponível
  const canSwitch = displayFiliais.length > 1;

  // Pode ver "Todas as filiais" apenas se é admin E não tem restrições explícitas
  const canViewAll = isAdmin && !hasExplicitAccess;

  // Usuário com apenas uma filial: apenas indicador visual
  if (!canSwitch && !canViewAll) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs text-muted-foreground",
          className
        )}
      >
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
          className={cn(
            "h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground gap-1",
            className
          )}
        >
          <MapPin className="h-3 w-3" />
          <span>{displayNome}</span>
          {isAllFiliais && <Badge variant="outline">Todas</Badge>}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {canViewAll && (
          <>
            <DropdownMenuItem
              onClick={() => handleSelectFilial(null, true)}
              className={cn(isAllFiliais && "bg-accent")}
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
            onClick={() => handleSelectFilial(filial.id, false)}
            className={cn(
              filialId === filial.id && !isAllFiliais && "bg-accent"
            )}
          >
            <MapPin className="h-4 w-4 mr-2" />
            <span>{filial.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
