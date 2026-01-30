import { useState, useEffect, type InputHTMLAttributes } from "react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
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

// Generate years from 1920 to current year
const anoAtual = new Date().getFullYear();
const anos = Array.from(
  { length: anoAtual - 1920 + 1 },
  (_, i) => (anoAtual - i).toString()
);

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

// Helper to parse existing date
const parseDateParts = (dateStr: string | null) => {
  if (!dateStr) return { dia: "", mes: "", ano: "" };
  const [year, month, day] = dateStr.split("-");
  return {
    dia: day || "",
    mes: month || "",
    ano: year === "1900" ? "" : year || "",
  };
};

export function EditarDadosPessoaisDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarDadosPessoaisDialogProps) {
  const [loading, setLoading] = useState(false);
  
  const dateParts = parseDateParts(dadosAtuais.data_nascimento);
  
  const [formData, setFormData] = useState({
    sexo: dadosAtuais.sexo || "",
    dia_nascimento: dateParts.dia,
    mes_nascimento: dateParts.mes,
    ano_nascimento: dateParts.ano,
    estado_civil: dadosAtuais.estado_civil || "",
    data_casamento: dadosAtuais.data_casamento || "",
    rg: dadosAtuais.rg || "",
    cpf: dadosAtuais.cpf || "",
    necessidades_especiais: dadosAtuais.necessidades_especiais || "",
  });
  const { toast } = useToast();

  const dias = Array.from({ length: 31 }, (_, i) =>
    (i + 1).toString().padStart(2, "0")
  );
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

  useEffect(() => {
    if (open) {
      const parts = parseDateParts(dadosAtuais.data_nascimento);
      setFormData({
        sexo: dadosAtuais.sexo || "",
        dia_nascimento: parts.dia,
        mes_nascimento: parts.mes,
        ano_nascimento: parts.ano,
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
      // Build data_nascimento from parts
      let dataNascimento = null;
      if (formData.dia_nascimento && formData.mes_nascimento) {
        const ano = formData.ano_nascimento || "1900";
        dataNascimento = `${ano}-${formData.mes_nascimento}-${formData.dia_nascimento}`;
      }

      const validatedData = dadosPessoaisSchema.parse({
        ...formData,
        data_nascimento: dataNascimento,
      });
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
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.issues[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : String(error) || "Não foi possível atualizar os dados",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col h-full">
        <div className="border-b pb-3 px-4 pt-4 md:px-6 md:pt-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Editar Dados Pessoais</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 space-y-4">
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
              <Label>Data de Nascimento</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={formData.dia_nascimento}
                  onValueChange={(value) =>
                    setFormData({ ...formData, dia_nascimento: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Dia" />
                  </SelectTrigger>
                  <SelectContent>
                    {dias.map((dia) => (
                      <SelectItem key={dia} value={dia}>
                        {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={formData.mes_nascimento}
                  onValueChange={(value) =>
                    setFormData({ ...formData, mes_nascimento: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={formData.ano_nascimento}
                  onValueChange={(value) =>
                    setFormData({ ...formData, ano_nascimento: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ano (opc.)" />
                  </SelectTrigger>
                  <SelectContent>
                    {anos.map((ano) => (
                      <SelectItem key={ano} value={ano}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                {(inputProps: InputHTMLAttributes<HTMLInputElement>) => (
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

          </div>

          <div className="border-t bg-muted/50 px-4 py-3 md:px-6 flex gap-2 justify-end">
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
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
