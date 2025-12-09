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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const dadosAdicionaisSchema = z.object({
  escolaridade: z.string().max(100).nullable(),
  profissao: z.string().max(100).nullable(),
  nacionalidade: z.string().max(100).nullable(),
  naturalidade: z.string().max(100).nullable(),
  entrevistado_por: z.string().max(100).nullable(),
  cadastrado_por: z.string().max(100).nullable(),
  tipo_sanguineo: z.string().max(10).nullable(),
  alergias: z.string().max(500).nullable(),
  necessidades_especiais: z.string().max(500).nullable(),
  observacoes: z.string().max(1000).nullable(),
});

interface EditarDadosAdicionaisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    escolaridade: string | null;
    profissao: string | null;
    nacionalidade: string | null;
    naturalidade: string | null;
    entrevistado_por: string | null;
    cadastrado_por: string | null;
    tipo_sanguineo: string | null;
    alergias: string | null;
    necessidades_especiais: string | null;
    observacoes: string | null;
  };
  onSuccess: () => void;
}

export function EditarDadosAdicionaisDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarDadosAdicionaisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    escolaridade: dadosAtuais.escolaridade || "",
    profissao: dadosAtuais.profissao || "",
    nacionalidade: dadosAtuais.nacionalidade || "",
    naturalidade: dadosAtuais.naturalidade || "",
    entrevistado_por: dadosAtuais.entrevistado_por || "",
    cadastrado_por: dadosAtuais.cadastrado_por || "",
    tipo_sanguineo: dadosAtuais.tipo_sanguineo || "",
    alergias: dadosAtuais.alergias || "",
    necessidades_especiais: dadosAtuais.necessidades_especiais || "",
    observacoes: dadosAtuais.observacoes || "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        escolaridade: dadosAtuais.escolaridade || "",
        profissao: dadosAtuais.profissao || "",
        nacionalidade: dadosAtuais.nacionalidade || "",
        naturalidade: dadosAtuais.naturalidade || "",
        entrevistado_por: dadosAtuais.entrevistado_por || "",
        cadastrado_por: dadosAtuais.cadastrado_por || "",
        tipo_sanguineo: dadosAtuais.tipo_sanguineo || "",
        alergias: dadosAtuais.alergias || "",
        necessidades_especiais: dadosAtuais.necessidades_especiais || "",
        observacoes: dadosAtuais.observacoes || "",
      });
    }
  }, [open, dadosAtuais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = dadosAdicionaisSchema.parse(formData);
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          escolaridade: validatedData.escolaridade || null,
          profissao: validatedData.profissao || null,
          nacionalidade: validatedData.nacionalidade || null,
          naturalidade: validatedData.naturalidade || null,
          entrevistado_por: validatedData.entrevistado_por || null,
          cadastrado_por: validatedData.cadastrado_por || null,
          tipo_sanguineo: validatedData.tipo_sanguineo || null,
          alergias: validatedData.alergias || null,
          necessidades_especiais: validatedData.necessidades_especiais || null,
          observacoes: validatedData.observacoes || null,
        })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados adicionais atualizados com sucesso",
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
          <DialogTitle>Editar Dados Adicionais</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="escolaridade">Escolaridade</Label>
              <Input
                id="escolaridade"
                value={formData.escolaridade}
                onChange={(e) =>
                  setFormData({ ...formData, escolaridade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profissao">Profissão</Label>
              <Input
                id="profissao"
                value={formData.profissao}
                onChange={(e) =>
                  setFormData({ ...formData, profissao: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nacionalidade">Nacionalidade</Label>
              <Input
                id="nacionalidade"
                value={formData.nacionalidade}
                onChange={(e) =>
                  setFormData({ ...formData, nacionalidade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="naturalidade">Naturalidade</Label>
              <Input
                id="naturalidade"
                value={formData.naturalidade}
                onChange={(e) =>
                  setFormData({ ...formData, naturalidade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entrevistadoPor">Entrevistado por</Label>
              <Input
                id="entrevistadoPor"
                value={formData.entrevistado_por}
                onChange={(e) =>
                  setFormData({ ...formData, entrevistado_por: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cadastradoPor">Cadastrado por</Label>
              <Input
                id="cadastradoPor"
                value={formData.cadastrado_por}
                onChange={(e) =>
                  setFormData({ ...formData, cadastrado_por: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoSanguineo">Tipo Sanguíneo</Label>
              <Input
                id="tipoSanguineo"
                value={formData.tipo_sanguineo}
                onChange={(e) =>
                  setFormData({ ...formData, tipo_sanguineo: e.target.value })
                }
                maxLength={10}
                placeholder="Ex: O+"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="alergias">Alergias</Label>
              <Textarea
                id="alergias"
                value={formData.alergias}
                onChange={(e) =>
                  setFormData({ ...formData, alergias: e.target.value })
                }
                maxLength={500}
                placeholder="Descreva alergias alimentares, medicamentosas ou outras"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="necessidadesEspeciais">Necessidades Especiais</Label>
              <Textarea
                id="necessidadesEspeciais"
                value={formData.necessidades_especiais}
                onChange={(e) =>
                  setFormData({ ...formData, necessidades_especiais: e.target.value })
                }
                maxLength={500}
                placeholder="Descreva necessidades especiais de acessibilidade, mobilidade ou outras"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) =>
                  setFormData({ ...formData, observacoes: e.target.value })
                }
                maxLength={1000}
                placeholder="Informações adicionais sobre a pessoa"
                className="min-h-[100px]"
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
