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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import InputMask from "react-input-mask";
import { removerFormatacao } from "@/lib/validators";

const perfilSchema = z.object({
  telefone: z.string().max(20, "Telefone deve ter no máximo 20 caracteres").nullable(),
  necessidades_especiais: z.string().max(500, "Deve ter no máximo 500 caracteres").nullable(),
  batizado: z.boolean(),
  e_pastor: z.boolean(),
  e_lider: z.boolean(),
});

interface EditarPerfilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    telefone: string | null;
    necessidades_especiais: string | null;
    batizado: boolean | null;
    e_pastor: boolean | null;
    e_lider: boolean | null;
  };
  onSuccess: () => void;
}

export function EditarPerfilDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarPerfilDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    telefone: dadosAtuais.telefone || "",
    necessidades_especiais: dadosAtuais.necessidades_especiais || "",
    batizado: dadosAtuais.batizado || false,
    e_pastor: dadosAtuais.e_pastor || false,
    e_lider: dadosAtuais.e_lider || false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        telefone: dadosAtuais.telefone || "",
        necessidades_especiais: dadosAtuais.necessidades_especiais || "",
        batizado: dadosAtuais.batizado || false,
        e_pastor: dadosAtuais.e_pastor || false,
        e_lider: dadosAtuais.e_lider || false,
      });
    }
  }, [open, dadosAtuais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = perfilSchema.parse(formData);
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          telefone: validatedData.telefone ? removerFormatacao(validatedData.telefone) : null,
          necessidades_especiais: validatedData.necessidades_especiais || null,
          batizado: validatedData.batizado,
          e_pastor: validatedData.e_pastor,
          e_lider: validatedData.e_lider,
        })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados do perfil atualizados com sucesso",
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
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <InputMask
              mask="(99) 99999-9999"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
            >
              {(inputProps: any) => (
                <Input
                  {...inputProps}
                  id="telefone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                />
              )}
            </InputMask>
          </div>

          <div className="space-y-2">
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

          <div className="flex items-center gap-2">
            <Switch
              id="batizado"
              checked={formData.batizado}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, batizado: checked })
              }
            />
            <Label htmlFor="batizado">É batizado?</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="pastor"
              checked={formData.e_pastor}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, e_pastor: checked })
              }
            />
            <Label htmlFor="pastor">É pastor?</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="lider"
              checked={formData.e_lider}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, e_lider: checked })
              }
            />
            <Label htmlFor="lider">Faz parte da liderança?</Label>
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
