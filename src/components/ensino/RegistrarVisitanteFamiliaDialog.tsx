import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  CalendarIcon, 
  Loader2, 
  Plus, 
  Trash2, 
  User, 
  Phone, 
  Baby,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Child {
  id: string;
  nome: string;
  dataNascimento: Date | undefined;
  alergias: string;
}

interface RegistrarVisitanteFamiliaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (criancasIds: string[]) => void;
}

export default function RegistrarVisitanteFamiliaDialog({
  open,
  onOpenChange,
  onSuccess,
}: RegistrarVisitanteFamiliaDialogProps) {
  // Block 1: Parent
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [telefoneResponsavel, setTelefoneResponsavel] = useState("");
  
  // Block 2: Children
  const [criancas, setCriancas] = useState<Child[]>([
    { id: crypto.randomUUID(), nome: "", dataNascimento: undefined, alergias: "" }
  ]);

  const resetForm = () => {
    setNomeResponsavel("");
    setTelefoneResponsavel("");
    setCriancas([{ id: crypto.randomUUID(), nome: "", dataNascimento: undefined, alergias: "" }]);
  };

  const addCrianca = () => {
    setCriancas([
      ...criancas,
      { id: crypto.randomUUID(), nome: "", dataNascimento: undefined, alergias: "" }
    ]);
  };

  const removeCrianca = (id: string) => {
    if (criancas.length > 1) {
      setCriancas(criancas.filter(c => c.id !== id));
    }
  };

  const updateCrianca = (id: string, field: keyof Child, value: string | Date | undefined) => {
    setCriancas(criancas.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const createFamilyMutation = useMutation({
    mutationFn: async () => {
      if (!nomeResponsavel.trim()) {
        throw new Error("Nome do responsável é obrigatório");
      }

      const validCriancas = criancas.filter(c => c.nome.trim() && c.dataNascimento);
      if (validCriancas.length === 0) {
        throw new Error("Adicione pelo menos uma criança com nome e data de nascimento");
      }

      // 1. Create the parent profile
      const nameParts = nomeResponsavel.trim().split(' ');
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

      // 2. Create family first
      const { data: familia, error: familiaError } = await supabase
        .from('familias')
        .insert({
          pessoa_id: crypto.randomUUID(), // Temporary, will update
          tipo_parentesco: 'responsavel',
          nome_familiar: `Família ${lastName}`
        })
        .select()
        .single();

      if (familiaError) throw familiaError;

      // 3. Create parent profile
      const { data: parentProfile, error: parentError } = await supabase
        .from('profiles')
        .insert({
          nome: nomeResponsavel.trim(),
          telefone: telefoneResponsavel.replace(/\D/g, '') || null,
          status: 'visitante' as const,
          familia_id: familia.id,
          responsavel_legal: true,
        })
        .select()
        .single();

      if (parentError) throw parentError;

      // 4. Update familia with correct pessoa_id
      await supabase
        .from('familias')
        .update({ pessoa_id: parentProfile.id })
        .eq('id', familia.id);

      // 5. Create children profiles
      const criancasToInsert = validCriancas.map(c => ({
        nome: c.nome.trim(),
        data_nascimento: format(c.dataNascimento!, 'yyyy-MM-dd'),
        alergias: c.alergias.trim() || null,
        status: 'visitante' as const,
        familia_id: familia.id,
        responsavel_legal: false,
      }));

      const { data: childrenProfiles, error: childrenError } = await supabase
        .from('profiles')
        .insert(criancasToInsert)
        .select();

      if (childrenError) throw childrenError;

      return {
        familia,
        parent: parentProfile,
        children: childrenProfiles || []
      };
    },
    onSuccess: (data) => {
      toast.success(`Família cadastrada! ${data.children.length} criança(s) registrada(s).`);
      const criancasIds = data.children.map(c => c.id);
      resetForm();
      onSuccess(criancasIds);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao cadastrar família");
    },
  });

  const canSubmit = () => {
    if (!nomeResponsavel.trim()) return false;
    const validCriancas = criancas.filter(c => c.nome.trim() && c.dataNascimento);
    return validCriancas.length > 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Baby className="w-5 h-5 text-primary" />
            Cadastro Rápido - Visitante
          </DialogTitle>
          <DialogDescription>
            Cadastre o responsável e as crianças para o check-in
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Block 1: Parent */}
          <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <User className="w-4 h-4 text-primary" />
              Responsável (Pai/Mãe)
            </div>
            
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nomeResponsavel" className="text-xs">Nome Completo *</Label>
                <Input
                  id="nomeResponsavel"
                  value={nomeResponsavel}
                  onChange={(e) => setNomeResponsavel(e.target.value)}
                  placeholder="Nome do responsável"
                  className="h-9"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-xs flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Celular (WhatsApp)
                </Label>
                <Input
                  id="telefone"
                  value={telefoneResponsavel}
                  onChange={(e) => setTelefoneResponsavel(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="h-9"
                  maxLength={15}
                />
              </div>
            </div>
          </div>

          {/* Block 2: Children */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Baby className="w-4 h-4 text-pink-500" />
                Crianças
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCrianca}
                className="gap-1 h-8 text-xs"
              >
                <Plus className="w-3 h-3" />
                Criança
              </Button>
            </div>

            <div className="space-y-3">
              {criancas.map((crianca, index) => (
                <div
                  key={crianca.id}
                  className="p-3 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Criança {index + 1}
                    </span>
                    {criancas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeCrianca(crianca.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Input
                      value={crianca.nome}
                      onChange={(e) => updateCrianca(crianca.id, 'nome', e.target.value)}
                      placeholder="Nome da criança *"
                      className="h-9"
                    />
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-9 justify-start text-left font-normal",
                            !crianca.dataNascimento && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {crianca.dataNascimento ? (
                            format(crianca.dataNascimento, "dd/MM/yyyy")
                          ) : (
                            <span className="text-xs">Data de nascimento *</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={crianca.dataNascimento}
                          onSelect={(date) => updateCrianca(crianca.id, 'dataNascimento', date)}
                          disabled={(date) =>
                            date > new Date() || date < new Date("2005-01-01")
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

                    <div className="relative">
                      <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-destructive" />
                      <Input
                        value={crianca.alergias}
                        onChange={(e) => updateCrianca(crianca.id, 'alergias', e.target.value)}
                        placeholder="Alergias / Restrições"
                        className="h-9 pl-8 border-destructive/30 focus-visible:ring-destructive/30"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={createFamilyMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => createFamilyMutation.mutate()}
            disabled={createFamilyMutation.isPending || !canSubmit()}
            className="gap-2"
          >
            {createFamilyMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Salvar e Check-in
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
