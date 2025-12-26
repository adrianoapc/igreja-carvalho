import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search } from "lucide-react";

interface VincularResponsavelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PessoaSugestao {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  avatar_url?: string;
}

interface KidsForAuthorization {
  id: string;
  nome: string;
  data_nascimento?: string;
}

const TIPOS_PARENTESCO_ADULTO = [
  { value: "avo", label: "Avó" },
  { value: "avo-paterno", label: "Avô (Paterno)" },
  { value: "ava-paterna", label: "Avó (Paterna)" },
  { value: "tia", label: "Tia" },
  { value: "tio", label: "Tio" },
  { value: "madrasta", label: "Madrasta" },
  { value: "padrasto", label: "Padrasto" },
  { value: "prima", label: "Prima" },
  { value: "primo", label: "Primo" },
  { value: "irma", label: "Irmã (adulta)" },
  { value: "irmao", label: "Irmão (adulto)" },
  { value: "outro", label: "Outro" },
];

export default function VincularResponsavelDialog({
  open,
  onOpenChange,
  onSuccess,
}: VincularResponsavelDialogProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Estados do formulário
  const [searchTerm, setSearchTerm] = useState("");
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaSugestao | null>(null);
  const [tipoParentesco, setTipoParentesco] = useState("");
  const [criancasSelecionadas, setCriancasSelecionadas] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"search" | "confirm" | "select-kids">("search");

  // Buscar sugestões de pessoas
  const { data: sugestoes = [], isLoading: searchLoading } = useQuery({
    queryKey: ["buscar-pessoa", searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, telefone, avatar_url")
        .neq("id", profile?.id)
        .or(
          `nome.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%`
        )
        .limit(10);

      if (error) {
        console.error("Erro ao buscar pessoas:", error);
        return [];
      }

      return data || [];
    },
    enabled: open && searchTerm.length >= 2,
  });

  // Buscar crianças da família do usuário
  const { data: criancas = [] } = useQuery({
    queryKey: ["kids-for-authorization", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const today = new Date();

      // Buscar todos os perfis que são filhos do usuário
      const { data: relationships, error: relError } = await supabase
        .from("familias")
        .select("familiar_id")
        .eq("pessoa_id", profile.id);

      if (relError) throw relError;

      if (!relationships || relationships.length === 0) return [];

      const familiarIds = relationships
        .map((r) => r.familiar_id)
        .filter((id): id is string => id !== null);

      // Buscar dados das crianças
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, data_nascimento")
        .in("id", familiarIds);

      if (profilesError) throw profilesError;

      // Filtrar apenas crianças (menores de 13 anos)
      return (profiles || [])
        .filter((p) => {
          if (!p.data_nascimento) return false;
          const birthDate = new Date(p.data_nascimento);
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const actualAge =
            monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
              ? age - 1
              : age;
          return actualAge < 13;
        })
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          data_nascimento: p.data_nascimento,
        }));
    },
    enabled: open,
  });

  // Mutation para vincular responsáveis
  const vincularMutation = useMutation({
    mutationFn: async () => {
      if (!pessoaSelecionada || !tipoParentesco || criancasSelecionadas.size === 0) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      // Para cada criança selecionada, criar um vínculo na tabela familias
      const inserts = Array.from(criancasSelecionadas).map((criancaId) => ({
        pessoa_id: pessoaSelecionada.id,
        familiar_id: criancaId,
        tipo_parentesco: tipoParentesco,
      }));

      const { error } = await supabase
        .from("familias")
        .insert(inserts);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Responsável vinculado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["family-members"] });
      queryClient.invalidateQueries({ queryKey: ["kids-directory"] });

      // Reset form
      setSearchTerm("");
      setPessoaSelecionada(null);
      setTipoParentesco("");
      setCriancasSelecionadas(new Set());
      setStep("search");
      onOpenChange(false);

      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Erro ao vincular responsável:", error);
      toast.error(error.message || "Erro ao vincular responsável");
    },
  });

  const handleSelecionarPessoa = (pessoa: PessoaSugestao) => {
    setPessoaSelecionada(pessoa);
    setStep("confirm");
    setSearchTerm("");
  };

  const handleConfirmarPessoa = () => {
    if (!tipoParentesco) {
      toast.error("Selecione o tipo de parentesco");
      return;
    }
    setStep("select-kids");
  };

  const handleToggleCrianca = (criancaId: string) => {
    const novas = new Set(criancasSelecionadas);
    if (novas.has(criancaId)) {
      novas.delete(criancaId);
    } else {
      novas.add(criancaId);
    }
    setCriancasSelecionadas(novas);
  };

  const handleVincular = async () => {
    if (criancasSelecionadas.size === 0) {
      toast.error("Selecione pelo menos uma criança");
      return;
    }
    await vincularMutation.mutateAsync();
  };

  const handleVoltar = () => {
    if (step === "confirm") {
      setPessoaSelecionada(null);
      setTipoParentesco("");
      setStep("search");
    } else if (step === "select-kids") {
      setStep("confirm");
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-4 px-6 pt-6">
          <h2 className="text-lg font-semibold">Vincular Responsável/Autorizado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "search" && "Digite o e-mail ou telefone da pessoa"}
            {step === "confirm" && "Confirme o tipo de parentesco"}
            {step === "select-kids" && "Selecione as crianças que ela pode buscar"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* STEP 1: SEARCH */}
        {step === "search" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search-pessoa">E-mail ou Telefone</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-pessoa"
                  placeholder="Ex: avo@email.com ou (11) 98765-4321"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {searchLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {!searchLoading && sugestoes.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {sugestoes.map((pessoa) => (
                  <button
                    key={pessoa.id}
                    onClick={() => handleSelecionarPessoa(pessoa)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-input hover:bg-accent cursor-pointer transition-colors"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={pessoa.avatar_url} />
                      <AvatarFallback>{pessoa.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium truncate">{pessoa.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {pessoa.email || pessoa.telefone}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searchLoading && searchTerm.length >= 2 && sugestoes.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Nenhuma pessoa encontrada
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CONFIRM PESSOA & PARENTESCO */}
        {step === "confirm" && pessoaSelecionada && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Avatar>
                <AvatarImage src={pessoaSelecionada.avatar_url} />
                <AvatarFallback>{pessoaSelecionada.nome.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{pessoaSelecionada.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {pessoaSelecionada.email || pessoaSelecionada.telefone}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentesco">Qual o parentesco dela com a família?</Label>
              <Select value={tipoParentesco} onValueChange={setTipoParentesco}>
                <SelectTrigger id="parentesco">
                  <SelectValue placeholder="Selecione o parentesco" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PARENTESCO_ADULTO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* STEP 3: SELECT KIDS */}
        {step === "select-kids" && pessoaSelecionada && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
              <span>
                <strong>{pessoaSelecionada.nome}</strong> poderá buscar:
              </span>
            </div>

            {criancas.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Nenhuma criança cadastrada
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {criancas.map((crianca) => (
                  <div
                    key={crianca.id}
                    className="flex items-center gap-3 p-2 rounded-lg border border-input"
                  >
                    <Checkbox
                      id={crianca.id}
                      checked={criancasSelecionadas.has(crianca.id)}
                      onCheckedChange={() => handleToggleCrianca(crianca.id)}
                    />
                    <label
                      htmlFor={crianca.id}
                      className="flex-1 cursor-pointer font-medium"
                    >
                      {crianca.nome}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        </div>
        <div className="border-t pt-4 px-6 pb-6 flex justify-end gap-2">
          {step !== "search" && (
            <Button variant="outline" onClick={handleVoltar}>
              Voltar
            </Button>
          )}

          {step === "search" && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          )}

          {step === "confirm" && (
            <Button onClick={handleConfirmarPessoa} disabled={!tipoParentesco}>
              Próximo
            </Button>
          )}

          {step === "select-kids" && (
            <Button
              onClick={handleVincular}
              disabled={criancasSelecionadas.size === 0 || vincularMutation.isPending}
            >
              {vincularMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vinculando...
                </>
              ) : (
                "Vincular"
              )}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
