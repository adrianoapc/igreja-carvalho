import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2 } from "lucide-react";
import { useCepAutocomplete } from "@/hooks/useCepAutocomplete";
import InputMask from "react-input-mask";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CompletarCadastroInscritoDialogProps {
  pessoaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormData {
  nome: string;
  telefone: string;
  email: string;
  sexo: string;
  data_nascimento: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const INITIAL_FORM: FormData = {
  nome: "",
  telefone: "",
  email: "",
  sexo: "",
  data_nascimento: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

export function CompletarCadastroInscritoDialog({
  pessoaId,
  open,
  onOpenChange,
  onSuccess,
}: CompletarCadastroInscritoDialogProps) {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { buscarCep, loading: cepLoading } = useCepAutocomplete();

  useEffect(() => {
    if (open && pessoaId) {
      loadPessoa();
    } else if (!open) {
      setForm(INITIAL_FORM);
    }
  }, [open, pessoaId]);

  const loadPessoa = async () => {
    if (!pessoaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome, telefone, email, sexo, data_nascimento, cep, endereco, numero, complemento, bairro, cidade, estado")
        .eq("id", pessoaId)
        .single();

      if (error) throw error;
      if (data) {
        setForm({
          nome: data.nome || "",
          telefone: data.telefone || "",
          email: data.email || "",
          sexo: data.sexo || "",
          data_nascimento: data.data_nascimento || "",
          cep: data.cep || "",
          endereco: data.endereco || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          cidade: data.cidade || "",
          estado: data.estado || "",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados da pessoa");
    } finally {
      setLoading(false);
    }
  };

  const handleCepChange = async (cep: string) => {
    setForm((prev) => ({ ...prev, cep }));
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      const data = await buscarCep(cep);
      if (data) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    }
  };

  const handleSave = async () => {
    if (!pessoaId) return;
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, string | null> = {
        nome: form.nome.trim(),
        telefone: form.telefone.replace(/\D/g, "") || null,
        email: form.email.trim() || null,
        sexo: form.sexo || null,
        data_nascimento: form.data_nascimento || null,
        cep: form.cep.replace(/\D/g, "") || null,
        endereco: form.endereco.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", pessoaId);

      if (error) throw error;

      toast.success("Cadastro atualizado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar dados");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      dialogContentProps={{ className: "max-w-lg max-h-[90vh]" }}
    >
      <ScrollArea className="max-h-[80vh] px-6 py-4">
        <h2 className="text-lg font-semibold mb-4">Completar Cadastro</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Dados Pessoais
              </h3>

              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => update("nome", e.target.value)}
                  placeholder="Nome completo"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <InputMask
                    mask="(99) 99999-9999"
                    value={form.telefone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("telefone", e.target.value)}
                  >
                    {(inputProps: React.InputHTMLAttributes<HTMLInputElement>) => (
                      <Input {...inputProps} placeholder="(00) 00000-0000" />
                    )}
                  </InputMask>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Sexo</Label>
                  <Select value={form.sexo} onValueChange={(v) => update("sexo", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={form.data_nascimento}
                    onChange={(e) => update("data_nascimento", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Endereço
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input
                      value={form.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {cepLoading && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) => update("cidade", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                   <Label>UF</Label>
                  <Input
                    value={form.estado}
                    onChange={(e) => update("estado", e.target.value)}
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={form.bairro}
                  onChange={(e) => update("bairro", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={form.endereco}
                    onChange={(e) => update("endereco", e.target.value)}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={form.numero}
                    onChange={(e) => update("numero", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input
                  value={form.complemento}
                  onChange={(e) => update("complemento", e.target.value)}
                  placeholder="Apto, Bloco..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 pb-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </ScrollArea>
    </ResponsiveDialog>
  );
}
