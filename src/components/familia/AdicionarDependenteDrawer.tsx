import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// Arrays para os selects de data
const dias = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const meses = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];
const currentYear = new Date().getFullYear();
const anos = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => (currentYear - i).toString());

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
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [alergias, setAlergias] = useState("");
  const [sexo, setSexo] = useState("");
  const [tipoParentesco, setTipoParentesco] = useState("filho");

  const resetForm = () => {
    setNome("");
    setDia("");
    setMes("");
    setAno("");
    setAlergias("");
    setSexo("");
    setTipoParentesco("filho");
  };

  const createDependentMutation = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) {
        throw new Error("Nome é obrigatório");
      }

      if (!dia || !mes || !ano) {
        throw new Error("Data de nascimento completa é obrigatória");
      }

      // Validar data
      const diaNum = parseInt(dia);
      const mesNum = parseInt(mes);
      const anoNum = parseInt(ano);

      if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12 || anoNum < 1920 || anoNum > new Date().getFullYear()) {
        throw new Error("Data de nascimento inválida");
      }

      const dataNascimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

      // 1. Create the child profile (without familia_id - relationships are managed via familias table)
      const { data: childProfile, error: childError } = await supabase
        .from('profiles')
        .insert({
          nome: nome.trim(),
          data_nascimento: dataNascimento,
          alergias: alergias.trim() || null,
          sexo: sexo || null,
          status: 'membro',
          responsavel_legal: false,
        })
        .select()
        .single();

      if (childError) throw childError;

      // 2. Create family relationship record in familias table
      const { error: relError } = await supabase
        .from('familias')
        .insert({
          pessoa_id: parentProfileId,
          familiar_id: childProfile.id,
          tipo_parentesco: tipoParentesco,
        });

      if (relError) throw relError;

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
            <DrawerTitle>Novo Familiar</DrawerTitle>
            <DrawerDescription>
              Cadastre um familiar ou dependente
            </DrawerDescription>
          </DrawerHeader>

          <form onSubmit={handleSubmit} className="px-4 space-y-4">
            {/* Tipo de Parentesco */}
            <div className="space-y-2">
              <Label>Tipo de Parentesco *</Label>
              <Select value={tipoParentesco} onValueChange={setTipoParentesco}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o parentesco" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filho">Filho(a)</SelectItem>
                  <SelectItem value="conjuge">Cônjuge</SelectItem>
                  <SelectItem value="pai">Pai</SelectItem>
                  <SelectItem value="mae">Mãe</SelectItem>
                  <SelectItem value="irmao">Irmão(ã)</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                required
              />
            </div>

            {/* Data de Nascimento */}
            <div className="space-y-2">
              <Label>Data de Nascimento *</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={dia} onValueChange={setDia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {dias.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={ano} onValueChange={setAno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                Informações importantes de saúde
              </p>
            </div>
          </form>

          <DrawerFooter className="pt-6">
            <Button
              onClick={handleSubmit}
              disabled={createDependentMutation.isPending || !nome.trim() || !dia || !mes || !ano}
              className="w-full"
            >
              {createDependentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Familiar"
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
