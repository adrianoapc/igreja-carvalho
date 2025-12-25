import { useState, useEffect } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

interface AdicionarFamiliarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  pessoaNome: string;
  onSuccess: () => void;
}

interface PessoaSugestao {
  id: string;
  nome: string;
  status: string;
}

const TIPOS_PARENTESCO = [
  { value: "conjuge", label: "Cônjuge" },
  { value: "filho", label: "Filho(a)" },
  { value: "pai", label: "Pai" },
  { value: "mae", label: "Mãe" },
  { value: "irmao", label: "Irmão(ã)" },
  { value: "avo", label: "Avô(ó)" },
  { value: "neto", label: "Neto(a)" },
  { value: "tio", label: "Tio(a)" },
  { value: "sobrinho", label: "Sobrinho(a)" },
  { value: "primo", label: "Primo(a)" },
  { value: "outro", label: "Outro" },
];

export function AdicionarFamiliarDialog({
  open,
  onOpenChange,
  pessoaId,
  pessoaNome,
  onSuccess,
}: AdicionarFamiliarDialogProps) {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sugestoes, setSugestoes] = useState<PessoaSugestao[]>([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState<PessoaSugestao | null>(null);
  const [nomeFamiliar, setNomeFamiliar] = useState("");
  const [tipoParentesco, setTipoParentesco] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const { toast } = useToast();

  // Buscar sugestões quando o usuário digitar
  useEffect(() => {
    const buscarPessoas = async () => {
      if (searchTerm.length < 2) {
        setSugestoes([]);
        return;
      }

      setSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nome, status")
          .ilike("nome", `%${searchTerm}%`)
          .neq("id", pessoaId)
          .limit(5);

        if (error) throw error;
        setSugestoes(data || []);
      } catch (error) {
        console.error("Erro ao buscar pessoas:", error);
      } finally {
        setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(buscarPessoas, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, pessoaId]);

  const handleSelecionarPessoa = (pessoa: PessoaSugestao) => {
    setPessoaSelecionada(pessoa);
    setSearchTerm(pessoa.nome);
    setSugestoes([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tipoParentesco) {
      toast({
        title: "Erro",
        description: "Selecione o tipo de parentesco",
        variant: "destructive",
      });
      return;
    }

    if (!pessoaSelecionada && !nomeFamiliar.trim()) {
      toast({
        title: "Erro",
        description: "Digite o nome do familiar ou selecione uma pessoa cadastrada",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("familias").insert({
        pessoa_id: pessoaId,
        familiar_id: pessoaSelecionada?.id || null,
        nome_familiar: pessoaSelecionada ? null : nomeFamiliar.trim(),
        tipo_parentesco: tipoParentesco,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Familiar adicionado com sucesso",
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Erro ao adicionar familiar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o familiar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setSugestoes([]);
    setPessoaSelecionada(null);
    setNomeFamiliar("");
    setTipoParentesco("");
    onOpenChange(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPessoaSelecionada(null);
    setNomeFamiliar(value);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Adicionar Familiar</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
          <div className="space-y-2">
            <Label>Membro Principal</Label>
            <Input value={pessoaNome} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome-familiar">Nome do Familiar</Label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="nome-familiar"
                  placeholder="Digite para buscar pessoa cadastrada ou nome do familiar"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {sugestoes.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                  {sugestoes.map((pessoa) => (
                    <button
                      key={pessoa.id}
                      type="button"
                      onClick={() => handleSelecionarPessoa(pessoa)}
                      className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium">{pessoa.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {pessoa.status === "membro" ? "Membro" : 
                         pessoa.status === "frequentador" ? "Frequentador" : "Visitante"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {pessoaSelecionada && (
                <p className="text-xs text-muted-foreground mt-1">
                  ✓ Pessoa cadastrada selecionada
                </p>
              )}
              {!pessoaSelecionada && searchTerm && sugestoes.length === 0 && !searchLoading && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nome será cadastrado como texto
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo-parentesco">Tipo de Parentesco</Label>
            <Select value={tipoParentesco} onValueChange={setTipoParentesco}>
              <SelectTrigger id="tipo-parentesco">
                <SelectValue placeholder="Selecione o parentesco" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PARENTESCO.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          </div>

          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
