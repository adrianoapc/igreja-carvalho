import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdicionarDependenteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  parentProfileId: string;
}

export default function AdicionarDependenteDrawer({
  open,
  onOpenChange,
  onSuccess,
  parentProfileId,
}: AdicionarDependenteDrawerProps) {
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState<Date | undefined>();
  const [alergias, setAlergias] = useState("");
  const [sexo, setSexo] = useState("");

  const resetForm = () => {
    setNome("");
    setDataNascimento(undefined);
    setAlergias("");
    setSexo("");
  };

  const createDependentMutation = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) {
        throw new Error("Nome é obrigatório");
      }

      if (!dataNascimento) {
        throw new Error("Data de nascimento é obrigatória");
      }

      // 1. Get parent's familia_id
      const { data: parent, error: parentError } = await supabase
        .from('profiles')
        .select('familia_id, nome')
        .eq('id', parentProfileId)
        .single();

      if (parentError) throw parentError;

      let familiaId = parent.familia_id;

      // 2. If parent has no familia_id, generate a new UUID for the family group
      if (!familiaId) {
        // Generate a new UUID for the family group
        familiaId = crypto.randomUUID();

        // Update parent with familia_id
        const { error: updateParentError } = await supabase
          .from('profiles')
          .update({ 
            familia_id: familiaId,
            responsavel_legal: true 
          })
          .eq('id', parentProfileId);

        if (updateParentError) throw updateParentError;
      }

      // 3. Create the child profile
      const { data: childProfile, error: childError } = await supabase
        .from('profiles')
        .insert({
          nome: nome.trim(),
          data_nascimento: format(dataNascimento, 'yyyy-MM-dd'),
          alergias: alergias.trim() || null,
          sexo: sexo || null,
          familia_id: familiaId,
          status: 'membro', // Children are automatically members
          responsavel_legal: false,
        })
        .select()
        .single();

      if (childError) throw childError;

      // 4. Create family relationship record
      await supabase
        .from('familias')
        .insert({
          pessoa_id: parentProfileId,
          familiar_id: childProfile.id,
          tipo_parentesco: 'filho(a)',
        });

      return childProfile;
    },
    onSuccess: () => {
      toast.success("Dependente adicionado com sucesso!");
      resetForm();
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao adicionar dependente");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDependentMutation.mutate();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Novo Dependente</DrawerTitle>
            <DrawerDescription>
              Cadastre um filho para facilitar o check-in no ministério infantil
            </DrawerDescription>
          </DrawerHeader>

          <form onSubmit={handleSubmit} className="px-4 space-y-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo da criança"
                required
              />
            </div>

            {/* Data de Nascimento */}
            <div className="space-y-2">
              <Label>Data de Nascimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dataNascimento && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataNascimento ? (
                      format(dataNascimento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataNascimento}
                    onSelect={setDataNascimento}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1990-01-01")
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                    locale={ptBR}
                    captionLayout="dropdown-buttons"
                    fromYear={2005}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Sexo */}
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={sexo} onValueChange={setSexo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Alergias */}
            <div className="space-y-2">
              <Label htmlFor="alergias" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alergias / Restrições
              </Label>
              <Textarea
                id="alergias"
                value={alergias}
                onChange={(e) => setAlergias(e.target.value)}
                placeholder="Ex: Alergia a amendoim, lactose..."
                className="border-destructive/50 focus-visible:ring-destructive/50"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Informações importantes para segurança da criança
              </p>
            </div>
          </form>

          <DrawerFooter className="pt-6">
            <Button
              onClick={handleSubmit}
              disabled={createDependentMutation.isPending || !nome.trim() || !dataNascimento}
              className="w-full"
            >
              {createDependentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Dependente"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              className="w-full"
            >
              Cancelar
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
