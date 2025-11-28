import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import InputMask from "react-input-mask";
import { validarCPF, removerFormatacao } from "@/lib/validators";

const dadosPessoaisSchema = z.object({
  sexo: z.string().max(20).nullable(),
  data_nascimento: z.string().nullable(),
  estado_civil: z.string().max(50).nullable(),
  data_casamento: z.string().nullable(),
  rg: z.string().max(20).nullable(),
  cpf: z
    .string()
    .nullable()
    .refine(
      (val) => {
        if (!val || val.trim() === "" || val.replace(/\D/g, "") === "") return true;
        return validarCPF(val);
      },
      { message: "CPF inválido" }
    ),
  necessidades_especiais: z.string().max(500).nullable(),
});

interface EditarDadosPessoaisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    sexo: string | null;
    data_nascimento: string | null;
    estado_civil: string | null;
    data_casamento: string | null;
    rg: string | null;
    cpf: string | null;
    necessidades_especiais: string | null;
  };
  onSuccess: () => void;
}

export function EditarDadosPessoaisDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarDadosPessoaisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sexo: dadosAtuais.sexo || "",
    data_nascimento: dadosAtuais.data_nascimento || "",
    estado_civil: dadosAtuais.estado_civil || "",
    data_casamento: dadosAtuais.data_casamento || "",
    rg: dadosAtuais.rg || "",
    cpf: dadosAtuais.cpf || "",
    necessidades_especiais: dadosAtuais.necessidades_especiais || "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        sexo: dadosAtuais.sexo || "",
        data_nascimento: dadosAtuais.data_nascimento || "",
        estado_civil: dadosAtuais.estado_civil || "",
        data_casamento: dadosAtuais.data_casamento || "",
        rg: dadosAtuais.rg || "",
        cpf: dadosAtuais.cpf || "",
        necessidades_especiais: dadosAtuais.necessidades_especiais || "",
      });
    }
  }, [open, dadosAtuais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = dadosPessoaisSchema.parse(formData);
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          sexo: validatedData.sexo || null,
          data_nascimento: validatedData.data_nascimento || null,
          estado_civil: validatedData.estado_civil || null,
          data_casamento: validatedData.data_casamento || null,
          rg: validatedData.rg || null,
          cpf: validatedData.cpf ? removerFormatacao(validatedData.cpf) : null,
          necessidades_especiais: validatedData.necessidades_especiais || null,
        })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados pessoais atualizados com sucesso",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.issues[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.message || "Não foi possível atualizar os dados",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Dados Pessoais</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo</Label>
              <Select
                value={formData.sexo}
                onValueChange={(value) =>
                  setFormData({ ...formData, sexo: value })
                }
              >
                <SelectTrigger id="sexo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) =>
                  setFormData({ ...formData, data_nascimento: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estadoCivil">Estado Civil</Label>
              <Select
                value={formData.estado_civil}
                onValueChange={(value) =>
                  setFormData({ ...formData, estado_civil: value })
                }
              >
                <SelectTrigger id="estadoCivil">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                  <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                  <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                  <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataCasamento">Data de Casamento</Label>
              <Input
                id="dataCasamento"
                type="date"
                value={formData.data_casamento}
                onChange={(e) =>
                  setFormData({ ...formData, data_casamento: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rg">RG</Label>
              <Input
                id="rg"
                value={formData.rg}
                onChange={(e) =>
                  setFormData({ ...formData, rg: e.target.value })
                }
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <InputMask
                mask="999.999.999-99"
                value={formData.cpf}
                onChange={(e) =>
                  setFormData({ ...formData, cpf: e.target.value })
                }
              >
                {(inputProps: any) => (
                  <Input
                    {...inputProps}
                    id="cpf"
                    placeholder="000.000.000-00"
                  />
                )}
              </InputMask>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="necessidades">Necessidades especiais</Label>
              <Input
                id="necessidades"
                value={formData.necessidades_especiais}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    necessidades_especiais: e.target.value,
                  })
                }
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
