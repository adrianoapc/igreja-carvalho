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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const contatosSchema = z.object({
  cep: z.string().max(10).nullable(),
  cidade: z.string().max(100).nullable(),
  bairro: z.string().max(100).nullable(),
  estado: z.string().max(2).nullable(),
  endereco: z.string().max(255).nullable(),
  email: z.string().email("Email inválido").max(255).nullable().or(z.literal("")),
  telefone: z.string().max(20).nullable(),
});

interface EditarContatosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoaId: string;
  dadosAtuais: {
    cep: string | null;
    cidade: string | null;
    bairro: string | null;
    estado: string | null;
    endereco: string | null;
    email: string | null;
    telefone: string | null;
  };
  onSuccess: () => void;
}

export function EditarContatosDialog({
  open,
  onOpenChange,
  pessoaId,
  dadosAtuais,
  onSuccess,
}: EditarContatosDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cep: dadosAtuais.cep || "",
    cidade: dadosAtuais.cidade || "",
    bairro: dadosAtuais.bairro || "",
    estado: dadosAtuais.estado || "",
    endereco: dadosAtuais.endereco || "",
    email: dadosAtuais.email || "",
    telefone: dadosAtuais.telefone || "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        cep: dadosAtuais.cep || "",
        cidade: dadosAtuais.cidade || "",
        bairro: dadosAtuais.bairro || "",
        estado: dadosAtuais.estado || "",
        endereco: dadosAtuais.endereco || "",
        email: dadosAtuais.email || "",
        telefone: dadosAtuais.telefone || "",
      });
    }
  }, [open, dadosAtuais]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = contatosSchema.parse(formData);
      setLoading(true);

      const { error } = await supabase
        .from("profiles")
        .update({
          cep: validatedData.cep || null,
          cidade: validatedData.cidade || null,
          bairro: validatedData.bairro || null,
          estado: validatedData.estado || null,
          endereco: validatedData.endereco || null,
          email: validatedData.email || null,
          telefone: validatedData.telefone || null,
        })
        .eq("id", pessoaId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados de contato atualizados com sucesso",
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
          <DialogTitle>Editar Contatos</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) =>
                  setFormData({ ...formData, cep: e.target.value })
                }
                maxLength={10}
                placeholder="00000-000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) =>
                  setFormData({ ...formData, cidade: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) =>
                  setFormData({ ...formData, bairro: e.target.value })
                }
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input
                id="estado"
                value={formData.estado}
                onChange={(e) =>
                  setFormData({ ...formData, estado: e.target.value })
                }
                maxLength={2}
                placeholder="SP"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={formData.endereco}
                onChange={(e) =>
                  setFormData({ ...formData, endereco: e.target.value })
                }
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Celular</Label>
              <Input
                id="telefone"
                type="tel"
                value={formData.telefone}
                onChange={(e) =>
                  setFormData({ ...formData, telefone: e.target.value })
                }
                maxLength={20}
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
