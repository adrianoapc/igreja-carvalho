import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface ResponsavelSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inscricaoId: string;
  currentResponsavelId?: string;
  onSuccess?: () => void;
}

export default function ResponsavelSelector({
  open,
  onOpenChange,
  inscricaoId,
  currentResponsavelId,
  onSuccess,
}: ResponsavelSelectorProps) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // Fetch líderes/membros que podem ser responsáveis
  const { data: pessoas, isLoading } = useQuery({
    queryKey: ["responsaveis-jornada", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .eq("status", "membro")
        .order("nome");

      if (search) {
        query = query.ilike("nome", `%${search}%`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (responsavelId: string | null) => {
      const { error } = await supabase
        .from("inscricoes_jornada")
        .update({ responsavel_id: responsavelId })
        .eq("id", inscricaoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável atualizado!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error("Error updating responsavel:", error);
      toast.error("Erro ao atualizar responsável");
    },
  });

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Selecionar Responsável</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Remove responsável */}
          {currentResponsavelId && (
            <Button
              variant="outline"
              className="w-full justify-start text-destructive"
              onClick={() => updateMutation.mutate(null)}
            >
              <X className="w-4 h-4 mr-2" />
              Remover responsável
            </Button>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membro..."
              className="pl-9"
            />
          </div>

          {/* Lista */}
          <ScrollArea className="h-[250px] border rounded-lg">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : pessoas && pessoas.length > 0 ? (
              <div className="p-2 space-y-1">
                {pessoas.map((pessoa) => (
                  <button
                    key={pessoa.id}
                    onClick={() => updateMutation.mutate(pessoa.id)}
                    disabled={updateMutation.isPending}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                      currentResponsavelId === pessoa.id
                        ? "bg-primary/10 ring-1 ring-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={pessoa.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getInitials(pessoa.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm truncate">
                      {pessoa.nome}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <User className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhum membro encontrado
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
