import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface AdicionarPessoaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jornadaId: string;
  primeiraEtapaId?: string;
  onSuccess: () => void;
}

export default function AdicionarPessoaDialog({
  open,
  onOpenChange,
  jornadaId,
  primeiraEtapaId,
  onSuccess,
}: AdicionarPessoaDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedPessoa, setSelectedPessoa] = useState<any>(null);

  // Fetch pessoas que ainda não estão nesta jornada
  const { data: pessoas, isLoading } = useQuery({
    queryKey: ["pessoas-para-jornada", jornadaId, search],
    queryFn: async () => {
      // Get already enrolled pessoas
      const { data: inscritos } = await supabase
        .from("inscricoes_jornada")
        .select("pessoa_id")
        .eq("jornada_id", jornadaId);

      const inscritosIds = inscritos?.map((i) => i.pessoa_id) || [];

      // Search pessoas
      let query = supabase
        .from("profiles")
        .select("id, nome, avatar_url, status, telefone")
        .order("nome");

      if (search) {
        query = query.ilike("nome", `%${search}%`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;

      // Filter out already enrolled
      return data?.filter((p) => !inscritosIds.includes(p.id)) || [];
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async (pessoaId: string) => {
      const { error } = await supabase.from("inscricoes_jornada").insert({
        jornada_id: jornadaId,
        pessoa_id: pessoaId,
        etapa_atual_id: primeiraEtapaId || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pessoa adicionada à jornada!");
      setSelectedPessoa(null);
      setSearch("");
      onSuccess();
    },
    onError: (error: any) => {
      console.error("Error adding pessoa:", error);
      if (error.code === "23505") {
        toast.error("Esta pessoa já está inscrita nesta jornada");
      } else {
        toast.error("Erro ao adicionar pessoa");
      }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "membro":
        return <Badge variant="default">Membro</Badge>;
      case "frequentador":
        return <Badge variant="secondary">Frequentador</Badge>;
      default:
        return <Badge variant="outline">Visitante</Badge>;
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title="Adicionar Pessoa à Jornada"
    >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="pl-9"
            />
          </div>

          {/* Lista de pessoas */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : pessoas && pessoas.length > 0 ? (
              <div className="space-y-2 pr-3">
                {pessoas.map((pessoa) => (
                  <button
                    key={pessoa.id}
                    onClick={() => setSelectedPessoa(pessoa)}
                    className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      selectedPessoa?.id === pessoa.id
                        ? "bg-primary/5 border-primary ring-1 ring-primary/20"
                        : "hover:bg-muted/50 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={pessoa.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {getInitials(pessoa.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-sm font-medium truncate">{pessoa.nome}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {pessoa.telefone || "Sem telefone"}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 ml-2">
                      {getStatusBadge(pessoa.status)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <User className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Nenhuma pessoa encontrada"
                    : "Todas as pessoas já estão inscritas"}
                </p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => selectedPessoa && addMutation.mutate(selectedPessoa.id)}
            disabled={!selectedPessoa || addMutation.isPending}
          >
            {addMutation.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
